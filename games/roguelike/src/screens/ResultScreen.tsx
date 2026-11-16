import { useEffect } from "react";
import { playSfx } from "../game/sfx";
import type { RunResult } from "../game/types";

type Props = {
  result: RunResult;
  essenceTotal: number;
  onAgain: () => void;
  onMeta: () => void;
  onTitle: () => void;
};

export function ResultScreen({
  result,
  essenceTotal,
  onAgain,
  onMeta,
  onTitle,
}: Props) {
  useEffect(() => {
    playSfx(result.won ? "win" : "lose");
  }, [result.won]);

  return (
    <div className={`result-screen ${result.won ? "win" : "lose"}`}>
      <div className="result-card">
        <p className="result-kicker">Ран завершён</p>
        <h1 className={`result-title ${result.won ? "win" : "lose"}`}>
          {result.won ? "Победа" : "Поражение"}
        </h1>
        <div className="result-stats">
          <div className="result-stat">
            <span className="result-stat-value">{result.floor}</span>
            <span className="result-stat-label">этаж</span>
          </div>
          <div className="result-stat">
            <span className="result-stat-value">{result.roomsCleared}</span>
            <span className="result-stat-label">комнат</span>
          </div>
          <div className="result-stat">
            <span className="result-stat-value">+{result.essenceEarned}</span>
            <span className="result-stat-label">эссенция</span>
          </div>
        </div>
        <p className="result-essence">
          Всего эссенции:{" "}
          <strong style={{ color: "var(--accent)" }}>{essenceTotal}</strong>
        </p>
      </div>
      <div className="result-actions">
        <button type="button" className="primary" onClick={onAgain}>
          Ещё ран
        </button>
        <button type="button" onClick={onMeta}>
          Улучшения
        </button>
        <button type="button" className="ghost" onClick={onTitle}>
          На главную
        </button>
      </div>
    </div>
  );
}
