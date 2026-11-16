import { monsterKit, skillById } from "./content";
import type {
  BattleState,
  BossMechanic,
  CombatLogTone,
  EnemyIntent,
  Fighter,
  IntentTemplate,
  SkillId,
} from "./types";

export type PlayerCombatAction =
  | { type: "attack" }
  | { type: "defend" }
  | { type: "skill"; skillId: SkillId };

function effectiveAtk(fighter: Fighter): number {
  const low = fighter.hp / fighter.maxHp < 0.5;
  const raw = fighter.atk + (low ? fighter.rageAtk : 0);
  if (fighter.weakTurns > 0) return Math.max(1, Math.floor(raw * 0.75));
  return raw;
}

function intentDmg(enemy: Fighter, ratio = 1): number {
  return Math.max(1, Math.floor(effectiveAtk(enemy) * ratio));
}

export function intentLabel(intent: EnemyIntent): string {
  switch (intent.kind) {
    case "attack":
      return `Атака ${intent.dmg}`;
    case "heavy":
      return `Тяжёлый удар ${intent.dmg}`;
    case "defend":
      return `Щит +${intent.shield}`;
    case "buff":
      return `Бафф +${intent.atk} ATK`;
    case "poison":
      return `Яд ×${intent.stacks}`;
  }
}

function materializeIntent(
  template: IntentTemplate,
  enemy: Fighter,
): EnemyIntent {
  switch (template.kind) {
    case "attack": {
      const ratio = template.ratio ?? 1;
      return { kind: "attack", dmg: intentDmg(enemy, ratio), ratio };
    }
    case "heavy":
      return {
        kind: "heavy",
        dmg: intentDmg(enemy, template.ratio),
        ratio: template.ratio,
      };
    case "defend":
      return { kind: "defend", shield: template.shield };
    case "buff":
      return { kind: "buff", atk: template.atk };
    case "poison":
      return { kind: "poison", stacks: template.stacks };
  }
}

function pickEnemyIntent(
  battle: BattleState,
  enemy: Fighter,
  turn: number,
  bossPhase: number,
): EnemyIntent {
  if (battle.isFinalBoss && bossPhase >= 2 && turn % 3 === 0) {
    return { kind: "heavy", dmg: intentDmg(enemy, 1.55), ratio: 1.55 };
  }

  const kit = monsterKit(battle.monsterId);
  const template = kit[(turn - 1) % kit.length] ?? kit[0]!;
  return materializeIntent(template, enemy);
}

function rollHit(
  attacker: Fighter,
  rng: () => number,
  ratio = 1,
): { dmg: number; crit: boolean } {
  const crit = rng() < attacker.critChance;
  const base = Math.max(
    1,
    Math.floor((effectiveAtk(attacker) + Math.floor(rng() * 3)) * ratio),
  );
  return { dmg: crit ? Math.floor(base * attacker.critMult) : base, crit };
}

/** С этого хода бой «ломается»: износ режет щит и бьёт HP напрямую. */
export const FATIGUE_TURN = 12;

function fatigueDamage(turn: number): number {
  return Math.max(0, turn - FATIGUE_TURN + 1) * 2;
}

/** Урон в HP, игнорируя щит и броню. */
function applyTrueHp(
  target: Fighter,
  raw: number,
): Fighter {
  return {
    ...target,
    hp: Math.max(0, target.hp - Math.max(0, raw)),
  };
}

function applyIncoming(
  target: Fighter,
  raw: number,
): { target: Fighter; hpLost: number; absorbed: number } {
  const scaled =
    target.vulnTurns > 0 ? Math.floor(raw * 1.5) : raw;
  let dmg = Math.max(0, scaled - target.armor);
  let shield = target.shield;
  let absorbed = 0;
  if (shield > 0 && dmg > 0) {
    absorbed = Math.min(shield, dmg);
    shield -= absorbed;
    dmg -= absorbed;
  }
  return {
    target: {
      ...target,
      shield,
      hp: Math.max(0, target.hp - dmg),
    },
    hpLost: dmg,
    absorbed,
  };
}

function tickStatusTurns(fighter: Fighter): Fighter {
  return {
    ...fighter,
    weakTurns: Math.max(0, fighter.weakTurns - 1),
    vulnTurns: Math.max(0, fighter.vulnTurns - 1),
  };
}

function tickPoison(target: Fighter): { target: Fighter; dmg: number } {
  if (target.dot <= 0) return { target, dmg: 0 };
  const perStack = 2 + target.poisonTickBonus;
  const dmg = Math.max(
    1,
    Math.floor(target.dot * perStack * target.poisonTickMult),
  );
  const next = applyIncoming(target, dmg);
  return {
    target: { ...next.target, dot: Math.max(0, target.dot - 1) },
    dmg: next.hpLost + next.absorbed,
  };
}

