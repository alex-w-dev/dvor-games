#!/usr/bin/env node
/**
 * Build (optional) + zip dist + POST release to Dvor API.
 * Run from a game package directory (cwd = games/<name>).
 *
 * Env (repo root .env):
 *   DVOR_API_KEY   required
 *   DVOR_API_URL   default https://dvor-play.ru/main-api
 *   DVOR_SUBMIT    default true
 *   DVOR_VERSION   else package.json#version (required, digits+dots)
 *   DVOR_SKIP_BUILD  if "true", skip pnpm run build
 *   DVOR_CARD_ONLY   if "true", no build/zip — media/card only
 *   DVOR_ICON / DVOR_COVER / DVOR_COVER_SHOWCASE — override dvor.* paths
 *
 * package.json#dvor:
 *   slug (required), icon, cover, coverShowcase, screenshots[{path,device}], card
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "./load-env.mjs";

const require = createRequire(import.meta.url);

const VERSION_LABEL_RE =
  /^(0|[1-9]\d{0,3})(\.(0|[1-9]\d{0,3})){1,3}$/;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const deployPkgRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(deployPkgRoot, "../..");
const gameRoot = process.cwd();

loadEnvFile(path.join(repoRoot, ".env"));
loadEnvFile(path.join(gameRoot, ".env"));

const pkgPath = path.join(gameRoot, "package.json");
if (!existsSync(pkgPath)) {
  console.error("package.json not found in", gameRoot);
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const dvor = pkg.dvor && typeof pkg.dvor === "object" ? pkg.dvor : {};
const slug = dvor.slug;
if (!slug || typeof slug !== "string") {
  console.error('package.json must have dvor.slug (e.g. "hello")');
  process.exit(1);
}

const apiUrl = (
  process.env.DVOR_API_URL ||
  "https://dvor-play.ru/main-api"
).replace(/\/$/, "");
const apiKey = process.env.DVOR_API_KEY || "";
const submit = process.env.DVOR_SUBMIT !== "false";
const cardOnly = process.env.DVOR_CARD_ONLY === "true";
const skipBuild = process.env.DVOR_SKIP_BUILD === "true" || cardOnly;

const pkgVersion =
  typeof pkg.version === "string" && pkg.version.trim()
    ? pkg.version.trim()
    : "";
const version = (process.env.DVOR_VERSION || pkgVersion).trim();

if (!apiKey) {
  console.error(
    "DVOR_API_KEY is required (root .env — see .env.example)",
  );
  process.exit(1);
}

if (!version) {
  console.error(
    "version is required: set package.json#version or DVOR_VERSION (e.g. 0.1.2)",
  );
  process.exit(1);
}
if (version.length < 3 || version.length > 16 || !VERSION_LABEL_RE.test(version)) {
  console.error(
    `invalid version "${version}": digits separated by single dots, 2–4 segments, length 3…16 (e.g. 1.0 or 0.1.1)`,
  );
  process.exit(1);
}

function resolveMediaPath(raw) {
  if (!raw || typeof raw !== "string" || !raw.trim()) return null;
  const abs = path.isAbsolute(raw)
    ? raw
    : path.resolve(gameRoot, raw.trim());
  if (!existsSync(abs)) {
    console.error("media file not found:", abs);
    process.exit(1);
  }
  return abs;
}

const iconPath = resolveMediaPath(
  process.env.DVOR_ICON || dvor.icon,
);
const coverPath = resolveMediaPath(
  process.env.DVOR_COVER || dvor.cover,
);
const coverShowcasePath = resolveMediaPath(
  process.env.DVOR_COVER_SHOWCASE || dvor.coverShowcase,
);

/** @type {{ path: string, device: "mobile"|"desktop" }[]} */
const screenshots = [];
if (Array.isArray(dvor.screenshots)) {
  for (let i = 0; i < dvor.screenshots.length; i += 1) {
    const item = dvor.screenshots[i];
    if (!item || typeof item !== "object") {
      console.error(`dvor.screenshots[${i}] must be { path, device }`);
      process.exit(1);
    }
    const shotPath = resolveMediaPath(item.path);
    const device = item.device;
    if (device !== "mobile" && device !== "desktop") {
      console.error(
        `dvor.screenshots[${i}].device must be mobile|desktop`,
      );
      process.exit(1);
    }
    screenshots.push({ path: shotPath, device });
  }
}

const hasCard =
  dvor.card != null &&
  typeof dvor.card === "object" &&
  !Array.isArray(dvor.card);
const hasMedia =
  !!(iconPath || coverPath || coverShowcasePath || screenshots.length);

if (cardOnly && !hasCard && !hasMedia) {
  console.error(
    "DVOR_CARD_ONLY=true requires dvor.card and/or media (icon/cover/…)",
  );
  process.exit(1);
}

let zipPath = null;
if (!cardOnly) {
  if (!skipBuild) {
    console.log("==> build");
    execSync("pnpm run build", { cwd: gameRoot, stdio: "inherit" });
  }

  const distDir = path.join(gameRoot, "dist");
  if (!existsSync(path.join(distDir, "index.html"))) {
    console.error("dist/index.html missing — run build first");
    process.exit(1);
  }

  const outDir = path.join(gameRoot, "tmp");
  await mkdir(outDir, { recursive: true });
  zipPath = path.join(outDir, `${slug}-${version}.zip`);
  if (existsSync(zipPath)) await rm(zipPath);

  console.log("==> zip", zipPath);
  const AdmZip = require("adm-zip");
  const zip = new AdmZip();
  zip.addLocalFolder(distDir);
  zip.writeZip(zipPath);

  const size = statSync(zipPath).size;
  const sizeMb = (size / (1024 * 1024)).toFixed(2);
  console.log(`zip size: ${sizeMb} MB`);
  if (size > 100 * 1024 * 1024) {
    console.error("Zip exceeds 100MB");
    process.exit(1);
  }
}

const form = new FormData();
form.append("version", version);
form.append("submit", submit ? "true" : "false");

const fieldNames = ["version", "submit"];

if (zipPath) {
  const blob = new Blob([readFileSync(zipPath)], {
    type: "application/zip",
  });
  form.append("file", blob, path.basename(zipPath));
  fieldNames.push("file");
}

function appendPng(field, absPath) {
  const blob = new Blob([readFileSync(absPath)], { type: "image/png" });
  form.append(field, blob, path.basename(absPath));
  fieldNames.push(field);
}

if (iconPath) appendPng("icon", iconPath);
if (coverPath) appendPng("cover", coverPath);
if (coverShowcasePath) appendPng("coverShowcase", coverShowcasePath);

if (screenshots.length) {
  for (const shot of screenshots) {
    appendPng("screenshot", shot.path);
  }
  form.append(
    "devices",
    JSON.stringify(screenshots.map((s) => s.device)),
  );
  fieldNames.push("devices");
}

if (hasCard) {
  form.append("card", JSON.stringify(dvor.card));
  fieldNames.push("card");
}

const url = `${apiUrl}/developer/games/${encodeURIComponent(slug)}/release`;
console.log(
  "==> release",
  url,
  `(submit=${submit}, fields=${fieldNames.join(",")})`,
);
const res = await fetch(url, {
  method: "POST",
  headers: { "X-Api-Key": apiKey },
  body: form,
});
const text = await res.text();
if (!res.ok) {
  console.error("release failed", res.status, text);
  process.exit(1);
}
console.log("released:", text);
console.log("play: https://dvor-play.ru/play/" + slug);
