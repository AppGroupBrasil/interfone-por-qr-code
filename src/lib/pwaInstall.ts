// Captura do prompt de instalação. Fica em módulo importado cedo pelo main:
// o Chrome dispara beforeinstallprompt no carregamento, antes de qualquer tela montar.

import { Capacitor } from "@capacitor/core";

export interface PromptInstalacao extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type Plataforma =
  | "instalado"
  | "android"
  | "ios-safari"
  | "ios-outro"
  | "desktop";

let promptGuardado: PromptInstalacao | null = null;
const ouvintes = new Set<() => void>();

const avisar = () => ouvintes.forEach((fn) => fn());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // sem isso o Chrome mostra a própria barra e some com o evento
    promptGuardado = e as PromptInstalacao;
    avisar();
  });
  window.addEventListener("appinstalled", () => {
    promptGuardado = null;
    avisar();
  });
}

export const getPromptInstalacao = () => promptGuardado;

export function limparPromptInstalacao() {
  promptGuardado = null;
  avisar();
}

export function ouvirPromptInstalacao(fn: () => void) {
  ouvintes.add(fn);
  return () => {
    ouvintes.delete(fn);
  };
}

export function ehStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia?.("(display-mode: standalone)").matches === true;
}

export function ehIos(): boolean {
  if (typeof navigator === "undefined") return false;
  // iPad com iPadOS se apresenta como Mac: só o toque o denuncia.
  const ipadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) || ipadOS;
}

export const ehIpad = () =>
  typeof navigator !== "undefined" &&
  (/iPad/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

// Link aberto dentro de outro app (Instagram, Facebook, LinkedIn) nao tem
// "Adicionar a Tela de Inicio": o morador precisa sair para o Safari.
export function ehWebViewIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /FBAN|FBAV|Instagram|LinkedInApp|MicroMessenger|Twitter/i.test(navigator.userAgent);
}

export function detectarPlataforma(): Plataforma {
  // Dentro do app nativo (Capacitor) nao existe o que instalar.
  if (Capacitor.isNativePlatform()) return "instalado";
  if (ehStandalone()) return "instalado";
  if (ehIos()) {
    // Chrome, Firefox, Edge e Opera no iOS não têm "Adicionar à Tela de Início".
    const outroNavegador = /CriOS|FxiOS|EdgiOS|OPiOS|Chrome/i.test(navigator.userAgent);
    return outroNavegador || ehWebViewIos() ? "ios-outro" : "ios-safari";
  }
  if (typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent)) return "android";
  return "desktop";
}

// APK oficial para quem nao quer esperar a Play Store. O link "latest" do
// GitHub sempre aponta para a ultima release publicada com esse nome de
// arquivo — nao precisa mexer no site a cada versao nova.
export const APK_URL =
  "https://github.com/AppGroupBrasil/interfone-por-qr-code/releases/latest/download/app-interfone.apk";
export const APK_VERSAO = "1.0.20";