export type TickResult =
  | { kind: "ongoing"; battle: BattleState }
  | { kind: "win"; battle: BattleState }
  | { kind: "lose"; battle: BattleState };

function pushLog(
  log: BattleState["log"],
  logSeq: number,
  text: string,
  tone: CombatLogTone = "normal",
): { log: BattleState["log"]; logSeq: number } {
  const nextSeq = logSeq + 1;
  return {
    log: [...log, { id: nextSeq, text, tone }],
    logSeq: nextSeq,
  };
}

function applyBossPhase(
  battle: BattleState,
  enemy: Fighter,
  log: BattleState["log"],
  logSeq: number,
  player?: Fighter,
): {
  enemy: Fighter;
  player: Fighter | undefined;
  bossPhase: number;
  banner: string | null;
  bossMechanic: BossMechanic;
  log: BattleState["log"];
  logSeq: number;
} {
  if (!battle.isBoss) {
    return {
      enemy,
      player,
      bossPhase: battle.bossPhase,
      banner: null,
      bossMechanic: battle.bossMechanic,
      log,
      logSeq,
    };
  }

  const pct = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 0;
  let phase = battle.bossPhase;
  let next = enemy;
  let nextPlayer = player;
  let banner: string | null = battle.banner;
  let mechanic = battle.bossMechanic;
  let nextLog = log;
  let nextSeq = logSeq;

  if (battle.isFinalBoss) {
    if (phase < 2 && pct <= 0.66) {
      phase = 2;
      mechanic = "final";
      next = {
        ...next,
        atk: next.atk + 5,
        cleaveHits: Math.max(next.cleaveHits, 1),
        cleaveRatio: Math.max(next.cleaveRatio, 0.55),
        armor: next.armor + 2,
      };
      banner = "Фаза 2 — Ярость";
      ({ log: nextLog, logSeq: nextSeq } = pushLog(
        nextLog,
        nextSeq,
        "Пожиратель входит в ярость!",
        "boss",
      ));
    }

    if (phase < 3 && pct <= 0.33) {
      phase = 3;
      const heal = Math.round(next.maxHp * 0.12);
      next = {
        ...next,
        hp: Math.min(next.maxHp, next.hp + heal),
        atk: next.atk + 4,
        poisonOnHit: Math.max(next.poisonOnHit, 2),
        critChance: Math.min(0.35, next.critChance + 0.12),
        shield: next.shield + 24,
        rageAtk: next.rageAtk + 6,
      };
      banner = "Фаза 3 — Пожирание";
      ({ log: nextLog, logSeq: nextSeq } = pushLog(
        nextLog,
        nextSeq,
        `Фаза 3! Лечение ${heal}, щит и яд`,
        "boss",
      ));
    }
  } else if (phase < 2 && pct <= 0.5) {
    phase = 2;
    if (battle.monsterId === 10) {
      mechanic = "wall";
      next = {
        ...next,
        shield: next.shield + 28,
        shieldPerTurn: next.shieldPerTurn + 8,
        armor: next.armor + 2,
      };
      banner = "Фаза 2 — Стена";
      ({ log: nextLog, logSeq: nextSeq } = pushLog(
        nextLog,
        nextSeq,
        "Демон-страж возводит стену!",
        "boss",
      ));
    } else if (battle.monsterId === 11) {
      mechanic = "void";
      next = {
        ...next,
        poisonOnHit: Math.max(next.poisonOnHit, 3),
        atk: next.atk + 3,
      };
      banner = "Фаза 2 — Бездна";
      ({ log: nextLog, logSeq: nextSeq } = pushLog(
        nextLog,
        nextSeq,
        "Бездна тянет жизнь каждый ход!",
        "boss",
      ));
    } else if (battle.monsterId === 12) {
      mechanic = "hunger";
      const steal = 3;
      if (nextPlayer) {
        nextPlayer = {
          ...nextPlayer,
          atk: Math.max(1, nextPlayer.atk - steal),
        };
      }
      next = { ...next, atk: next.atk + steal + 4, vamp: Math.max(next.vamp, 0.2) };
      banner = "Фаза 2 — Голод";
      ({ log: nextLog, logSeq: nextSeq } = pushLog(
        nextLog,
        nextSeq,
        `Пожиратель крадёт ${steal} ATK!`,
        "boss",
      ));
    }
  }

  return {
    enemy: next,
    player: nextPlayer,
    bossPhase: phase,
    banner,
    bossMechanic: mechanic,
    log: nextLog,
    logSeq: nextSeq,
  };
}

