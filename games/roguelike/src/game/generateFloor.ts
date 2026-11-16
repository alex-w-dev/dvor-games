import { ELITE_TRAIT_RU, pickMonster } from "./content";
import type {
  Floor,
  FloorLayoutId,
  MetaUnlockId,
  Room,
  RoomKind,
  RunMods,
} from "./types";

function roomLabel(kind: RoomKind): string {
  switch (kind) {
    case "fight":
      return "Бой";
    case "elite":
      return "Элита";
    case "rest":
      return "Отдых";
    case "boss":
      return "Босс";
    case "shop":
      return "Магазин";
    case "event":
      return "Событие";
  }
}

function combatRoom(
  id: string,
  kind: "fight" | "elite" | "boss",
  floor: number,
  next: string[],
  rng: () => number,
  opts?: { finalBoss?: boolean },
): Room {
  const monster = pickMonster(floor, kind, rng, opts);
  const trait =
    kind === "elite" && monster.eliteTrait
      ? ELITE_TRAIT_RU[monster.eliteTrait]
      : null;
  const hint = opts?.finalBoss
    ? "3 фазы · финал рана"
    : kind === "elite"
      ? trait
        ? `Элита · ${trait}`
        : "Сложнее · больше золота"
      : kind === "boss"
        ? "Босс этажа"
        : "Обычный бой · немного золота";
  return {
    id,
    kind,
    monsterId: monster.id,
    label: `${roomLabel(kind)} · ${monster.name}`,
    hint,
    next,
  };
}

function utilityRoom(
  id: string,
  kind: "rest" | "shop" | "event",
  next: string[],
): Room {
  const labels: Record<typeof kind, { label: string; hint: string }> = {
    rest: { label: "Отдых · +30% HP", hint: "Безопасно · лечение" },
    shop: { label: "Магазин", hint: "Потратить золото на силу" },
    event: { label: "Событие", hint: "Выбор с риском или выгодой" },
  };
  const meta = labels[kind];
  return {
    id,
    kind,
    label: meta.label,
    hint: meta.hint,
    next,
  };
}

type BranchKind = "fight" | "elite" | "event";

const LAYOUT_LABEL: Record<FloorLayoutId, string> = {
  fork: "Развилка",
  gauntlet: "Коридор",
  triad: "Тройной путь",
  shortcut: "Короткий путь",
  brutal: "Мясорубка",
  blitz: "Блиц",
};

function pickMid(
  rng: () => number,
  mods: RunMods,
): "rest" | "shop" | "event" {
  if (mods.noShop) {
    return rng() < 0.5 ? "rest" : "event";
  }
  const midRoll = rng();
  return midRoll < 0.34 ? "rest" : midRoll < 0.67 ? "shop" : "event";
}

function pickLayout(
  rng: () => number,
  opts: { blitz: boolean; altLayouts: boolean; eliteHeavy: boolean },
): FloorLayoutId {
  if (opts.blitz) return "blitz";
  const base: FloorLayoutId[] = ["fork", "gauntlet"];
  if (opts.altLayouts) {
    base.push("triad", "shortcut", "brutal");
  }
  if (opts.eliteHeavy) {
    base.push("brutal", "gauntlet");
  }
  return base[Math.floor(rng() * base.length) % base.length]!;
}

export type GenerateFloorOpts = {
  unlocks?: MetaUnlockId[];
  mods?: RunMods;
  blitz?: boolean;
};

/**
 * Случайный граф этажа: fork / gauntlet / triad / shortcut / brutal / blitz.
 */
