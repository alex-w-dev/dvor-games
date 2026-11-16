import {
  beginCombatTurn,
  resolvePlayerAction,
  type PlayerCombatAction,
} from "./combat";
import {
  BLITZ_FLOORS,
  ELITE_TRAIT_RU,
  MAX_FLOORS,
  MONSTERS,
  applyClassToPlayer,
  applySynergyBonus,
  goldReward,
  pendingSynergies,
  pickEvent,
  pickRandomSkill,
  pickRelicChoices,
  pickSynergyUpgrade,
  scaleMonster,
  shopOffersForVisit,
  skillsForRun,
  UPGRADES,
  upgradeById,
} from "./content";
import { generateFloor } from "./generateFloor";
import {
  applyDailyWinBonus,
  applyRelicToPlayer,
  buyMetaUnlock,
  buyMetaUpgrade,
  calcEssenceEarned,
  clampDifficultyCoeff,
  createPlayerFromMeta,
  dailySeed,
  loadMeta,
  relicGoldBonus,
  relicGoldMult,
  saveMeta,
  startingGold,
} from "./meta";
import { createRng } from "./rng";
import type {
  ClassId,
  EventChoiceId,
  Fighter,
  MetaUnlockId,
  MetaUpgradeId,
  RelicId,
  Room,
  RunMods,
  RunState,
  ShopOfferId,
  UpgradeDef,
  UpgradeId,
  UpgradeTag,
} from "./types";

function floorOpts(state: RunState) {
  return {
    unlocks: state.meta.unlocks,
    mods: state.runMods,
    blitz: state.mode === "blitz",
  };
}

function rollRunMods(seed: number, daily: boolean): RunMods {
  const rng = createRng(seed ^ 0x9e3779b9);
  if (!daily) {
    return {
      noShop: rng() < 0.12,
      eliteHeavy: rng() < 0.15,
    };
  }
  return {
    noShop: rng() < 0.4,
    eliteHeavy: rng() < 0.45,
  };
}

function applyNewSynergies(
  player: Fighter,
  picked: UpgradeId[],
  unlocked: UpgradeTag[],
): { player: Fighter; synergyUnlocked: UpgradeTag[]; gained: string[] } {
  const pending = pendingSynergies(picked, unlocked);
  let next = player;
  const synergyUnlocked = [...unlocked];
  const gained: string[] = [];
  for (const syn of pending) {
    next = applySynergyBonus(next, syn.tag);
    synergyUnlocked.push(syn.tag);
    gained.push(syn.title);
  }
  return { player: next, synergyUnlocked, gained };
}

export type RunAction =
  | { type: "START_RUN" }
  | { type: "START_DAILY" }
  | { type: "START_BLITZ" }
  | { type: "PICK_CLASS"; classId: ClassId }
  | { type: "PICK_RELIC"; relicId: RelicId }
  | { type: "OPEN_META" }
  | { type: "CLOSE_META" }
  | { type: "OPEN_BUILD" }
  | { type: "CLOSE_BUILD" }
  | { type: "BUY_META"; upgradeId: MetaUpgradeId }
  | { type: "BUY_UNLOCK"; unlockId: MetaUnlockId }
  | { type: "ENTER_ROOM"; roomId: string }
  | { type: "PLAYER_ACTION"; action: PlayerCombatAction }
  | { type: "PICK_UPGRADE"; upgradeId: UpgradeId }
  | { type: "SHOP_BUY"; offerId: ShopOfferId }
  | { type: "SHOP_LEAVE" }
  | { type: "EVENT_CHOOSE"; choiceId: EventChoiceId }
  | { type: "ABANDON_RUN" }
  | { type: "BACK_TO_TITLE" };