function strike(
  attacker: Fighter,
  defender: Fighter,
  rng: () => number,
  ratio: number,
  applyPoison: boolean,
  opts?: { lifestealFull?: boolean; blocked?: boolean },
): {
  attacker: Fighter;
  defender: Fighter;
  dmg: number;
  crit: boolean;
  healed: number;
  blocked: boolean;
} {
  if (opts?.blocked) {
    return {
      attacker,
      defender,
      dmg: 0,
      crit: false,
      healed: 0,
      blocked: true,
    };
  }
  const hit = rollHit(attacker, rng, ratio);
  const applied = applyIncoming(defender, hit.dmg);
  let nextDef = applied.target;
  let nextAtk = attacker;
  let healed = 0;
  if (applyPoison && attacker.poisonOnHit > 0) {
    nextDef = { ...nextDef, dot: nextDef.dot + attacker.poisonOnHit };
  }
  const healBase = opts?.lifestealFull
    ? applied.hpLost + applied.absorbed
    : applied.hpLost;
  if (attacker.vamp > 0 && healBase > 0) {
    healed = Math.max(1, Math.floor(healBase * attacker.vamp));
    nextAtk = {
      ...nextAtk,
      hp: Math.min(nextAtk.maxHp, nextAtk.hp + healed),
    };
  }
  return {
    attacker: nextAtk,
    defender: nextDef,
    dmg: hit.dmg,
    crit: hit.crit,
    healed,
    blocked: false,
  };
}

function tickSkillCds(
  skillCd: BattleState["skillCd"],
): BattleState["skillCd"] {
  const next: BattleState["skillCd"] = {};
  for (const [id, cd] of Object.entries(skillCd)) {
    const left = Math.max(0, (cd ?? 0) - 1);
    if (left > 0) next[id as SkillId] = left;
  }
  return next;
}

type TurnCtx = {
  player: Fighter;
  enemy: Fighter;
  log: BattleState["log"];
  logSeq: number;
  bossPhase: number;
  banner: string | null;
  skillCd: BattleState["skillCd"];
  turn: number;
  intent: EnemyIntent;
  phoenixUsed: boolean;
  bossMechanic: BossMechanic;
  eliteBarrierUp: boolean;
};

function snapshot(
  battle: BattleState,
  ctx: TurnCtx,
  awaitingInput: boolean,
): BattleState {
  return {
    ...battle,
    player: ctx.player,
    enemy: ctx.enemy,
    log: ctx.log.slice(-12),
    logSeq: ctx.logSeq,
    turn: ctx.turn,
    bossPhase: ctx.bossPhase,
    banner: ctx.banner,
    skillCd: ctx.skillCd,
    intent: ctx.intent,
    phoenixUsed: ctx.phoenixUsed,
    bossMechanic: ctx.bossMechanic,
    eliteBarrierUp: ctx.eliteBarrierUp,
    awaitingInput,
  };
}

function consumeBarrier(battle: BattleState, ctx: TurnCtx): boolean {
  if (battle.eliteTrait !== "barrier" || !ctx.eliteBarrierUp) return false;
  ctx.eliteBarrierUp = false;
  ({ log: ctx.log, logSeq: ctx.logSeq } = pushLog(
    ctx.log,
    ctx.logSeq,
    "Барьер элиты глотает удар!",
    "shield",
  ));
  return true;
}

function enemyThornsOnHit(
  battle: BattleState,
  ctx: TurnCtx,
  hitIndex: number,
): TickResult | null {
  if (ctx.enemy.thorns <= 0) return null;
  const everyHit = battle.eliteTrait === "thorns";
  if (!everyHit && hitIndex !== 0) return null;
  const reflect = applyIncoming(ctx.player, ctx.enemy.thorns);
  ctx.player = reflect.target;
  ({ log: ctx.log, logSeq: ctx.logSeq } = pushLog(
    ctx.log,
    ctx.logSeq,
    `Шипы врага ${ctx.enemy.thorns}`,
    "normal",
  ));
  return trySurvive(battle, ctx);
}

function trySurvive(
  battle: BattleState,
  ctx: TurnCtx,
): TickResult | null {
  if (ctx.player.hp > 0) return null;
  if (battle.relic === "phoenix_ash" && !ctx.phoenixUsed) {
    ctx.phoenixUsed = true;
    ctx.player = {
      ...ctx.player,
      hp: 1,
      shield: ctx.player.shield + 20,
    };
    ({ log: ctx.log, logSeq: ctx.logSeq } = pushLog(
      ctx.log,
      ctx.logSeq,
      "Пепел феникса: ты жив!",
      "heal",
    ));
    return null;
  }
  return { kind: "lose", battle: snapshot(battle, ctx, false) };
}

