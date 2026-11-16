import { useEffect, useRef, useState } from "react";
import { FATIGUE_TURN, type PlayerCombatAction } from "../game/combat";
import { avatarIconUrl, itemIconUrl, monsterIconUrl } from "../game/assets";
import { actionIcon, ELITE_TRAIT_RU, skillById } from "../game/content";
import { playSfx } from "../game/sfx";
import type {
  BattleState,
  CombatLogTone,
  EnemyIntent,
  Fighter,
  SkillId,
} from "../game/types";

type Props = {
  battle: BattleState;
  onAction: (action: PlayerCombatAction) => void;
};

type Floater = {
  id: number;
  side: "player" | "enemy";
  text: string;
  tone: CombatLogTone;
};

type ActionTone = "attack" | "defend" | "poison" | "heal" | "buff";

function HpBar({
  hp,
  maxHp,
  player,
}: {
  hp: number;
  maxHp: number;
  player?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  return (
    <>
      <div className={`bar ${player ? "player" : ""}`}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <div className="hp-text">
        {hp} / {maxHp}
      </div>
    </>
  );
}

function floaterToneClass(tone: CombatLogTone): string {
  if (tone === "normal") return "floater";
  return `floater floater-${tone}`;
}

function StatusIcons({ fighter }: { fighter: Fighter }) {
  return (
    <div className="status-icons">
      {fighter.shield > 0 ? (
        <span className="status-pill status-shield" title="Щит">
          <StatusGlyph kind="shield" />
          {fighter.shield}
        </span>
      ) : null}
      {fighter.dot > 0 ? (
        <span className="status-pill status-poison" title="Яд">
          <StatusGlyph kind="poison" />
          {fighter.dot}
        </span>
      ) : null}
      {fighter.thorns > 0 ? (
        <span className="status-pill status-thorns" title="Шипы">
          <StatusGlyph kind="thorns" />
          {fighter.thorns}
        </span>
      ) : null}
      {fighter.rageAtk > 0 ? (
        <span className="status-pill status-rage" title="Ярость">
          <StatusGlyph kind="rage" />
          {fighter.rageAtk}
        </span>
      ) : null}
      {fighter.weakTurns > 0 ? (
        <span className="status-pill status-rage" title="Слабость">
          <StatusGlyph kind="weak" />
          {fighter.weakTurns}
        </span>
      ) : null}
      {fighter.vulnTurns > 0 ? (
        <span className="status-pill status-poison" title="Уязвимость">
          <StatusGlyph kind="vuln" />
          {fighter.vulnTurns}
        </span>
      ) : null}
    </div>
  );
}

function StatusGlyph({
  kind,
}: {
  kind: "shield" | "poison" | "thorns" | "rage" | "weak" | "vuln";
}) {
  if (kind === "shield") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className="glyph">
        <path
          fill="currentColor"
          d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3z"
        />
      </svg>
    );
  }
  if (kind === "poison") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className="glyph">
        <path
          fill="currentColor"
          d="M12 2c-1.5 3-4 5-4 9a4 4 0 0 0 8 0c0-4-2.5-6-4-9zm-3 14h6l1 6H8l1-6z"
        />
      </svg>
    );
  }
  if (kind === "thorns") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className="glyph">
        <path
          fill="currentColor"
          d="M12 2 14 9l7 1-5 5 2 7-6-4-6 4 2-7-5-5 7-1 2-7z"
        />
      </svg>
    );
  }
  if (kind === "weak") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className="glyph">
        <path
          fill="currentColor"
          d="M12 3a4 4 0 0 1 4 4v2h2v12H6V9h2V7a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v2h4V7a2 2 0 0 0-2-2z"
          opacity="0.55"
        />
      </svg>
    );
  }
  if (kind === "vuln") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className="glyph">
        <path
          fill="currentColor"
          d="M12 2 3 7v5c0 5.5 3.8 10.2 9 12 5.2-1.8 9-6.5 9-12V7l-9-5zm0 4 6 3.2v3.6c0 3.8-2.4 7.1-6 8.6-3.6-1.5-6-4.8-6-8.6V9.2L12 6z"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="glyph">
      <path
        fill="currentColor"
        d="M13 2 4 14h7l-1 8 10-14h-7l0-6z"
      />
    </svg>
  );
}

