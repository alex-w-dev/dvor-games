/**
 * Copy game static files into dist/ (index.html + src/, assets/ if present).
 * Run from the game package root (cwd).
 */
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");
const indexHtml = path.join(root, "index.html");

if (!existsSync(indexHtml)) {
  console.error("index.html missing in", root);
  process.exit(1);
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(indexHtml, path.join(dist, "index.html"));

for (const dir of ["src", "assets", "public"]) {
  const from = path.join(root, dir);
  if (existsSync(from)) {
    cpSync(from, path.join(dist, dir), { recursive: true });
  }
}

console.log("built", dist);
