import type {
  ClassId,
  EliteTrait,
  EventDef,
  Fighter,
  IntentTemplate,
  MetaUnlockId,
  MonsterDef,
  RelicDef,
  RelicId,
  RoomKind,
  ShopOffer,
  SkillDef,
  SkillId,
  UpgradeDef,
  UpgradeId,
  UpgradeTag,
} from "./types";

export type ClassDef = {
  id: ClassId;
  title: string;
  description: string;
  passive: string;
  /** Аватар персонажа из `avatars.json` / S3 `chars`. */
  avatarId: number;
};

export const CLASSES: ClassDef[] = [
  {
    id: "warrior",
    title: "Воин",
    description: "Танк: щиты, броня, шипы. Навык Удар щитом.",
    passive: "+15 HP · +1 броня · +4 щита/ход · +3 шипа",
    avatarId: 3,
  },
  {
    id: "rogue",
    title: "Разбойник",
    description: "Крит и рассечение. Навык Удар в спину по атакующему.",
    passive: "+2 ATK · +10% крита · ×2.3 крит · рассечение",
    avatarId: 13,
  },
  {
    id: "mage",
    title: "Маг",
    description: "Яд и вампиризм. Навык Вспышка: урон + яд.",
    passive: "+2 реген · +3 щита/ход · яд · вампиризм",
    avatarId: 27,
  },
];

export type FloorTheme = {
  floor: number;
  title: string;
  tagline: string;
  accent: string;
  tint: string;
};

export const FLOOR_THEMES: FloorTheme[] = [
  {
    floor: 1,
    title: "Тлеющие катакомбы",
    tagline: "Кости, пыль и эхо шагов",
    accent: "#c4a35a",
    tint: "rgba(80, 55, 20, 0.35)",
  },
  {
    floor: 2,
    title: "Ядовитые топи",
    tagline: "Тишина, туман и зелень",
    accent: "#6aaa5e",
    tint: "rgba(30, 70, 35, 0.4)",
  },
  {
    floor: 3,
    title: "Обсидиановый шпиль",
    tagline: "Холод стали и синий пепел",
    accent: "#7a9ec4",
    tint: "rgba(25, 40, 75, 0.42)",
  },
  {
    floor: 4,
    title: "Сердце бездны",
    tagline: "Финал. Здесь кончаются пути",
    accent: "#c45c5c",
    tint: "rgba(70, 15, 25, 0.48)",
  },
];

export function floorTheme(floor: number): FloorTheme {
  return (
    FLOOR_THEMES.find((t) => t.floor === floor) ?? FLOOR_THEMES[0]!
  );
}

export function classById(id: ClassId): ClassDef | undefined {
  return CLASSES.find((c) => c.id === id);
}

export function applyClassToPlayer(
  player: Fighter,
  classId: ClassId,
): Fighter {
  switch (classId) {
    case "warrior":
      return {
        ...player,
        name: "Воин",
        iconId: 3,
        maxHp: player.maxHp + 15,
        hp: player.hp + 15,
        armor: player.armor + 1,
        shieldPerTurn: player.shieldPerTurn + 4,
        thorns: player.thorns + 3,
      };
    case "rogue":
      return {
        ...player,
        name: "Разбойник",
        iconId: 13,
        maxHp: Math.max(30, player.maxHp - 5),
        hp: Math.max(30, player.hp - 5),
        atk: player.atk + 2,
        critChance: Math.min(0.55, player.critChance + 0.1),
        critMult: Math.max(player.critMult, 2.3),
        cleaveHits: player.cleaveHits + 1,
        cleaveRatio: Math.max(player.cleaveRatio, 0.5),
      };
    case "mage":
      return {
        ...player,
        name: "Маг",
        iconId: 27,
        maxHp: Math.max(30, player.maxHp - 8),
        hp: Math.max(30, player.hp - 8),
        regen: player.regen + 2,
        shieldPerTurn: player.shieldPerTurn + 3,
        poisonOnHit: player.poisonOnHit + 1,
        vamp: Math.min(0.4, player.vamp + 0.05),
      };
  }
}

export function skillsForClass(classId: ClassId): SkillId[] {
  switch (classId) {
    case "warrior":
      return ["burst", "guard", "bash"];
    case "rogue":
      return ["burst", "toxin", "backstab"];
    case "mage":
      return ["guard", "siphon", "nova"];
  }
}

const DEFAULT_KIT: IntentTemplate[] = [
  { kind: "attack" },
  { kind: "attack" },
  { kind: "defend", shield: 8 },
];

