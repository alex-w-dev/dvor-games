var COUNTDOWN_SEC = 5;
var MATCH_SEC = 30;
var SPAWN_MIN = 0.35;
var SPAWN_MAX = 1.1;
var MOLE_TTL_MIN = 0.7;
var MOLE_TTL_MAX = 1.6;

function emptyCells() {
  return [null, null, null, null, null, null, null, null, null];
}

function connectedPlayers(ctx) {
  return ctx.players.values().filter(function (p) {
    return !!p.connected;
  });
}

function connectedIds(ctx) {
  return connectedPlayers(ctx).map(function (p) {
    return p.id;
  });
}

function startCountdown(ctx) {
  var ids = connectedIds(ctx);
  if (ids.length < 2) return;
  ctx.state.sides = { left: ids[0], right: ids[1] };
  ctx.state.phase = "countdown";
  ctx.state.countdownLeft = COUNTDOWN_SEC;
  ctx.state.timeLeft = MATCH_SEC;
  ctx.state.cells = emptyCells();
  ctx.state.spawnIn = 0.2;
  ctx.state.nextMoleId = 1;
  ctx.state.winnerId = null;
  ctx.state.reason = null;
  ctx.state.endArmed = false;
  ctx.log("countdown start", ids[0], ids[1]);
}

var TOP_N = 10;

function playerLabel(ctx, playerId) {
  var p = ctx.players.get(playerId);
  if (p && p.username) return String(p.username);
  return String(playerId).slice(0, 8);
}

function upsertBoard(list, entry, metric) {
  var next = Array.isArray(list) ? list.slice() : [];
  var row = null;
  for (var i = 0; i < next.length; i++) {
    if (next[i] && next[i].id === entry.id) {
      row = next[i];
      break;
    }
  }
  if (row) {
    row.name = entry.name;
    row[metric] = entry[metric];
  } else {
    var item = { id: entry.id, name: entry.name };
    item[metric] = entry[metric];
    next.push(item);
  }
  next.sort(function (a, b) {
    return ((b && b[metric]) || 0) - ((a && a[metric]) || 0);
  });
  return next.slice(0, TOP_N);
}

function recordMatchStats(ctx) {
  if (!ctx.player || !ctx.player.getData || !ctx.player.setData) {
    return;
  }
  if (!ctx.game || !ctx.game.getData || !ctx.game.setData) {
    return;
  }
  var left = ctx.state.sides && ctx.state.sides.left;
  var right = ctx.state.sides && ctx.state.sides.right;
  var winnerId = ctx.state.winnerId;
  var ids = [];
  if (left) ids.push(left);
  if (right && right !== left) ids.push(right);
  if (!ids.length) return;

  var chain = Promise.resolve();
  var snapshots = [];

  ids.forEach(function (playerId) {
    chain = chain.then(function () {
      var matchScore = (ctx.state.scores[playerId] || 0) | 0;
      var won = winnerId && playerId === winnerId ? 1 : 0;
      var name = playerLabel(ctx, playerId);
      return ctx.player.getData(playerId).then(function (data) {
        var prev = data && typeof data === "object" ? data : {};
        var next = Object.assign({}, prev, {
          score: ((prev.score || 0) | 0) + matchScore,
          wins: ((prev.wins || 0) | 0) + won,
          games: ((prev.games || 0) | 0) + 1,
        });
        snapshots.push({
          id: playerId,
          name: name,
          score: next.score,
          wins: next.wins,
          games: next.games,
        });
        return ctx.player.setData(playerId, next);
      });
    });
  });

  chain
    .then(function () {
      return ctx.game.getData();
    })
    .then(function (shared) {
      var board = shared && typeof shared === "object" ? shared : {};
      var topScore = board.topScore;
      var topWins = board.topWins;
      var topGames = board.topGames;
      for (var i = 0; i < snapshots.length; i++) {
        var s = snapshots[i];
        topScore = upsertBoard(topScore, s, "score");
        if ((s.wins || 0) > 0) {
          topWins = upsertBoard(topWins, s, "wins");
        }
        topGames = upsertBoard(topGames, s, "games");
      }
      return ctx.game.setData({
        topScore: topScore,
        topWins: topWins,
        topGames: topGames,
      });
    })
    .catch(function (err) {
      ctx.log(
        "stats update failed",
        err && err.message ? err.message : err,
      );
    });
}

function finish(ctx, reason) {
  if (ctx.state.phase === "ended") return;
  ctx.state.phase = "ended";
  ctx.state.reason = reason;
  ctx.state.cells = emptyCells();
  ctx.state.endArmed = false;
  var left = ctx.state.sides.left;
  var right = ctx.state.sides.right;
  var sl = (ctx.state.scores[left] || 0) | 0;
  var sr = (ctx.state.scores[right] || 0) | 0;
  if (reason === "opponent_left") {
    var ids = connectedIds(ctx);
    ctx.state.winnerId = ids.length === 1 ? ids[0] : null;
  } else if (sl > sr) {
    ctx.state.winnerId = left;
  } else if (sr > sl) {
    ctx.state.winnerId = right;
  } else {
    ctx.state.winnerId = null;
  }
  ctx.log("match end", reason, ctx.state.winnerId);
  recordMatchStats(ctx);
  // Не зовём match.end здесь: сначала уйдёт state с phase=ended (после onTick),
  // на следующем тике закроем комнату.
}

