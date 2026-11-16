import { itemIconUrl } from "../game/assets";
import type { Fighter, ShopOffer, ShopOfferId } from "../game/types";

type Props = {
  gold: number;
  player: Fighter;
  offers: ShopOffer[];
  onBuy: (id: ShopOfferId) => void;
  onLeave: () => void;
};

export function ShopScreen({ gold, player, offers, onBuy, onLeave }: Props) {
  return (
    <div className="panel">
      <h2 style={{ marginTop: 0 }}>Магазин</h2>
      <p className="lead" style={{ marginBottom: "0.75rem" }}>
        Золото: <strong style={{ color: "var(--accent)" }}>{gold}</strong>
        {" · "}
        HP {player.hp}/{player.maxHp} · ATK {player.atk}
      </p>
      <div className="upgrade-grid class-card-grid">
        {offers.map((o) => {
          const bought = Boolean(o.bought);
          const can = !bought && gold >= o.cost;
          return (
            <button
              key={o.id}
              type="button"
              className={`upgrade-card class-card ${o.rare ? "synergy" : ""} ${bought ? "bought" : ""}`}
              disabled={!can}
              onClick={() => onBuy(o.id)}
            >
              {bought ? (
                <span className="synergy-badge bought-badge">✓ куплено</span>
              ) : o.rare ? (
                <span className="synergy-badge">редко</span>
              ) : null}
              <span
                className="class-card-art icon-art"
                style={{ backgroundImage: `url(${itemIconUrl(o.icon)})` }}
                aria-hidden
              />
              <span className="class-card-copy">
                <strong>
                  {o.title} · {o.cost}g
                </strong>
                <span>{o.description}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="actions" style={{ marginTop: "1rem" }}>
        <button type="button" className="primary" onClick={onLeave}>
          Уйти
        </button>
      </div>
    </div>
  );
}
