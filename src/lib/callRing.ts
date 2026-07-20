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
}

const CallRinger = registerPlugin<CallRingerPlugin>("CallRinger");

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
