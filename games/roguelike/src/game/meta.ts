import type {
  Fighter,
  MetaProgress,
  MetaUnlockId,
  MetaUpgradeId,
  RelicId,
} from "./types";
import { createBasePlayer } from "./content";

const STORAGE_KEY = "l-fight-roguelike-meta-v1";

export const META_MAX_LEVEL = 5;

export type MetaUpgradeDef = {
  id: MetaUpgradeId;
  title: string;
  description: (level: number) => string;
  /** Иконка dataset (`gNNNN` / `sNNNN`). */
  icon: string;
};

export type MetaUnlockDef = {
  id: MetaUnlockId;
  title: string;
  description: string;
  cost: number;
  /** Иконка dataset (`gNNNN` / `sNNNN`). */
  icon: string;
  requires?: MetaUnlockId;
};

export function dailyKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}

export function dailySeed(d = new Date()): number {
  const key = dailyKey(d);
  let h = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function dayIndex(key: string): number {
  const [y, m, day] = key.split("-").map(Number);
  return Math.floor(Date.UTC(y!, m! - 1, day!) / 86400000);
}

export const META_UPGRADES: MetaUpgradeDef[] = [
  {
    id: "vitality",
    title: "Живучесть",
    description: (level) => `Старт +${level * 8} HP`,
    icon: "g0438", // Зелье исцеления
  },
  {
    id: "power",
    title: "Сила",
    description: (level) => `Старт +${level} ATK`,
    icon: "g0360", // Камень заточки
  },
  {
    id: "purse",
    title: "Кошель",
    description: (level) => `Старт +${level * 8} золота`,
    icon: "g0733", // Монета
  },
  {
    id: "luck",
    title: "Удача",
    description: (level) => `Старт +${level * 3}% крита`,
    icon: "g0733", // Монета Нулмара
  },
  {
    id: "recovery",
    title: "Восстановление",
    description: (level) => `Старт +${level} regen`,
    icon: "s1455", // Быстрое восстановление HP
  },
];

export const META_UNLOCKS: MetaUnlockDef[] = [
  {
    id: "events_rare",
    title: "Редкие события",
    description: "Библиотека и Сборщик в пуле ивентов",
    cost: 35,
    icon: "g0262", // Книга еретика
  },
  {
    id: "relic_blood",
    title: "Кровавая чаша",
    description: "Новая реликвия в пуле старта",
    cost: 40,
    icon: "g0830", // Кровь святого
  },
  {
    id: "relic_echo",
    title: "Клинок эха",
    description: "Новая реликвия в пуле старта",
    cost: 40,
    icon: "g0627", // Клинок тёмного легиона
  },
  {
    id: "skill_siphon",
    title: "Навык Вытягивание",
    description: "Базовый навык: урон + лечение",
    cost: 55,
    icon: "s1514", // Похищение жизни
  },
  {
    id: "relic_phoenix",
    title: "Пепел феникса",
    description: "Реликвия: второе дыхание в бою",
    cost: 50,
    icon: "g0498", // Пепел
    requires: "events_rare",
  },
  {
    id: "relic_pact",
    title: "Кровавый пакт",
    description: "Реликвия: жертва HP за урон",
    cost: 65,
    icon: "g0257", // Кровь мудреца
    requires: "relic_phoenix",
  },
  {
    id: "relic_elite",
    title: "Печать элиты",
    description: "Реликвия: скидка в магазине после элиты",
    cost: 55,
    icon: "g0831", // Печать света
    requires: "relic_pact",
  },
  {
    id: "layouts_alt",
    title: "Карты бездны",
    description: "Новые графы этажей: тройной путь, shortcut, мясорубка",
    cost: 45,
    icon: "g0533", // Камень глаза бесконечности
  },
  {
    id: "events_build",
    title: "Сделки судьбы",
    description: "Ивенты, ломающие билд: тень, разлом, знамение",
    cost: 50,
    icon: "g0480", // Камень души
    requires: "events_rare",
  },
];

const DIFFICULTY_MIN = 0.5;
const DIFFICULTY_MAX = 2;

export function clampDifficultyCoeff(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  const stepped = Math.round(n * 10) / 10;
  return Math.max(DIFFICULTY_MIN, Math.min(DIFFICULTY_MAX, stepped));
}

export function emptyMeta(): MetaProgress {
  return {
    essence: 0,
    levels: {
      vitality: 0,
      power: 0,
      purse: 0,
      luck: 0,
      recovery: 0,
    },
    unlocks: [],
    dailyDate: null,
    dailyStreak: 0,
    difficultyCoeff: 1,
  };
}

const UNLOCK_IDS = new Set<MetaUnlockId>(
  META_UNLOCKS.map((u) => u.id),
);

export function loadMeta(): MetaProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyMeta();
    const parsed = JSON.parse(raw) as Partial<MetaProgress>;
    const unlocks = Array.isArray(parsed.unlocks)
      ? parsed.unlocks.filter(
          (id): id is MetaUnlockId =>
            typeof id === "string" && UNLOCK_IDS.has(id as MetaUnlockId),
        )
      : [];
    return {
      essence: Math.max(0, Math.floor(Number(parsed.essence) || 0)),
      levels: {
        vitality: clampLevel(parsed.levels?.vitality),
        power: clampLevel(parsed.levels?.power),
        purse: clampLevel(parsed.levels?.purse),
        luck: clampLevel(parsed.levels?.luck),
        recovery: clampLevel(parsed.levels?.recovery),
      },
      unlocks,
      dailyDate:
        typeof parsed.dailyDate === "string" ? parsed.dailyDate : null,
      dailyStreak: Math.max(0, Math.floor(Number(parsed.dailyStreak) || 0)),
      difficultyCoeff: clampDifficultyCoeff(
        parsed.difficultyCoeff === undefined ? 1 : parsed.difficultyCoeff,
      ),
    };
  } catch {
    return emptyMeta();
  }
}

