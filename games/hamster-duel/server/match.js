var COUNTDOWN_SEC = 5;
var MATCH_SEC = 30;
var SPAWN_MIN = 0.35;
var SPAWN_MAX = 1.1;
var MOLE_TTL_MIN = 0.7;
var MOLE_TTL_MAX = 1.6;
var LATE_WINDOW_SEC = 1;
var FRENZY_START_SEC = 10;
var FRENZY_MAX_SEC = 5;
var FRENZY_SPEED_MAX = 1.5;

/** Возраст «недавнего удара» по клетке (сек); вне ctx.state — не уходит клиентам. */
var lateByCell = emptyLateCells();

function emptyCells() {
  return [null, null, null, null, null, null, null, null, null];
}

function emptyLateCells() {
  return [null, null, null, null, null, null, null, null, null];
}

function roundHundredths(v) {
  return Math.round(v * 100) / 100;
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

function syncNames(ctx) {
  if (!ctx.state.names) ctx.state.names = {};
  connectedPlayers(ctx).forEach(function (p) {
    ctx.state.names[p.id] = playerLabel(ctx, p.id);
  });
}

function bothSidesConnected(ctx) {
  var left = ctx.state.sides && ctx.state.sides.left;
  var right = ctx.state.sides && ctx.state.sides.right;
  if (!left || !right) return false;
  var pl = ctx.players.get(left);
  var pr = ctx.players.get(right);
  return !!(pl && pl.connected && pr && pr.connected);
}

function startCountdown(ctx) {
  if (ctx.state.phase !== "waiting") return;
  var left = ctx.state.sides && ctx.state.sides.left;
  var right = ctx.state.sides && ctx.state.sides.right;
  if (!left || !right) {
    var ids = connectedIds(ctx);
    if (ids.length < 2) return;
    left = ids[0];
    right = ids[1];
    ctx.state.sides = { left: left, right: right };
  } else if (!bothSidesConnected(ctx)) {
    return;
  }
  syncNames(ctx);
  ctx.state.phase = "countdown";
  ctx.state.countdownLeft = COUNTDOWN_SEC;
  ctx.state.timeLeft = MATCH_SEC;
  ctx.state.cells = emptyCells();
  lateByCell = emptyLateCells();
  ctx.state.spawnIn = 0.2;
  ctx.state.nextMoleId = 1;
  ctx.state.winnerId = null;
  ctx.state.reason = null;
  ctx.state.endArmed = false;
  ctx.log("countdown start", left, right);
}

function sidesFromOptions(options) {
  var left = null;
  var right = null;
  var teams = options && options.teams;
  if (Array.isArray(teams)) {
    for (var i = 0; i < teams.length; i++) {
      var t = teams[i];
      if (!t || typeof t.id !== "string") continue;
      var pid =
        Array.isArray(t.playerIds) && typeof t.playerIds[0] === "string"
          ? t.playerIds[0]
          : null;
      if (!pid) continue;
      if (t.id === "left") left = pid;
      else if (t.id === "right") right = pid;
    }
    if ((!left || !right) && teams.length >= 2) {
      var a = teams[0] && teams[0].playerIds && teams[0].playerIds[0];
      var b = teams[1] && teams[1].playerIds && teams[1].playerIds[0];
      if (!left && typeof a === "string") left = a;
      if (!right && typeof b === "string") right = b;
    }
  }
  var players = options && options.players;
  if ((!left || !right) && Array.isArray(players)) {
    if (!left && typeof players[0] === "string") left = players[0];
    if (!right && typeof players[1] === "string") right = players[1];
  }
  return { left: left, right: right, fromLobby: !!(left && right) };
}

var TOP_N = 5;

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
    row.score = entry.score;
    row.wins = entry.wins;
    row.games = entry.games;
  } else {
    next.push({
      id: entry.id,
      name: entry.name,
      score: entry.score,
      wins: entry.wins,
      games: entry.games,
    });
  }
  next.sort(function (a, b) {
    return ((b && b[metric]) || 0) - ((a && a[metric]) || 0);
  });
  return next.slice(0, TOP_N);
}

function recordMatchStats(ctx) {
  if (!ctx.player || !ctx.player.getData || !ctx.player.setData) {
    return Promise.resolve();
  }
  if (!ctx.game || !ctx.game.getData || !ctx.game.setData) {
    return Promise.resolve();
  }
  var left = ctx.state.sides && ctx.state.sides.left;
  var right = ctx.state.sides && ctx.state.sides.right;
  var winnerId = ctx.state.winnerId;
  var ids = [];
  if (left) ids.push(left);
  if (right && right !== left) ids.push(right);
  if (!ids.length) return Promise.resolve();

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

  return chain
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
  ctx.state.statsReady = false;
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
  recordMatchStats(ctx).then(function () {
    ctx.state.statsReady = true;
  });
  // Не зовём match.end здесь: сначала уйдёт state с phase=ended (после onTick),
  // после записи статистики закроем комнату.
}

function randRange(a, b) {
  return a + Math.random() * (b - a);
}