function shuffle<T>(items: T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

function findRoom(state: RunState, roomId: string): Room | undefined {
  return state.currentFloor?.rooms.find((r) => r.id === roomId);
}

function applyUpgrade(player: Fighter, id: UpgradeId): Fighter {
  switch (id) {
    case "atk":
      return { ...player, atk: player.atk + 3 };
    case "maxHp": {
      const maxHp = player.maxHp + 18;
      return { ...player, maxHp, hp: maxHp };
    }
    case "regen":
      return { ...player, regen: player.regen + 2 };
    case "crit":
      return {
        ...player,
        critChance: Math.min(0.6, player.critChance + 0.12),
      };
    case "poison":
      return { ...player, poisonOnHit: player.poisonOnHit + 2 };
    case "venom":
      return {
        ...player,
        poisonOnHit: player.poisonOnHit + 1,
        poisonTickBonus: player.poisonTickBonus + 1,
      };
    case "plague":
      return {
        ...player,
        poisonTickMult: Math.min(3, player.poisonTickMult + 0.5),
      };
    case "barrier":
      return { ...player, shieldPerTurn: player.shieldPerTurn + 8 };
    case "fortify":
      return {
        ...player,
        shieldPerTurn: player.shieldPerTurn + 5,
        armor: player.armor + 2,
      };
    case "iron":
      return { ...player, armor: player.armor + 3 };
    case "cleave":
      return {
        ...player,
        cleaveHits: player.cleaveHits + 1,
        cleaveRatio: Math.max(player.cleaveRatio, 0.45),
      };
    case "whirl":
      return {
        ...player,
        cleaveHits: player.cleaveHits + 1,
        cleaveRatio: Math.min(0.9, player.cleaveRatio + 0.2),
      };
    case "vamp":
      return { ...player, vamp: Math.min(0.45, player.vamp + 0.15) };
    case "thorns":
      return { ...player, thorns: player.thorns + 4 };
    case "sharp":
      return { ...player, critMult: Math.max(player.critMult, 2.5) };
    case "berserk":
      return { ...player, rageAtk: player.rageAtk + 5 };
  }
}

function rewardChoices(
  rng: () => number,
  owned: UpgradeId[] | undefined,
): UpgradeDef[] {
  const ownedTags = new Set(
    (owned ?? []).flatMap((id) => upgradeById(id)?.tags ?? []),
  );
  const scored = UPGRADES.map((u) => {
    const synergy = u.tags.some((t) => ownedTags.has(t)) ? 1.35 : 1;
    return { u, w: synergy + rng() };
  });
  scored.sort((a, b) => b.w - a.w);
  return scored.slice(0, 3).map((s) => s.u);
}

function settleRun(
  state: RunState,
  input: {
    won: boolean;
    floor: number;
    roomsCleared: number;
    gold: number;
    countForDifficulty: boolean;
  },
): Pick<RunState, "meta" | "result"> {
  const base = calcEssenceEarned(input);
  let meta = state.meta;
  let essenceEarned = base;
  if (state.daily && input.won) {
    const daily = applyDailyWinBonus(meta, base);
    meta = daily.meta;
    essenceEarned = daily.essenceEarned;
  } else {
    meta = { ...meta, essence: meta.essence + base };
  }
  if (input.countForDifficulty) {
    const delta = input.won ? 0.1 : -0.1;
    meta = {
      ...meta,
      difficultyCoeff: clampDifficultyCoeff(meta.difficultyCoeff + delta),
    };
  }
  saveMeta(meta);
  return {
    meta,
    result: {
      won: input.won,
      floor: input.floor,
      roomsCleared: input.roomsCleared,
      essenceEarned,
    },
  };
}

function advanceFromRoom(state: RunState, room: Room): RunState {
  const roomsCleared = state.roomsCleared + 1;

  if (room.next.length === 0) {
    const nextFloor = state.floor + 1;
    const rng = createRng(state.seed + nextFloor * 997);
    const floor = generateFloor(
      nextFloor,
      state.maxFloors,
      rng,
      floorOpts(state),
    );
    return {
      ...state,
      phase: "map",
      floor: nextFloor,
      currentFloor: floor,
      currentRoomId: null,
      availableNext: [floor.startId],
      roomsCleared,
      shopOffers: [],
      activeEvent: null,
      battle: null,
      rewardChoices: [],
    };
  }

  return {
    ...state,
    phase: "map",
    currentRoomId: room.id,
    availableNext: room.next,
    roomsCleared,
    shopOffers: [],
    activeEvent: null,
    battle: null,
    rewardChoices: [],
  };
}

function afterCombatWin(state: RunState, room: Room): RunState {
  const player = state.battle?.player ?? state.player;
  const isFinalBoss = room.kind === "boss" && state.floor >= state.maxFloors;
  const goldGain = Math.round(
    goldReward(room.kind, state.floor) * state.goldMult,
  );
  const gold = state.gold + goldGain;
  const roomsCleared = state.roomsCleared + 1;
  const shopDiscount =
    room.kind === "elite" && state.selectedRelic === "elite_seal"
      ? 0.35
      : state.shopDiscount;

  if (isFinalBoss) {
    const settled = settleRun(state, {
      won: true,
      floor: state.floor,
      roomsCleared,
      gold,
      countForDifficulty: true,
    });
    return {
      ...state,
      phase: "result",
      player,
      gold,
      battle: null,
      roomsCleared,
      availableNext: [],
      ...settled,
    };
  }

  const rng = createRng(state.seed + roomsCleared * 131 + state.floor);
  const rewardedPlayer =
    room.kind === "elite" ? { ...player, atk: player.atk + 2 } : player;

  if (room.next.length === 0) {
    const nextFloor = state.floor + 1;
    const floorRng = createRng(state.seed + nextFloor * 997);
    const floor = generateFloor(
      nextFloor,
      state.maxFloors,
      floorRng,
      floorOpts(state),
    );
    return {
      ...state,
      phase: "reward",
      player: rewardedPlayer,
      gold,
      battle: null,
      floor: nextFloor,
      currentFloor: floor,
      currentRoomId: null,
      availableNext: [floor.startId],
      roomsCleared,
      shopDiscount,
      rewardChoices: rewardChoices(rng, state.pickedUpgrades),
    };
  }

  return {
    ...state,
    phase: "reward",
    player: rewardedPlayer,
    gold,
    battle: null,
    currentRoomId: room.id,
    availableNext: room.next,
    roomsCleared,
    shopDiscount,
    rewardChoices: rewardChoices(rng, state.pickedUpgrades),
  };
}

export function initialRunState(): RunState {
  return {
    phase: "title",
    floor: 1,
    maxFloors: MAX_FLOORS,
    mode: "normal",
    runMods: { noShop: false, eliteHeavy: false },
    currentFloor: null,
    currentRoomId: null,
    availableNext: [],
    player: createPlayerFromMeta(loadMeta()),
    gold: 0,
    battle: null,
    rewardChoices: [],
    pickedUpgrades: [],
    synergyUnlocked: [],
    shopOffers: [],
    activeEvent: null,
    roomsCleared: 0,
    result: null,
    seed: 0,
    meta: loadMeta(),
    relicChoices: [],
    selectedRelic: null,
    selectedClass: null,
    skills: ["burst", "guard"],
    goldMult: 1,
    daily: false,
    shopDiscount: 0,
  };
}

function beginRun(
  state: RunState,
  input: { seed: number; daily: boolean; mode: "normal" | "blitz" },
): RunState {
  const meta = state.meta;
  const maxFloors = input.mode === "blitz" ? BLITZ_FLOORS : MAX_FLOORS;
  return {
    ...initialRunState(),
    phase: "class",
    seed: input.seed,
    floor: 1,
    maxFloors,
    mode: input.mode,
    runMods: rollRunMods(input.seed, input.daily),
    player: createPlayerFromMeta(meta),
    gold: startingGold(meta) + (input.mode === "blitz" ? 10 : 0),
    meta,
    daily: input.daily,
  };
}

export function runReducer(state: RunState, action: RunAction): RunState {
  switch (action.type) {
    case "START_RUN": {
      const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
      return beginRun(state, { seed, daily: false, mode: "normal" });
    }

    case "START_DAILY": {
      return beginRun(state, {
        seed: dailySeed(),
        daily: true,
        mode: "normal",
      });
    }

    case "START_BLITZ": {
      const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
      return beginRun(state, { seed, daily: false, mode: "blitz" });
    }

    case "PICK_CLASS": {
      if (state.phase !== "class") return state;
      const rng = createRng(state.seed);
      const player = applyClassToPlayer(state.player, action.classId);
      return {
        ...state,
        phase: "relic",
        player,
        selectedClass: action.classId,
        skills: skillsForRun(action.classId, null, state.meta.unlocks),
        relicChoices: pickRelicChoices(rng, state.meta.unlocks),
      };
    }

    case "PICK_RELIC": {
      if (state.phase !== "relic") return state;
      if (!state.selectedClass) return state;
      if (!state.relicChoices.some((r) => r.id === action.relicId)) return state;
      const rng = createRng(state.seed);
      const floor = generateFloor(1, state.maxFloors, rng, floorOpts(state));
      const player = applyRelicToPlayer(state.player, action.relicId);
      const skills = skillsForRun(
        state.selectedClass,
        action.relicId,
        state.meta.unlocks,
      );
      return {
        ...state,
        phase: "map",
        currentFloor: floor,
        availableNext: [floor.startId],
        player,
        gold: state.gold + relicGoldBonus(action.relicId),
        selectedRelic: action.relicId,
        skills,
        goldMult: relicGoldMult(action.relicId),
        relicChoices: [],
      };
    }

    case "OPEN_META":
      if (state.phase !== "title" && state.phase !== "result") return state;
      return { ...state, phase: "meta" };

    case "CLOSE_META":
      if (state.phase !== "meta") return state;
      return { ...state, phase: "title", result: null };

    case "BUY_META": {
      if (state.phase !== "meta") return state;
      const next = buyMetaUpgrade(state.meta, action.upgradeId);
      if (!next) return state;
      saveMeta(next);
      return { ...state, meta: next };
    }

    case "BUY_UNLOCK": {
      if (state.phase !== "meta") return state;
      const next = buyMetaUnlock(state.meta, action.unlockId);
      if (!next) return state;
      saveMeta(next);
      return { ...state, meta: next };
    }

    case "OPEN_BUILD":
      if (state.phase !== "map") return state;
      return { ...state, phase: "build" };

    case "CLOSE_BUILD":
      if (state.phase !== "build") return state;
      return { ...state, phase: "map" };

    case "ENTER_ROOM": {
      const room = findRoom(state, action.roomId);
      if (!room || !state.availableNext.includes(action.roomId)) return state;

      if (room.kind === "rest") {
        const heal = Math.max(1, Math.round(state.player.maxHp * 0.3));
        const player = {
          ...state.player,
          hp: Math.min(state.player.maxHp, state.player.hp + heal),
        };
        return advanceFromRoom({ ...state, player }, room);
      }

      if (room.kind === "shop") {
        const rng = createRng(state.seed + state.roomsCleared * 59 + 7);
        const discount = state.shopDiscount;
        const offers = shopOffersForVisit(
          rng,
          state.floor,
          state.pickedUpgrades,
        ).map((o) => ({
          ...o,
          cost: Math.max(1, Math.round(o.cost * (1 - discount))),
        }));
        return {
          ...state,
          phase: "shop",
          currentRoomId: room.id,
          availableNext: [],
          shopOffers: offers,
          shopDiscount: 0,
          activeEvent: null,
          battle: null,
        };
      }

      if (room.kind === "event") {
        const rng = createRng(state.seed + state.roomsCleared * 71 + 11);
        return {
          ...state,
          phase: "event",
          currentRoomId: room.id,
          availableNext: [],
          activeEvent: pickEvent(rng, state.meta.unlocks),
          shopOffers: [],
          battle: null,
        };
      }

      const def =
        MONSTERS.find((m) => m.id === room.monsterId) ?? MONSTERS[0]!;
      const enemy = scaleMonster(
        def,
        state.floor,
        state.meta.difficultyCoeff,
      );
      const isFinalBoss =
        room.kind === "boss" &&
        (Boolean(def.final) || state.floor >= state.maxFloors);
      const eliteTrait =
        room.kind === "elite" ? (def.eliteTrait ?? null) : null;
      const intro =
        isFinalBoss
          ? {
              log: [
                {
                  id: 1 as const,
                  text: "Финал: три фазы. Держись.",
                  tone: "boss" as const,
                },
              ],
              logSeq: 1,
              banner: "Фаза 1 — Пробуждение",
            }
          : room.kind === "boss"
            ? {
                log: [
                  {
                    id: 1 as const,
                    text:
                      def.id === 10
                        ? `${enemy.name}: ниже 50% — Стена`
                        : def.id === 11
                          ? `${enemy.name}: ниже 50% — Бездна`
                          : def.id === 12
                            ? `${enemy.name}: ниже 50% — Голод`
                            : `Босс этажа: ${enemy.name}`,
                    tone: "boss" as const,
                  },
                ],
                logSeq: 1,
                banner: null,
              }
            : eliteTrait
              ? {
                  log: [
                    {
                      id: 1 as const,
                      text: `Элита · ${ELITE_TRAIT_RU[eliteTrait]}`,
                      tone: "boss" as const,
                    },
                  ],
                  logSeq: 1,
                  banner: null,
                }
              : { log: [], logSeq: 0, banner: null };
      const started = beginCombatTurn({
        player: { ...state.player },
        enemy,
        log: intro.log,
        logSeq: intro.logSeq,
        roomId: room.id,
        isBoss: room.kind === "boss",
        isElite: room.kind === "elite",
        isFinalBoss,
        turn: 0,
        bossPhase: 1,
        banner: intro.banner,
        skills: state.skills,
        skillCd: {},
        awaitingInput: false,
        eliteTrait,
        eliteBarrierUp: eliteTrait === "barrier",
        monsterId: def.id,
        relic: state.selectedRelic,
        phoenixUsed: false,
        bossMechanic: isFinalBoss ? "final" : null,
        intent: { kind: "attack", dmg: enemy.atk },
      });
      if (started.kind !== "ongoing") {
        // яд/крайний случай на старте — не ожидаем
        return {
          ...state,
          phase: "battle",
          currentRoomId: room.id,
          availableNext: [],
          battle: started.battle,
        };
      }
      return {
        ...state,
        phase: "battle",
        currentRoomId: room.id,
        availableNext: [],
        battle: started.battle,
      };
    }

    case "PLAYER_ACTION": {
      if (state.phase !== "battle" || !state.battle) return state;
      const rng = createRng(
        state.seed + state.battle.logSeq * 23 + state.roomsCleared * 5,
      );
      const result = resolvePlayerAction(
        state.battle,
        action.action,
        rng,
      );
      if (!result) return state;
      if (result.kind === "ongoing") {
        return { ...state, battle: result.battle };
      }
      if (result.kind === "lose") {
        const settled = settleRun(state, {
          won: false,
          floor: state.floor,
          roomsCleared: state.roomsCleared,
          gold: state.gold,
          countForDifficulty: true,
        });
        return {
          ...state,
          phase: "result",
          player: result.battle.player,
          battle: result.battle,
          ...settled,
        };
      }
      const winRoom = findRoom(state, result.battle.roomId);
      if (!winRoom) return state;
      return afterCombatWin(
        { ...state, player: result.battle.player, battle: result.battle },
        winRoom,
      );
    }

    case "PICK_UPGRADE": {
      if (state.phase !== "reward") return state;
      const pickedUpgrades = [...state.pickedUpgrades, action.upgradeId];
      let player = applyUpgrade(state.player, action.upgradeId);
      const syn = applyNewSynergies(
        player,
        pickedUpgrades,
        state.synergyUnlocked,
      );
      player = syn.player;
      return {
        ...state,
        phase: "map",
        player,
        rewardChoices: [],
        pickedUpgrades,
        synergyUnlocked: syn.synergyUnlocked,
      };
    }

    case "SHOP_BUY": {
      if (state.phase !== "shop") return state;
      const offer = state.shopOffers.find((o) => o.id === action.offerId);
      if (!offer || offer.bought || state.gold < offer.cost) return state;

      let player = state.player;
      const gold = state.gold - offer.cost;
      const rng = createRng(state.seed + state.roomsCleared * 13 + gold);
      const markBought = (offers: typeof state.shopOffers) =>
        offers.map((o) => (o.id === offer.id ? { ...o, bought: true } : o));

      switch (offer.id) {
        case "heal": {
          const heal = Math.max(1, Math.round(player.maxHp * 0.4));
          player = {
            ...player,
            hp: Math.min(player.maxHp, player.hp + heal),
          };
          break;
        }
        case "atk":
          player = { ...player, atk: player.atk + 2 };
          break;
        case "maxHp":
          player = {
            ...player,
            maxHp: player.maxHp + 12,
            hp: player.hp + 12,
          };
          break;
        case "upgrade": {
          const pick = shuffle(UPGRADES, rng)[0]!;
          const pickedUpgrades = [...state.pickedUpgrades, pick.id];
          player = applyUpgrade(player, pick.id);
          const syn = applyNewSynergies(
            player,
            pickedUpgrades,
            state.synergyUnlocked,
          );
          return {
            ...state,
            player: syn.player,
            gold,
            pickedUpgrades,
            synergyUnlocked: syn.synergyUnlocked,
            shopOffers: markBought(state.shopOffers),
          };
        }
        case "poison_vial":
          player = { ...player, poisonOnHit: player.poisonOnHit + 2 };
          break;
        case "shield_kit":
          player = {
            ...player,
            shieldPerTurn: player.shieldPerTurn + 6,
          };
          break;
        case "crit_scope":
          player = {
            ...player,
            critChance: Math.min(0.65, player.critChance + 0.08),
          };
          break;
        case "cleave_oil":
          player = {
            ...player,
            cleaveRatio: Math.min(0.95, player.cleaveRatio + 0.15),
          };
          break;
        case "synergy_tome": {
          const pick = pickSynergyUpgrade(rng, state.pickedUpgrades);
          const pickedUpgrades = [...state.pickedUpgrades, pick.id];
          player = applyUpgrade(player, pick.id);
          const syn = applyNewSynergies(
            player,
            pickedUpgrades,
            state.synergyUnlocked,
          );
          return {
            ...state,
            player: syn.player,
            gold,
            pickedUpgrades,
            synergyUnlocked: syn.synergyUnlocked,
            shopOffers: markBought(state.shopOffers),
          };
        }
      }

      return {
        ...state,
        player,
        gold,
        shopOffers: markBought(state.shopOffers),
      };
    }

    case "SHOP_LEAVE": {
      if (state.phase !== "shop" || !state.currentRoomId) return state;
      const room = findRoom(state, state.currentRoomId);
      if (!room) return state;
      return advanceFromRoom(state, room);
    }

    case "EVENT_CHOOSE": {
      if (state.phase !== "event" || !state.activeEvent || !state.currentRoomId)
        return state;
      const room = findRoom(state, state.currentRoomId);
      if (!room) return state;

      const choiceId = action.choiceId;
      let player = { ...state.player };
      let gold = state.gold;
      const rng = createRng(state.seed + state.roomsCleared * 19 + 3);

      if (state.activeEvent.id === "blood_pact" && choiceId === "accept") {
        const loss = Math.max(1, Math.round(player.hp * 0.2));
        player = {
          ...player,
          hp: Math.max(1, player.hp - loss),
          atk: player.atk + 4,
        };
      } else if (state.activeEvent.id === "gambler" && choiceId === "risk") {
        if (rng() < 0.5) {
          gold += 25;
        } else {
          player = { ...player, hp: Math.max(1, player.hp - 18) };
        }
      } else if (state.activeEvent.id === "shrine") {
        if (choiceId === "crit") {
          player = {
            ...player,
            hp: Math.max(1, player.hp - 12),
            critChance: Math.min(0.6, player.critChance + 0.1),
          };
        } else if (choiceId === "heal_pay") {
          if (gold < 20) return state;
          gold -= 20;
          player = { ...player, hp: player.maxHp };
        }
      } else if (state.activeEvent.id === "fountain") {
        if (choiceId === "drink") {
          const heal = Math.max(1, Math.round(player.maxHp * 0.35));
          player = {
            ...player,
            hp: Math.min(player.maxHp, player.hp + heal),
          };
        } else if (choiceId === "bottle") {
          gold += 12;
        }
      } else if (state.activeEvent.id === "smith") {
        if (choiceId === "pay") {
          if (gold < 18) return state;
          gold -= 18;
          player = { ...player, atk: player.atk + 3 };
        }
      } else if (
        state.activeEvent.id === "curse_chest" &&
        choiceId === "open"
      ) {
        gold += 40;
        const maxHp = Math.max(20, player.maxHp - 10);
        player = {
          ...player,
          maxHp,
          hp: Math.min(player.hp, maxHp),
        };
      } else if (state.activeEvent.id === "poison_well") {
        if (choiceId === "drink") {
          player = {
            ...player,
            hp: Math.max(1, player.hp - 15),
            poisonOnHit: player.poisonOnHit + 3,
          };
        } else if (choiceId === "blade") {
          player = {
            ...player,
            poisonOnHit: player.poisonOnHit + 1,
            poisonTickBonus: player.poisonTickBonus + 1,
          };
        }
      } else if (state.activeEvent.id === "armory") {
        if (choiceId === "armor") {
          player = {
            ...player,
            armor: player.armor + 2,
            shieldPerTurn: player.shieldPerTurn + 8,
          };
        } else if (choiceId === "blade") {
          player = { ...player, atk: player.atk + 4 };
        }
      } else if (state.activeEvent.id === "mirror_lake") {
        if (choiceId === "trade_atk") {
          player = {
            ...player,
            atk: Math.max(1, player.atk - 3),
            armor: player.armor + 4,
          };
        } else if (choiceId === "trade_armor") {
          player = {
            ...player,
            armor: Math.max(0, player.armor - 2),
            atk: player.atk + 4,
          };
        }
      } else if (state.activeEvent.id === "library") {
        if (choiceId === "study") {
          player = {
            ...player,
            hp: Math.max(1, player.hp - 12),
          };
          const pick = pickSynergyUpgrade(rng, state.pickedUpgrades);
          const pickedUpgrades = [...state.pickedUpgrades, pick.id];
          player = applyUpgrade(player, pick.id);
          const syn = applyNewSynergies(
            player,
            pickedUpgrades,
            state.synergyUnlocked,
          );
          return advanceFromRoom(
            {
              ...state,
              player: syn.player,
              gold,
              pickedUpgrades,
              synergyUnlocked: syn.synergyUnlocked,
            },
            room,
          );
        } else if (choiceId === "steal") {
          gold += 20;
          if (rng() < 0.4) {
            player = { ...player, hp: Math.max(1, player.hp - 10) };
          }
        }
      } else if (state.activeEvent.id === "scavenger") {
        if (choiceId === "blood") {
          const loss = Math.max(1, Math.round(player.hp * 0.25));
          player = { ...player, hp: Math.max(1, player.hp - loss) };
          const pick = pickSynergyUpgrade(rng, state.pickedUpgrades);
          const pickedUpgrades = [...state.pickedUpgrades, pick.id];
          player = applyUpgrade(player, pick.id);
          const syn = applyNewSynergies(
            player,
            pickedUpgrades,
            state.synergyUnlocked,
          );
          return advanceFromRoom(
            {
              ...state,
              player: syn.player,
              gold,
              pickedUpgrades,
              synergyUnlocked: syn.synergyUnlocked,
            },
            room,
          );
        } else if (choiceId === "pay") {
          if (gold < 25) return state;
          gold -= 25;
          player = { ...player, atk: player.atk + 5 };
        }
      } else if (state.activeEvent.id === "soul_trade" && choiceId === "accept") {
        const maxHp = Math.max(20, Math.round(player.maxHp * 0.75));
        player = {
          ...player,
          maxHp,
          hp: Math.min(player.hp, maxHp),
          regen: player.regen + 3,
          vamp: Math.min(0.5, player.vamp + 0.1),
        };
      } else if (state.activeEvent.id === "class_rift") {
        if (choiceId === "swap") {
          if (state.skills.length === 0) {
            return advanceFromRoom({ ...state, player, gold }, room);
          }
          const idx = Math.floor(rng() * state.skills.length) % state.skills.length;
          const nextSkills = [...state.skills];
          const replacement = pickRandomSkill(rng, nextSkills);
          nextSkills[idx] = replacement;
          return advanceFromRoom(
            { ...state, player, gold, skills: nextSkills },
            room,
          );
        }
        if (choiceId === "focus") {
          player = { ...player, hp: Math.max(1, player.hp - 15) };
          const pick = pickSynergyUpgrade(rng, state.pickedUpgrades);
          const pickedUpgrades = [...state.pickedUpgrades, pick.id];
          player = applyUpgrade(player, pick.id);
          const syn = applyNewSynergies(
            player,
            pickedUpgrades,
            state.synergyUnlocked,
          );
          return advanceFromRoom(
            {
              ...state,
              player: syn.player,
              gold,
              pickedUpgrades,
              synergyUnlocked: syn.synergyUnlocked,
            },
            room,
          );
        }
      } else if (state.activeEvent.id === "omen_path") {
        if (choiceId === "power") {
          player = {
            ...player,
            atk: player.atk + 3,
            armor: Math.max(0, player.armor - 2),
          };
        } else if (choiceId === "greed") {
          gold += 35;
          return advanceFromRoom(
            { ...state, player, gold, shopDiscount: Math.max(state.shopDiscount, 0.4) },
            room,
          );
        }
      }

      return advanceFromRoom({ ...state, player, gold }, room);
    }

    case "ABANDON_RUN": {
      if (
        state.phase === "title" ||
        state.phase === "meta" ||
        state.phase === "result"
      ) {
        return state;
      }
      const settled = settleRun(state, {
        won: false,
        floor: state.floor,
        roomsCleared: state.roomsCleared,
        gold: state.gold,
        countForDifficulty: false,
      });
      return {
        ...state,
        phase: "result",
        battle: state.battle
          ? { ...state.battle, awaitingInput: false }
          : state.battle,
        ...settled,
      };
    }

    case "BACK_TO_TITLE":
      return {
        ...initialRunState(),
        meta: state.meta,
        player: createPlayerFromMeta(state.meta),
      };

    default:
      return state;
  }
}