function syncBossPhase(
  battle: BattleState,
  ctx: TurnCtx,
): void {
  const phased = applyBossPhase(
    { ...battle, bossPhase: ctx.bossPhase, bossMechanic: ctx.bossMechanic },
    ctx.enemy,
    ctx.log,
    ctx.logSeq,
    ctx.player,
  );
  ctx.enemy = phased.enemy;
  if (phased.player) ctx.player = phased.player;
  ctx.bossPhase = phased.bossPhase;
  ctx.banner = phased.banner;
  ctx.bossMechanic = phased.bossMechanic;
  ctx.log = phased.log;
  ctx.logSeq = phased.logSeq;
}

function applyPlayerStrikes(
  battle: BattleState,
  ctx: TurnCtx,
  rng: () => number,
): TickResult | null {
  if (battle.relic === "blood_pact") {
    const tax = applyIncoming(ctx.player, 3);
    ctx.player = tax.target;
    ({ log: ctx.log, logSeq: ctx.logSeq } = pushLog(
      ctx.log,
      ctx.logSeq,
      "Пакт: −3 HP",
      "boss",
    ));
    const died = trySurvive(battle, ctx);
    if (died) return died;
  }

  const hits = 1 + ctx.player.cleaveHits;
  for (let i = 0; i < hits; i += 1) {
    let ratio = i === 0 ? 1 : ctx.player.cleaveRatio;
    if (battle.relic === "blood_pact") ratio *= 1.4;
    const blocked = i === 0 && consumeBarrier(battle, ctx);
    const result = strike(ctx.player, ctx.enemy, rng, ratio, i === 0, {
      blocked,
    });
    ctx.player = result.attacker;
    ctx.enemy = result.defender;
    if (result.blocked) {
      // уже в логе барьера
    } else {
      const label =
        i === 0
          ? result.crit
            ? `Крит! ${result.dmg}`
            : `${ctx.player.name}: ${result.dmg}`
          : result.crit
            ? `Рассечение крит ${result.dmg}`
            : `Рассечение ${result.dmg}`;
      ({ log: ctx.log, logSeq: ctx.logSeq } = pushLog(
        ctx.log,
        ctx.logSeq,
        label,
        result.crit ? "crit" : "normal",
      ));
      if (result.healed > 0) {
        ({ log: ctx.log, logSeq: ctx.logSeq } = pushLog(
          ctx.log,
          ctx.logSeq,
          `Вампиризм +${result.healed}`,
          "heal",
        ));
      }
      const thorned = enemyThornsOnHit(battle, ctx, i);
      if (thorned) return thorned;
    }
    syncBossPhase(battle, ctx);
    if (ctx.enemy.hp <= 0) {
      return { kind: "win", battle: snapshot(battle, ctx, false) };
    }
  }
  return null;
}

function applyEnemyStrikes(
  battle: BattleState,
  ctx: TurnCtx,
  rng: () => number,
  ratio: number,
  slamLabel: string,
): TickResult | null {
  const enemyHits = 1 + (ctx.bossPhase >= 2 ? ctx.enemy.cleaveHits : 0);
  const fullVamp = battle.eliteTrait === "lifesteal";
  for (let i = 0; i < Math.max(1, enemyHits); i += 1) {
    const hitRatio = i === 0 ? ratio : ctx.enemy.cleaveRatio;
    const beforeHp = ctx.player.hp;
    const result = strike(ctx.enemy, ctx.player, rng, hitRatio, i === 0, {
      lifestealFull: fullVamp,
    });
    ctx.enemy = result.attacker;
    ctx.player = result.defender;
    ({ log: ctx.log, logSeq: ctx.logSeq } = pushLog(
      ctx.log,
      ctx.logSeq,
      result.crit
        ? `${slamLabel}${ctx.enemy.name} крит! ${result.dmg}`
        : `${slamLabel}${ctx.enemy.name}: ${result.dmg}`,
      ratio > 1 || result.crit ? "boss" : "normal",
    ));
    if (result.healed > 0 && fullVamp) {
      ({ log: ctx.log, logSeq: ctx.logSeq } = pushLog(
        ctx.log,
        ctx.logSeq,
        `Вампир элиты +${result.healed}`,
        "heal",
      ));
    }
    if (ctx.player.thorns > 0 && ctx.player.hp < beforeHp) {
      const thorns = applyIncoming(ctx.enemy, ctx.player.thorns);
      ctx.enemy = thorns.target;
      ({ log: ctx.log, logSeq: ctx.logSeq } = pushLog(
        ctx.log,
        ctx.logSeq,
        `Шипы ${ctx.player.thorns}`,
        "normal",
      ));
      if (ctx.enemy.hp <= 0) {
        return { kind: "win", battle: snapshot(battle, ctx, false) };
      }
    }
  }
  const died = trySurvive(battle, ctx);
  if (died) return died;
  if (ctx.enemy.hp <= 0) {
    return { kind: "win", battle: snapshot(battle, ctx, false) };
  }
  return null;
}

