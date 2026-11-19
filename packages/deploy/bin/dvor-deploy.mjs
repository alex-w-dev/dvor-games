#!/usr/bin/env node
/**
 * Build (optional) + zip dist + POST to Dvor Deploy API.
 * Run from a game package directory (cwd = games/<name>).
 *
 * Env (repo root .env):
 *   DVOR_API_KEY   required
 *   DVOR_API_URL   default https://dvor-play.ru/main-api
 *   DVOR_SUBMIT    default true
 *   DVOR_VERSION   else package.json#version, else timestamp
 *   DVOR_SKIP_BUILD  if "true", skip pnpm run build
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "./load-env.mjs";

const require = createRequire(import.meta.url);
const AdmZip = require("adm-zip");

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
const slug = pkg.dvor?.slug;
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
const pkgVersion =
  typeof pkg.version === "string" && pkg.version.trim()
    ? pkg.version.trim()
    : "";
const version =
  process.env.DVOR_VERSION ||
  pkgVersion ||
  new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
const skipBuild = process.env.DVOR_SKIP_BUILD === "true";

if (!apiKey) {
  console.error(
    "DVOR_API_KEY is required (root .env — see .env.example)",
  );
  process.exit(1);
}

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
const zipPath = path.join(outDir, `${slug}-${version}.zip`);
if (existsSync(zipPath)) await rm(zipPath);

console.log("==> zip", zipPath);
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

const form = new FormData();
form.append("version", version);
form.append("submit", submit ? "true" : "false");
const blob = new Blob([readFileSync(zipPath)], { type: "application/zip" });
form.append("file", blob, path.basename(zipPath));

const url = `${apiUrl}/developer/games/${encodeURIComponent(slug)}/deploy`;
console.log("==> deploy", url, `(submit=${submit})`);
const res = await fetch(url, {
  method: "POST",
  headers: { "X-Api-Key": apiKey },
  body: form,
});
const text = await res.text();
if (!res.ok) {
  console.error("deploy failed", res.status, text);
  process.exit(1);
}
console.log("deployed:", text);
console.log("play: https://dvor-play.ru/play/" + slug);