/** Уникальные циклы намерений по id монстра. */
export const MONSTER_KITS: Record<number, IntentTemplate[]> = {
  1: [{ kind: "attack" }, { kind: "attack" }, { kind: "defend", shield: 6 }],
  2: [
    { kind: "attack" },
    { kind: "heavy", ratio: 1.3 },
    { kind: "attack" },
  ],
  3: [
    { kind: "attack" },
    { kind: "heavy", ratio: 1.35 },
    { kind: "attack" },
    { kind: "attack" },
  ],
  4: [
    { kind: "attack" },
    { kind: "defend", shield: 10 },
    { kind: "poison", stacks: 2 },
    { kind: "attack" },
  ],
  5: [
    { kind: "attack" },
    { kind: "heavy", ratio: 1.25 },
    { kind: "defend", shield: 8 },
    { kind: "attack" },
  ],
  6: [
    { kind: "poison", stacks: 2 },
    { kind: "attack" },
    { kind: "heavy", ratio: 1.2 },
  ],
  13: [
    { kind: "attack" },
    { kind: "heavy", ratio: 1.35 },
    { kind: "attack" },
    { kind: "buff", atk: 2 },
  ],
  14: [
    { kind: "defend", shield: 14 },
    { kind: "attack" },
    { kind: "heavy", ratio: 1.3 },
    { kind: "attack" },
  ],
  15: [
    { kind: "heavy", ratio: 1.4 },
    { kind: "attack" },
    { kind: "attack" },
    { kind: "poison", stacks: 1 },
  ],
  21: [
    { kind: "defend", shield: 10 },
    { kind: "attack" },
    { kind: "defend", shield: 8 },
    { kind: "attack" },
  ],
  22: [
    { kind: "attack" },
    { kind: "attack" },
    { kind: "heavy", ratio: 1.45 },
  ],
  23: [
    { kind: "buff", atk: 2 },
    { kind: "attack" },
    { kind: "attack" },
    { kind: "heavy", ratio: 1.25 },
  ],
  24: [
    { kind: "defend", shield: 16 },
    { kind: "heavy", ratio: 1.35 },
    { kind: "defend", shield: 10 },
    { kind: "attack" },
  ],
  25: [
    { kind: "poison", stacks: 3 },
    { kind: "attack" },
    { kind: "poison", stacks: 1 },
    { kind: "attack" },
  ],
  26: [
    { kind: "attack" },
    { kind: "poison", stacks: 2 },
    { kind: "heavy", ratio: 1.3 },
  ],
  27: [
    { kind: "buff", atk: 3 },
    { kind: "poison", stacks: 2 },
    { kind: "attack" },
    { kind: "defend", shield: 8 },
  ],
  28: [
    { kind: "heavy", ratio: 1.4 },
    { kind: "attack" },
    { kind: "heavy", ratio: 1.3 },
    { kind: "attack" },
  ],
  29: [
    { kind: "defend", shield: 12 },
    { kind: "defend", shield: 8 },
    { kind: "heavy", ratio: 1.6 },
    { kind: "attack" },
  ],
  7: [
    { kind: "defend", shield: 14 },
    { kind: "attack" },
    { kind: "defend", shield: 10 },
    { kind: "heavy", ratio: 1.2 },
  ],
  8: [
    { kind: "attack" },
    { kind: "buff", atk: 3 },
    { kind: "heavy", ratio: 1.35 },
    { kind: "attack" },
  ],
  9: [
    { kind: "attack" },
    { kind: "heavy", ratio: 1.3 },
    { kind: "attack" },
    { kind: "defend", shield: 8 },
  ],
  16: [
    { kind: "poison", stacks: 3 },
    { kind: "attack" },
    { kind: "poison", stacks: 2 },
    { kind: "heavy", ratio: 1.2 },
  ],
  17: [
    { kind: "heavy", ratio: 1.3 },
    { kind: "attack" },
    { kind: "buff", atk: 2 },
    { kind: "heavy", ratio: 1.25 },
  ],
  30: [
    { kind: "poison", stacks: 4 },
    { kind: "defend", shield: 10 },
    { kind: "poison", stacks: 3 },
    { kind: "attack" },
  ],
  31: [
    { kind: "buff", atk: 4 },
    { kind: "attack" },
    { kind: "heavy", ratio: 1.4 },
    { kind: "buff", atk: 2 },
  ],
  32: [
    { kind: "attack" },
    { kind: "heavy", ratio: 1.25 },
    { kind: "defend", shield: 12 },
    { kind: "heavy", ratio: 1.35 },
  ],
  33: [
    { kind: "heavy", ratio: 1.35 },
    { kind: "buff", atk: 2 },
    { kind: "heavy", ratio: 1.3 },
    { kind: "attack" },
  ],
  34: [
    { kind: "defend", shield: 18 },
    { kind: "heavy", ratio: 1.3 },
    { kind: "defend", shield: 14 },
    { kind: "heavy", ratio: 1.45 },
  ],
  10: [
    { kind: "attack" },
    { kind: "defend", shield: 12 },
    { kind: "heavy", ratio: 1.4 },
    { kind: "attack" },
    { kind: "buff", atk: 2 },
  ],
  11: [
    { kind: "heavy", ratio: 1.35 },
    { kind: "poison", stacks: 2 },
    { kind: "attack" },
    { kind: "defend", shield: 14 },
    { kind: "heavy", ratio: 1.5 },
  ],
  12: [
    { kind: "attack" },
    { kind: "heavy", ratio: 1.4 },
    { kind: "defend", shield: 16 },
    { kind: "buff", atk: 3 },
    { kind: "heavy", ratio: 1.45 },
  ],
  20: [
    { kind: "attack" },
    { kind: "heavy", ratio: 1.4 },
    { kind: "defend", shield: 18 },
    { kind: "poison", stacks: 3 },
    { kind: "buff", atk: 3 },
    { kind: "heavy", ratio: 1.55 },
  ],
};

export function monsterKit(monsterId: number): IntentTemplate[] {
  return MONSTER_KITS[monsterId] ?? DEFAULT_KIT;
}

export const MAX_FLOORS = 4;
export const BLITZ_FLOORS = 2;

export const GOLD_FIGHT = 18;
export const GOLD_ELITE = 45;
export const GOLD_BOSS = 70;

export const TAG_RU: Record<UpgradeTag, string> = {
  power: "сила",
  tank: "танк",
  poison: "яд",
  shield: "щит",
  cleave: "рассечение",
  crit: "крит",
};

export const ELITE_TRAIT_RU: Record<EliteTrait, string> = {
  poison: "яд · реген выкл, тик сильнее",
  thorns: "шипы · отражают все удары",
  enrage: "ярость · бешенство ниже 40%",
  barrier: "барьер · глотает первый удар хода",
  lifesteal: "вампир · лечится с любого урона",
};

