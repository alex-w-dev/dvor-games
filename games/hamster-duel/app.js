(function () {
  const lobbyEl = document.getElementById("lobby");
  const matchEl = document.getElementById("match");
  const lobbyPlayer = document.getElementById("lobby-player");
  const lobbyStatus = document.getElementById("lobby-status");
  const myStatsEl = document.getElementById("my-stats");
  const boardScoreEl = document.getElementById("board-score");
  const boardScoreEmpty = document.getElementById("board-score-empty");
  const boardWinsEl = document.getElementById("board-wins");
  const boardWinsEmpty = document.getElementById("board-wins-empty");
  const boardGamesEl = document.getElementById("board-games");
  const boardGamesEmpty = document.getElementById("board-games-empty");
  const statusEl = document.getElementById("status");
  const timerEl = document.getElementById("timer");
  const joinBtn = document.getElementById("join");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlaySub = document.getElementById("overlay-sub");
  const againBtn = document.getElementById("again");
  const toLobbyBtn = document.getElementById("to-lobby");
  const cancelWaitBtn = document.getElementById("cancel-wait");
  const hammer = document.getElementById("cursor-hammer");
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
  let boardsCache = { topScore: [], topWins: [], topGames: [] };
  let playerSave = {};
  let sideColor = "red";
  let unlockedColors = FREE_COLORS.slice();
  let blackPriceLeaves = null;
  let colorBusy = false;

  function setLobbyStatus(text) {
    lobbyStatus.textContent = text || "";
  }

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function leaveToLobby() {
    if (sdk && sdk.match && sdk.match.leave) {
      try {
        sdk.match.leave();
      } catch (_) {}
    }
    showLobby();
  }

  function showLobby() {
    lobbyEl.hidden = false;
    matchEl.hidden = true;
    overlay.hidden = true;
    hammer.hidden = true;
    cancelWaitBtn.hidden = true;
    document.body.classList.remove("in-match");
    inMatch = false;
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

  function renderBoard(listEl, emptyEl, list, metric, suffix) {
    const rows = Array.isArray(list) ? list : [];
    listEl.innerHTML = "";
    rows.slice(0, 8).forEach((row, i) => {
      const li = document.createElement("li");
      li.innerHTML =
        '<span class="rank"></span><span class="name"></span><span class="wins"></span>';
      li.querySelector(".rank").textContent = String(i + 1);
      li.querySelector(".name").textContent = row.name || "Игрок";
      li.querySelector(".wins").textContent =
        ((row[metric] || 0) | 0) + " " + suffix;
      listEl.appendChild(li);
    });
    emptyEl.hidden = rows.length > 0;
  }

  function renderBoards(shared) {
    const data = shared && typeof shared === "object" ? shared : {};
    boardsCache = {
      topScore: Array.isArray(data.topScore) ? data.topScore : [],
      topWins: Array.isArray(data.topWins) ? data.topWins : [],
      topGames: Array.isArray(data.topGames) ? data.topGames : [],
    };
    renderBoard(
      boardScoreEl,
      boardScoreEmpty,
      boardsCache.topScore,
      "score",
      "очков",
    );
    renderBoard(
      boardWinsEl,
      boardWinsEmpty,
      boardsCache.topWins,
      "wins",
      "побед",
    );
    renderBoard(
      boardGamesEl,
      boardGamesEmpty,
      boardsCache.topGames,
      "games",
      "игр",
    );
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
    if (sdk && sdk.player && sdk.player.setData) {
      await sdk.player.setData(playerSave);
    }
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
    if (id === meId) return "Вы";
    return "Соперник";
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
    const leftId = state.sides && state.sides.left;
    const rightId = state.sides && state.sides.right;
    const left = document.getElementById("side-left");
    const right = document.getElementById("side-right");

    left.classList.toggle("is-me", leftId === meId);
    right.classList.toggle("is-me", rightId === meId);
    left.querySelector(".name").textContent = labelPlayer(leftId, "Игрок 1");
    right.querySelector(".name").textContent = labelPlayer(rightId, "Игрок 2");
    left.querySelector(".score").textContent = String(
      (state.scores && leftId && state.scores[leftId]) || 0,
    );
    right.querySelector(".score").textContent = String(
      (state.scores && rightId && state.scores[rightId]) || 0,
    );
    applySideColor(left, leftId, state);
    applySideColor(right, rightId, state);
  }

  function renderCells(state) {
    const list = state.cells || [];
    for (let i = 0; i < 9; i++) {
      const btn = cells[i];
      const mole = list[i];
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

  function showResult(state) {
    timerEl.hidden = true;
    setStatus("Матч окончен");
    const win = state.winnerId;
    if (state.reason === "opponent_left") {
      overlayTitle.textContent = win === meId ? "Победа" : "Соперник вышел";
      overlaySub.textContent =
        win === meId ? "Соперник покинул бой." : "Матч прерван.";
    } else if (!win) {
      overlayTitle.textContent = "Ничья";
      overlaySub.textContent = "Очки равны.";
    } else if (win === meId) {
      overlayTitle.textContent = "Победа!";
      overlaySub.textContent = "Вы набрали больше очков.";
    } else {
      overlayTitle.textContent = "Поражение";
      overlaySub.textContent = "Соперник был быстрее.";
    }
    hammer.hidden = true;
    cancelWaitBtn.hidden = true;
    overlay.hidden = false;
    inMatch = false;
    joinBtn.disabled = false;
    joinBtn.textContent = "В бой";
  }

  function renderPhase(state) {
    const phase = state.phase || "waiting";
    timerEl.hidden = !(phase === "countdown" || phase === "playing");

    if (phase === "waiting") {
      setStatus("Ожидание соперника…");
      cancelWaitBtn.hidden = false;
      overlay.hidden = true;
      return;
    }
    if (phase === "countdown") {
      const sec = Math.max(0, Math.ceil(Number(state.countdownLeft) || 0));
      setStatus("Приготовьтесь");
      timerEl.textContent = String(sec);
      cancelWaitBtn.hidden = true;
      overlay.hidden = true;
      return;
    }
    if (phase === "playing") {
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
    showMatch();
    renderSides(lastState);
    renderCells(lastState);
    renderPhase(lastState);
  }

  function onMatchMessage(type, payload) {
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

  async function joinMatch() {
    if (!sdk || inMatch) return;
    joinBtn.disabled = true;
    setLobbyStatus("Подключение…");
    overlay.hidden = true;
    try {
      bindMatchHandlers();
      const info = await sdk.match.join();
      inMatch = true;
      meId = (await sdk.getPlayer()).id || meId;
      showMatch();
      if (info && info.state) onState(info.state);
      else {
        setStatus("Ожидание соперника…");
        cancelWaitBtn.hidden = false;
      }
    } catch (e) {
      inMatch = false;
      showLobby();
      joinBtn.disabled = false;
      setLobbyStatus("Не удалось войти: " + (e && e.message ? e.message : e));
    }
  }

  cells.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!sdk || !inMatch) return;
      if (!lastState || lastState.phase !== "playing") return;
      const cell = Number(btn.dataset.cell);
      sdk.match.send("hit", { cell });
      hammer.classList.add("smash");
      setTimeout(() => hammer.classList.remove("smash"), 80);
    });
  });

  joinBtn.addEventListener("click", joinMatch);
  againBtn.addEventListener("click", () => {
    overlay.hidden = true;
    joinMatch();
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
      await refreshLobbyStats();
    } catch (e) {
      lobbyPlayer.textContent =
        "Ошибка SDK: " + (e && e.message ? e.message : e);
    }
  })();
})();
