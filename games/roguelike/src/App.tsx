import { useEffect, useMemo, useReducer } from "react";
import { bgUrlForPhase } from "./game/assets";
import { floorTheme } from "./game/content";
import { setMusicFloor, startRunMusic, stopRunMusic } from "./game/music";
import { initialRunState, runReducer } from "./game/runReducer";
import { BattleScreen } from "./screens/BattleScreen";
import { BuildScreen } from "./screens/BuildScreen";
import { ClassScreen } from "./screens/ClassScreen";
import { EventScreen } from "./screens/EventScreen";
import { MapScreen } from "./screens/MapScreen";
import { MetaScreen } from "./screens/MetaScreen";
import { RelicScreen } from "./screens/RelicScreen";
import { ResultScreen } from "./screens/ResultScreen";
import { RewardScreen } from "./screens/RewardScreen";
import { ShopScreen } from "./screens/ShopScreen";
import { TitleScreen } from "./screens/TitleScreen";

const RUN_PHASES = new Set([
  "class",
  "relic",
  "map",
  "build",
  "battle",
  "reward",
  "shop",
  "event",
]);

export default function App() {
  const [state, dispatch] = useReducer(runReducer, undefined, initialRunState);
  const bg = useMemo(
    () => bgUrlForPhase(state.phase, state.result?.won),
    [state.phase, state.result?.won],
  );
  const theme = floorTheme(state.floor);
  const inRun = RUN_PHASES.has(state.phase);

  useEffect(() => {
    if (inRun) {
      startRunMusic(state.floor);
      setMusicFloor(state.floor);
      return;
    }
    stopRunMusic();
  }, [inRun, state.floor]);

  return (
    <div
      className={`app${inRun ? ` floor-${state.floor}` : ""}${state.phase === "battle" ? " phase-battle" : ""}`}
      style={{
        ["--bg-image" as string]: `url(${bg})`,
        ...(inRun
          ? {
              ["--accent" as string]: theme.accent,
              ["--floor-tint" as string]: theme.tint,
            }
          : {}),
      }}
    >
      <div className="shell">
        {inRun ? (
          <div className="run-escape">
            <button
              type="button"
              className="run-escape-btn"
              onClick={() => dispatch({ type: "ABANDON_RUN" })}
            >
              Сдаться
            </button>
          </div>
        ) : null}

        {state.phase === "title" && (
          <TitleScreen
            meta={state.meta}
            onStart={() => dispatch({ type: "START_RUN" })}
            onDaily={() => dispatch({ type: "START_DAILY" })}
            onBlitz={() => dispatch({ type: "START_BLITZ" })}
            onMeta={() => dispatch({ type: "OPEN_META" })}
          />
        )}

        {state.phase === "meta" && (
          <MetaScreen
            meta={state.meta}
            onBuy={(upgradeId) => dispatch({ type: "BUY_META", upgradeId })}
            onUnlock={(unlockId) => dispatch({ type: "BUY_UNLOCK", unlockId })}
            onBack={() => dispatch({ type: "CLOSE_META" })}
          />
        )}

        {state.phase === "class" && (
          <ClassScreen
            onPick={(classId) => dispatch({ type: "PICK_CLASS", classId })}
          />
        )}

        {state.phase === "relic" && (
          <RelicScreen
            choices={state.relicChoices}
            onPick={(relicId) => dispatch({ type: "PICK_RELIC", relicId })}
          />
        )}

        {state.phase === "map" && state.currentFloor && (
          <MapScreen
            floor={state.floor}
            maxFloors={state.maxFloors}
            mode={state.mode}
            runMods={state.runMods}
            player={state.player}
            gold={state.gold}
            pickedUpgrades={state.pickedUpgrades}
            synergyUnlocked={state.synergyUnlocked}
            selectedRelic={state.selectedRelic}
            currentFloor={state.currentFloor}
            availableNext={state.availableNext}
            onEnter={(roomId) => dispatch({ type: "ENTER_ROOM", roomId })}
            onOpenBuild={() => dispatch({ type: "OPEN_BUILD" })}
          />
        )}

        {state.phase === "build" && (
          <BuildScreen
            player={state.player}
            pickedUpgrades={state.pickedUpgrades}
            synergyUnlocked={state.synergyUnlocked}
            selectedRelic={state.selectedRelic}
            skills={state.skills}
            onBack={() => dispatch({ type: "CLOSE_BUILD" })}
          />
        )}

        {state.phase === "battle" && state.battle && (
          <BattleScreen
            battle={state.battle}
            onAction={(action) => dispatch({ type: "PLAYER_ACTION", action })}
          />
        )}

        {state.phase === "reward" && (
          <RewardScreen
            choices={state.rewardChoices}
            owned={state.pickedUpgrades}
            synergyUnlocked={state.synergyUnlocked}
            goldNote={
              state.gold > 0 ? `Золото: ${state.gold}` : undefined
            }
            onPick={(upgradeId) =>
              dispatch({ type: "PICK_UPGRADE", upgradeId })
            }
          />
        )}

        {state.phase === "shop" && (
          <ShopScreen
            gold={state.gold}
            player={state.player}
            offers={state.shopOffers}
            onBuy={(offerId) => dispatch({ type: "SHOP_BUY", offerId })}
            onLeave={() => dispatch({ type: "SHOP_LEAVE" })}
          />
        )}

        {state.phase === "event" && state.activeEvent && (
          <EventScreen
            event={state.activeEvent}
            player={state.player}
            gold={state.gold}
            onChoose={(choiceId) =>
              dispatch({ type: "EVENT_CHOOSE", choiceId })
            }
          />
        )}

        {state.phase === "result" && state.result && (
          <ResultScreen
            result={state.result}
            essenceTotal={state.meta.essence}
            onAgain={() => dispatch({ type: "START_RUN" })}
            onMeta={() => dispatch({ type: "OPEN_META" })}
            onTitle={() => dispatch({ type: "BACK_TO_TITLE" })}
          />
        )}
      </div>
    </div>
  );
}
