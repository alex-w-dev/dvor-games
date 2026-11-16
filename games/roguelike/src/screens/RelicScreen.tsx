import { itemIconUrl } from "../game/assets";
import { playSfx } from "../game/sfx";
import type { RelicDef, RelicId } from "../game/types";

type Props = {
  choices: RelicDef[];
  onPick: (relicId: RelicId) => void;
};

export function RelicScreen({ choices, onPick }: Props) {
  return (
    <div className="panel">
      <h2 style={{ marginTop: 0 }}>Стартовый артефакт</h2>
      <p className="lead" style={{ marginBottom: "1rem" }}>
        Выбери одну реликвию — она задаёт тон билда и навыки в бою.
      </p>
      <div className="upgrade-grid class-card-grid">
        {choices.map((relic) => (
          <button
            key={relic.id}
            type="button"
            className="upgrade-card class-card"
            onClick={() => {
              playSfx("click");
              onPick(relic.id);
            }}
          >
            <span
              className="class-card-art icon-art"
              style={{ backgroundImage: `url(${itemIconUrl(relic.icon)})` }}
              aria-hidden
            />
            <span className="class-card-copy">
              <strong>{relic.title}</strong>
              <span>{relic.description}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