export const RELICS: RelicDef[] = [
  {
    id: "plague_skull",
    title: "Череп чумы",
    description: "Старт с ядом +2 · навык Токсин",
    icon: "s1779", // Проклятие яда (череп)
  },
  {
    id: "ancestor_shield",
    title: "Щит предков",
    description: "+10 щита/ход · +1 броня",
    icon: "g0355", // Щит рыцаря
  },
  {
    id: "gold_compass",
    title: "Золотой компас",
    description: "+50% золота за бой",
    icon: "g0848", // Кусок карты
  },
  {
    id: "berserker_heart",
    title: "Сердце берсерка",
    description: "+3 ATK · +4 ярости · навык Рёв",
    icon: "g0659", // Заготовка клинка берсерка
  },
  {
    id: "venom_fang",
    title: "Клык яда",
    description: "+1 яд · тик +1 · навык Токсин",
    icon: "g0205", // Клык Рикмунсаса
  },
  {
    id: "lucky_coin",
    title: "Счастливая монета",
    description: "+10% крита · +15 золота на старте",
    icon: "g0733", // Монета Нулмара
  },
  {
    id: "blood_chalice",
    title: "Кровавая чаша",
    description: "+10 HP · +10% вампиризма · навык Вытягивание",
    icon: "g0830", // Кровь святого
  },
  {
    id: "echo_blade",
    title: "Клинок эха",
    description: "+1 рассечение · навык Вытягивание",
    icon: "g0627", // Клинок тёмного легиона
  },
  {
    id: "chrono_lens",
    title: "Линза хроноса",
    description: "Каждый 3-й ход: навыки остывают ещё на 1",
    icon: "g0493", // Кристалл стеклянного ягуара
  },
  {
    id: "ward_blade",
    title: "Клинок-щит",
    description: "Защита даёт +4 ATK до конца боя",
    icon: "g0092", // Щит Варда
  },
  {
    id: "toxin_heart",
    title: "Сердце токсина",
    description: "Яд на тебе лечит вместо урона",
    icon: "g1024", // Тёмное зелье
  },
  {
    id: "phoenix_ash",
    title: "Пепел феникса",
    description: "Раз за бой: вместо смерти — 1 HP и +20 щита",
    icon: "g0498", // Пепел
  },
  {
    id: "blood_pact",
    title: "Кровавый пакт",
    description: "Атака: −3 HP, но +40% урона",
    icon: "g0257", // Кровь мудреца
  },
  {
    id: "elite_seal",
    title: "Печать элиты",
    description: "После элиты следующий магазин −35%",
    icon: "g0831", // Печать света
  },
];

const BASE_RELIC_IDS: RelicId[] = [
  "plague_skull",
  "ancestor_shield",
  "gold_compass",
  "berserker_heart",
  "venom_fang",
  "lucky_coin",
  "chrono_lens",
  "ward_blade",
  "toxin_heart",
];

const UNLOCK_RELIC: Partial<Record<MetaUnlockId, RelicId>> = {
  relic_blood: "blood_chalice",
  relic_echo: "echo_blade",
  relic_phoenix: "phoenix_ash",
  relic_pact: "blood_pact",
  relic_elite: "elite_seal",
};

/** Базовые действия боя → иконки скиллов dataset. */
export const BASIC_ACTION_ICONS = {
  attack: "s1346", // Мощный удар
  defend: "s1539", // Щит-крепость
} as const;

export const SKILLS: SkillDef[] = [
  {
    id: "burst",
    title: "Удар",
    description: "180% ATK урона",
    cooldown: 4,
    icon: "s1357", // Смертельный удар
  },
  {
    id: "guard",
    title: "Заслон",
    description: "+20 щита",
    cooldown: 3,
    icon: "s1539", // Щит-крепость
  },
  {
    id: "toxin",
    title: "Токсин",
    description: "+4 яда · уязвимость 1 ход",
    cooldown: 3,
    icon: "s1423", // Яд
  },
  {
    id: "roar",
    title: "Рёв",
    description: "+6 ATK до конца боя",
    cooldown: 5,
    icon: "s1419", // Боевой рёв
  },
  {
    id: "siphon",
    title: "Вытягивание",
    description: "80% ATK + лечение 12",
    cooldown: 4,
    icon: "s1514", // Похищение жизни
  },
  {
    id: "bash",
    title: "Удар щитом",
    description: "120% ATK + 10 щита · слабость 2 хода",
    cooldown: 3,
    icon: "s1397", // Оглушение щитом
  },
  {
    id: "backstab",
    title: "Удар в спину",
    description: "200% если враг атакует (+уязвимость), иначе 115%",
    cooldown: 4,
    icon: "s1366", // Удар в спину
  },
  {
    id: "nova",
    title: "Вспышка",
    description: "70% ATK + 3 яда · уязвимость",
    cooldown: 3,
    icon: "s1523", // Призыв большого взрыва
  },
];

export function actionIcon(kind: "attack" | "defend" | SkillId): string {
  if (kind === "attack") return BASIC_ACTION_ICONS.attack;
  if (kind === "defend") return BASIC_ACTION_ICONS.defend;
  return skillById(kind)?.icon ?? BASIC_ACTION_ICONS.attack;
}

export function relicById(id: RelicId): RelicDef | undefined {
  return RELICS.find((r) => r.id === id);
}

export function skillById(id: SkillId): SkillDef | undefined {
  return SKILLS.find((s) => s.id === id);
}

