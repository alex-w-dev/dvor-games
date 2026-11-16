import { itemIconUrl } from "../game/assets";
import {
  META_MAX_LEVEL,
  META_UNLOCKS,
  META_UPGRADES,
  metaUpgradeCost,
} from "../game/meta";
import type {
  MetaProgress,
  MetaUnlockId,
  MetaUpgradeId,
} from "../game/types";

type Props = {
  meta: MetaProgress;
  onBuy: (id: MetaUpgradeId) => void;
  onUnlock: (id: MetaUnlockId) => void;
  onBack: () => void;
};

export function MetaScreen({ meta, onBuy, onUnlock, onBack }: Props) {
  return (
    <div className="panel">
      <h2 style={{ marginTop: 0 }}>Наследие</h2>
      <p className="lead" style={{ marginBottom: "1rem" }}>
        Эссенция:{" "}
        <strong style={{ color: "var(--accent)" }}>{meta.essence}</strong>.
        Постоянные бонусы и разлоки. Сохраняется в браузере.
      </p>
      <div className="upgrade-grid class-card-grid meta-grid">
        {META_UPGRADES.map((u) => {
          const level = meta.levels[u.id];
          const maxed = level >= META_MAX_LEVEL;
          const cost = metaUpgradeCost(level);
          const can = !maxed && meta.essence >= cost;
          return (
            <button
              key={u.id}
              type="button"
              className="upgrade-card class-card meta-card"
              disabled={!can}
              onClick={() => onBuy(u.id)}
            >
              <span
                className="class-card-art icon-art"
                style={{ backgroundImage: `url(${itemIconUrl(u.icon)})` }}
                aria-hidden
              />
              <span className="class-card-copy">
                <strong>
                  {u.title} · {level}/{META_MAX_LEVEL}
                </strong>
                <span>
                  {maxed
                    ? u.description(level)
                    : `след.: ${u.description(level + 1)}`}
                </span>
                <span className="hint">
                  {maxed ? "макс." : `купить за ${cost}`}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <h3 style={{ margin: "1.25rem 0 0.65rem" }}>Разлоки</h3>
      <div className="upgrade-grid class-card-grid meta-grid">
        {META_UNLOCKS.map((u) => {
          const owned = meta.unlocks.includes(u.id);
          const reqOk = !u.requires || meta.unlocks.includes(u.requires);
          const can = !owned && reqOk && meta.essence >= u.cost;
          const reqTitle = u.requires
            ? META_UNLOCKS.find((x) => x.id === u.requires)?.title
            : null;
          return (
            <button
              key={u.id}
              type="button"
              className={`upgrade-card class-card meta-card ${owned ? "synergy" : ""}`}
              disabled={!can}
              onClick={() => onUnlock(u.id)}
            >
              {owned ? <span className="synergy-badge">открыто</span> : null}
              <span
                className="class-card-art icon-art"
                style={{ backgroundImage: `url(${itemIconUrl(u.icon)})` }}
                aria-hidden
              />
              <span className="class-card-copy">
                <strong>{u.title}</strong>
                <span>{u.description}</span>
                <span className="hint">
                  {owned
                    ? "открыто"
                    : !reqOk
                      ? `нужен: ${reqTitle ?? u.requires}`
                      : `купить за ${u.cost}`}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="actions" style={{ marginTop: "1rem" }}>
        <button type="button" className="primary" onClick={onBack}>
          Назад
        </button>
      </div>
    </div>
  );
}
