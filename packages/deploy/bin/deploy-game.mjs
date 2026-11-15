#!/usr/bin/env node
/**
 * Root helper: pnpm run deploy <game-folder-name>
 * Resolves games/<name> and runs its deploy script.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");

const name = process.argv[2];
if (!name) {
  console.error("Usage: pnpm run deploy <game-name>");
  console.error("Example: pnpm run deploy hello");
  process.exit(1);
}

const gameRoot = path.join(repoRoot, "games", name);
const pkgPath = path.join(gameRoot, "package.json");
if (!existsSync(pkgPath)) {
  console.error("Game not found:", gameRoot);
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
console.log(`==> deploy @games/${name} (slug=${pkg.lightborn?.slug ?? "?"})`);
execSync("pnpm run deploy", { cwd: gameRoot, stdio: "inherit" });
