const CDN = "https://storage.yandexcloud.net/lfm";
/** Совпадает с major GAME_DATA_VERSION — bust immutable S3. */
const BG_V = 14;

function imgKey(
  kind: string,
  id: string | number,
  size: 64 | 512 | "original",
): string {
  return `img/${kind}/${id}/${size}.jpg`;
}

function bgUrl(id: string): string {
  return `${CDN}/${imgKey("backgrounds", id, 512)}?v=${BG_V}`;
}

/** Канонический id картинки монстра (`m0001`) из числового image id датасета. */
function monsterImageId(imageId: number): string {
  return `m${String(imageId).padStart(4, "0")}`;
}

/** Превью монстра (512): `iconId` = число из `mNNNN` датасета. */
export function monsterIconUrl(iconId: number): string {
  return `${CDN}/${imgKey("monsters", monsterImageId(iconId), 512)}`;
}

/** Превью аватара (512): `avatarId` из `avatars.json`. */
export function avatarIconUrl(avatarId: number): string {
  return `${CDN}/${imgKey("chars", avatarId, 512)}`;
}

/** Иконка предмета/реликвии из dataset (`gNNNN` / `sNNNN`). */
export function itemIconUrl(icon: string, size: 64 | 512 = 512): string {
  const kind = icon.trim().toLowerCase().startsWith("s") ? "skills" : "items";
  return `${CDN}/${imgKey(kind, icon, size)}`;
}

/** Фон титула / meta. */
export function titleBgUrl(): string {
  return bgUrl("roguelike-title");
}

/** Фон экрана поражения. */
export function defeatBgUrl(): string {
  return bgUrl("roguelike-defeat");
}

/** Фон экрана победы. */
export function victoryBgUrl(): string {
  return bgUrl("roguelike-victory");
}

/** Фон во время рана (катакомбы, role battle). */
export function runBgUrl(): string {
  return bgUrl("dungeon-floor");
}

export function bgUrlForPhase(phase: string, won?: boolean): string {
  if (phase === "result") {
    return won ? victoryBgUrl() : defeatBgUrl();
  }
  if (phase === "title" || phase === "meta") {
    return titleBgUrl();
  }
  return runBgUrl();
}