function randRange(a, b) {
  return a + Math.random() * (b - a);
}

function spawnMole(ctx) {
  var free = [];
  for (var i = 0; i < 9; i++) {
    if (!ctx.state.cells[i]) free.push(i);
  }
  if (!free.length) return;
  var cell = free[(Math.random() * free.length) | 0];
  var id = ctx.state.nextMoleId++;
  ctx.state.cells[cell] = { id: id, ttl: randRange(MOLE_TTL_MIN, MOLE_TTL_MAX) };
  ctx.state.spawnIn = randRange(SPAWN_MIN, SPAWN_MAX);
}

globalThis.hooks = {
  onCreate: function (ctx) {
    ctx.state = {
      phase: "waiting",
      countdownLeft: COUNTDOWN_SEC,
      timeLeft: MATCH_SEC,
      scores: {},
      sides: { left: null, right: null },
      colors: {},
      cells: emptyCells(),
      spawnIn: 0,
      nextMoleId: 1,
      winnerId: null,
      reason: null,
      endArmed: false,
    };
    ctx.log("hamster-duel created");
  },

  onJoin: function (ctx, player) {
    ctx.state.scores[player.id] = ctx.state.scores[player.id] || 0;
    if (!ctx.state.colors) ctx.state.colors = {};
    ctx.state.colors[player.id] = ctx.state.colors[player.id] || "red";
    if (ctx.player && ctx.player.getData) {
      ctx.player.getData(player.id).then(function (data) {
        var color =
          data && typeof data.sideColor === "string" ? data.sideColor : "red";
        if (!ctx.state.colors) ctx.state.colors = {};
        ctx.state.colors[player.id] = color;
      });
    }
    var n = connectedIds(ctx).length;
    ctx.log("join", player.id, "connected=" + n, "phase=" + ctx.state.phase);
    if (ctx.state.phase === "waiting" && n >= 2) {
      startCountdown(ctx);
    }
  },

  onLeave: function (ctx, player) {
    ctx.log("leave", player.id);
    if (ctx.state.phase === "countdown" || ctx.state.phase === "playing") {
      finish(ctx, "opponent_left");
      return;
    }
    if (ctx.state.phase === "waiting") {
      delete ctx.state.scores[player.id];
      if (ctx.state.colors) delete ctx.state.colors[player.id];
    }
  },

  onMessage: function (ctx, player, type, payload) {
    if (type !== "hit" || ctx.state.phase !== "playing") return;
    var cell = payload && typeof payload.cell === "number" ? payload.cell | 0 : -1;
    if (cell < 0 || cell > 8) return;
    var mole = ctx.state.cells[cell];
    if (!mole) return;
    ctx.state.cells[cell] = null;
    ctx.state.scores[player.id] = ((ctx.state.scores[player.id] || 0) | 0) + 1;
  },

  onTick: function (ctx, dt) {
    var phase = ctx.state.phase;

    if (phase === "ended") {
      if (!ctx.state.endArmed) {
        ctx.state.endArmed = true;
        return;
      }
      ctx.match.end(ctx.state.reason || "ended");
      return;
    }

    var live = connectedIds(ctx);
    if (
      (phase === "countdown" || phase === "playing") &&
      live.length < 2
    ) {
      finish(ctx, "opponent_left");
      return;
    }

    if (phase === "waiting") {
      if (live.length >= 2) startCountdown(ctx);
      return;
    }

    if (phase === "countdown") {
      ctx.state.countdownLeft -= dt;
      if (ctx.state.countdownLeft <= 0) {
        ctx.state.countdownLeft = 0;
        ctx.state.phase = "playing";
        ctx.state.timeLeft = MATCH_SEC;
        ctx.state.spawnIn = 0.15;
        ctx.log("playing");
      }
      return;
    }

    if (phase !== "playing") return;

    ctx.state.timeLeft -= dt;
    if (ctx.state.timeLeft < 0) ctx.state.timeLeft = 0;

    for (var i = 0; i < 9; i++) {
      var m = ctx.state.cells[i];
      if (!m) continue;
      m.ttl -= dt;
      if (m.ttl <= 0) ctx.state.cells[i] = null;
    }

    ctx.state.spawnIn -= dt;
    if (ctx.state.spawnIn <= 0) spawnMole(ctx);

    if (ctx.state.timeLeft <= 0) {
      finish(ctx, "time");
    }
  },
};