export function skillsForRun(
  classId: ClassId,
  relic: RelicId | null,
  unlocks: MetaUnlockId[] = [],
): SkillId[] {
  const skills = [...skillsForClass(classId)];
  const add = (id: SkillId) => {
    if (!skills.includes(id)) skills.push(id);
  };
  if (unlocks.includes("skill_siphon")) add("siphon");
  if (relic === "plague_skull" || relic === "venom_fang") add("toxin");
  if (relic === "berserker_heart") add("roar");
  if (relic === "blood_chalice" || relic === "echo_blade") add("siphon");
  return skills;
}

export function pickRelicChoices(
  rng: () => number,
  unlocks: MetaUnlockId[] = [],
): RelicDef[] {
  const allowed = new Set<RelicId>(BASE_RELIC_IDS);
  for (const id of unlocks) {
    const relicId = UNLOCK_RELIC[id];
    if (relicId) allowed.add(relicId);
  }
  const pool = RELICS.filter((r) => allowed.has(r.id));
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = tmp;
  }
  return pool.slice(0, 3);
}

export const UPGRADES: UpgradeDef[] = [
  {
    id: "atk",
    title: "Клинок",
    description: "+3 к атаке",
    tags: ["power"],
    icon: "g0002", // Длинный меч
  },
  {
    id: "maxHp",
    title: "Живучесть",
    description: "+18 макс. HP и полное лечение",
    tags: ["tank"],
    icon: "g0438", // Зелье исцеления
  },
  {
    id: "regen",
    title: "Регенерация",
    description: "+2 HP за ход",
    tags: ["tank"],
    icon: "s1455", // Быстрое восстановление HP
  },
  {
    id: "crit",
    title: "Удача",
    description: "+12% шанс крита",
    tags: ["crit"],
    icon: "s1427", // Шанс крит. удара
  },
  {
    id: "poison",
    title: "Яд",
    description: "+2 яда за удар (тик в начале хода)",
    tags: ["poison"],
    icon: "s1423", // Яд
  },
  {
    id: "venom",
    title: "Токсин",
    description: "+1 яд за удар, тик яда +1 за стак",
    tags: ["poison"],
    icon: "s1748", // Змеиный яд
  },
  {
    id: "plague",
    title: "Чума",
    description: "Тик яда ×1.5 · сильнее с Ядом/Токсином",
    tags: ["poison"],
    icon: "s1407", // Чумной труп
  },
  {
    id: "barrier",
    title: "Барьер",
    description: "+8 щита в начале хода",
    tags: ["shield"],
    icon: "s1421", // Духовный барьер
  },
  {
    id: "fortify",
    title: "Укрепление",
    description: "+5 щита/ход и +2 брони · синергия со щитом",
    tags: ["shield", "tank"],
    icon: "s1516", // Финальная крепость
  },
  {
    id: "iron",
    title: "Кольчуга",
    description: "+3 брони (снижает входящий урон)",
    tags: ["tank"],
    icon: "g0263", // Кольчатый нагрудник
  },
  {
    id: "cleave",
    title: "Рассечение",
    description: "Доп. удар на 45% ATK",
    tags: ["cleave", "power"],
    icon: "s1344", // Тройной рубящий удар
  },
  {
    id: "whirl",
    title: "Вихрь",
    description: "+1 доп. удар · доля доп. удара +20%",
    tags: ["cleave"],
    icon: "s1787", // Вихрь
  },
  {
    id: "vamp",
    title: "Кровопийца",
    description: "15% урона возвращается как HP",
    tags: ["power"],
    icon: "s1532", // Танец вампира
  },
  {
    id: "thorns",
    title: "Шипы",
    description: "Отражает 4 урона при попадании по HP",
    tags: ["tank"],
    icon: "s1665", // Шип
  },
  {
    id: "sharp",
    title: "Заточка",
    description: "Крит бьёт ×2.5 вместо ×2 · синергия с удачей",
    tags: ["crit"],
    icon: "g0360", // Камень заточки оружия
  },
  {
    id: "berserk",
    title: "Берсерк",
    description: "+5 ATK, пока HP ниже 50%",
    tags: ["power"],
    icon: "s1673", // Танец берсерка
  },
];

export const SHOP_OFFERS: ShopOffer[] = [
  {
    id: "heal",
    title: "Зелье",
    description: "Восстановить 40% макс. HP",
    cost: 22,
    icon: "g0439", // Старшее зелье исцеления
  },
  {
    id: "atk",
    title: "Точильный камень",
    description: "+2 к атаке",
    cost: 30,
    icon: "g0420", // Камень заточки оружия III
  },
  {
    id: "maxHp",
    title: "Амулет",
    description: "+12 макс. HP (текущее тоже +12)",
    cost: 28,
    icon: "g0410", // Ожерелье защиты
  },
  {
    id: "upgrade",
    title: "Случайный дар",
    description: "Случайный боевой бафф",
    cost: 40,
    icon: "g0088", // Свиток мудрости
  },
];

const RARE_SHOP_BY_TAG: Partial<
  Record<UpgradeTag, Omit<ShopOffer, "cost"> & { cost: number }>
> = {
  poison: {
    id: "poison_vial",
    title: "Ядовитая склянка",
    description: "+2 яда за удар",
    cost: 36,
    icon: "g1023", // Зелье ветра
    rare: true,
  },
  shield: {
    id: "shield_kit",
    title: "Клепка щита",
    description: "+6 щита/ход",
    cost: 34,
    icon: "g0349", // Бронзовый щит
    rare: true,
  },
  crit: {
    id: "crit_scope",
    title: "Прицел",
    description: "+8% крита",
    cost: 32,
    icon: "g0389", // Аквамариновое кольцо
    rare: true,
  },
  cleave: {
    id: "cleave_oil",
    title: "Масло рассечения",
    description: "Доля доп. удара +15%",
    cost: 34,
    icon: "g0056", // Орочий меч
    rare: true,
  },
};