function applyEnemyTurn(
  battle: BattleState,
  ctx: TurnCtx,
  rng: () => number,
): TickResult | null {
  ctx.enemy = tickStatusTurns(ctx.enemy);
  const intent = battle.intent;

  if (intent.kind === "defend") {
    ctx.enemy = { ...ctx.enemy, shield: ctx.enemy.shield + intent.shield };
    ({ log: ctx.log, logSeq: ctx.logSeq } = pushLog(
      ctx.log,
      ctx.logSeq,
      `${ctx.enemy.name}: щит +${intent.shield}`,
      "shield",
    ));
    return null;
  }

  if (intent.kind === "buff") {
    ctx.enemy = { ...ctx.enemy, atk: ctx.enemy.atk + intent.atk };
    ({ log: ctx.log, logSeq: ctx.logSeq } = pushLog(
      ctx.log,
      ctx.logSeq,
      `${ctx.enemy.name}: +${intent.atk} ATK`,
      "boss",
    ));
    return null;
  }

  if (intent.kind === "poison") {
    ctx.player = { ...ctx.player, dot: ctx.player.dot + intent.stacks };
    ({ log: ctx.log, logSeq: ctx.logSeq } = pushLog(
      ctx.log,
      ctx.logSeq,
      `${ctx.enemy.name}: яд ×${intent.stacks}`,
      "poison",
    ));
    return null;
  }

  if (intent.kind === "heavy") {
    const ended = applyEnemyStrikes(
      battle,
      ctx,
      rng,
      intent.ratio,
      "Тяжёлый удар! ",
    );
    if (!ended) {
      ctx.player = {
        ...ctx.player,
        weakTurns: Math.max(ctx.player.weakTurns, 1),
      };
      ({ log: ctx.log, logSeq: ctx.logSeq } = pushLog(
        ctx.log,
        ctx.logSeq,
        "Ты ослаблен (−25% урона)",
        "boss",
      ));
    }
    return ended;
  }

  const ratio = intent.kind === "attack" ? (intent.ratio ?? 1) : 1;
  return applyEnemyStrikes(battle, ctx, rng, ratio, "");
}

