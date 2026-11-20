/**
 * Watch each games/<slug> sources and rebuild dist/ on change.
 * LOCAL_GAMES_ROOT = path to games/ (default: <farm>/games).
 */
import { execSync } from "node:child_process";
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  watch,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEBOUNCE_MS = 400;
const IGNORE_DIR = new Set(["dist", "tmp", "node_modules", ".git"]);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const farmRoot = path.resolve(__dirname, "../../..");
const gamesRoot = path.resolve(
  process.env.LOCAL_GAMES_ROOT?.trim() || path.join(farmRoot, "games"),
);

function listGames() {
  if (!existsSync(gamesRoot)) return [];
  return readdirSync(gamesRoot).filter((name) => {
    const pkg = path.join(gamesRoot, name, "package.json");
    if (!existsSync(pkg)) return false;
    try {
      const json = JSON.parse(readFileSync(pkg, "utf8"));
      return Boolean(json.scripts?.build);
    } catch {
      return false;
    }
  });
}

function shouldIgnore(relPath) {
  const parts = relPath.split(/[/\\]/).filter(Boolean);
  return parts.some((p) => IGNORE_DIR.has(p) || p.startsWith("."));
}

/** @type {Map<string, ReturnType<typeof setTimeout>>} */
const timers = new Map();
/** @type {Set<string>} */
const queued = new Set();
/** @type {string[]} */
const runningQueue = [];
let building = false;

function runBuild(slug) {
  const cwd = path.join(gamesRoot, slug);
  console.log(`[games] build ${slug}`);
  try {
    execSync("pnpm run build", { cwd, stdio: "inherit" });
    console.log(`[games] built ${slug}`);
  } catch {
    console.error(`[games] build failed ${slug}`);
  }
}

function drainQueue() {
  if (building) return;
  building = true;
  while (runningQueue.length) {
    const slug = runningQueue.shift();
    queued.delete(slug);
    runBuild(slug);
  }
  building = false;
}

function scheduleBuild(slug) {
  const prev = timers.get(slug);
  if (prev) clearTimeout(prev);
  timers.set(
    slug,
    setTimeout(() => {
      timers.delete(slug);
      if (!queued.has(slug)) {
        queued.add(slug);
        runningQueue.push(slug);
      }
      drainQueue();
    }, DEBOUNCE_MS),
  );
}

function watchGame(slug) {
  const dir = path.join(gamesRoot, slug);
  try {
    const watcher = watch(dir, { recursive: true }, (_event, filename) => {
      if (!filename) return;
      if (shouldIgnore(filename)) return;
      scheduleBuild(slug);
    });
    watcher.on("error", (err) => {
      console.error(`[games] watch error ${slug}:`, err.message);
    });
  } catch (err) {
    console.error(`[games] cannot watch ${slug}:`, err.message);
  }
}

const slugs = listGames();
if (!slugs.length) {
  console.error(`[games] no games with build script in ${gamesRoot}`);
  process.exit(1);
}

console.log(`[games] watching ${gamesRoot} (${slugs.join(", ")})`);
for (const slug of slugs) {
  runBuild(slug);
}
for (const slug of slugs) {
  if (!statSync(path.join(gamesRoot, slug)).isDirectory()) continue;
  watchGame(slug);
}