const SYNERGY_TOME: ShopOffer = {
  id: "synergy_tome",
  title: "Свиток синергии",
  description: "Случайный бафф под твои теги",
  cost: 48,
  icon: "g1142", // Древний пергамент
  rare: true,
};

/** Общая иконка отказа в событиях (не пересекается с реликвиями/наградами). */
const EVENT_LEAVE_ICON = "g0506"; // Синтетический пепел

export const EVENTS: EventDef[] = [
  {
    id: "blood_pact",
    title: "Кровавый договор",
    body: "Алтарь просит кровь в обмен на силу.",
    choices: [
      {
        id: "accept",
        title: "Отдать кровь",
        description: "−20% текущего HP → +4 ATK",
        icon: "g1020", // Зелье огня
      },
      {
        id: "refuse",
        title: "Уйти",
        description: "Ничего не меняется",
        icon: EVENT_LEAVE_ICON,
      },
    ],
  },
  {
    id: "gambler",
    title: "Кости судьбы",
    body: "Незнакомец предлагает бросок. Риск или спокойный уход.",
    choices: [
      {
        id: "risk",
        title: "Бросить кости",
        description: "50%: +25 золота · 50%: −18 HP",
        icon: "g0466", // Кристалл I
      },
      {
        id: "refuse",
        title: "Не играть",
        description: "Уйти без потерь",
        icon: EVENT_LEAVE_ICON,
      },
    ],
  },
  {
    id: "shrine",
    title: "Тёмный алтарь",
    body: "Можно пожертвовать живучестью ради удара.",
    choices: [
      {
        id: "crit",
        title: "Пожертвовать",
        description: "−12 HP → +10% крита",
        icon: "g0262", // Книга еретика
      },
      {
        id: "heal_pay",
        title: "Помолиться золотом",
        description: "−20 золота → полное лечение (если хватает)",
        icon: "g1025", // Святое зелье
      },
      {
        id: "refuse",
        title: "Пройти мимо",
        description: "Без изменений",
        icon: EVENT_LEAVE_ICON,
      },
    ],
  },
  {
    id: "fountain",
    title: "Источник пепла",
    body: "Вода тёплая, но пахнет металлом.",
    choices: [
      {
        id: "drink",
        title: "Испить",
        description: "+35% макс. HP",
        icon: "g1021", // Зелье воды
      },
      {
        id: "bottle",
        title: "Набрать в флягу",
        description: "+12 золота, без лечения",
        icon: "g0480", // Камень души
      },
      {
        id: "refuse",
        title: "Обойти",
        description: "Без изменений",
        icon: EVENT_LEAVE_ICON,
      },
    ],
  },
  {
    id: "smith",
    title: "Бродячий кузнец",
    body: "За звон монет заточит клинок.",
    choices: [
      {
        id: "pay",
        title: "Заплатить",
        description: "−18 золота → +3 ATK",
        icon: "g0074", // Железный молот
      },
      {
        id: "refuse",
        title: "Отказаться",
        description: "Уйти",
        icon: EVENT_LEAVE_ICON,
      },
    ],
  },
  {
    id: "curse_chest",
    title: "Проклятый сундук",
    body: "Замок шепчет. Внутри наверняка золото.",
    choices: [
      {
        id: "open",
        title: "Вскрыть",
        description: "+40 золота · −10 макс. HP",
        icon: "g0533", // Камень глаза бесконечности
      },
      {
        id: "refuse",
        title: "Не трогать",
        description: "Безопасно",
        icon: EVENT_LEAVE_ICON,
      },
    ],
  },
  {
    id: "poison_well",
    title: "Колодец гнили",
    body: "Зелёная жижа кипит. Можно выпить или обмакнуть клинок.",
    choices: [
      {
        id: "drink",
        title: "Выпить",
        description: "−15 HP → +3 яда за удар",
        icon: "g1022", // Зелье земли
      },
      {
        id: "blade",
        title: "Обмакнуть клинок",
        description: "+1 яд · тик +1",
        icon: "g0009", // Костяной кинжал
      },
      {
        id: "refuse",
        title: "Отойти",
        description: "Без изменений",
        icon: EVENT_LEAVE_ICON,
      },
    ],
  },
  {
    id: "armory",
    title: "Заброшенная оружейная",
    body: "Стойка с бронёй и ржавыми клинками.",
    choices: [
      {
        id: "armor",
        title: "Надеть броню",
        description: "+2 брони · +8 щита/ход",
        icon: "g0272", // Латный доспех
      },
      {
        id: "blade",
        title: "Взять клинок",
        description: "+4 ATK",
        icon: "g0107", // Меч рыцаря
      },
      {
        id: "refuse",
        title: "Ничего не трогать",
        description: "Уйти",
        icon: EVENT_LEAVE_ICON,
      },
    ],
  },
  {
    id: "mirror_lake",
    title: "Зеркальное озеро",
    body: "Отражение предлагает обмен силы на защиту.",
    choices: [
      {
        id: "trade_atk",
        title: "Отдать силу",
        description: "−3 ATK → +4 брони",
        icon: "g0352", // Кайт-щит
      },
      {
        id: "trade_armor",
        title: "Отдать защиту",
        description: "−2 брони → +4 ATK",
        icon: "g0058", // Полуторный меч
      },
      {
        id: "refuse",
        title: "Не смотреть",
        description: "Уйти",
        icon: EVENT_LEAVE_ICON,
      },
    ],
  },
];