function applySkillEffect(
  battle: BattleState,
  ctx: TurnCtx,
  skillId: SkillId,
  rng: () => number,
): TickResult | null {
  const def = skillById(skillId);
  if (!def) return null;

  const skillHits = new Set<SkillId>([
    "burst",
    "siphon",
    "bash",
    "backstab",
    "nova",
  ]);

  switch (skillId) {
    case "burst": {
      const blocked = consumeBarrier(battle, ctx);
      const result = strike(ctx.player, ctx.enemy, rng, 1.8, true, {
        blocked,
      });
      ctx.player = result.attacker;
      ctx.enemy = result.defender;
      if (!result.blocked) {
        ({ log: ctx.log, logSeq: ctx.logSeq } = pushLog(
          ctx.log,
          ctx.logSeq,
          result.crit ? `Удар! Крит ${result.dmg}` : `Удар: ${result.dmg}`,
          result.crit ? "crit" : "normal",
        ));
      }
      break;
    }
    case "guard": {
      ctx.player = { ...ctx.player, shield: ctx.player.shield + 20 };
      ({ log: ctx.log, logSeq: ctx.logSeq } = pushLog(
        ctx.log,
        ctx.logSeq,
        "Заслон: +20 щита",
        "shield",
      ));
      break;
    }
    case "toxin": {
      ctx.enemy = {
        ...ctx.enemy,
        dot: ctx.enemy.dot + 4,
        vulnTurns: Math.max(ctx.enemy.vulnTurns, 1),
      };
      ({ log: ctx.log, logSeq: ctx.logSeq } = pushLog(
        ctx.log,
        ctx.logSeq,
        "Токсин: +4 яда · уязвимость",
        "poison",
      ));
      break;
    }
    case "roar": {
      ctx.player = { ...ctx.player, atk: ctx.player.atk + 6 };
      ({ log: ctx.log, logSeq: ctx.logSeq } = pushLog(
        ctx.log,
        ctx.logSeq,
        "Рёв: +6 ATK",
        "boss",
      ));
      break;
    }
    case "siphon": {
      const blocked = consumeBarrier(battle, ctx);
      const result = strike(ctx.player, ctx.enemy, rng, 0.8, true, {
        blocked,
      });
      ctx.player = {
        ...result.attacker,
        hp: Math.min(
          result.attacker.maxHp,
          result.attacker.hp + (result.blocked ? 0 : 12),
        ),
      };
      ctx.enemy = result.defender;
      if (!result.blocked) {
        ({ log: ctx.log, logSeq: ctx.logSeq } = pushLog(
          ctx.log,
          ctx.logSeq,
          `Вытягивание: ${result.dmg} и +12 HP`,
          "heal",
        ));
      }
      break;
    }
    case "bash": {
      const blocked = consumeBarrier(battle, ctx);
      const result = strike(ctx.player, ctx.enemy, rng, 1.2, true, {
        blocked,
      });
      ctx.player = {
        ...result.attacker,
        shield: result.attacker.shield + 10,
      };
      ctx.enemy = result.blocked
        ? result.defender
        : {
            ...result.defender,
            weakTurns: Math.max(result.defender.weakTurns, 2),
          };
      if (!result.blocked) {
        ({ log: ctx.log, logSeq: ctx.logSeq } = pushLog(
          ctx.log,
          ctx.logSeq,
          result.crit
            ? `Удар щитом! Крит ${result.dmg} +10 щита · слабость`
            : `Удар щитом: ${result.dmg} +10 щита · слабость`,
          result.crit ? "crit" : "shield",
        ));
      } else {
        ({ log: ctx.log, logSeq: ctx.logSeq } = pushLog(
          ctx.log,
          ctx.logSeq,
          "Заслон: +10 щита",
          "shield",
        ));
      }
      break;
    }
    case "backstab": {
      const open =
        battle.intent.kind === "attack" || battle.intent.kind === "heavy";
      const ratio = open ? 2 : 1.15;
      const blocked = consumeBarrier(battle, ctx);
      const result = strike(ctx.player, ctx.enemy, rng, ratio, true, {
        blocked,
      });
      ctx.player = result.attacker;
      ctx.enemy =
        !result.blocked && open
          ? {
              ...result.defender,
              vulnTurns: Math.max(result.defender.vulnTurns, 2),
            }
          : result.defender;
      if (!result.blocked) {
        ({ log: ctx.log, logSeq: ctx.logSeq } = pushLog(
          ctx.log,
          ctx.logSeq,
          open
            ? result.crit
              ? `Удар в спину! Крит ${result.dmg} · уязвимость`
              : `Удар в спину: ${result.dmg} · уязвимость`
            : `Удар в спину (закрыт): ${result.dmg}`,
          result.crit ? "crit" : "normal",
        ));
      }
      break;
    }
    case "nova": {
      const blocked = consumeBarrier(battle, ctx);
      const result = strike(ctx.player, ctx.enemy, rng, 0.7, true, {
        blocked,
      });
      ctx.player = result.attacker;
      ctx.enemy = result.blocked
        ? result.defender
        : {
            ...result.defender,
            dot: result.defender.dot + 3,
            vulnTurns: Math.max(result.defender.vulnTurns, 1),
          };
      if (!result.blocked) {
        ({ log: ctx.log, logSeq: ctx.logSeq } = pushLog(
          ctx.log,
          ctx.logSeq,
          `Вспышка: ${result.dmg} +3 яда · уязвимость`,
          "poison",
        ));
      }
      break;
    }
  }

  ctx.skillCd = { ...ctx.skillCd, [skillId]: def.cooldown };

  if (skillHits.has(skillId) && ctx.enemy.hp > 0) {
    const thorned = enemyThornsOnHit(battle, ctx, 0);
    if (thorned) return thorned;
  }

  syncBossPhase(battle, ctx);

  if (ctx.enemy.hp <= 0) {
    return { kind: "win", battle: snapshot(battle, ctx, false) };
  }
  const died = trySurvive(battle, ctx);
  if (died) return died;
  return null;
}

