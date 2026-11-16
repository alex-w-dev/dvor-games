import { avatarIconUrl, itemIconUrl, monsterIconUrl } from "../game/assets";
import { floorTheme, MONSTERS, relicById, upgradeById } from "../game/content";
import type {
  Fighter,
  Floor,
  RelicId,
  RoomKind,
  RunMode,
  RunMods,
  UpgradeId,
  UpgradeTag,
} from "../game/types";

type Props = {
  floor: number;
  maxFloors: number;
  mode: RunMode;
  runMods: RunMods;
  player: Fighter;
  gold: number;
  pickedUpgrades: UpgradeId[];
  synergyUnlocked: UpgradeTag[];
  selectedRelic: RelicId | null;
  currentFloor: Floor;
  availableNext: string[];
  onEnter: (roomId: string) => void;
  onOpenBuild: () => void;
};

const KIND_RU: Record<RoomKind, string> = {
  fight: "бой",
  elite: "элита",
  rest: "отдых",
  boss: "босс",
  shop: "магазин",
  event: "событие",
};

export function MapScreen({
  floor,
  maxFloors,
  mode,
  runMods,
  player,
  gold,
  pickedUpgrades,
  synergyUnlocked,
  selectedRelic,
  currentFloor,
  availableNext,
  onEnter,
  onOpenBuild,
}: Props) {
  const relic = selectedRelic ? relicById(selectedRelic) : null;
  const theme = floorTheme(floor);
  const modBits = [
    mode === "blitz" ? "блиц" : null,
    runMods.noShop ? "без магазина" : null,
    runMods.eliteHeavy ? "больше элит" : null,
  ].filter(Boolean);
  return (
    <>
      <div className="panel map-hud">
        <div className="floor-banner">
          <strong>{theme.title}</strong>
          <span className="lead floor-tagline">
            {theme.tagline} · карта: {currentFloor.layoutLabel}
            {modBits.length > 0 ? ` · ${modBits.join(" · ")}` : ""}
          </span>
        </div>
        <div className="map-hero-row">
          <img
            className="map-class-art"
            src={avatarIconUrl(player.iconId)}
            alt={player.name}
          />
          <div className="map-hero-main">
            <div className="stats">
              <span>
                Этаж <strong>{floor}</strong> / {maxFloors}
              </span>
              <span>
                HP <strong>{player.hp}</strong> / {player.maxHp}
              </span>
              <span>
                ATK <strong>{player.atk}</strong>
              </span>
              <span>
                Золото <strong>{gold}</strong>
              </span>
              <span>
                Crit <strong>{Math.round(player.critChance * 100)}%</strong>
              </span>
              {player.shieldPerTurn > 0 ? (
                <span>
                  Щит/ход <strong>{player.shieldPerTurn}</strong>
                </span>
              ) : null}
              {player.poisonOnHit > 0 ? (
                <span>
                  Яд <strong>{player.poisonOnHit}</strong>
                </span>
              ) : null}
              {player.cleaveHits > 0 ? (
                <span>
                  Рассеч. <strong>×{player.cleaveHits}</strong>
                </span>
              ) : null}
            </div>
            <div className="build-row">
              <span className="build-label">Билд</span>
              {relic ? (
                <span className="build-chip relic-chip">
                  <img
                    className="chip-art"
                    src={itemIconUrl(relic.icon, 64)}
                    alt=""
                  />
                  {relic.title}
                </span>
              ) : null}
              {pickedUpgrades.length === 0 ? (
                <span className="build-chip muted">пусто</span>
              ) : (
                pickedUpgrades.map((id, i) => {
                  const u = upgradeById(id);
                  return (
                    <span key={`${id}-${i}`} className="build-chip">
                      {u?.title ?? id}
                    </span>
                  );
                })
              )}
              <button
                type="button"
                className="build-open"
                onClick={onOpenBuild}
              >
                Подробнее
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <h2 className="map-path-title">Выбери путь</h2>
        <p className="lead map-path-lead">
          Элиты ломают правила боя. Синергии: {synergyUnlocked.length}/6.
          {maxFloors >= 4 ? " На последнем этаже — финал с фазами." : " Короткий блиц."}
        </p>
        <div className="room-grid">
          {currentFloor.rooms.map((room) => {
            const open = availableNext.includes(room.id);
            const foe =
              room.monsterId != null
                ? MONSTERS.find((m) => m.id === room.monsterId)
                : undefined;
            return (
              <button
                key={room.id}
                type="button"
                className={`room-card ${room.kind}${foe ? " has-foe" : ""}`}
                style={
                  foe
                    ? {
                        ["--room-foe" as string]: `url(${monsterIconUrl(foe.iconId)})`,
                      }
                    : undefined
                }
                disabled={!open}
                onClick={() => onEnter(room.id)}
              >
                <span className="kind">{KIND_RU[room.kind]}</span>
                <strong>{room.label}</strong>
                {room.hint ? <span className="hint">{room.hint}</span> : null}
                {open ? <span>Войти →</span> : <span>закрыто</span>}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
