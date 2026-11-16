import { dailyKey } from "../game/meta";
import { playSfx, preloadSfx } from "../game/sfx";
import type { MetaProgress } from "../game/types";

type Props = {
  meta: MetaProgress;
  onStart: () => void;
  onDaily: () => void;
  onBlitz: () => void;
  onMeta: () => void;
};

export function TitleScreen({ meta, onStart, onDaily, onBlitz, onMeta }: Props) {
  const levels =
    meta.levels.vitality +
    meta.levels.power +
    meta.levels.purse +
    meta.levels.luck +
    meta.levels.recovery;
  const today = dailyKey();
  const dailyDone = meta.dailyDate === today;

  return (
    <div className="center">
      <div>
        <h1 className="brand">Roguelike</h1>
        <p className="lead">
          Под руинами дремлет Теневой Шпиль. Каждый спуск — чужая судьба:
          возьми реликвию предков, пройди этажи и вынеси эссенцию прежде, чем
          тьма закроет путь.
        </p>
        <p className="lead" style={{ marginTop: "0.75rem" }}>
          Эссенция:{" "}
          <strong style={{ color: "var(--accent)" }}>{meta.essence}</strong>
          {" · "}
          уровней наследия: <strong>{levels}</strong>
          {meta.dailyStreak > 0 ? (
            <>
              {" · "}
              daily-серия: <strong>{meta.dailyStreak}</strong>
            </>
          ) : null}
        </p>
      </div>
      <div className="actions">
        <button
          type="button"
          className="primary"
          onClick={() => {
            preloadSfx();
            playSfx("click");
            onStart();
          }}
        >
          Новый ран
        </button>
        <button
          type="button"
          onClick={() => {
            preloadSfx();
            playSfx("click");
            onBlitz();
          }}
        >
          Блиц · 2 этажа
        </button>
        <button
          type="button"
          onClick={() => {
            preloadSfx();
            playSfx("click");
            onDaily();
          }}
        >
          {dailyDone ? "Daily (награда получена)" : "Ежедневный вызов"}
        </button>
        <button
          type="button"
          onClick={() => {
            preloadSfx();
            playSfx("click");
            onMeta();
          }}
        >
          Улучшения
        </button>
      </div>
    </div>
  );
}