/** Старт хода игрока: КД, щит/реген/яд. */
export function beginCombatTurn(battle: BattleState): TickResult {
  let skillCd = tickSkillCds(battle.skillCd);
  const turn = battle.turn + 1;
  if (battle.relic === "chrono_lens" && turn % 3 === 0) {
    skillCd = tickSkillCds(skillCd);
  }

  const ctx: TurnCtx = {
    player: { ...battle.player },
    enemy: { ...battle.enemy },
    log: [...battle.log],
    logSeq: battle.logSeq,
    bossPhase: battle.bossPhase,
    banner: battle.banner,
    skillCd,
    turn,
    intent: battle.intent,
    phoenixUsed: battle.phoenixUsed,
    bossMechanic: battle.bossMechanic,
    eliteBarrierUp:
      battle.eliteTrait === "barrier" ? true : battle.eliteBarrierUp,
  };

  ctx.player = tickStatusTurns(ctx.player);

  if (battle.relic === "chrono_lens" && turn % 3 === 0) {
    ({ log: ctx.log, logSeq: ctx.logSeq } = pushLog(
      ctx.log,
      ctx.logSeq,
      "Линза хроноса: КД −1",
      "heal",
    ));
  }

  if (ctx.bossMechanic === "void" && ctx.bossPhase >= 2) {
    const tax = applyIncoming(ctx.player, 4);
    ctx.player = tax.target;
    ({ log: ctx.log, logSeq: ctx.logSeq } = pushLog(
      ctx.log,
      ctx.logSeq,
      "Бездна: −4 HP",
      "boss",
    ));
    const died = trySurvive(battle, ctx);
    if (died) return died;
  }

  if (ctx.bossMechanic === "wall" && ctx.bossPhase >= 2) {
    ctx.enemy = { ...ctx.enemy, shield: ctx.enemy.shield + 6 };
  }

  if (ctx.player.shieldPerTurn > 0) {
    ctx.player = {
      ...ctx.player,
      shield: ctx.player.shield + ctx.player.shieldPerTurn,
    };
    ({ log: ctx.log, logSeq: ctx.logSeq } = pushLog(
      ctx.log,
      ctx.logSeq,
      `Щит +${ctx.player.shieldPerTurn}`,
      "shield",
    ));
  }

  if (ctx.enemy.shieldPerTurn > 0) {
    ctx.enemy = {
      ...ctx.enemy,
      shield: ctx.enemy.shield + ctx.enemy.shieldPerTurn,
    };
  }

  if (ctx.turn >= FATIGUE_TURN) {
    const wear = fatigueDamage(ctx.turn);
    const shred = (f: Fighter): Fighter =>
      applyTrueHp({ ...f, shield: Math.floor(f.shield / 2) }, wear);
    ctx.player = shred(ctx.player);
    ctx.enemy = shred(ctx.enemy);
    ({ log: ctx.log, logSeq: ctx.logSeq } = pushLog(
      ctx.log,
      ctx.logSeq,
      `Износ боя: −${wear} HP сквозь щит`,
      "boss",
    ));
    if (ctx.enemy.hp <= 0) {
      return { kind: "win", battle: snapshot(battle, ctx, false) };
    }
    const died = trySurvive(battle, ctx);
    if (died) return died;
  }

  if (
    battle.eliteTrait === "enrage" &&
    ctx.enemy.hp / ctx.enemy.maxHp <= 0.4 &&
    ctx.enemy.rageAtk < 10
  ) {
    ctx.enemy = {
      ...ctx.enemy,
      rageAtk: ctx.enemy.rageAtk + 4,
      atk: ctx.enemy.atk + 2,
    };
    ({ log: ctx.log, logSeq: ctx.logSeq } = pushLog(
      ctx.log,
      ctx.logSeq,
      "Элита в ярости!",
      "boss",
    ));
  }

  if (battle.eliteTrait === "barrier" && ctx.eliteBarrierUp) {
    ({ log: ctx.log, logSeq: ctx.logSeq } = pushLog(
      ctx.log,
      ctx.logSeq,
      "Барьер элиты готов",
      "shield",
    ));
  }

  const poisonBlocksRegen =
    battle.eliteTrait === "poison" && ctx.player.dot > 0;

  if (
    ctx.player.regen > 0 &&
    ctx.player.hp > 0 &&
    ctx.player.hp < ctx.player.maxHp &&
    !poisonBlocksRegen
  ) {
    const heal = Math.min(ctx.player.regen, ctx.player.maxHp - ctx.player.hp);
    ctx.player = { ...ctx.player, hp: ctx.player.hp + heal };
    ({ log: ctx.log, logSeq: ctx.logSeq } = pushLog(
      ctx.log,
      ctx.logSeq,
      `Реген +${heal}`,
      "heal",
    ));
  } else if (poisonBlocksRegen && ctx.player.regen > 0) {
    ({ log: ctx.log, logSeq: ctx.logSeq } = pushLog(
      ctx.log,
      ctx.logSeq,
      "Яд элиты глушит реген",
      "poison",
    ));
  }

  if (ctx.player.dot > 0) {
    if (battle.relic === "toxin_heart") {
      const heal = Math.max(1, ctx.player.dot * 2);
      ctx.player = {
        ...ctx.player,
        hp: Math.min(ctx.player.maxHp, ctx.player.hp + heal),
        dot: Math.max(0, ctx.player.dot - 1),
      };
      ({ log: ctx.log, logSeq: ctx.logSeq } = pushLog(
        ctx.log,
        ctx.logSeq,
        `Сердце токсина +${heal}`,
        "heal",
      ));
    } else {
      const tickTarget =
        battle.eliteTrait === "poison"
          ? {
              ...ctx.player,
              poisonTickMult: Math.max(ctx.player.poisonTickMult, 1) * 1.5,
            }
          : ctx.player;
      const poisoned = tickPoison(tickTarget);
      ctx.player = {
        ...poisoned.target,
        poisonTickMult: ctx.player.poisonTickMult,
      };
      ({ log: ctx.log, logSeq: ctx.logSeq } = pushLog(
        ctx.log,
        ctx.logSeq,
        `Яд по тебе: ${poisoned.dmg}`,
        "poison",
      ));
      const died = trySurvive(battle, ctx);
      if (died) return died;
    }
  }

  if (ctx.enemy.dot > 0) {
    const poisoned = tickPoison({
      ...ctx.enemy,
      poisonTickBonus: ctx.player.poisonTickBonus,
      poisonTickMult: ctx.player.poisonTickMult,
    });
    ctx.enemy = poisoned.target;
    ({ log: ctx.log, logSeq: ctx.logSeq } = pushLog(
      ctx.log,
      ctx.logSeq,
      `Яд: ${poisoned.dmg}`,
      "poison",
    ));
    syncBossPhase(battle, ctx);
    if (ctx.enemy.hp <= 0) {
      return { kind: "win", battle: snapshot(battle, ctx, false) };
    }
  }

  ctx.intent = pickEnemyIntent(battle, ctx.enemy, ctx.turn, ctx.bossPhase);

  ({ log: ctx.log, logSeq: ctx.logSeq } = pushLog(
    ctx.log,
    ctx.logSeq,
    `Твой ход ${ctx.turn}`,
    "normal",
  ));

  return { kind: "ongoing", battle: snapshot(battle, ctx, true) };
}