export function saveMeta(meta: MetaProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
  } catch {
    // ignore quota / private mode
  }
}

function clampLevel(value: unknown): number {
  const n = Math.floor(Number(value) || 0);
  return Math.max(0, Math.min(META_MAX_LEVEL, n));
}

export function metaUpgradeCost(currentLevel: number): number {
  return 12 + currentLevel * 10;
}

export function hasUnlock(
  meta: MetaProgress,
  id: MetaUnlockId,
): boolean {
  return meta.unlocks.includes(id);
}

export function startingGold(meta: MetaProgress): number {
  return 12 + meta.levels.purse * 8;
}

export function createPlayerFromMeta(meta: MetaProgress): Fighter {
  const base = createBasePlayer();
  const maxHp = base.maxHp + meta.levels.vitality * 8;
  return {
    ...base,
    maxHp,
    hp: maxHp,
    atk: base.atk + meta.levels.power,
    critChance: Math.min(0.45, base.critChance + meta.levels.luck * 0.03),
    regen: base.regen + meta.levels.recovery,
  };
}

export function applyRelicToPlayer(
  player: Fighter,
  relic: RelicId | null,
): Fighter {
  if (!relic) return player;
  switch (relic) {
    case "plague_skull":
      return { ...player, poisonOnHit: player.poisonOnHit + 2 };
    case "ancestor_shield":
      return {
        ...player,
        shieldPerTurn: player.shieldPerTurn + 10,
        armor: player.armor + 1,
      };
    case "gold_compass":
      return player;
    case "berserker_heart":
      return {
        ...player,
        atk: player.atk + 3,
        rageAtk: player.rageAtk + 4,
      };
    case "venom_fang":
      return {
        ...player,
        poisonOnHit: player.poisonOnHit + 1,
        poisonTickBonus: player.poisonTickBonus + 1,
      };
    case "lucky_coin":
      return {
        ...player,
        critChance: Math.min(0.55, player.critChance + 0.1),
      };
    case "blood_chalice":
      return {
        ...player,
        maxHp: player.maxHp + 10,
        hp: player.hp + 10,
        vamp: Math.min(0.4, player.vamp + 0.1),
      };
    case "echo_blade":
      return {
        ...player,
        cleaveHits: player.cleaveHits + 1,
        cleaveRatio: Math.max(player.cleaveRatio, 0.5),
      };
    case "chrono_lens":
    case "ward_blade":
    case "toxin_heart":
    case "phoenix_ash":
    case "blood_pact":
    case "elite_seal":
      return player;
  }
}

export function relicGoldBonus(relic: RelicId | null): number {
  return relic === "lucky_coin" ? 15 : 0;
}

export function relicGoldMult(relic: RelicId | null): number {
  return relic === "gold_compass" ? 1.5 : 1;
}

export function calcEssenceEarned(input: {
  won: boolean;
  floor: number;
  roomsCleared: number;
  gold: number;
}): number {
  const fromRooms = input.roomsCleared * 3;
  const floorsCleared = Math.max(0, input.floor - 1);
  if (!input.won) {
    // Поражение/сдача: только за прогресс, без минимума и стартового золота.
    return fromRooms + floorsCleared * 5;
  }
  const fromFloor = input.floor * 2;
  const fromGold = Math.floor(input.gold / 12);
  return fromRooms + fromFloor + fromGold + 25;
}

export function buyMetaUpgrade(
  meta: MetaProgress,
  id: MetaUpgradeId,
): MetaProgress | null {
  const level = meta.levels[id];
  if (level >= META_MAX_LEVEL) return null;
  const cost = metaUpgradeCost(level);
  if (meta.essence < cost) return null;
  return {
    ...meta,
    essence: meta.essence - cost,
    levels: { ...meta.levels, [id]: level + 1 },
  };
}

export function buyMetaUnlock(
  meta: MetaProgress,
  id: MetaUnlockId,
): MetaProgress | null {
  if (meta.unlocks.includes(id)) return null;
  const def = META_UNLOCKS.find((u) => u.id === id);
  if (!def || meta.essence < def.cost) return null;
  if (def.requires && !meta.unlocks.includes(def.requires)) return null;
  return {
    ...meta,
    essence: meta.essence - def.cost,
    unlocks: [...meta.unlocks, id],
  };
}

export function applyDailyWinBonus(
  meta: MetaProgress,
  essenceBase: number,
): { meta: MetaProgress; essenceEarned: number; dailyBonus: number } {
  const key = dailyKey();
  if (meta.dailyDate === key) {
    return {
      meta: { ...meta, essence: meta.essence + essenceBase },
      essenceEarned: essenceBase,
      dailyBonus: 0,
    };
  }
  const prev = meta.dailyDate;
  const streak =
    prev && dayIndex(key) - dayIndex(prev) === 1
      ? meta.dailyStreak + 1
      : 1;
  const dailyBonus = 15 + Math.min(25, (streak - 1) * 5);
  return {
    meta: {
      ...meta,
      dailyDate: key,
      dailyStreak: streak,
      essence: meta.essence + essenceBase + dailyBonus,
    },
    essenceEarned: essenceBase + dailyBonus,
    dailyBonus,
  };
}
