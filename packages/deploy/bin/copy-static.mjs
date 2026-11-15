/**
 * Copy game static files into dist/.
 * - index.html (required)
 * - root files: .js .css .json .svg .png .jpg .jpeg .webp .gif .ogg .mp3 .wav .woff .woff2
 * - dirs: src/, assets/, public/ if present
 * Run from the game package root (cwd).
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";

const ROOT_SKIP = new Set([
  "package.json",
  "dist",
  "tmp",
  "node_modules",
  ".env",
  ".env.local",
]);

const ROOT_EXT = new Set([
  ".html",
  ".js",
  ".css",
  ".json",
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".ogg",
  ".mp3",
  ".wav",
  ".woff",
  ".woff2",
]);

const root = process.cwd();
const dist = path.join(root, "dist");
const indexHtml = path.join(root, "index.html");

if (!existsSync(indexHtml)) {
  console.error("index.html missing in", root);
  process.exit(1);
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

for (const name of readdirSync(root)) {
  if (ROOT_SKIP.has(name) || name.startsWith(".")) continue;
  const from = path.join(root, name);
  const st = statSync(from);
  if (!st.isFile()) continue;
  const ext = path.extname(name).toLowerCase();
  if (!ROOT_EXT.has(ext)) continue;
  cpSync(from, path.join(dist, name));
}

for (const dir of ["src", "assets", "public"]) {
  const from = path.join(root, dir);
  if (existsSync(from)) {
    cpSync(from, path.join(dist, dir), { recursive: true });
  }
}

console.log("built", dist);
