export type SfxKind =
  | "hit"
  | "crit"
  | "shield"
  | "heal"
  | "poison"
  | "click"
  | "win"
  | "lose";

let audioCtx: AudioContext | null = null;
const buffers = new Map<SfxKind, AudioBuffer>();
const loading = new Map<SfxKind, Promise<AudioBuffer | null>>();

/** Те же ключи, что в client `SfxId` → S3 `sfx/{id}/original.ogg`. */
const SFX_CDN = "https://storage.yandexcloud.net/lfm/sfx";

const SFX_URL: Record<SfxKind, string> = {
  hit: `${SFX_CDN}/sfx_hit/original.ogg`,
  crit: `${SFX_CDN}/sfx_hit_crit/original.ogg`,
  shield: `${SFX_CDN}/sfx_hit_shield/original.ogg`,
  heal: `${SFX_CDN}/sfx_skill_heal/original.ogg`,
  poison: `${SFX_CDN}/sfx_dot_tick/original.ogg`,
  click: `${SFX_CDN}/sfx_ui_click/original.ogg`,
  win: `${SFX_CDN}/sfx_battle_victory/original.ogg`,
  lose: `${SFX_CDN}/sfx_battle_defeat/original.ogg`,
};

const SFX_GAIN: Record<SfxKind, number> = {
  click: 0.35,
  hit: 0.45,
  crit: 0.5,
  shield: 0.42,
  heal: 0.4,
  poison: 0.38,
  win: 0.45,
  lose: 0.4,
};

export function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      audioCtx = new AC();
    }
    if (audioCtx.state === "suspended") void audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

async function loadBuffer(kind: SfxKind): Promise<AudioBuffer | null> {
  const cached = buffers.get(kind);
  if (cached) return cached;
  const pending = loading.get(kind);
  if (pending) return pending;

  const task = (async () => {
    const ac = getAudioContext();
    if (!ac) return null;
    try {
      const res = await fetch(SFX_URL[kind]);
      if (!res.ok) return null;
      const raw = await res.arrayBuffer();
      const buf = await ac.decodeAudioData(raw.slice(0));
      buffers.set(kind, buf);
      return buf;
    } catch {
      return null;
    } finally {
      loading.delete(kind);
    }
  })();

  loading.set(kind, task);
  return task;
}

function playBuffer(kind: SfxKind, buf: AudioBuffer): void {
  const ac = getAudioContext();
  if (!ac) return;
  const src = ac.createBufferSource();
  const g = ac.createGain();
  src.buffer = buf;
  g.gain.value = SFX_GAIN[kind];
  src.connect(g);
  g.connect(ac.destination);
  src.start();
}

/** Fallback, если файл не загрузился. */
function beep(
  freq: number,
  dur: number,
  type: OscillatorType,
  gain = 0.045,
  when = 0,
): void {
  const ac = getAudioContext();
  if (!ac) return;
  const t0 = ac.currentTime + when;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function playBeepFallback(kind: SfxKind): void {
  switch (kind) {
    case "click":
      beep(520, 0.05, "square", 0.03);
      break;
    case "hit":
      beep(180, 0.09, "sawtooth", 0.05);
      beep(90, 0.12, "triangle", 0.035, 0.02);
      break;
    case "crit":
      beep(320, 0.08, "square", 0.05);
      beep(480, 0.1, "sawtooth", 0.04, 0.05);
      beep(640, 0.12, "triangle", 0.03, 0.1);
      break;
    case "shield":
      beep(420, 0.08, "sine", 0.04);
      beep(620, 0.1, "sine", 0.03, 0.04);
      break;
    case "heal":
      beep(480, 0.08, "sine", 0.035);
      beep(720, 0.12, "sine", 0.03, 0.06);
      break;
    case "poison":
      beep(160, 0.14, "triangle", 0.04);
      beep(120, 0.16, "sawtooth", 0.025, 0.05);
      break;
    case "win":
      beep(523, 0.1, "sine", 0.04);
      beep(659, 0.12, "sine", 0.035, 0.08);
      beep(784, 0.18, "sine", 0.03, 0.16);
      break;
    case "lose":
      beep(220, 0.2, "triangle", 0.04);
      beep(165, 0.28, "sine", 0.035, 0.12);
      break;
  }
}

export function playSfx(kind: SfxKind): void {
  void (async () => {
    const buf = await loadBuffer(kind);
    if (buf) {
      playBuffer(kind, buf);
      return;
    }
    playBeepFallback(kind);
  })();
}

/** Прогрев буферов после жеста пользователя. */
export function preloadSfx(): void {
  for (const kind of Object.keys(SFX_URL) as SfxKind[]) {
    void loadBuffer(kind);
  }
}
