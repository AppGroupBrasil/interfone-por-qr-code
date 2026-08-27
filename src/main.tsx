import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import { CapacitorUpdater } from "@capgo/capacitor-updater";
import App from "./App";
import "./index.css";
// Registra o listener de beforeinstallprompt antes de qualquer tela montar.
import "./lib/pwaInstall";

// OTA: sem notifyAppReady dentro de appReadyTimeout o plugin considera o
// bundle quebrado e faz rollback automático para a versão embutida no APK.
if (Capacitor.isNativePlatform()) {
  CapacitorUpdater.notifyAppReady().catch(() => {});
}

// Detecta wrapper Capacitor (Android/iOS) e marca <html> para aplicar safe-area
try {
  const isCapacitor =
    typeof window !== "undefined" &&
    (((window as any).Capacitor && (window as any).Capacitor.isNativePlatform?.()) ||
      /Android.*wv\)|Capacitor/i.test(navigator.userAgent));
  if (isCapacitor) {
    document.documentElement.classList.add("capacitor-native");
  }
} catch {}

// Apply saved theme immediately to prevent flash
try {
  const savedTheme = localStorage.getItem("app-theme");
  const validThemes = ["dark", "light", "steel", "emerald", "midnight"];
  if (savedTheme && validThemes.includes(savedTheme) && savedTheme !== "light") {
    document.documentElement.classList.add(savedTheme);
  }
} catch {
  // localStorage may be unavailable in private/incognito mode
}

// ─── Listen for Service Worker messages (push ringtone) ───
let pushRingtoneAudio: HTMLAudioElement | null = null;

function stopPushRingtone() {
  if (pushRingtoneAudio) {
    pushRingtoneAudio.pause();
    pushRingtoneAudio.currentTime = 0;
    pushRingtoneAudio = null;
  }
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (event) => {
    const msg = event.data;

    if (msg?.type === "play-ringtone") {
      stopPushRingtone();
      pushRingtoneAudio = new Audio("/sounds/ringtone-call.wav");
      pushRingtoneAudio.loop = true;
      pushRingtoneAudio.volume = 0.8;
      pushRingtoneAudio.play().catch(() => {
        console.warn("Ringtone autoplay blocked by browser");
      });
    }

    if (msg?.type === "stop-ringtone") {
      stopPushRingtone();
    }
  });
}

// Also listen for custom event (dispatched from other components to stop push ringtone)
globalThis.addEventListener("stop-push-ringtone", stopPushRingtone);

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
