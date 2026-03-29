/**
 * Biblioteca de Toques – App Interfone
 * -----------------------------------
 * 6 toques distintos gerados via Web Audio API (AudioContext).
 * Cada toque possui id, nome, descrição e funções play/stop.
 * A preferência do usuário é salva em localStorage.
 */

/* ── tipos ─────────────────────────────────────── */
export interface RingtoneInfo {
  id: string;
  name: string;
  description: string;
}

interface ActiveRingtone {
  stop: () => void;
}

/* ── estado interno ────────────────────────────── */
let active: ActiveRingtone | null = null;

const STORAGE_KEY = "interfone_ringtone";

/* ── catálogo ──────────────────────────────────── */
export const RINGTONES: RingtoneInfo[] = [
  { id: "classico",   name: "Clássico",   description: "Toque padrão – beep intermitente" },
  { id: "suave",      name: "Suave",       description: "Pulso suave e grave" },
  { id: "urgente",    name: "Urgente",     description: "Beep rápido e agudo" },
  { id: "melodia",    name: "Melodia",     description: "Sequência de notas musicais" },
  { id: "digital",    name: "Digital",     description: "Tom digital moderno" },
  { id: "campainha",  name: "Campainha",   description: "Ding-dong de campainha" },
];

/* ── preferência do usuário ────────────────────── */
export function getSelectedRingtone(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || "classico";
  } catch {
    return "classico";
  }
}

export function setSelectedRingtone(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {}
}

/* ── helpers ───────────────────────────────────── */
function safeClose(ctx: AudioContext) {
  try { if (ctx.state !== "closed") ctx.close().catch(() => {}); } catch {}
}

/* ── geradores de toque ────────────────────────── */

/**
 * 1) Clássico – Padrão telefone: ring-ring … pausa … ring-ring
 *    440 Hz sine, 2 toques curtos (0.4s cada) com pausa de 2.5s entre grupos
 */
function playClassico(): ActiveRingtone {
  const ctx = new AudioContext();
  let stopped = false;

  const playRingGroup = () => {
    if (stopped) return;
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 440;
      gain.gain.value = 0.3;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.55;
      osc.start(t);
      osc.stop(t + 0.4);
    }
  };

  playRingGroup();
  const interval = setInterval(playRingGroup, 3000);

  return {
    stop: () => {
      stopped = true;
      clearInterval(interval);
      safeClose(ctx);
    },
  };
}

/**
 * 2) Suave – 280 Hz triangle, fade in/out suave
 */
function playSuave(): ActiveRingtone {
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.value = 280;
  gain.gain.value = 0;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();

  const pulse = () => {
    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.4);
    gain.gain.linearRampToValueAtTime(0, now + 0.8);
    // segunda batida mais leve
    gain.gain.linearRampToValueAtTime(0.15, now + 1.2);
    gain.gain.linearRampToValueAtTime(0, now + 1.6);
  };

  pulse();
  const interval = setInterval(pulse, 2400);

  return {
    stop: () => {
      clearInterval(interval);
      try { osc.stop(); } catch {};
      safeClose(ctx);
    },
  };
}

/**
 * 3) Urgente – 880 Hz square, 3 beeps rápidos + pausa
 */
function playUrgente(): ActiveRingtone {
  const ctx = new AudioContext();
  let stopped = false;

  const playBurst = () => {
    if (stopped) return;
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 880;
      gain.gain.value = 0.2;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.25;
      osc.start(t);
      osc.stop(t + 0.15);
    }
  };

  playBurst();
  const interval = setInterval(playBurst, 1500);

  return {
    stop: () => {
      stopped = true;
      clearInterval(interval);
      safeClose(ctx);
    },
  };
}

/**
 * 4) Melodia – Sequência de notas (Dó-Mi-Sol-Dó5)
 */
function playMelodia(): ActiveRingtone {
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  gain.gain.value = 0;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();

  const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

  const playSequence = () => {
    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.25;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.setValueAtTime(0, t + 0.2);
    });
    // silêncio ao final da sequência
    gain.gain.setValueAtTime(0, now + notes.length * 0.25);
  };

  playSequence();
  const interval = setInterval(playSequence, 1800);

  return {
    stop: () => {
      clearInterval(interval);
      try { osc.stop(); } catch {};
      safeClose(ctx);
    },
  };
}

/**
 * 5) Digital – Dois tons alternados (600 / 900 Hz) onda square
 */
function playDigital(): ActiveRingtone {
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  gain.gain.value = 0;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();

  const pattern = () => {
    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    // beep 1
    osc.frequency.setValueAtTime(600, now);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.setValueAtTime(0, now + 0.12);
    // beep 2
    osc.frequency.setValueAtTime(900, now + 0.2);
    gain.gain.setValueAtTime(0.18, now + 0.2);
    gain.gain.setValueAtTime(0, now + 0.32);
    // beep 3
    osc.frequency.setValueAtTime(600, now + 0.4);
    gain.gain.setValueAtTime(0.18, now + 0.4);
    gain.gain.setValueAtTime(0, now + 0.52);
    // silêncio
    gain.gain.setValueAtTime(0, now + 0.6);
  };

  pattern();
  const interval = setInterval(pattern, 1200);

  return {
    stop: () => {
      clearInterval(interval);
      try { osc.stop(); } catch {};
      safeClose(ctx);
    },
  };
}

/**
 * 6) Campainha – Ding-dong (dois tons longos: 700 Hz → 550 Hz)
 */
function playCampainha(): ActiveRingtone {
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  gain.gain.value = 0;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();

  const dingDong = () => {
    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    osc.frequency.cancelScheduledValues(now);
    // Ding
    osc.frequency.setValueAtTime(700, now);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    // Dong
    osc.frequency.setValueAtTime(550, now + 0.55);
    gain.gain.setValueAtTime(0.3, now + 0.55);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 1.1);
    // silêncio
    gain.gain.setValueAtTime(0, now + 1.15);
  };

  dingDong();
  const interval = setInterval(dingDong, 2200);

  return {
    stop: () => {
      clearInterval(interval);
      try { osc.stop(); } catch {};
      safeClose(ctx);
    },
  };
}

/* ── mapa de geradores ─────────────────────────── */
const generators: Record<string, () => ActiveRingtone> = {
  classico:  playClassico,
  suave:     playSuave,
  urgente:   playUrgente,
  melodia:   playMelodia,
  digital:   playDigital,
  campainha: playCampainha,
};

/* ── API pública ───────────────────────────────── */

/** Toca o toque selecionado (ou o informado por id). Para o anterior se houver. */
export function playRingtone(id?: string) {
  stopRingtone();
  const chosen = id || getSelectedRingtone();
  const gen = generators[chosen] || generators["classico"];
  try {
    active = gen();
  } catch {
    // fallback silencioso
  }
}

/** Toca um preview de 3 s do toque informado. */
export function previewRingtone(id: string) {
  stopRingtone();
  const gen = generators[id] || generators["classico"];
  try {
    active = gen();
    setTimeout(() => {
      stopRingtone();
    }, 3000);
  } catch {}
}

/** Para o toque ativo. */
export function stopRingtone() {
  if (!active) return;
  try { active.stop(); } catch {}
  active = null;
}
