import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, "games/afterlight-radio/catalog.json");
const catalog = JSON.parse(fs.readFileSync(file, "utf8"));

function rewriteUrl(url) {
  if (typeof url !== "string") return url;
  let u = url;
  u = u.replace(/\/lfm\/bg\/([^/?#]+)/g, (_, fileName) => {
    const id = fileName.replace(/\.[^.]+$/, "");
    return `/lfm/img/backgrounds/${id}/512.jpg`;
  });
  u = u.replace(
    /\/lfm\/preview\/monster\/([^/?#]+)\.jpe?g/gi,
    "/lfm/img/monsters/$1/512.jpg",
  );
  u = u.replace(
    /\/lfm\/preview\/chars\/([^/?#]+)\.jpe?g/gi,
    "/lfm/img/chars/$1/512.jpg",
  );
  u = u.replace(/\/lfm\/ico\/(64|512)\/(s[^/?#]+)\.jpe?g/gi, (_, size, id) => {
    return `/lfm/img/skills/${id}/${size}.jpg`;
  });
  u = u.replace(/\/lfm\/ico\/(64|512)\/([^/?#]+)\.jpe?g/gi, (_, size, id) => {
    return `/lfm/img/items/${id}/${size}.jpg`;
  });
  u = u.replace(
    /\/lfm\/music\/(peace|battle|lobby)\/([^/?#]+)\.ogg/gi,
    "/lfm/music/$1/$2/original.ogg",
  );
  u = u.replace(
    /\/lfm\/audio\/sfx\/([^/?#]+)\.ogg/gi,
    "/lfm/sfx/$1/original.ogg",
  );
  return u;
}

function walk(value) {
  if (typeof value === "string") return rewriteUrl(value);
  if (Array.isArray(value)) return value.map(walk);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = walk(v);
    return out;
  }
  return value;
}

const next = walk(catalog);
fs.writeFileSync(file, JSON.stringify(next));
console.log("rewrote", file);
