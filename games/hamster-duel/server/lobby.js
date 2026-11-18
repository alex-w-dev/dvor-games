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

globalThis.hooks = {
  onCreate: function (ctx) {
    ctx.state = {};
    ctx.log("hamster-duel lobby created");
  },

  onJoin: function (ctx, player) {
    ctx.log("lobby join", player.id);
  },

  onLeave: function (ctx, player) {
    ctx.log("lobby leave", player.id);
  },

  onMessage: function (ctx, player, type, payload) {
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
};
