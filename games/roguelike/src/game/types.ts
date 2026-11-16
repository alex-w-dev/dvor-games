export type Phase =
  | "title"
  | "meta"
  | "class"
  | "relic"
  | "map"
  | "build"
  | "battle"
  | "reward"
  | "shop"
  | "event"
  | "result";

export type ClassId = "warrior" | "rogue" | "mage";

export type EnemyIntent =
  | { kind: "attack"; dmg: number; ratio?: number }
  | { kind: "heavy"; dmg: number; ratio: number }
  | { kind: "defend"; shield: number }
  | { kind: "buff"; atk: number }
  | { kind: "poison"; stacks: number };

export type IntentTemplate =
  | { kind: "attack"; ratio?: number }
  | { kind: "heavy"; ratio: number }
  | { kind: "defend"; shield: number }
  | { kind: "buff"; atk: number }
  | { kind: "poison"; stacks: number };

export type RelicId =
  | "plague_skull"
  | "ancestor_shield"
  | "gold_compass"
  | "berserker_heart"
  | "venom_fang"
  | "lucky_coin"
  | "blood_chalice"
  | "echo_blade"
  | "chrono_lens"
  | "ward_blade"
  | "toxin_heart"
  | "phoenix_ash"
  | "blood_pact"
  | "elite_seal";

export type BossMechanic = "wall" | "void" | "hunger" | "final" | null;

export type SkillId =
  | "burst"
  | "guard"
  | "toxin"
  | "roar"
  | "siphon"
  | "bash"
  | "backstab"
  | "nova";

export type EliteTrait =
  | "poison"
  | "thorns"
  | "enrage"
  | "barrier"
  | "lifesteal";

export type MetaUpgradeId =
  | "vitality"
  | "power"
  | "purse"
  | "luck"
  | "recovery";

export type MetaUnlockId =
  | "relic_blood"
  | "relic_echo"
  | "skill_siphon"
  | "events_rare"
  | "relic_phoenix"
  | "relic_pact"
  | "relic_elite"
  | "layouts_alt"
  | "events_build";

export type RunMode = "normal" | "blitz";

export type FloorLayoutId =
  | "fork"
  | "gauntlet"
  | "triad"
  | "shortcut"
  | "brutal"
  | "blitz";

export type MetaProgress = {
  essence: number;
  levels: Record<MetaUpgradeId, number>;
  unlocks: MetaUnlockId[];
  /** YYYY-M-D последнего засчитанного daily-win */
  dailyDate: string | null;
  dailyStreak: number;
  /** Множитель HP мобов; DDA между ранами. */
  difficultyCoeff: number;
};

export type RoomKind =
  | "fight"
  | "elite"
  | "rest"
  | "boss"
  | "shop"
  | "event";

export type UpgradeTag =
  | "power"
  | "tank"
  | "poison"
  | "shield"
  | "cleave"
  | "crit";

export type UpgradeId =
  | "atk"
  | "maxHp"
  | "regen"
  | "crit"
  | "poison"
  | "venom"
  | "plague"
  | "barrier"
  | "fortify"
  | "iron"
  | "cleave"
  | "whirl"
  | "vamp"
  | "thorns"
  | "sharp"
  | "berserk";

export type Fighter = {
  name: string;
  iconId: number;
  hp: number;
  maxHp: number;
  atk: number;
  regen: number;
  critChance: number;
  critMult: number;
  /** щит сейчас */
  shield: number;
  /** щит в начале хода */
  shieldPerTurn: number;
  /** снижение входящего урона */
  armor: number;
  /** стаки яда за основной удар */
  poisonOnHit: number;
  /** бонус к тику яда за стак */
  poisonTickBonus: number;
  /** множитель тика яда (1 = базовый) */
  poisonTickMult: number;
  /** доп. удары за ход */
  cleaveHits: number;
  /** доля ATK у доп. удара */
  cleaveRatio: number;
  /** вампиризм 0..1 */
  vamp: number;
  /** отражение при получении урона по HP */
  thorns: number;
  /** бонус ATK при HP < 50% */
  rageAtk: number;
  /** текущие стаки яда на цели (бой) */
  dot: number;
  /** ходов слабости: −25% исходящего урона */
  weakTurns: number;
  /** ходов уязвимости: +50% входящего урона */
  vulnTurns: number;
};

