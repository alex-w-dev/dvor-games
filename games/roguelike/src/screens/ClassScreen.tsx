import { avatarIconUrl } from "../game/assets";
import { CLASSES } from "../game/content";
import { playSfx } from "../game/sfx";
import type { ClassId } from "../game/types";

type Props = {
  onPick: (classId: ClassId) => void;
};

export function ClassScreen({ onPick }: Props) {
  return (
    <div className="panel">
      <h2 style={{ marginTop: 0 }}>Класс</h2>
      <p className="lead" style={{ marginBottom: "1rem" }}>
        Архетип задаёт пассив и уникальный навык — разные игры в одном ране.
      </p>
      <div className="upgrade-grid class-card-grid">
        {CLASSES.map((cls) => (
          <button
            key={cls.id}
            type="button"
            className="upgrade-card class-card"
            onClick={() => {
              playSfx("click");
              onPick(cls.id);
            }}
          >
            <span
              className="class-card-art"
              style={{
                backgroundImage: `url(${avatarIconUrl(cls.avatarId)})`,
              }}
              aria-hidden
            />
            <span className="class-card-copy">
              <strong>{cls.title}</strong>
              <span>{cls.description}</span>
              <span className="hint">{cls.passive}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