/** Разлок через мету `events_build`. */
export const BUILD_EVENTS: EventDef[] = [
  {
    id: "soul_trade",
    title: "Сделка с тенью",
    body: "Тень предлагает вечную жажду вместо плоти.",
    choices: [
      {
        id: "accept",
        title: "Принять",
        description: "−25% макс. HP → +3 реген · +10% вампиризма",
        icon: "g0408", // Тёмное ожерелье
      },
      {
        id: "refuse",
        title: "Отказаться",
        description: "Уйти",
        icon: EVENT_LEAVE_ICON,
      },
    ],
  },
  {
    id: "class_rift",
    title: "Разлом классов",
    body: "Твои навыки мерцают — можно вырвать чужой приём.",
    choices: [
      {
        id: "swap",
        title: "Перекроить",
        description: "Случайный навык → другой случайный",
        icon: "g0157", // Кристальный посох
      },
      {
        id: "focus",
        title: "Усилить стиль",
        description: "−15 HP → апгрейд под твои теги",
        icon: "g0097", // Магическое кольцо
      },
      {
        id: "refuse",
        title: "Закрыть разлом",
        description: "Уйти",
        icon: EVENT_LEAVE_ICON,
      },
    ],
  },
  {
    id: "omen_path",
    title: "Знамение пути",
    body: "Камень показывает два будущих шага.",
    choices: [
      {
        id: "power",
        title: "Путь клинка",
        description: "+3 ATK · −2 брони",
        icon: "g0104", // Меч хребта
      },
      {
        id: "greed",
        title: "Путь жадности",
        description: "+35 золота · скидка магазина 40%",
        icon: "g0467", // Кристалл II
      },
      {
        id: "refuse",
        title: "Не читать",
        description: "Уйти",
        icon: EVENT_LEAVE_ICON,
      },
    ],
  },
];

/** Разлок через мету `events_rare`. */
export const RARE_EVENTS: EventDef[] = [
  {
    id: "library",
    title: "Забытая библиотека",
    body: "Пыльные тома обещают знание — за цену.",
    choices: [
      {
        id: "study",
        title: "Читать",
        description: "−12 HP → случайный апгрейд под билд",
        icon: "g0086", // Книга заклинаний ученика
      },
      {
        id: "steal",
        title: "Украсть свиток",
        description: "+20 золота · риск −10 HP (40%)",
        icon: "g0436", // Свиток Бормолшера
      },
      {
        id: "refuse",
        title: "Закрыть дверь",
        description: "Уйти",
        icon: EVENT_LEAVE_ICON,
      },
    ],
  },
  {
    id: "scavenger",
    title: "Сборщик костей",
    body: "Торгует трофеями. Ему нужна кровь или золото.",
    choices: [
      {
        id: "blood",
        title: "Отдать кровь",
        description: "−25% текущего HP → редкий бафф магазина",
        icon: "g0260", // Клыки чертила
      },
      {
        id: "pay",
        title: "Заплатить",
        description: "−25 золота → +5 ATK",
        icon: "g0005", // Булава
      },
      {
        id: "refuse",
        title: "Отказаться",
        description: "Уйти",
        icon: EVENT_LEAVE_ICON,
      },
    ],
  },
];

export const FINAL_BOSS: MonsterDef = {
  id: 20,
  name: "Пожиратель миров",
  iconId: 1899,
  hp: 220,
  atk: 15,
  boss: true,
  final: true,
};

export const MONSTERS: MonsterDef[] = [
  { id: 1, name: "Скелет", iconId: 125, hp: 28, atk: 5 },
  { id: 2, name: "Гоблин", iconId: 37, hp: 32, atk: 6 },
  { id: 3, name: "Волк", iconId: 358, hp: 36, atk: 7 },
  { id: 4, name: "Слизень", iconId: 41, hp: 40, atk: 5 },
  { id: 5, name: "Орк", iconId: 145, hp: 48, atk: 8 },
  { id: 6, name: "Призрак", iconId: 410, hp: 34, atk: 9 },
  { id: 13, name: "Гарпия", iconId: 154, hp: 38, atk: 8 },
  { id: 14, name: "Тролль", iconId: 435, hp: 58, atk: 7 },
  { id: 15, name: "Бандит", iconId: 1269, hp: 42, atk: 9 },
  { id: 21, name: "Жук-щит", iconId: 1230, hp: 36, atk: 4 },
  { id: 22, name: "Крыса", iconId: 133, hp: 24, atk: 7 },
  { id: 23, name: "Культист", iconId: 909, hp: 33, atk: 6 },
  { id: 24, name: "Каменный голем", iconId: 50, hp: 64, atk: 7 },
  { id: 25, name: "Ящер", iconId: 386, hp: 39, atk: 6 },
  { id: 26, name: "Имп", iconId: 38, hp: 30, atk: 8 },
  { id: 27, name: "Некромант", iconId: 1238, hp: 44, atk: 7 },
  { id: 28, name: "Берсерк-пёс", iconId: 815, hp: 41, atk: 9 },
  { id: 29, name: "Мимик", iconId: 852, hp: 50, atk: 8 },
  {
    id: 7,
    name: "Страж",
    iconId: 1793,
    hp: 55,
    atk: 9,
    elite: true,
    eliteTrait: "barrier",
  },
  {
    id: 8,
    name: "Палач",
    iconId: 1176,
    hp: 62,
    atk: 11,
    elite: true,
    eliteTrait: "enrage",
  },
  {
    id: 9,
    name: "Тёмный рыцарь",
    iconId: 562,
    hp: 70,
    atk: 12,
    elite: true,
    eliteTrait: "thorns",
  },
  {
    id: 16,
    name: "Ведьмак",
    iconId: 699,
    hp: 58,
    atk: 13,
    elite: true,
    eliteTrait: "poison",
  },
  {
    id: 17,
    name: "Химера",
    iconId: 56,
    hp: 78,
    atk: 12,
    elite: true,
    eliteTrait: "lifesteal",
  },
  {
    id: 30,
    name: "Алхимик",
    iconId: 1874,
    hp: 60,
    atk: 10,
    elite: true,
    eliteTrait: "poison",
  },
  {
    id: 31,
    name: "Командир орков",
    iconId: 1286,
    hp: 72,
    atk: 12,
    elite: true,
    eliteTrait: "enrage",
  },
  {
    id: 32,
    name: "Шипастый идол",
    iconId: 856,
    hp: 68,
    atk: 11,
    elite: true,
    eliteTrait: "thorns",
  },
  {
    id: 33,
    name: "Кровавый жрец",
    iconId: 687,
    hp: 66,
    atk: 12,
    elite: true,
    eliteTrait: "lifesteal",
  },
  {
    id: 34,
    name: "Стенолом",
    iconId: 127,
    hp: 80,
    atk: 11,
    elite: true,
    eliteTrait: "barrier",
  },
  { id: 10, name: "Демон-страж", iconId: 937, hp: 95, atk: 14, boss: true },
  { id: 11, name: "Владыка бездны", iconId: 933, hp: 120, atk: 16, boss: true },
  { id: 12, name: "Пожиратель", iconId: 1538, hp: 140, atk: 18, boss: true },
  FINAL_BOSS,
];

