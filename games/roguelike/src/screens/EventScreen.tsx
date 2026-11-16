import { itemIconUrl } from "../game/assets";
import type { EventChoiceId, EventDef, Fighter } from "../game/types";

type Props = {
  event: EventDef;
  player: Fighter;
  gold: number;
  onChoose: (id: EventChoiceId) => void;
};

export function EventScreen({ event, player, gold, onChoose }: Props) {
  return (
    <div className="panel">
      <h2 style={{ marginTop: 0 }}>{event.title}</h2>
      <p className="lead">{event.body}</p>
      <p className="lead" style={{ marginBottom: "1rem" }}>
        HP {player.hp}/{player.maxHp} · ATK {player.atk} · золото {gold}
      </p>
      <div className="upgrade-grid class-card-grid">
        {event.choices.map((c) => {
          const needGold = c.id === "heal_pay";
          const blocked = needGold && gold < 20;
          return (
            <button
              key={c.id}
              type="button"
              className="upgrade-card class-card"
              disabled={blocked}
              onClick={() => onChoose(c.id)}
            >
              <span
                className="class-card-art icon-art"
                style={{ backgroundImage: `url(${itemIconUrl(c.icon)})` }}
                aria-hidden
              />
              <span className="class-card-copy">
                <strong>{c.title}</strong>
                <span>{c.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
