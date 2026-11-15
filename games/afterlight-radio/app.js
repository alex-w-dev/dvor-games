(() => {
  const dial = document.getElementById("dial");
  const bandEl = document.getElementById("band");
  const trackEl = document.getElementById("track");
  const loreEl = document.getElementById("lore");
  const stage = document.getElementById("stage");
  const faces = document.getElementById("faces");
  const playerLabel = document.getElementById("player-label");
  const canvas = document.getElementById("fx");
  const ctx = canvas.getContext("2d", { alpha: true });

  const WAVE_LABEL = {
    peace: "PEACE · 88–120",
    battle: "BATTLE · 420–640",
    lobby: "LOBBY · 780–920",
  };

  const audio = new Audio();
  audio.loop = true;
  audio.crossOrigin = "anonymous";

  let catalog = null;
  let sfxClick = null;
  let unlocked = false;
  let lockedWave = null;
  let noise = 0.35;
  let ghostAlpha = 0.15;
  let currentBg = null;
  let haunted = [];
  let ghostImg = null;

  function resize() {
    canvas.width = Math.floor(window.innerWidth * devicePixelRatio);
    canvas.height = Math.floor(window.innerHeight * devicePixelRatio);
  }
  window.addEventListener("resize", resize);
  resize();

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function waveFromDial(value) {
    const v = Number(value);
    if (v < 220) return { wave: "peace", strength: 1 - Math.abs(v - 120) / 120 };
    if (v < 700) return { wave: "battle", strength: 1 - Math.abs(v - 520) / 180 };
    return { wave: "lobby", strength: 1 - Math.abs(v - 860) / 140 };
  }

  function pickTrack(wave) {
    const list = catalog.stations[wave] || [];
    if (!list.length) return null;
    return list[Math.floor(Math.random() * list.length)];
  }

  function setBackground(entry) {
    if (!entry) return;
    currentBg = entry;
    stage.style.backgroundImage =
      'linear-gradient(180deg, rgba(7,6,5,0.35), rgba(7,6,5,0.72)), url("' +
      entry.url +
      '")';
  }

  function setLore(text) {
    loreEl.textContent = text || "";
  }

  function playClick() {
    if (!sfxClick) return;
    try {
      sfxClick.currentTime = 0;
      void sfxClick.play();
    } catch (_) {}
  }

  async function ensureAudio() {
    if (unlocked) return;
    unlocked = true;
    try {
      await audio.play();
      audio.pause();
    } catch (_) {}
  }

  function tune() {
    const { wave, strength } = waveFromDial(dial.value);
    const clean = clamp01(strength);
    noise = 1 - clean;
    ghostAlpha = 0.08 + noise * 0.45;
    bandEl.textContent = WAVE_LABEL[wave];

    if (lockedWave === wave && audio.src) {
      audio.volume = 0.15 + clean * 0.7;
      trackEl.textContent = decodeURIComponent(
        (audio.src.split("/").pop() || wave).replace(/\.ogg$/i, ""),
      );
      return;
    }

    trackEl.textContent =
      clean > 0.55
        ? "почти " + wave + "… нажми «Поймать волну»"
        : "помехи / чужая речь / шорох";
    audio.volume = Math.max(0.05, clean * 0.25);
  }

  async function lockWave() {
    await ensureAudio();
    playClick();
    const { wave, strength } = waveFromDial(dial.value);
    if (strength < 0.35) {
      trackEl.textContent = "слишком далеко от станции";
      return;
    }
    const track = pickTrack(wave);
    if (!track) {
      trackEl.textContent = "на волне " + wave + " пока пусто";
      return;
    }
    lockedWave = wave;
    audio.src = track.url;
    audio.volume = 0.2 + strength * 0.65;
    try {
      await audio.play();
    } catch (_) {
      trackEl.textContent = "разреши звук жестом и поймай снова";
      return;
    }
    trackEl.textContent = track.id;
    const bg =
      catalog.backgrounds[
        Math.floor(Math.random() * catalog.backgrounds.length)
      ];
    setBackground(bg);
    setLore(
      [track.description, bg && bg.description].filter(Boolean).join(" · ") ||
        "Станция " + wave + ": фон и саундтрек из общего asset-датасета.",
    );
  }

  function haunt() {
    playClick();
    const pool = catalog.monsters;
    if (!pool.length) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    haunted.unshift(pick);
    haunted = haunted.slice(0, 5);
    faces.innerHTML = "";
    haunted.forEach(function (m, i) {
      const img = document.createElement("img");
      img.src = m.url;
      img.alt = m.id;
      img.loading = "lazy";
      img.style.setProperty(
        "--tilt",
        (i % 2 === 0 ? -1 : 1) * (4 + i * 2) + "deg",
      );
      img.title = m.description || m.id;
      img.onerror = function () {
        img.remove();
      };
      faces.appendChild(img);
    });
    ghostImg = new Image();
    ghostImg.crossOrigin = "anonymous";
    ghostImg.src = pick.url;
    if (pick.description) setLore(pick.description);
  }

  function drawStatic(t) {
    const w = canvas.width;
    const h = canvas.height;
    if (!w || !h) return;
    const image = ctx.createImageData(w, h);
    const data = image.data;
    const amount = Math.floor(noise * 55);
    for (let i = 0; i < data.length; i += 16) {
      const v = (Math.random() * 255) | 0;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = amount;
    }
    ctx.putImageData(image, 0, 0);

    if (ghostImg && ghostImg.complete && ghostAlpha > 0.05) {
      const size = Math.min(w, h) * 0.35;
      const x = w * (0.55 + Math.sin(t / 900) * 0.08);
      const y = h * (0.35 + Math.cos(t / 1100) * 0.06);
      ctx.save();
      ctx.globalAlpha = ghostAlpha;
      ctx.filter = "contrast(1.2) saturate(0.4) blur(" + (2 + noise * 6) + "px)";
      ctx.drawImage(ghostImg, x, y, size, size);
      ctx.restore();
    }

    ctx.fillStyle =
      "rgba(255,180,84," + (0.02 + (1 - noise) * 0.05) + ")";
    ctx.fillRect(0, 0, w, h);
  }

  function loop(t) {
    drawStatic(t);
    requestAnimationFrame(loop);
  }

  dial.addEventListener("input", function () {
    void ensureAudio();
    tune();
  });
  document.getElementById("lock").addEventListener("click", function () {
    void lockWave();
  });
  document.getElementById("haunt").addEventListener("click", haunt);

  async function bootSdk() {
    try {
      if (!window.PlatformSDK || !window.PlatformSDK.init) return;
      const sdk = await window.PlatformSDK.init();
      const player = await sdk.getPlayer();
      playerLabel.textContent = player.authorized
        ? "игрок " + String(player.id).slice(0, 8)
        : "гость " + String(player.id).slice(0, 10);
    } catch (_) {
      playerLabel.textContent = "offline shell";
    }
  }

  fetch("./catalog.json")
    .then(function (r) {
      return r.json();
    })
    .then(function (data) {
      catalog = data;
      sfxClick = new Audio(catalog.sfx.click);
      sfxClick.volume = 0.35;
      currentBg = catalog.backgrounds[0] || null;
      setBackground(currentBg);
      tune();
      requestAnimationFrame(loop);
      void bootSdk();
    })
    .catch(function (err) {
      trackEl.textContent = "не удалось загрузить catalog.json";
      console.error(err);
    });
})();
