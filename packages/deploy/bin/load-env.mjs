import { existsSync, readFileSync } from "node:fs";

/** Load KEY=VALUE from a .env file into process.env (does not override set keys). */
export function loadEnvFile(file) {
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 1) continue;
    const key = line.slice(0, i).trim();
    const val = line.slice(i + 1).trim();
    if (process.env[key] == null || process.env[key] === "") {
      process.env[key] = val;
    }
  }
}