function IntentBadge({ intent }: { intent: EnemyIntent }) {
  const value =
    intent.kind === "attack" || intent.kind === "heavy"
      ? intent.dmg
      : intent.kind === "defend"
        ? intent.shield
        : intent.kind === "buff"
          ? intent.atk
          : intent.stacks;
  const label =
    intent.kind === "attack"
      ? "Атака"
      : intent.kind === "heavy"
        ? "Тяжёлый"
        : intent.kind === "defend"
          ? "Щит"
          : intent.kind === "buff"
            ? "Бафф"
            : "Яд";
  return (
    <div
      className={`intent-badge intent-${intent.kind}`}
      title={`Намерение: ${label} ${value}`}
    >
      <IntentGlyph kind={intent.kind} />
      <strong>{value}</strong>
    </div>
  );
}

function IntentGlyph({ kind }: { kind: EnemyIntent["kind"] }) {
  if (kind === "defend") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className="intent-glyph">
        <path
          fill="currentColor"
          d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3z"
        />
      </svg>
    );
  }
  if (kind === "poison") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className="intent-glyph">
        <path
          fill="currentColor"
          d="M12 2c-1.5 3-4 5-4 9a4 4 0 0 0 8 0c0-4-2.5-6-4-9z"
        />
      </svg>
    );
  }
  if (kind === "buff") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className="intent-glyph">
        <path fill="currentColor" d="M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7V4z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="intent-glyph">
      <path
        fill="currentColor"
        d="M3 20 14 9l2 2L5 22H3v-2zm13.5-12.5 2.1-2.1 2.1 2.1-2.1 2.1-2.1-2.1zM15 4l2 2-1.5 1.5-2-2L15 4z"
      />
    </svg>
  );
}

function ActionArt({
  kind,
}: {
  kind: "attack" | "defend" | SkillId;
}) {
  return (
    <img
      className="action-art"
      src={itemIconUrl(actionIcon(kind))}
      alt=""
      draggable={false}
    />
  );
}

function actionTone(kind: "attack" | "defend" | SkillId): ActionTone {
  if (kind === "defend" || kind === "guard") return "defend";
  if (kind === "bash") return "defend";
  if (kind === "toxin" || kind === "nova") return "poison";
  if (kind === "siphon") return "heal";
  if (kind === "roar") return "buff";
  return "attack";
}

function isPowerSkill(kind: "attack" | "defend" | SkillId): boolean {
  return (
    kind === "bash" ||
    kind === "siphon" ||
    kind === "backstab" ||
    kind === "nova" ||
    kind === "roar"
  );
}

function isTurnToast(text: string): boolean {
  return /^Твой ход\s+\d+/i.test(text);
}

