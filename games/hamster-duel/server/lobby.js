var FREE_COLORS = ["red", "blue", "green"];
var PAID_COLOR = "black";
var ALL_COLORS = FREE_COLORS.concat([PAID_COLOR]);

function normalizeColors(data, payload) {
  var prev = data && typeof data === "object" ? data : {};
  var fromPayload =
    payload && typeof payload === "object" ? payload : {};
  var unlocked = Array.isArray(fromPayload.unlockedColors)
    ? fromPayload.unlockedColors.filter(function (c) {
        return ALL_COLORS.indexOf(c) >= 0;
      })
    : Array.isArray(prev.unlockedColors)
      ? prev.unlockedColors.filter(function (c) {
          return ALL_COLORS.indexOf(c) >= 0;
        })
      : [];
  FREE_COLORS.forEach(function (c) {
    if (unlocked.indexOf(c) < 0) unlocked.push(c);
  });
  var requested =
    typeof fromPayload.sideColor === "string" ? fromPayload.sideColor : null;
  var sideColor =
    requested && unlocked.indexOf(requested) >= 0
      ? requested
      : typeof prev.sideColor === "string" && unlocked.indexOf(prev.sideColor) >= 0
        ? prev.sideColor
        : "red";
  return { unlockedColors: unlocked, sideColor: sideColor };
}

function searchingIds(ctx) {
  var out = [];
  var map = ctx.state.searching || {};
  ctx.players.keys().forEach(function (id) {
    if (!map[id]) return;
    var p = ctx.players.get(id);
    if (p && p.connected) out.push(id);
  });
  return out;
}

function tryStartDuel(ctx) {
  if (ctx.state.starting) return;
  var ids = searchingIds(ctx);
  if (ids.length < 2) return;
  var a = ids[0];
  var b = ids[1];
  ctx.state.starting = true;
  delete ctx.state.searching[a];
  delete ctx.state.searching[b];
  ctx.log("start duel", a, b);
  ctx.match.start({
    players: [a, b],
    teams: [
      { id: "left", name: "Left", playerIds: [a] },
      { id: "right", name: "Right", playerIds: [b] },
    ],
    data: { mode: "duel" },
  });
  ctx.state.starting = false;
  ctx.broadcast("queue_update", { searching: searchingIds(ctx).length });
}

globalThis.hooks = {
  onCreate: function (ctx) {
    ctx.state = { searching: {} };
    ctx.log("hamster-duel lobby created");
  },

  onJoin: function (ctx, player) {
    ctx.log("lobby join", player.id);
  },

  onLeave: function (ctx, player) {
    if (ctx.state.searching) delete ctx.state.searching[player.id];
    ctx.log("lobby leave", player.id);
  },

  onMessage: function (ctx, player, type, payload) {
    if (type === "queue") {
      ctx.state.searching[player.id] = true;
      ctx.send(player.id, "queue_ok", {});
      ctx.broadcast("queue_update", { searching: searchingIds(ctx).length });
      tryStartDuel(ctx);
      return;
    }
    if (type === "cancel_queue") {
      delete ctx.state.searching[player.id];
      ctx.send(player.id, "queue_cancelled", {});
      ctx.broadcast("queue_update", { searching: searchingIds(ctx).length });
      return;
    }
    if (type !== "set_color") return;
    if (!ctx.player || !ctx.player.getData || !ctx.player.setData) {
      ctx.send(player.id, "color_err", { message: "player cloud unavailable" });
      return;
    }
    return ctx.player
      .getData(player.id)
      .then(function (data) {
        var next = normalizeColors(data, payload);
        var merged = Object.assign({}, data || {}, {
          sideColor: next.sideColor,
          unlockedColors: next.unlockedColors,
        });
        return ctx.player.setData(player.id, merged).then(function () {
          ctx.send(player.id, "color_ok", {
            sideColor: next.sideColor,
            unlockedColors: next.unlockedColors,
          });
        });
      })
      .catch(function (err) {
        ctx.send(player.id, "color_err", {
          message: err && err.message ? String(err.message) : String(err),
        });
      });
  },

  onTick: function (ctx) {
    tryStartDuel(ctx);
  },
};
