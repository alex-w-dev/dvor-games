/**
 * Local hub: http://localhost:PORT/ — links to games/<slug>/dist.
 * Starts watch-games in the same process.
 */
import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ogg": "audio/ogg",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".wasm": "application/wasm",
  ".map": "application/json",
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const farmRoot = path.resolve(__dirname, "../../..");
const gamesRoot = path.resolve(
  process.env.LOCAL_GAMES_ROOT?.trim() || path.join(farmRoot, "games"),
);
const PORT = Number(process.env.LOCAL_PORT || process.env.PORT || 4444);

function listGames() {
  if (!existsSync(gamesRoot)) return [];
  return readdirSync(gamesRoot)
    .filter((name) => {
      const dir = path.join(gamesRoot, name);
      if (!statSync(dir).isDirectory()) return false;
      const pkg = path.join(dir, "package.json");
      if (!existsSync(pkg)) return false;
      try {
        const json = JSON.parse(readFileSync(pkg, "utf8"));
        return Boolean(json.scripts?.build);
      } catch {
        return false;
      }
    })
    .sort();
}

function gameTitle(slug) {
  const pkgPath = path.join(gamesRoot, slug, "package.json");
  try {
    const json = JSON.parse(readFileSync(pkgPath, "utf8"));
    return json.dvor?.card?.title || json.dvor?.slug || slug;
  } catch {
    return slug;
  }
}

function hubHtml(slugs) {
  const items = slugs
    .map((slug) => {
      const ready = existsSync(path.join(gamesRoot, slug, "dist", "index.html"));
      const title = gameTitle(slug);
      const status = ready ? "" : ' <span class="miss">нет dist/</span>';
      return `<li><a href="/${slug}/">${title}</a> <code>${slug}</code>${status}</li>`;
    })
    .join("\n");
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>dvor-games local</title>
  <style>
    :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
    body { max-width: 40rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; }
    h1 { font-size: 1.25rem; margin: 0 0 0.25rem; }
    p { color: #666; margin: 0 0 1.25rem; }
    ul { padding: 0; list-style: none; }
    li { margin: 0.5rem 0; }
    a { font-weight: 600; }
    code { font-size: 0.85em; opacity: 0.7; }
    .miss { color: #b45309; font-size: 0.85em; }
  </style>
</head>
<body>
  <h1>Локальные игры</h1>
  <p>Сборка в <code>dist/</code> — watch рядом. Порт ${PORT}.</p>
  <ul>
${items || "    <li>Нет игр с scripts.build</li>"}
  </ul>
</body>
</html>`;
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { "Content-Type": MIME[ext] ?? "application/octet-stream" });
  createReadStream(filePath).pipe(res);
}

function resolveUnder(root, rel) {
  const filePath = path.resolve(root, rel);
  if (filePath !== root && !filePath.startsWith(root + path.sep)) return null;
  return filePath;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  let pathname = decodeURIComponent(url.pathname);

  if (pathname === "/" || pathname === "/index.html") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(hubHtml(listGames()));
    return;
  }

  const parts = pathname.split("/").filter(Boolean);
  const slug = parts[0];
  if (!slug || slug.includes("..")) {
    res.writeHead(400);
    res.end("bad path");
    return;
  }

  const distRoot = path.resolve(gamesRoot, slug, "dist");
  if (!existsSync(distRoot)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(`Нет dist/ у ${slug}. Дождись build или pnpm run build в games/${slug}`);
    return;
  }

  if (parts.length === 1 && !pathname.endsWith("/")) {
    res.writeHead(302, { Location: `/${slug}/` });
    res.end();
    return;
  }

  const rel = parts.slice(1).join("/") || "index.html";
  if (rel.includes("..")) {
    res.writeHead(400);
    res.end("bad path");
    return;
  }

  let filePath = resolveUnder(distRoot, rel);
  if (!filePath) {
    res.writeHead(403);
    res.end();
    return;
  }

  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  sendFile(res, filePath);
});

server.listen(PORT, () => {
  console.log(`[local] http://localhost:${PORT}/  ← хаб игр`);
  console.log(`[local] games root: ${gamesRoot}`);
});

await import(pathToFileURL(path.join(__dirname, "watch-games.mjs")).href);