/** 1 → 1.5: с 10 с до 5 с до конца плавно, дальше максимум. */
function frenzySpeed(ctx) {
  var t = ctx.state.timeLeft || 0;
  if (t > FRENZY_START_SEC) return 1;
  if (t <= FRENZY_MAX_SEC) return FRENZY_SPEED_MAX;
  return (
    1 +
    (FRENZY_SPEED_MAX - 1) *
      ((FRENZY_START_SEC - t) / (FRENZY_START_SEC - FRENZY_MAX_SEC))
  );
}

function spawnMole(ctx) {
  var free = [];
  for (var i = 0; i < 9; i++) {
    if (!ctx.state.cells[i]) free.push(i);
  }
  if (!free.length) return;
  var cell = free[(Math.random() * free.length) | 0];
  var id = ctx.state.nextMoleId++;
  var scale = 1 / frenzySpeed(ctx);
  ctx.state.cells[cell] = {
    id: id,
    ttl: randRange(MOLE_TTL_MIN, MOLE_TTL_MAX) * scale,
  };
  ctx.state.spawnIn = randRange(SPAWN_MIN, SPAWN_MAX) * scale;
}

globalThis.hooks = {
  onCreate: function (ctx, options) {
    lateByCell = emptyLateCells();
    var sides = sidesFromOptions(options || {});
    ctx.state = {
      phase: "waiting",
      countdownLeft: COUNTDOWN_SEC,
      timeLeft: MATCH_SEC,
      scores: {},
      sides: { left: sides.left, right: sides.right },
      fromLobby: sides.fromLobby,
      colors: {},
      names: {},
      cells: emptyCells(),
      spawnIn: 0,
      nextMoleId: 1,
      winnerId: null,
      reason: null,
      endArmed: false,
    };
    if (sides.left) ctx.state.scores[sides.left] = 0;
    if (sides.right) ctx.state.scores[sides.right] = 0;
    ctx.log(
      "hamster-duel created",
      sides.fromLobby ? "fromLobby" : "open",
      sides.left,
      sides.right,
    );
  },

  onJoin: function (ctx, player) {
    ctx.state.scores[player.id] = ctx.state.scores[player.id] || 0;
    if (!ctx.state.colors) ctx.state.colors = {};
    ctx.state.colors[player.id] = ctx.state.colors[player.id] || "red";
    if (!ctx.state.names) ctx.state.names = {};
    ctx.state.names[player.id] = playerLabel(ctx, player.id);
    if (!ctx.state.sides) ctx.state.sides = { left: null, right: null };
    // Open match room: seat first/second. Lobby-started: sides already frozen.
    if (ctx.state.phase === "waiting" && !ctx.state.fromLobby) {
      if (!ctx.state.sides.left) {
        ctx.state.sides.left = player.id;
      } else if (
        !ctx.state.sides.right &&
        ctx.state.sides.left !== player.id
      ) {
        ctx.state.sides.right = player.id;
      }
    }
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
    if (ctx.state.phase === "waiting") {
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
      if (ctx.state.names) delete ctx.state.names[player.id];
      if (ctx.state.sides) {
        if (ctx.state.sides.left === player.id) ctx.state.sides.left = null;
        if (ctx.state.sides.right === player.id) ctx.state.sides.right = null;
        if (!ctx.state.sides.left && ctx.state.sides.right) {
          ctx.state.sides.left = ctx.state.sides.right;
          ctx.state.sides.right = null;
        }
      }
    }
  },

  onMessage: function (ctx, player, type, payload) {
    if (type !== "hit" || ctx.state.phase !== "playing") return;
    var cell = payload && typeof payload.cell === "number" ? payload.cell | 0 : -1;
    if (cell < 0 || cell > 8) return;
    var mole = ctx.state.cells[cell];
    if (!mole) {
      var age = lateByCell[cell];
      if (age != null && age <= LATE_WINDOW_SEC) {
        ctx.send(player.id, "late", {
          cell: cell,
          delay: roundHundredths(age),
        });
      }
      return;
    }
    ctx.state.cells[cell] = null;
    lateByCell[cell] = 0;
    ctx.state.scores[player.id] = ((ctx.state.scores[player.id] || 0) | 0) + 1;
  },

  onTick: function (ctx, dt) {
    var phase = ctx.state.phase;

    if (phase === "ended") {
      if (!ctx.state.endArmed) {
        ctx.state.endArmed = true;
        return;
      }
      if (!ctx.state.statsReady) return;
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
      startCountdown(ctx);
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

    for (var j = 0; j < 9; j++) {
      if (lateByCell[j] == null) continue;
      lateByCell[j] += dt;
      if (lateByCell[j] > LATE_WINDOW_SEC) lateByCell[j] = null;
    }

    ctx.state.spawnIn -= dt * frenzySpeed(ctx);
    if (ctx.state.spawnIn <= 0) spawnMole(ctx);

    if (ctx.state.timeLeft <= 0) {
      finish(ctx, "time");
    }
  },
};