/** Действие игрока → ответ врага → следующий ход (или конец боя). */
export function resolvePlayerAction(
  battle: BattleState,
  action: PlayerCombatAction,
  rng: () => number,
): TickResult | null {
  if (!battle.awaitingInput) return null;

  const ctx: TurnCtx = {
    player: { ...battle.player },
    enemy: { ...battle.enemy },
    log: [...battle.log],
    logSeq: battle.logSeq,
    bossPhase: battle.bossPhase,
    banner: battle.banner,
    skillCd: { ...battle.skillCd },
    turn: battle.turn,
    intent: battle.intent,
    phoenixUsed: battle.phoenixUsed,
    bossMechanic: battle.bossMechanic,
    eliteBarrierUp: battle.eliteBarrierUp,
  };

  if (action.type === "attack") {
    const ended = applyPlayerStrikes(battle, ctx, rng);
    if (ended) return ended;
  } else if (action.type === "defend") {
    ctx.player = { ...ctx.player, shield: ctx.player.shield + 15 };
    ({ log: ctx.log, logSeq: ctx.logSeq } = pushLog(
      ctx.log,
      ctx.logSeq,
      "Защита: +15 щита",
      "shield",
    ));
    if (battle.relic === "ward_blade") {
      ctx.player = { ...ctx.player, atk: ctx.player.atk + 4 };
      ({ log: ctx.log, logSeq: ctx.logSeq } = pushLog(
        ctx.log,
        ctx.logSeq,
        "Клинок-щит: +4 ATK",
        "boss",
      ));
    }
  } else {
    if (!battle.skills.includes(action.skillId)) return null;
    if ((battle.skillCd[action.skillId] ?? 0) > 0) return null;
    const ended = applySkillEffect(battle, ctx, action.skillId, rng);
    if (ended === null && !skillById(action.skillId)) return null;
    if (ended) return ended;
  }

  const enemyEnded = applyEnemyTurn(battle, ctx, rng);
  if (enemyEnded) return enemyEnded;

  return beginCombatTurn(snapshot(battle, ctx, false));
}