export type MonsterDef = {
  id: number;
  name: string;
  iconId: number;
  hp: number;
  atk: number;
  elite?: boolean;
  eliteTrait?: EliteTrait;
  boss?: boolean;
  /** финальный босс 4 этажа */
  final?: boolean;
};

export type RelicDef = {
  id: RelicId;
  title: string;
  description: string;
  /** Иконка предмета из dataset (`gNNNN`), CDN `/ico/512/`. */
  icon: string;
};

export type SkillDef = {
  id: SkillId;
  title: string;
  description: string;
  cooldown: number;
  /** Иконка скилла из dataset (`sNNNN`), CDN `/ico/512/`. */
  icon: string;
};

export type UpgradeDef = {
  id: UpgradeId;
  title: string;
  description: string;
  tags: UpgradeTag[];
  /** Иконка dataset (`gNNNN` предмет / `sNNNN` скилл), CDN `/ico/512/`. */
  icon: string;
};

export type Room = {
  id: string;
  kind: RoomKind;
  monsterId?: number;
  label: string;
  hint?: string;
  /** next room ids; empty = end of floor */
  next: string[];
};

export type Floor = {
  rooms: Room[];
  startId: string;
  layoutId: FloorLayoutId;
  layoutLabel: string;
};

export type CombatLogTone =
  | "normal"
  | "crit"
  | "heal"
  | "poison"
  | "boss"
  | "shield";

export type CombatLogEntry = {
  id: number;
  text: string;
  tone?: CombatLogTone;
};

export type BattleState = {
  player: Fighter;
  enemy: Fighter;
  log: CombatLogEntry[];
  logSeq: number;
  roomId: string;
  isBoss: boolean;
  isElite: boolean;
  isFinalBoss: boolean;
  turn: number;
  bossPhase: number;
  banner: string | null;
  skills: SkillId[];
  skillCd: Partial<Record<SkillId, number>>;
  /** ждём выбор действия игрока */
  awaitingInput: boolean;
  eliteTrait: EliteTrait | null;
  /** барьер элиты: глотает первый удар хода */
  eliteBarrierUp: boolean;
  monsterId: number;
  relic: RelicId | null;
  phoenixUsed: boolean;
  bossMechanic: BossMechanic;
  /** что враг сделает после твоего хода */
  intent: EnemyIntent;
};

export type RunResult = {
  won: boolean;
  floor: number;
  roomsCleared: number;
  essenceEarned: number;
};

export type ShopOfferId =
  | "heal"
  | "atk"
  | "maxHp"
  | "upgrade"
  | "poison_vial"
  | "shield_kit"
  | "crit_scope"
  | "cleave_oil"
  | "synergy_tome";

export type ShopOffer = {
  id: ShopOfferId;
  title: string;
  description: string;
  cost: number;
  /** Иконка предмета из dataset (`gNNNN`), CDN `/ico/512/`. */
  icon: string;
  rare?: boolean;
  /** Уже куплено в этом визите — слот остаётся с галочкой. */
  bought?: boolean;
};

export type EventChoiceId = string;

export type EventChoice = {
  id: EventChoiceId;
  title: string;
  description: string;
  /** Иконка предмета из dataset (`gNNNN`), CDN `/ico/512/`. */
  icon: string;
};

export type EventDef = {
  id: string;
  title: string;
  body: string;
  choices: EventChoice[];
};

export type RunMods = {
  /** mid без магазина */
  noShop: boolean;
  /** больше элит на карте */
  eliteHeavy: boolean;
};

export type RunState = {
  phase: Phase;
  floor: number;
  maxFloors: number;
  mode: RunMode;
  runMods: RunMods;
  currentFloor: Floor | null;
  currentRoomId: string | null;
  availableNext: string[];
  player: Fighter;
  gold: number;
  battle: BattleState | null;
  rewardChoices: UpgradeDef[];
  pickedUpgrades: UpgradeId[];
  /** теги, по которым уже выдан бонус синергии ×3 */
  synergyUnlocked: UpgradeTag[];
  shopOffers: ShopOffer[];
  activeEvent: EventDef | null;
  roomsCleared: number;
  result: RunResult | null;
  seed: number;
  meta: MetaProgress;
  relicChoices: RelicDef[];
  selectedRelic: RelicId | null;
  selectedClass: ClassId | null;
  skills: SkillId[];
  goldMult: number;
  /** ежедневный сид */
  daily: boolean;
  /** скидка магазина 0..1 (elite_seal) */
  shopDiscount: number;
};
