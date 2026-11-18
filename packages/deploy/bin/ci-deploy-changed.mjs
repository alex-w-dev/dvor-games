#!/usr/bin/env node
/**
 * CI: deploy only games changed in the push, using package.json#version.
 * Skips if that version label already exists on the platform.
 * Frees a slot (max 3) by deleting the oldest non-published version.
 *
 * Env:
 *   LIGHTBORN_API_KEY   required
 *   LIGHTBORN_API_URL   default https://lightborn.ru/main-api
 *   GITHUB_EVENT_BEFORE / GITHUB_SHA  optional (GitHub Actions)
 */
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "./load-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const gamesRoot = path.join(repoRoot, "games");

loadEnvFile(path.join(repoRoot, ".env"));

const apiUrl = (
  process.env.LIGHTBORN_API_URL ||
  "https://lightborn.ru/main-api"
).replace(/\/$/, "");
const apiKey = process.env.LIGHTBORN_API_KEY || "";

if (!apiKey) {
  console.error("LIGHTBORN_API_KEY is required");
  process.exit(1);
}

function listGameDirs() {
  if (!existsSync(gamesRoot)) return [];
  return readdirSync(gamesRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => existsSync(path.join(gamesRoot, name, "package.json")));
}

function resolveDiffRange() {
  const before = process.env.GITHUB_EVENT_BEFORE || "";
  const sha = process.env.GITHUB_SHA || "";
  if (
    before &&
    sha &&
    !/^0+$/.test(before)
  ) {
    return { from: before, to: sha };
  }
  try {
    execSync("git rev-parse --verify HEAD~1", {
      cwd: repoRoot,
      stdio: "ignore",
    });
    return { from: "HEAD~1", to: "HEAD" };
  } catch {
    return null;
  }
}

function changedGameNames() {
  const range = resolveDiffRange();
  if (!range) {
    console.log("No previous commit — treating all games as changed");
    return listGameDirs();
  }
  let out = "";
  try {
    out = execSync(`git diff --name-only ${range.from} ${range.to}`, {
      cwd: repoRoot,
      encoding: "utf8",
    });
  } catch (err) {
    console.warn("git diff failed, falling back to all games:", err.message);
    return listGameDirs();
  }
  const names = new Set();
  for (const line of out.split(/\r?\n/)) {
    const m = line.match(/^games\/([^/]+)\//);
    if (m) names.add(m[1]);
  }
  return [...names].filter((name) =>
    existsSync(path.join(gamesRoot, name, "package.json")),
  );
}

async function api(method, pathSuffix) {
  const url = `${apiUrl}${pathSuffix}`;
  const res = await fetch(url, {
    method,
    headers: { "X-Api-Key": apiKey },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const msg =
      body && typeof body === "object" && body.message
        ? body.message
        : text || res.statusText;
    throw new Error(`${method} ${pathSuffix} → ${res.status}: ${msg}`);
  }
  return body;
}

function isPublished(v) {
  return v && v.status === "published";
}

async function ensureSlot(slug, versions) {
  if (versions.length < 3) return versions;
  const candidates = versions
    .filter((v) => !isPublished(v))
    .slice()
    .sort((a, b) => {
      const ta = Date.parse(a.createdAt || 0) || 0;
      const tb = Date.parse(b.createdAt || 0) || 0;
      return ta - tb;
    });
  if (!candidates.length) {
    throw new Error(
      `${slug}: 3 versions and none deletable (all published?)`,
    );
  }
  const oldest = candidates[0];
  console.log(
    `==> ${slug}: free slot, delete ${oldest.version} (${oldest.id}, ${oldest.status})`,
  );
  await api(
    "DELETE",
    `/developer/games/${encodeURIComponent(slug)}/versions/${oldest.id}`,
  );
  return versions.filter((v) => v.id !== oldest.id);
}

async function deployGame(name) {
  const gameRoot = path.join(gamesRoot, name);
  const pkg = JSON.parse(
    readFileSync(path.join(gameRoot, "package.json"), "utf8"),
  );
  const slug = pkg.lightborn?.slug;
  const version =
    typeof pkg.version === "string" ? pkg.version.trim() : "";
  if (!slug || typeof slug !== "string") {
    throw new Error(`${name}: package.json lightborn.slug required`);
  }
  if (!version) {
    throw new Error(
      `${name}: package.json version required for CI (user-set label)`,
    );
  }

  console.log(`==> ${name}: slug=${slug} version=${version}`);
  let versions = await api(
    "GET",
    `/developer/games/${encodeURIComponent(slug)}/versions`,
  );
  if (!Array.isArray(versions)) {
    throw new Error(`${slug}: unexpected versions response`);
  }

  if (versions.some((v) => v && v.version === version)) {
    console.log(`==> ${name}: version ${version} already on platform — skip`);
    return "skipped";
  }

  versions = await ensureSlot(slug, versions);

  console.log(`==> ${name}: deploy ${version}`);
  execSync(`pnpm run deploy ${name}`, {
    cwd: repoRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      LIGHTBORN_API_KEY: apiKey,
      LIGHTBORN_API_URL: apiUrl,
      LIGHTBORN_VERSION: version,
      LIGHTBORN_SUBMIT: "true",
    },
  });
  return "deployed";
}

const changed = changedGameNames();
if (!changed.length) {
  console.log("No games changed — nothing to deploy");
  process.exit(0);
}

console.log("Changed games:", changed.join(", "));

let failed = 0;
for (const name of changed) {
  try {
    await deployGame(name);
  } catch (err) {
    failed += 1;
    console.error(`==> ${name}: FAILED`, err && err.message ? err.message : err);
  }
}

if (failed) {
  process.exit(1);
}
console.log("CI deploy done");