export function generateFloor(
  floor: number,
  maxFloors: number,
  rng: () => number,
  opts: GenerateFloorOpts = {},
): Floor {
  const mods: RunMods = opts.mods ?? { noShop: false, eliteHeavy: false };
  const unlocks = opts.unlocks ?? [];
  const layout = pickLayout(rng, {
    blitz: Boolean(opts.blitz),
    altLayouts: unlocks.includes("layouts_alt"),
    eliteHeavy: mods.eliteHeavy,
  });
  const id = (n: string) => `f${floor}-${n}`;
  const finalBoss = floor >= maxFloors;
  const midKind = pickMid(rng, mods);

  const makeBranch = (key: string, kind: BranchKind, next: string[]): Room => {
    if (kind === "event") return utilityRoom(id(key), "event", next);
    return combatRoom(id(key), kind, floor, next, rng);
  };

  let rooms: Room[] = [];
  let startId = id("start");

  if (layout === "blitz") {
    const risk: BranchKind = mods.eliteHeavy || rng() < 0.55 ? "elite" : "fight";
    const safe: BranchKind = rng() < 0.5 ? "fight" : "event";
    const kindA = rng() < 0.5 ? risk : safe;
    const kindB = kindA === risk ? safe : risk;
    const start = combatRoom(id("start"), "fight", floor, [id("a"), id("b")], rng);
    const a = makeBranch("a", kindA, [id("end")]);
    const b = makeBranch("b", kindB, [id("end")]);
    const end = combatRoom(id("end"), "boss", floor, [], rng, { finalBoss });
    rooms = [start, a, b, end];
  } else if (layout === "gauntlet") {
    const start = combatRoom(
      id("start"),
      "fight",
      floor,
      [id("mid1")],
      rng,
    );
    const mid1 = combatRoom(
      id("mid1"),
      mods.eliteHeavy || rng() < 0.6 ? "elite" : "fight",
      floor,
      [id("util")],
      rng,
    );
    const util = utilityRoom(id("util"), midKind, [id("end")]);
    const end = combatRoom(id("end"), "boss", floor, [], rng, { finalBoss });
    rooms = [start, mid1, util, end];
  } else if (layout === "triad") {
    const kinds: BranchKind[] = [
      "elite",
      rng() < 0.5 ? "fight" : "event",
      mods.eliteHeavy ? "elite" : rng() < 0.45 ? "elite" : "fight",
    ];
    for (let i = kinds.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = kinds[i]!;
      kinds[i] = kinds[j]!;
      kinds[j] = tmp;
    }
    const start = combatRoom(
      id("start"),
      "fight",
      floor,
      [id("a"), id("b"), id("c")],
      rng,
    );
    const a = makeBranch("a", kinds[0]!, [id("mid")]);
    const b = makeBranch("b", kinds[1]!, [id("mid")]);
    const c = makeBranch("c", kinds[2]!, [id("mid")]);
    const mid = utilityRoom(id("mid"), midKind, [id("end")]);
    const end = combatRoom(id("end"), "boss", floor, [], rng, { finalBoss });
    rooms = [start, a, b, c, mid, end];
  } else if (layout === "shortcut") {
    const start = combatRoom(
      id("start"),
      "fight",
      floor,
      [id("safe"), id("risk")],
      rng,
    );
    const safe = utilityRoom(id("safe"), midKind, [id("end")]);
    const risk = combatRoom(id("risk"), "elite", floor, [id("end")], rng);
    const end = combatRoom(id("end"), "boss", floor, [], rng, { finalBoss });
    rooms = [start, safe, risk, end];
  } else if (layout === "brutal") {
    const start = combatRoom(
      id("start"),
      "elite",
      floor,
      [id("a"), id("b")],
      rng,
    );
    const a = combatRoom(id("a"), "fight", floor, [id("mid")], rng);
    const b = combatRoom(id("b"), "elite", floor, [id("mid")], rng);
    const mid =
      mods.noShop || rng() < 0.55
        ? utilityRoom(id("mid"), "event", [id("end")])
        : utilityRoom(id("mid"), midKind, [id("end")]);
    const end = combatRoom(id("end"), "boss", floor, [], rng, { finalBoss });
    rooms = [start, a, b, mid, end];
  } else {
    const safeBranch: BranchKind = rng() < 0.55 ? "fight" : "event";
    const riskBranch: BranchKind = "elite";
    const kindA = rng() < 0.5 ? riskBranch : safeBranch;
    const kindB = kindA === "elite" ? safeBranch : riskBranch;
    const start = combatRoom(
      id("start"),
      "fight",
      floor,
      [id("a"), id("b")],
      rng,
    );
    const a = makeBranch("a", kindA, [id("mid")]);
    const b = makeBranch("b", kindB, [id("mid")]);
    const mid = utilityRoom(id("mid"), midKind, [id("end")]);
    const end = combatRoom(id("end"), "boss", floor, [], rng, { finalBoss });
    rooms = [start, a, b, mid, end];
  }

  startId = rooms[0]!.id;
  return {
    startId,
    rooms,
    layoutId: layout,
    layoutLabel: LAYOUT_LABEL[layout],
  };
}