/** Боссы этажей 1–3 по ротации (финал — FINAL_BOSS). */
export const FLOOR_BOSSES: MonsterDef[] = [
  MONSTERS.find((m) => m.id === 10)!,
  MONSTERS.find((m) => m.id === 11)!,
  MONSTERS.find((m) => m.id === 12)!,
];

export function createBasePlayer(): Fighter {
  return {
    name: "Странник",
    iconId: 1,
    hp: 60,
    maxHp: 60,
    atk: 8,
    regen: 0,
    critChance: 0.08,
    critMult: 2,
    shield: 0,
    shieldPerTurn: 0,
    armor: 0,
    poisonOnHit: 0,
    poisonTickBonus: 0,
    poisonTickMult: 1,
    cleaveHits: 0,
    cleaveRatio: 0.45,
    vamp: 0,
    thorns: 0,
    rageAtk: 0,
    dot: 0,
    weakTurns: 0,
    vulnTurns: 0,
  };
}

export function goldReward(kind: RoomKind, floor: number): number {
  const base =
    kind === "elite"
      ? GOLD_ELITE
      : kind === "boss"
        ? GOLD_BOSS
        : kind === "fight"
          ? GOLD_FIGHT
          : 0;
  if (base <= 0) return 0;
  return Math.round(base * (1 + (floor - 1) * 0.14));
}

export function scaleMonster(
  def: MonsterDef,
  floor: number,
  difficultyCoeff = 1,
): Fighter {
  const mul = 1 + (floor - 1) * 0.26;
  const eliteBonus = def.elite ? 1.18 : 1;
  const finalBonus = def.final ? 1.1 : 1;
  const factor = mul * eliteBonus * finalBonus;
  const hp = Math.round(def.hp * factor * difficultyCoeff);
  let fighter: Fighter = {
    ...createBasePlayer(),
    name: def.name,
    iconId: def.iconId,
    hp,
    maxHp: hp,
    atk: Math.round(def.atk * factor),
    critChance: def.elite || def.boss ? 0.1 : 0.05,
    armor: def.final ? 2 : def.boss ? 1 : 0,
  };

  if (def.elite && def.eliteTrait) {
    switch (def.eliteTrait) {
      case "poison":
        fighter = { ...fighter, poisonOnHit: 2 };
        break;
      case "thorns":
        fighter = { ...fighter, thorns: 7 };
        break;
      case "enrage":
        fighter = { ...fighter, rageAtk: 6 };
        break;
      case "barrier":
        fighter = {
          ...fighter,
          shield: 12,
          shieldPerTurn: 3,
          armor: fighter.armor + 1,
        };
        break;
      case "lifesteal":
        fighter = { ...fighter, vamp: 0.35 };
        break;
    }
  }

  if (def.boss && !def.final) {
    fighter = {
      ...fighter,
      shield: Math.round(8 + floor * 4),
      critChance: Math.min(0.2, fighter.critChance + 0.05),
    };
  }

  return fighter;
}

export function upgradeById(id: UpgradeId): UpgradeDef | undefined {
  return UPGRADES.find((u) => u.id === id);
}

export function pickMonster(
  floor: number,
  kind: "fight" | "elite" | "boss",
  rng: () => number,
  opts?: { finalBoss?: boolean },
): MonsterDef {
  if (opts?.finalBoss || (kind === "boss" && floor >= MAX_FLOORS)) {
    return FINAL_BOSS;
  }

  if (kind === "boss") {
    return FLOOR_BOSSES[(floor - 1) % FLOOR_BOSSES.length] ?? FLOOR_BOSSES[0]!;
  }

  let pool = MONSTERS.filter((m) => {
    if (m.final) return false;
    if (kind === "elite") return Boolean(m.elite);
    return !m.elite && !m.boss;
  });

  if (kind === "fight") {
    if (floor <= 1) {
      pool = pool.filter((m) => m.hp <= 40);
    } else if (floor === 2) {
      pool = pool.filter((m) => m.hp >= 30 && m.hp <= 48);
    } else if (floor === 3) {
      pool = pool.filter((m) => m.hp >= 36);
    } else {
      pool = pool.filter((m) => m.hp >= 40);
    }
  }

  if (kind === "elite") {
    if (floor <= 2) {
      pool = pool.filter((m) => m.atk <= 12);
    } else {
      pool = pool.filter((m) => m.atk >= 11);
    }
  }

  if (pool.length === 0) {
    pool = MONSTERS.filter((m) => !m.final && !m.boss && !m.elite);
  }

  const idx = Math.floor(rng() * pool.length) % pool.length;
  return pool[idx] ?? MONSTERS[0]!;
}