export function BattleScreen({ battle, onAction }: Props) {
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [flash, setFlash] = useState<"player" | "enemy" | null>(null);
  const prevRef = useRef({
    playerHp: battle.player.hp,
    enemyHp: battle.enemy.hp,
    playerShield: battle.player.shield,
    enemyShield: battle.enemy.shield,
    ready: false,
  });
  const floaterSeq = useRef(0);
  const canAct = battle.awaitingInput;
  const lastLog = battle.log[battle.log.length - 1];
  const toast =
    lastLog && !isTurnToast(lastLog.text) ? lastLog : null;

  useEffect(() => {
    const prev = prevRef.current;
    if (!prev.ready) {
      prevRef.current = {
        playerHp: battle.player.hp,
        enemyHp: battle.enemy.hp,
        playerShield: battle.player.shield,
        enemyShield: battle.enemy.shield,
        ready: true,
      };
      return;
    }

    const next: Floater[] = [];
    const push = (
      side: "player" | "enemy",
      text: string,
      tone: CombatLogTone,
    ) => {
      floaterSeq.current += 1;
      next.push({ id: floaterSeq.current, side, text, tone });
    };

    const pHp = battle.player.hp - prev.playerHp;
    const eHp = battle.enemy.hp - prev.enemyHp;
    const pSh = battle.player.shield - prev.playerShield;
    const eSh = battle.enemy.shield - prev.enemyShield;

    if (pHp < 0) push("player", `${pHp}`, "normal");
    if (pHp > 0) push("player", `+${pHp}`, "heal");
    if (eHp < 0) push("enemy", `${eHp}`, eHp <= -14 ? "crit" : "normal");
    if (eHp > 0) push("enemy", `+${eHp}`, "heal");
    if (pSh > 0) push("player", `+${pSh}`, "shield");
    if (eSh > 0) push("enemy", `+${eSh}`, "shield");

    if (next.length > 0) {
      const hasCrit = next.some((f) => f.tone === "crit");
      const hasHeal = next.some((f) => f.tone === "heal");
      const hasShield = next.some((f) => f.tone === "shield");
      const hasPoison = next.some((f) => f.tone === "poison");
      const hasHit = next.some(
        (f) => f.tone === "normal" || f.tone === "crit" || f.tone === "boss",
      );
      if (hasCrit) playSfx("crit");
      else if (hasHit) playSfx("hit");
      if (hasShield) playSfx("shield");
      if (hasHeal) playSfx("heal");
      if (hasPoison) playSfx("poison");

      setFloaters((cur) => [...cur, ...next].slice(-8));
      const hitSide =
        eHp < 0 ? "enemy" : pHp < 0 ? "player" : next[0]!.side;
      setFlash(hitSide);
      const flashTimer = window.setTimeout(() => setFlash(null), 420);
      const clearIds = next.map((f) =>
        window.setTimeout(() => {
          setFloaters((cur) => cur.filter((x) => x.id !== f.id));
        }, 1100),
      );
      prevRef.current = {
        playerHp: battle.player.hp,
        enemyHp: battle.enemy.hp,
        playerShield: battle.player.shield,
        enemyShield: battle.enemy.shield,
        ready: true,
      };
      return () => {
        window.clearTimeout(flashTimer);
        for (const id of clearIds) window.clearTimeout(id);
      };
    }

    prevRef.current = {
      playerHp: battle.player.hp,
      enemyHp: battle.enemy.hp,
      playerShield: battle.player.shield,
      enemyShield: battle.enemy.shield,
      ready: true,
    };
  }, [
    battle.player.hp,
    battle.enemy.hp,
    battle.player.shield,
    battle.enemy.shield,
    battle.logSeq,
  ]);

  const act = (action: PlayerCombatAction) => {
    playSfx("click");
    onAction(action);
  };

  return (
    <div
      className={`panel battle battle-stage ${battle.isFinalBoss ? "final-boss" : ""}`}
    >
      <div className="battle-top">
        <div className={`turn-badge ${canAct ? "turn-active" : ""}`}>
          {canAct
            ? `Ход ${Math.max(1, battle.turn)} · твой ход`
            : `Ход ${Math.max(1, battle.turn)}`}
        </div>
        {toast ? (
          <div className={`battle-toast log-${toast.tone ?? "normal"}`}>
            {toast.text}
          </div>
        ) : (
          <div className="battle-toast battle-toast-empty" />
        )}
      </div>

      {battle.turn >= FATIGUE_TURN - 2 && battle.turn < FATIGUE_TURN ? (
        <div className="battle-banner fatigue-warn">
          Скоро износ боя — урон сквозь щит
        </div>
      ) : null}
      {battle.turn >= FATIGUE_TURN ? (
        <div className="battle-banner fatigue-active">
          Износ: оба теряют щит и HP каждый ход
        </div>
      ) : null}

      {battle.banner ? (
        <div className="battle-banner">{battle.banner}</div>
      ) : null}

      <div className="battle-arena">
        <div className="arena-backdrop" aria-hidden />

        <div
          className={`fighter fighter-enemy ${flash === "enemy" ? "fighter-flash fighter-hit" : ""}`}
        >
          <div className="fighter-art">
            <img
              src={monsterIconUrl(battle.enemy.iconId)}
              alt={battle.enemy.name}
              className={
                battle.isFinalBoss
                  ? `boss-phase-${battle.bossPhase}`
                  : undefined
              }
            />
            {floaters
              .filter((f) => f.side === "enemy")
              .map((f) => (
                <span key={f.id} className={floaterToneClass(f.tone)}>
                  {f.text}
                </span>
              ))}
          </div>
          <div className="fighter-meta">
            <div className="fighter-headline">
              <h3>
                {battle.enemy.name}
                {battle.isFinalBoss
                  ? ` · ФАЗА ${battle.bossPhase}`
                  : battle.isBoss
                    ? " · БОСС"
                    : battle.isElite
                      ? " · ЭЛИТА"
                      : ""}
              </h3>
              <IntentBadge intent={battle.intent} />
            </div>
            {battle.eliteTrait ? (
              <div className="hp-text elite-trait">
                {ELITE_TRAIT_RU[battle.eliteTrait]}
              </div>
            ) : null}
            <HpBar hp={battle.enemy.hp} maxHp={battle.enemy.maxHp} />
            <StatusIcons fighter={battle.enemy} />
          </div>
        </div>

        <div
          className={`fighter fighter-player ${flash === "player" ? "fighter-flash fighter-hit" : ""}`}
        >
          <div className="fighter-art">
            <img
              src={avatarIconUrl(battle.player.iconId)}
              alt={battle.player.name}
              className={
                battle.player.shield > 0 ? "fighter-glow-shield" : undefined
              }
            />
            {floaters
              .filter((f) => f.side === "player")
              .map((f) => (
                <span key={f.id} className={floaterToneClass(f.tone)}>
                  {f.text}
                </span>
              ))}
          </div>
          <div className="fighter-meta">
            <h3>{battle.player.name}</h3>
            <HpBar
              hp={battle.player.hp}
              maxHp={battle.player.maxHp}
              player
            />
            <StatusIcons fighter={battle.player} />
          </div>
        </div>
      </div>

      <div className="skill-row battle-actions">
        <button
          type="button"
          className={`skill-btn tone-${actionTone("attack")}`}
          disabled={!canAct}
          onClick={() => act({ type: "attack" })}
        >
          <ActionArt kind="attack" />
          <span className="skill-copy">
            <strong>Атака</strong>
            <span>Обычный удар</span>
          </span>
        </button>
        <button
          type="button"
          className={`skill-btn tone-${actionTone("defend")}`}
          disabled={!canAct}
          onClick={() => act({ type: "defend" })}
        >
          <ActionArt kind="defend" />
          <span className="skill-copy">
            <strong>Защита</strong>
            <span>+15 щита</span>
          </span>
        </button>
        {battle.skills.map((id) => {
          const def = skillById(id);
          const cd = battle.skillCd[id] ?? 0;
          const locked = !canAct || cd > 0;
          const power = isPowerSkill(id) ? " skill-power" : "";
          const onCd = cd > 0 ? " skill-cd" : "";
          return (
            <button
              key={id}
              type="button"
              className={`skill-btn tone-${actionTone(id)}${power}${onCd}`}
              disabled={locked}
              title={def?.description}
              onClick={() => act({ type: "skill", skillId: id })}
            >
              <span className="action-art-wrap">
                <ActionArt kind={id} />
                {cd > 0 ? (
                  <span className="skill-cd-badge" aria-label={`КД ${cd}`}>
                    <svg viewBox="0 0 24 24" aria-hidden className="cd-hour">
                      <path
                        fill="currentColor"
                        d="M6 2h12v2l-4 5v2l4 5v2H6v-2l4-5v-2L6 4V2zm3.2 2 2.8 3.5L14.8 4H9.2zM9.2 18h5.6L12 14.5 9.2 18z"
                      />
                    </svg>
                    <strong>{cd}</strong>
                  </span>
                ) : null}
              </span>
              <span className="skill-copy">
                <strong>{def?.title ?? id}</strong>
                <span>{cd > 0 ? `Перезарядка ${cd}` : def?.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
