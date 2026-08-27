/**
 * ═══════════════════════════════════════════════════════════
 * TOQUE DA CHAMADA — fonte única
 * No Android o som sai do plugin nativo CallRinger (volume de
 * TOQUE do aparelho, em loop). No navegador (ou em APK antigo
 * sem o plugin) cai no WAV pelo WebView.
 * ═══════════════════════════════════════════════════════════
 */
import { registerPlugin } from "@capacitor/core";
import { isNative } from "./config";
import { stopIncomingCallVibration, vibrateIncomingCall } from "./mediaDiagnostics";

interface CallRingerPlugin {
  start(): Promise<void>;
  stop(): Promise<void>;
  canUseFullScreenIntent(): Promise<{ value: boolean }>;
  openFullScreenIntentSettings(): Promise<void>;
  isIgnoringBatteryOptimizations(): Promise<{ value: boolean }>;
  openBatteryOptimizationSettings(): Promise<void>;
  mediaPermissions(): Promise<{ camera: boolean; microphone: boolean }>;
  openAppSettings(): Promise<void>;
}

const CallRinger = registerPlugin<CallRingerPlugin>("CallRinger");

/**
 * Android 14+ pode bloquear a chamada em tela cheia. Quando bloqueada, a
 * campainha ainda toca, mas o morador com o celular na mão não vê a tela de
 * atender — por isso a tela do interfone avisa e leva às configurações.
 * APK antigo sem os métodos no plugin responde erro: aí assume liberado.
 */
export async function podeUsarTelaCheia(): Promise<boolean> {
  if (!isNative) return true;
  try {
    const r = await CallRinger.canUseFullScreenIntent();
    return r?.value !== false;
  } catch {
    return true;
  }
}

export async function abrirConfigTelaCheia(): Promise<void> {
  if (!isNative) return;
  try {
    await CallRinger.openFullScreenIntentSettings();
  } catch {}
}

/**
 * Otimização de bateria (Doze). Com o app dias sem abrir, o Android pode
 * atrasar o push da campainha — a chamada chega tarde ou não chega. Aqui só
 * consultamos; a isenção quem dá é o morador, na tela do sistema.
 * Web e APK antigo sem o método respondem "liberado" para não inventar alarme.
 */
export async function bateriaLiberada(): Promise<boolean> {
  if (!isNative) return true;
  try {
    const r = await CallRinger.isIgnoringBatteryOptimizations();
    return r?.value !== false;
  } catch {
    return true;
  }
}

export async function abrirConfigBateria(): Promise<void> {
  if (!isNative) return;
  try {
    await CallRinger.openBatteryOptimizationSettings();
  } catch {}
}

/**
 * Estado de câmera e microfone no Android. null = não dá para saber (navegador
 * ou APK antigo): nesse caso quem descobre é o próprio getUserMedia.
 */
export async function permissoesDeMidia(): Promise<{ camera: boolean; microfone: boolean } | null> {
  if (!isNative) return null;
  try {
    const r = await CallRinger.mediaPermissions();
    return { camera: r.camera === true, microfone: r.microphone === true };
  } catch {
    return null;
  }
}

/** Tela do app no sistema — saída quando o morador marcou "não perguntar mais". */
export async function abrirConfigApp(): Promise<void> {
  if (!isNative) return;
  try {
    await CallRinger.openAppSettings();
  } catch {}
}

let nativeRinging = false;
let webAudio: HTMLAudioElement | null = null;

function startWebRing() {
  if (webAudio) return;
  try {
    const audio = new Audio("/sounds/ringtone-call.wav");
    audio.loop = true;
    audio.volume = 1;
    audio.play().catch(() => {});
    webAudio = audio;
    vibrateIncomingCall();
  } catch {}
}

function stopWebRing() {
  if (webAudio) {
    try { webAudio.pause(); webAudio.currentTime = 0; } catch {}
    webAudio = null;
  }
  stopIncomingCallVibration();
}

/** Começa a tocar. Idempotente — chamar de novo durante o toque não faz nada. */
export async function startCallRing(): Promise<void> {
  if (isNative) {
    try {
      await CallRinger.start();
      nativeRinging = true;
      return;
    } catch {
      // APK antigo sem o plugin
    }
  }
  startWebRing();
}

/** Para tudo: toque nativo, WAV do WebView e vibração. */
export function stopCallRing(): void {
  if (nativeRinging || isNative) {
    nativeRinging = false;
    CallRinger.stop().catch(() => {});
  }
  stopWebRing();
}