export function pickEvent(
  rng: () => number,
  unlocks: MetaUnlockId[] = [],
): EventDef {
  const pool = [
    ...EVENTS,
    ...(unlocks.includes("events_rare") ? RARE_EVENTS : []),
    ...(unlocks.includes("events_build") ? BUILD_EVENTS : []),
  ];
  const idx = Math.floor(rng() * pool.length) % pool.length;
  return pool[idx]!;
}

export type SynergyDef = {
  tag: UpgradeTag;
  need: number;
  title: string;
  description: string;
};

export const SYNERGIES: SynergyDef[] = [
  {
    tag: "poison",
    need: 3,
    title: "Чумной каскад",
    description: "Тик яда ×1.5 · +1 яд за удар",
  },
  {
    tag: "shield",
    need: 3,
    title: "Живая стена",
    description: "+6 щита/ход · +4 шипов",
  },
  {
    tag: "cleave",
    need: 3,
    title: "Буря клинков",
    description: "+2 ATK · доля рассечения +15%",
  },
  {
    tag: "crit",
    need: 3,
    title: "Смертельный прицел",
    description: "+8% крита · крит ×2.75",
  },
  {
    tag: "power",
    need: 3,
    title: "Кровавая ярость",
    description: "+4 ATK · +3 берсерк",
  },
  {
    tag: "tank",
    need: 3,
    title: "Несокрушимый",
    description: "+15 макс. HP · +2 брони",
  },
];

export function applySynergyBonus(player: Fighter, tag: UpgradeTag): Fighter {
  switch (tag) {
    case "poison":
      return {
        ...player,
        poisonOnHit: player.poisonOnHit + 1,
        poisonTickMult: Math.min(3, player.poisonTickMult + 0.5),
      };
    case "shield":
      return {
        ...player,
        shieldPerTurn: player.shieldPerTurn + 6,
        thorns: player.thorns + 4,
      };
    case "cleave":
      return {
        ...player,
        atk: player.atk + 2,
        cleaveRatio: Math.min(0.95, player.cleaveRatio + 0.15),
      };
    case "crit":
      return {
        ...player,
        critChance: Math.min(0.7, player.critChance + 0.08),
        critMult: Math.max(player.critMult, 2.75),
      };
    case "power":
      return {
        ...player,
        atk: player.atk + 4,
        rageAtk: player.rageAtk + 3,
      };
    case "tank": {
      const maxHp = player.maxHp + 15;
      return {
        ...player,
        maxHp,
        hp: Math.min(maxHp, player.hp + 15),
        armor: player.armor + 2,
      };
    }
  }
}

export function pendingSynergies(
  picked: UpgradeId[],
  unlocked: UpgradeTag[],
): SynergyDef[] {
  const counts = new Map<UpgradeTag, number>();
  for (const id of picked) {
    for (const tag of upgradeById(id)?.tags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return SYNERGIES.filter(
    (s) => !unlocked.includes(s.tag) && (counts.get(s.tag) ?? 0) >= s.need,
  );
}

export function pickRandomSkill(
  rng: () => number,
  exclude: SkillId[],
): SkillId {
  const pool = SKILLS.map((s) => s.id).filter((id) => !exclude.includes(id));
  if (pool.length === 0) {
    return SKILLS[Math.floor(rng() * SKILLS.length) % SKILLS.length]!.id;
  }
  return pool[Math.floor(rng() * pool.length) % pool.length]!;
}

function ownedTags(picked: UpgradeId[]): Set<UpgradeTag> {
  const tags = new Set<UpgradeTag>();
  for (const id of picked) {
    const def = upgradeById(id);
    if (!def) continue;
    for (const t of def.tags) tags.add(t);
  }
  return tags;
}

export function shopOffersForVisit(
  rng: () => number,
  floor: number,
  pickedUpgrades: UpgradeId[] = [],
): ShopOffer[] {
  const scale = 1 + (floor - 1) * 0.08;
  const pool = SHOP_OFFERS.map((o) => ({
    ...o,
    cost: Math.round(o.cost * scale),
  }));
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = tmp;
  }
  const offers = pool.slice(0, 3);

  const tags = ownedTags(pickedUpgrades);
  const rarePool: ShopOffer[] = [];
  for (const tag of tags) {
    const rare = RARE_SHOP_BY_TAG[tag];
    if (rare) {
      rarePool.push({
        ...rare,
        cost: Math.round(rare.cost * scale),
      });
    }
  }
  if (tags.size >= 2) {
    rarePool.push({
      ...SYNERGY_TOME,
      cost: Math.round(SYNERGY_TOME.cost * scale),
    });
  }

  if (rarePool.length > 0 && rng() < 0.55) {
    const pick = rarePool[Math.floor(rng() * rarePool.length)]!;
    if (!offers.some((o) => o.id === pick.id)) {
      offers[offers.length - 1] = pick;
    }
  }

  return offers;
}

/** Случайный апгрейд, совпадающий с тегами билда (или любой). */
export function pickSynergyUpgrade(
  rng: () => number,
  picked: UpgradeId[],
): UpgradeDef {
  const tags = ownedTags(picked);
  let pool = UPGRADES;
  if (tags.size > 0) {
    const matched = UPGRADES.filter((u) => u.tags.some((t) => tags.has(t)));
    if (matched.length > 0) pool = matched;
  }
  return pool[Math.floor(rng() * pool.length) % pool.length]!;
}
