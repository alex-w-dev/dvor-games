(function () {
  const lobbyEl = document.getElementById("lobby");
  const matchEl = document.getElementById("match");
  const lobbyPlayer = document.getElementById("lobby-player");
  const lobbyStatus = document.getElementById("lobby-status");
  const myStatsEl = document.getElementById("my-stats");
  const boardRatingEl = document.getElementById("board-rating");
  const boardRatingEmpty = document.getElementById("board-rating-empty");
  const statusEl = document.getElementById("status");
  const timerEl = document.getElementById("timer");
  const goCountdownEl = document.getElementById("go-countdown");
  const joinBtn = document.getElementById("join");
  let lastGoSec = null;
  let overlayActionsTimer = null;
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlaySub = document.getElementById("overlay-sub");
  const overlayMePortrait = document.getElementById("overlay-me-portrait");
  const overlayFoePortrait = document.getElementById("overlay-foe-portrait");
  const overlayMeName = document.getElementById("overlay-me-name");
  const overlayFoeName = document.getElementById("overlay-foe-name");
  const overlayMeScore = document.getElementById("overlay-me-score");
  const overlayFoeScore = document.getElementById("overlay-foe-score");
  const againBtn = document.getElementById("again");
  const toLobbyBtn = document.getElementById("to-lobby");
  const cancelWaitBtn = document.getElementById("cancel-wait");
  const hammer = document.getElementById("cursor-hammer");
  const boardStageEl = document.getElementById("board-stage");
  const cells = Array.from(document.querySelectorAll(".cell"));
  const colorSwatchesEl = document.getElementById("color-swatches");
  const colorStatusEl = document.getElementById("color-status");

  const FREE_COLORS = ["red", "blue", "green"];
  const PAID_COLOR = "black";
  const PAID_PRODUCT_ID = "color_black";
  const ALL_COLORS = FREE_COLORS.concat([PAID_COLOR]);

  let sdk = null;
  let meId = "";
  let meName = "Игрок";
  let lastState = null;
  let inMatch = false;
  let handlersBound = false;
  let lobbyConnected = false;
  let searching = false;
  let boardsCache = { topScore: [], topWins: [], topGames: [] };
  let playerSave = {};
  let sideColor = "red";
  let unlockedColors = FREE_COLORS.slice();
  let blackPriceLeaves = null;
  let colorBusy = false;
  // true = я на сервере «справа»: UI всегда «я слева/снизу», поле зеркалим по X
  let viewMirrored = false;

  function mirrorCell(cell) {
    const c = cell | 0;
    if (c < 0 || c > 8) return c;
    return (c / 3 | 0) * 3 + (2 - (c % 3));
  }

  function setLobbyStatus(text) {
    lobbyStatus.textContent = text || "";
  }

  function setStatus(text) {
    statusEl.textContent = text;
  }

  async function leaveToLobby() {
    if (searching) {
      try {
        if (sdk && sdk.lobby && sdk.lobby.send) {
          sdk.lobby.send("cancel_queue");
        }
        if (sdk && sdk.lobby && sdk.lobby.cancelQueue) {
          await sdk.lobby.cancelQueue();
        }
      } catch (_) {}
      searching = false;
    }
    if (sdk && sdk.match && sdk.match.leave) {
      try {
        await sdk.match.leave();
      } catch (_) {}
    }
    lobbyConnected = false;
    inMatch = false;
    showLobby();
    ensureLobby().catch(function () {});
  }

  async function ensureLobby() {
    if (!sdk || !sdk.lobby || !sdk.lobby.join) {
      throw new Error("lobby SDK unavailable");
    }
    if (lobbyConnected) return;
    await sdk.lobby.join();
    lobbyConnected = true;
    if (sdk.lobby.onMatchStarting) {
      sdk.lobby.onMatchStarting(function () {
        searching = false;
        bindMatchHandlers();
        inMatch = true;
        joinBtn.disabled = true;
        showMatch();
        setStatus("Подключение к матчу…");
        cancelWaitBtn.hidden = true;
        // auto-join via SDK (default)
      });
    }
  }

  function lobbySetColor(color, unlocked) {
    return new Promise(function (resolve, reject) {
      if (!sdk || !sdk.lobby || !sdk.lobby.send || !sdk.lobby.onMessage) {
        reject(new Error("lobby.send unavailable"));
        return;
      }
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        off();
        reject(new Error("timeout saving color"));
      }, 10000);
      var off = sdk.lobby.onMessage(function (type, payload) {
        if (type !== "color_ok" && type !== "color_err") return;
        if (done) return;
        done = true;
        clearTimeout(timer);
        off();
        if (type === "color_ok") resolve(payload || {});
        else
          reject(
            new Error(
              (payload && payload.message) || "не удалось сохранить цвет",
            ),
          );
      });
      sdk.lobby.send("set_color", {
        sideColor: color,
        unlockedColors: unlocked,
      });
    });
  }

  function showLobby() {
    lobbyEl.hidden = false;
    matchEl.hidden = true;
    overlay.hidden = true;
    hammer.hidden = true;
    cancelWaitBtn.hidden = true;
    document.body.classList.remove("in-match");
    inMatch = false;
    searching = false;
    joinBtn.disabled = !meId;
    joinBtn.textContent = "В бой";
    setLobbyStatus("");
    refreshLobbyStats();
  }

  function showMatch() {
    lobbyEl.hidden = true;
    matchEl.hidden = false;
    overlay.hidden = true;
    hammer.hidden = false;
    document.body.classList.add("in-match");
  }

  function takeTop(list, n) {
    return (Array.isArray(list) ? list : []).slice(0, n);
  }

  function mergeRatingRows(topScore, topWins, topGames) {
    const byId = Object.create(null);
    function absorb(row) {
      if (!row || row.id == null) return;
      const id = String(row.id);
      const prev = byId[id] || {
        id: row.id,
        name: row.name || "Игрок",
        score: 0,
        wins: 0,
        games: 0,
      };
      byId[id] = {
        id: prev.id,
        name: row.name || prev.name,
        score: Math.max((prev.score || 0) | 0, (row.score || 0) | 0),
        wins: Math.max((prev.wins || 0) | 0, (row.wins || 0) | 0),
        games: Math.max((prev.games || 0) | 0, (row.games || 0) | 0),
      };
    }
    takeTop(topScore, 5).forEach(absorb);
    takeTop(topWins, 5).forEach(absorb);
    takeTop(topGames, 5).forEach(absorb);
    return Object.keys(byId)
      .map(function (id) {
        return byId[id];
      })
      .sort(function (a, b) {
        const ds = ((b.score || 0) | 0) - ((a.score || 0) | 0);
        if (ds) return ds;
        const dw = ((b.wins || 0) | 0) - ((a.wins || 0) | 0);
        if (dw) return dw;
        return ((b.games || 0) | 0) - ((a.games || 0) | 0);
      });
  }

  function renderBoards(shared) {
    const data = shared && typeof shared === "object" ? shared : {};
    boardsCache = {
      topScore: Array.isArray(data.topScore) ? data.topScore : [],
      topWins: Array.isArray(data.topWins) ? data.topWins : [],
      topGames: Array.isArray(data.topGames) ? data.topGames : [],
    };
    const rows = mergeRatingRows(
      boardsCache.topScore,
      boardsCache.topWins,
      boardsCache.topGames,
    );
    boardRatingEl.innerHTML = "";
    rows.forEach(function (row, i) {
      const li = document.createElement("li");
      li.innerHTML =
        '<span class="rank"></span><span class="name"></span>' +
        '<span class="num" data-k="score"></span>' +
        '<span class="num" data-k="wins"></span>' +
        '<span class="num" data-k="games"></span>';
      li.querySelector(".rank").textContent = String(i + 1);
      li.querySelector(".name").textContent = row.name || "Игрок";
      li.querySelector('[data-k="score"]').textContent = String(
        (row.score || 0) | 0,
      );
      li.querySelector('[data-k="wins"]').textContent = String(
        (row.wins || 0) | 0,
      );
      li.querySelector('[data-k="games"]').textContent = String(
        (row.games || 0) | 0,
      );
      boardRatingEl.appendChild(li);
    });
    boardRatingEmpty.hidden = rows.length > 0;
  }

  function renderMyStats(data) {
    if (!myStatsEl) return;
    if (!data) {
      myStatsEl.textContent = "Ваша статистика загрузится после входа.";
      return;
    }
    const score = (data.score || 0) | 0;
    const wins = (data.wins || 0) | 0;
    const games = (data.games || 0) | 0;
    myStatsEl.textContent =
      "Вы: " + score + " очков · " + wins + " побед · " + games + " игр";
  }

  function normalizeColors(data) {
    const prev = data && typeof data === "object" ? data : {};
    let unlocked = Array.isArray(prev.unlockedColors)
      ? prev.unlockedColors.filter(function (c) {
          return ALL_COLORS.indexOf(c) >= 0;
        })
      : [];
    FREE_COLORS.forEach(function (c) {
      if (unlocked.indexOf(c) < 0) unlocked.push(c);
    });
    let color =
      typeof prev.sideColor === "string" && unlocked.indexOf(prev.sideColor) >= 0
        ? prev.sideColor
        : "red";
    return { unlockedColors: unlocked, sideColor: color };
  }

  function setColorStatus(text) {
    if (colorStatusEl) colorStatusEl.textContent = text || "";
  }

  function renderColorPicker() {
    if (!colorSwatchesEl) return;
    colorSwatchesEl.innerHTML = "";
    ALL_COLORS.forEach(function (color) {
      const unlocked = unlockedColors.indexOf(color) >= 0;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "color-swatch";
      btn.dataset.color = color;
      btn.title = unlocked
        ? color
        : "Купить" +
          (blackPriceLeaves != null ? " · " + blackPriceLeaves + " Leaves" : "");
      if (color === sideColor) btn.classList.add("is-selected");
      if (!unlocked) btn.classList.add("is-locked");
      btn.disabled = colorBusy;
      btn.addEventListener("click", function () {
        onColorClick(color);
      });
      colorSwatchesEl.appendChild(btn);
    });
  }

  async function persistColors(nextColor, nextUnlocked) {
    sideColor = nextColor;
    unlockedColors = nextUnlocked.slice();
    playerSave = Object.assign({}, playerSave, {
      sideColor: sideColor,
      unlockedColors: unlockedColors,
    });
    renderColorPicker();
    await ensureLobby();
    const confirmed = await lobbySetColor(sideColor, unlockedColors);
    if (confirmed && typeof confirmed.sideColor === "string") {
      sideColor = confirmed.sideColor;
    }
    if (confirmed && Array.isArray(confirmed.unlockedColors)) {
      unlockedColors = confirmed.unlockedColors.slice();
    }
    playerSave = Object.assign({}, playerSave, {
      sideColor: sideColor,
      unlockedColors: unlockedColors,
    });
    renderColorPicker();
  }

  async function buyBlackColor() {
    if (!sdk || !sdk.payments || !sdk.payments.purchase) {
      setColorStatus("Покупки недоступны в этой сборке SDK.");
      return;
    }
    colorBusy = true;
    renderColorPicker();
    setColorStatus("Покупка…");
    let purchaseId = null;
    try {
      const pending = await sdk.payments.purchase(PAID_PRODUCT_ID);
      purchaseId = pending && pending.purchaseId;
      const nextUnlocked = unlockedColors.slice();
      if (nextUnlocked.indexOf(PAID_COLOR) < 0) nextUnlocked.push(PAID_COLOR);
      await persistColors(PAID_COLOR, nextUnlocked);
      await sdk.payments.confirmPurchase(purchaseId);
      setColorStatus("Чёрный цвет разблокирован.");
    } catch (e) {
      if (purchaseId) {
        try {
          const rolled = unlockedColors.filter(function (c) {
            return c !== PAID_COLOR;
          });
          const fallback =
            rolled.indexOf(sideColor) >= 0 ? sideColor : "red";
          await persistColors(fallback, rolled);
        } catch (_) {}
      }
      setColorStatus(
        "Покупка не удалась: " + (e && e.message ? e.message : e),
      );
    } finally {
      colorBusy = false;
      renderColorPicker();
    }
  }

  async function onColorClick(color) {
    if (colorBusy) return;
    if (unlockedColors.indexOf(color) >= 0) {
      if (color === sideColor) return;
      colorBusy = true;
      renderColorPicker();
      try {
        await persistColors(color, unlockedColors);
        setColorStatus("");
      } catch (e) {
        setColorStatus(
          "Не удалось сохранить цвет: " + (e && e.message ? e.message : e),
        );
      } finally {
        colorBusy = false;
        renderColorPicker();
      }
      return;
    }
    if (color === PAID_COLOR) {
      await buyBlackColor();
    }
  }

  async function syncColorsFromSaveAndEntitlements() {
    let mine = {};
    try {
      if (sdk && sdk.player && sdk.player.getData) {
        mine = (await sdk.player.getData()) || {};
      }
    } catch (_) {
      mine = {};
    }
    playerSave = mine && typeof mine === "object" ? mine : {};
    const normalized = normalizeColors(playerSave);
    unlockedColors = normalized.unlockedColors;
    sideColor = normalized.sideColor;

    try {
      if (sdk && sdk.payments && sdk.payments.getEntitlements) {
        const ents = await sdk.payments.getEntitlements();
        const hasBlack = (ents || []).some(function (e) {
          return e && e.productId === PAID_PRODUCT_ID;
        });
        if (hasBlack && unlockedColors.indexOf(PAID_COLOR) < 0) {
          unlockedColors = unlockedColors.concat([PAID_COLOR]);
          await persistColors(sideColor, unlockedColors);
        }
      }
    } catch (_) {
      /* guest / no payments */
    }

    try {
      if (sdk && sdk.payments && sdk.payments.listProducts) {
        const products = await sdk.payments.listProducts();
        const black = (products || []).find(function (p) {
          return p && p.productId === PAID_PRODUCT_ID;
        });
        blackPriceLeaves = black ? black.priceLeaves : null;
      }
    } catch (_) {
      blackPriceLeaves = null;
    }

    renderColorPicker();
  }

  async function refreshLobbyStats() {
    if (!sdk) {
      renderBoards({});
      renderMyStats(null);
      renderColorPicker();
      return;
    }
    try {
      if (sdk.game && sdk.game.getData) {
        const shared = await sdk.game.getData();
        renderBoards(shared);
      } else {
        renderBoards(boardsCache);
      }
    } catch (_) {
      renderBoards(boardsCache);
    }
    try {
      if (sdk.player && sdk.player.getData) {
        const mine = await sdk.player.getData();
        playerSave = mine && typeof mine === "object" ? mine : {};
        renderMyStats(mine);
      }
    } catch (_) {
      /* keep previous */
    }
    await syncColorsFromSaveAndEntitlements();
  }

  function labelPlayer(id, fallback) {
    if (!id) return fallback;
    const names = (lastState && lastState.names) || {};
    const fromState = names[id];
    if (fromState) return fromState;
    if (id === meId && meName) return meName;
    return fallback;
  }

  function applySideColor(el, playerId, state) {
    const colors = state.colors || {};
    const color =
      (playerId && colors[playerId]) ||
      (playerId === meId ? sideColor : null) ||
      "red";
    el.dataset.color = color;
  }

  function renderSides(state) {
    let leftId = state.sides && state.sides.left;
    let rightId = state.sides && state.sides.right;
    // Waiting: show self immediately even before sides land in state.
    if ((state.phase || "waiting") === "waiting" && meId) {
      if (!leftId && !rightId) leftId = meId;
      else if (leftId && !rightId && leftId !== meId) rightId = meId;
      else if (rightId && !leftId && rightId !== meId) leftId = meId;
    }
    // Визуально всегда: я — left (десктоп) / снизу (мобилка через CSS order).
    viewMirrored = !!(meId && rightId === meId && leftId !== meId);
    const homeId = viewMirrored ? rightId : leftId;
    const awayId = viewMirrored ? leftId : rightId;
    const left = document.getElementById("side-left");
    const right = document.getElementById("side-right");

    left.classList.toggle("is-me", !!(meId && homeId === meId));
    right.classList.toggle("is-me", false);
    left.querySelector(".name").textContent = labelPlayer(homeId, "Вы");
    right.querySelector(".name").textContent = labelPlayer(
      awayId,
      (state.phase || "waiting") === "waiting" ? "Ожидание…" : "Соперник",
    );
    left.querySelector(".score").textContent = String(
      (state.scores && homeId && state.scores[homeId]) || 0,
    );
    right.querySelector(".score").textContent = String(
      (state.scores && awayId && state.scores[awayId]) || 0,
    );
    applySideColor(left, homeId, state);
    applySideColor(right, awayId, state);
  }

  function renderCells(state) {
    const list = state.cells || [];
    for (let i = 0; i < 9; i++) {
      const btn = cells[i];
      const serverCell = viewMirrored ? mirrorCell(i) : i;
      const mole = list[serverCell];
      const had = btn.classList.contains("has-mole");
      btn.classList.toggle("has-mole", !!mole);
      if (!mole && had) {
        btn.classList.add("whack");
        setTimeout(() => btn.classList.remove("whack"), 120);
      }
      let img = btn.querySelector(".mole");
      if (!img) {
        img = document.createElement("span");
        img.className = "mole";
        btn.appendChild(img);
      }
    }
  }

  function hideGoCountdown() {
    goCountdownEl.hidden = true;
    goCountdownEl.textContent = "";
    goCountdownEl.classList.remove("is-pop");
    lastGoSec = null;
  }

  function showGoCountdown(sec) {
    goCountdownEl.hidden = false;
    if (sec === lastGoSec) return;
    lastGoSec = sec;
    goCountdownEl.textContent = String(sec);
    goCountdownEl.classList.remove("is-pop");
    void goCountdownEl.offsetWidth;
    goCountdownEl.classList.add("is-pop");
  }

  function resolveFoeId(state) {
    const leftId = state.sides && state.sides.left;
    const rightId = state.sides && state.sides.right;
    if (meId && leftId === meId) return rightId || null;
    if (meId && rightId === meId) return leftId || null;
    if (leftId && leftId !== meId) return leftId;
    if (rightId && rightId !== meId) return rightId;
    return null;
  }

  function playerColor(state, playerId) {
    const colors = state.colors || {};
    if (playerId && colors[playerId]) return colors[playerId];
    if (playerId === meId) return sideColor || "red";
    return "red";
  }

  function setOverlayActionsLocked(locked) {
    againBtn.disabled = locked;
    toLobbyBtn.disabled = locked;
    overlay.classList.toggle("actions-locked", locked);
  }

  function armOverlayActions() {
    if (overlayActionsTimer) {
      clearTimeout(overlayActionsTimer);
      overlayActionsTimer = null;
    }
    setOverlayActionsLocked(true);
    overlayActionsTimer = setTimeout(function () {
      overlayActionsTimer = null;
      setOverlayActionsLocked(false);
    }, 2000);
  }

  function showResult(state) {
    timerEl.hidden = true;
    hideGoCountdown();
    setStatus("Матч окончен");
    const win = state.winnerId;
    let outcome = "draw";
    if (state.reason === "opponent_left") {
      if (win === meId) {
        outcome = "win";
        overlayTitle.textContent = "Победа";
        overlaySub.textContent = "Соперник покинул бой.";
      } else {
        outcome = "lose";
        overlayTitle.textContent = "Соперник вышел";
        overlaySub.textContent = "Матч прерван.";
      }
    } else if (!win) {
      outcome = "draw";
      overlayTitle.textContent = "Ничья";
      overlaySub.textContent = "Очки равны — достойный бой.";
    } else if (win === meId) {
      outcome = "win";
      overlayTitle.textContent = "Победа!";
      overlaySub.textContent = "Вы набрали больше очков.";
    } else {
      outcome = "lose";
      overlayTitle.textContent = "Поражение";
      overlaySub.textContent = "Соперник был быстрее.";
    }
    overlay.dataset.outcome = outcome;

    const foeId = resolveFoeId(state);
    const myScore = (state.scores && meId && state.scores[meId]) || 0;
    const foeScore = (state.scores && foeId && state.scores[foeId]) || 0;
    overlayMeScore.textContent = String(myScore | 0);
    overlayFoeScore.textContent = String(foeScore | 0);
    overlayMeName.textContent = meName || "Вы";
    overlayFoeName.textContent = labelPlayer(foeId, "Соперник");
    overlayMePortrait.dataset.color = playerColor(state, meId);
    overlayFoePortrait.dataset.color = playerColor(state, foeId);

    hammer.hidden = true;
    cancelWaitBtn.hidden = true;
    overlay.hidden = false;
    armOverlayActions();
    inMatch = false;
    joinBtn.disabled = false;
    joinBtn.textContent = "В бой";
  }

  function renderPhase(state) {
    const phase = state.phase || "waiting";
    timerEl.hidden = phase !== "playing";

    if (phase === "waiting") {
      hideGoCountdown();
      setStatus("Ожидание соперника…");
      cancelWaitBtn.hidden = false;
      overlay.hidden = true;
      return;
    }
    if (phase === "countdown") {
      const sec = Math.max(0, Math.ceil(Number(state.countdownLeft) || 0));
      setStatus("Приготовьтесь");
      showGoCountdown(sec);
      cancelWaitBtn.hidden = true;
      overlay.hidden = true;
      return;
    }
    if (phase === "playing") {
      hideGoCountdown();
      const left = Math.max(0, Number(state.timeLeft) || 0);
      const sec = Math.max(0, Math.ceil(left - 1e-9));
      setStatus("Бейте хомяков!");
      timerEl.textContent = sec + " с";
      cancelWaitBtn.hidden = true;
      overlay.hidden = true;
      return;
    }
    if (phase === "ended") {
      showResult(state);
    }
  }

  function onState(state) {
    lastState = state || {};
    var phase = lastState.phase || "waiting";
    // Не держим inMatch=false после рематча: join() может отдать stale state
    // предыдущего матча с phase=ended и иначе клики по хомякам молчат.
    if (phase === "ended") inMatch = false;
    else inMatch = true;
    showMatch();
    renderSides(lastState);
    renderCells(lastState);
    renderPhase(lastState);
  }

  function showLateFloat(serverCell, delay) {
    if (!boardStageEl) return;
    const visual =
      viewMirrored ? mirrorCell(serverCell | 0) : serverCell | 0;
    const btn = cells[visual];
    if (!btn) return;
    const stageRect = boardStageEl.getBoundingClientRect();
    const cellRect = btn.getBoundingClientRect();
    const el = document.createElement("span");
    el.className = "late-float";
    const d = Number(delay);
    const text =
      "−" + (Number.isFinite(d) ? d : 0).toFixed(2) + " с";
    el.textContent = text;
    el.style.left =
      cellRect.left - stageRect.left + cellRect.width / 2 + "px";
    el.style.top =
      cellRect.top - stageRect.top + cellRect.height * 0.35 + "px";
    boardStageEl.appendChild(el);
    el.addEventListener("animationend", function () {
      el.remove();
    });
  }

  function onMatchMessage(type, payload) {
    if (type === "late") {
      showLateFloat(
        payload && payload.cell,
        payload && payload.delay,
      );
      return;
    }
    if (type === "ended" || type === "match_ended") {
      const next = Object.assign({}, lastState || {}, {
        phase: "ended",
        reason: (payload && payload.reason) || (lastState && lastState.reason),
        winnerId:
          (payload && payload.winnerId) || (lastState && lastState.winnerId),
      });
      onState(next);
    }
  }

  function bindMatchHandlers() {
    if (handlersBound || !sdk) return;
    handlersBound = true;
    sdk.match.onState(onState);
    if (sdk.match.onMessage) sdk.match.onMessage(onMatchMessage);
    if (sdk.match.onEnded) {
      sdk.match.onEnded(function (reason) {
        onMatchMessage("ended", { reason: reason });
      });
    }
  }

  async function queueForDuel() {
    if (!sdk || inMatch || searching) return;
    joinBtn.disabled = true;
    overlay.hidden = true;
    try {
      await ensureLobby();
      if (sdk.lobby.queue) {
        try {
          await sdk.lobby.queue("duel");
        } catch (_) {}
      }
      sdk.lobby.send("queue");
      searching = true;
      joinBtn.textContent = "Отмена";
      joinBtn.disabled = false;
      setLobbyStatus("Ищем соперника…");
    } catch (e) {
      searching = false;
      joinBtn.disabled = !meId;
      joinBtn.textContent = "В бой";
      setLobbyStatus(
        "Не удалось встать в поиск: " + (e && e.message ? e.message : e),
      );
    }
  }

  async function cancelQueue() {
    if (!searching) return;
    try {
      if (sdk && sdk.lobby && sdk.lobby.send) sdk.lobby.send("cancel_queue");
      if (sdk && sdk.lobby && sdk.lobby.cancelQueue) {
        await sdk.lobby.cancelQueue();
      }
    } catch (_) {}
    searching = false;
    joinBtn.disabled = !meId;
    joinBtn.textContent = "В бой";
    setLobbyStatus("Поиск отменён.");
  }

  async function onJoinClick() {
    if (searching) {
      await cancelQueue();
      return;
    }
    await queueForDuel();
  }

  cells.forEach((btn) => {
    btn.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (!sdk || !inMatch) return;
      if (!lastState || lastState.phase !== "playing") return;
      e.preventDefault();
      const visual = Number(btn.dataset.cell);
      const cell = viewMirrored ? mirrorCell(visual) : visual;
      sdk.match.send("hit", { cell });
      hammer.classList.add("smash");
      setTimeout(() => hammer.classList.remove("smash"), 80);
    });
  });

  joinBtn.addEventListener("click", onJoinClick);
  againBtn.addEventListener("click", () => {
    overlay.hidden = true;
    leaveToLobby().then(function () {
      return queueForDuel();
    });
  });
  toLobbyBtn.addEventListener("click", leaveToLobby);
  cancelWaitBtn.addEventListener("click", leaveToLobby);

  window.addEventListener("mousemove", (e) => {
    if (hammer.hidden) return;
    hammer.style.left = e.clientX + "px";
    hammer.style.top = e.clientY + "px";
  });

  (async () => {
    showLobby();
    if (typeof PlatformSDK === "undefined") {
      lobbyPlayer.textContent = "SDK не загрузился";
      return;
    }
    try {
      sdk = await PlatformSDK.init();
      const player = await sdk.getPlayer();
      meId = player && player.id ? player.id : "";
      meName =
        (player && (player.username || player.displayName || player.name)) ||
        (meId ? "Игрок " + meId.slice(0, 6) : "Гость");
      lobbyPlayer.textContent = meId
        ? "Вы вошли как " + meName
        : "Гость — войдите в аккаунт";
      joinBtn.disabled = !meId;
      if (!meId) setLobbyStatus("Для матча нужен вход на платформе.");
      if (meId) {
        try {
          await ensureLobby();
        } catch (lobbyErr) {
          setLobbyStatus(
            "Лобби недоступно: " +
              (lobbyErr && lobbyErr.message ? lobbyErr.message : lobbyErr),
          );
        }
      }
      await refreshLobbyStats();
    } catch (e) {
      lobbyPlayer.textContent =
        "Ошибка SDK: " + (e && e.message ? e.message : e);
    }
  })();
})();
