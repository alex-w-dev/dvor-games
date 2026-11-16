import { avatarIconUrl, itemIconUrl } from "../game/assets";
import {
  CLASSES,
  relicById,
  skillById,
  SYNERGIES,
  TAG_RU,
  upgradeById,
} from "../game/content";
import type {
  Fighter,
  RelicId,
  SkillId,
  UpgradeId,
  UpgradeTag,
} from "../game/types";

type Props = {
  player: Fighter;
  pickedUpgrades: UpgradeId[];
  synergyUnlocked: UpgradeTag[];
  selectedRelic: RelicId | null;
  skills: SkillId[];
  onBack: () => void;
};

const ALL_TAGS: UpgradeTag[] = [
  "poison",
  "shield",
  "cleave",
  "crit",
  "power",
  "tank",
];

export function BuildScreen({
  player,
  pickedUpgrades,
  synergyUnlocked,
  selectedRelic,
  skills,
  onBack,
}: Props) {
  const counts = new Map<UpgradeId, number>();
  for (const id of pickedUpgrades) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  const tagCounts = new Map<UpgradeTag, number>();
  for (const id of pickedUpgrades) {
    for (const tag of upgradeById(id)?.tags ?? []) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  const topTag = [...tagCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const relic = selectedRelic ? relicById(selectedRelic) : null;
  const cls = CLASSES.find((c) => c.title === player.name);

  return (
    <div className="panel">
      <h2 style={{ marginTop: 0 }}>Билд рана</h2>
      <p className="lead" style={{ marginBottom: "1rem" }}>
        Набери ×3 одного тега — получишь бонус синергии. Сейчас сильнее —{" "}
        <strong style={{ color: "var(--accent)" }}>
          {topTag ? TAG_RU[topTag[0]] : "пока пусто"}
        </strong>
        {topTag ? ` ×${topTag[1]}` : ""}.
      </p>

      <div className="build-tag-grid" style={{ marginBottom: "1rem" }}>
        {SYNERGIES.map((s) => {
          const have = tagCounts.get(s.tag) ?? 0;
          const done = synergyUnlocked.includes(s.tag);
          return (
            <div key={s.tag} className="build-tag-card">
              <strong>
                {done ? "✓ " : ""}
                {s.title}
              </strong>
              <span>
                {TAG_RU[s.tag]} {have}/{s.need}
              </span>
            </div>
          );
        })}
      </div>

      <div className="build-item build-item-with-art" style={{ marginBottom: "0.55rem" }}>
        <img
          className="build-item-art"
          src={avatarIconUrl(player.iconId)}
          alt=""
        />
        <div className="build-item-copy">
          <strong>Класс · {player.name}</strong>
          <span>{cls?.description ?? cls?.passive ?? ""}</span>
        </div>
      </div>

      {relic ? (
        <div className="build-item build-item-with-art" style={{ marginBottom: "0.75rem" }}>
          <img
            className="build-item-art"
            src={itemIconUrl(relic.icon)}
            alt=""
          />
          <div className="build-item-copy">
            <strong>Реликвия · {relic.title}</strong>
            <span>{relic.description}</span>
          </div>
        </div>
      ) : null}

      <div className="build-tag-grid" style={{ marginBottom: "1rem" }}>
        {skills.map((id) => {
          const s = skillById(id);
          return (
            <div key={id} className="build-tag-card">
              <strong>{s?.title ?? id}</strong>
              <span>КД {s?.cooldown ?? "?"}</span>
            </div>
          );
        })}
      </div>

      <div className="stats" style={{ marginBottom: "1rem" }}>
        <span>
          HP <strong>{player.hp}</strong> / {player.maxHp}
        </span>
        <span>
          ATK <strong>{player.atk}</strong>
        </span>
        <span>
          Crit <strong>{Math.round(player.critChance * 100)}%</strong> ×
          {player.critMult}
        </span>
        {player.regen > 0 ? (
          <span>
            Реген <strong>{player.regen}</strong>
          </span>
        ) : null}
        {player.armor > 0 ? (
          <span>
            Броня <strong>{player.armor}</strong>
          </span>
        ) : null}
        {player.shieldPerTurn > 0 ? (
          <span>
            Щит/ход <strong>{player.shieldPerTurn}</strong>
          </span>
        ) : null}
        {player.poisonOnHit > 0 ? (
          <span>
            Яд/удар <strong>{player.poisonOnHit}</strong>
          </span>
        ) : null}
        {player.cleaveHits > 0 ? (
          <span>
            Рассечение <strong>×{player.cleaveHits}</strong> (
            {Math.round(player.cleaveRatio * 100)}%)
          </span>
        ) : null}
        {player.vamp > 0 ? (
          <span>
            Вамп <strong>{Math.round(player.vamp * 100)}%</strong>
          </span>
        ) : null}
        {player.thorns > 0 ? (
          <span>
            Шипы <strong>{player.thorns}</strong>
          </span>
        ) : null}
        {player.rageAtk > 0 ? (
          <span>
            Берсерк <strong>+{player.rageAtk}</strong>
          </span>
        ) : null}
      </div>

      <div className="build-tag-grid">
        {ALL_TAGS.map((tag) => (
          <div key={tag} className="build-tag-card">
            <strong>{TAG_RU[tag]}</strong>
            <span>×{tagCounts.get(tag) ?? 0}</span>
          </div>
        ))}
      </div>

      <div className="build-list">
        {pickedUpgrades.length === 0 ? (
          <p className="lead">Пока нет апгрейдов — побеждай бои.</p>
        ) : (
          [...counts.entries()].map(([id, n]) => {
            const u = upgradeById(id);
            return (
              <div key={id} className="build-item">
                <strong>
                  {u?.title ?? id}
                  {n > 1 ? ` ×${n}` : ""}
                </strong>
                <span>{u?.description}</span>
                <span className="upgrade-tags">
                  {(u?.tags ?? []).map((t) => TAG_RU[t]).join(" · ")}
                </span>
              </div>
            );
          })
        )}
      </div>

      <div className="actions" style={{ marginTop: "1rem" }}>
        <button type="button" className="primary" onClick={onBack}>
          Назад к карте
        </button>
      </div>
    </div>
  );
}
