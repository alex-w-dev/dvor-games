import { itemIconUrl } from "../game/assets";
import { SYNERGIES, TAG_RU, upgradeById } from "../game/content";
import type { UpgradeDef, UpgradeId, UpgradeTag } from "../game/types";

type Props = {
  choices: UpgradeDef[];
  owned: UpgradeId[];
  synergyUnlocked: UpgradeTag[];
  goldNote?: string;
  onPick: (id: UpgradeId) => void;
};

export function RewardScreen({
  choices,
  owned,
  synergyUnlocked,
  goldNote,
  onPick,
}: Props) {
  const ownedTags = new Set(
    owned.flatMap((id) => upgradeById(id)?.tags ?? []),
  );
  const tagCounts = new Map<UpgradeTag, number>();
  for (const id of owned) {
    for (const tag of upgradeById(id)?.tags ?? []) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  return (
    <div className="panel">
      <h2 style={{ marginTop: 0 }}>Награда</h2>
      <p className="lead" style={{ marginBottom: "1rem" }}>
        Выбери апгрейд. ×3 одного тега даёт синергию.
        {goldNote ? ` ${goldNote}.` : ""}
      </p>
      <div className="upgrade-grid class-card-grid">
        {choices.map((u) => {
          const synergy = u.tags.some((t) => ownedTags.has(t));
          const near = u.tags.some((t) => {
            if (synergyUnlocked.includes(t)) return false;
            const have = tagCounts.get(t) ?? 0;
            const need = SYNERGIES.find((s) => s.tag === t)?.need ?? 3;
            return have + 1 >= need;
          });
          return (
            <button
              key={u.id}
              type="button"
              className={`upgrade-card class-card ${synergy ? "synergy" : ""}`}
              onClick={() => onPick(u.id)}
            >
              {near ? (
                <span className="synergy-badge">синергия ×3!</span>
              ) : synergy ? (
                <span className="synergy-badge">синергия</span>
              ) : null}
              <span
                className="class-card-art icon-art"
                style={{ backgroundImage: `url(${itemIconUrl(u.icon)})` }}
                aria-hidden
              />
              <span className="class-card-copy">
                <strong>{u.title}</strong>
                <span>{u.description}</span>
                <span className="upgrade-tags">
                  {u.tags.map((t) => TAG_RU[t]).join(" · ")}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
