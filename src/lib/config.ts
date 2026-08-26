/* ═══════════════════════════════════════════════════════════
   Capacitor / Web environment configuration
   ═══════════════════════════════════════════════════════════ */

import { Capacitor } from "@capacitor/core";

/** True when running inside a Capacitor native shell (Android/iOS) */
export const isNative: boolean =
  typeof window !== "undefined" && Capacitor.isNativePlatform();

const envApiBaseRaw = ((import.meta as any).env?.VITE_API_URL ?? "") as string;
const envApiBase = envApiBaseRaw.trim();

/**
 * Base URL for all API calls.
 * - Web (dev):  "" → Vite proxy forwards /api to localhost:3001
 * - Web (prod): "" → Express serves SPA + API on same origin
 * - Capacitor:  uses VITE_API_URL env var (e.g. https://appinterfone.com.br)
 */
export const API_BASE: string =
  // Web always uses same-origin to avoid CORS/env drift between www and apex.
  // Native needs an absolute host; fallback guarantees API reachability.
  isNative ? (envApiBase || "https://appinterfone.com.br") : "";

/**
 * Public-facing origin used to build shareable links (QR codes, WhatsApp, etc.).
 * In Capacitor the WebView origin is capacitor://localhost — unusable for links.
 */
export const APP_ORIGIN: string =
  (import.meta as any).env?.VITE_APP_ORIGIN ??
  (isNative ? "https://appinterfone.com.br" : window.location.origin);

/**
 * Build a WebSocket URL from the current API base.
 * - Web dev:  ws://<host>:3001/ws/interfone  (direct to backend, bypasses Vite proxy)
 * - Web prod: wss://appinterfone.com.br/ws/interfone
 * - Capacitor: wss://appinterfone.com.br/ws/interfone
 */
/**
 * Build a WebSocket URL.
 * In dev, the WebSocket server runs on a dedicated port to avoid Vite proxy issues:
 *   /ws/interfone → port 3002
 * In prod / Capacitor, same origin or API_BASE.
 */
export function buildWsUrl(path: string): string {
  if (API_BASE) {
    return API_BASE.replace(/^http/, "ws") + path;
  }

  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const hostname = window.location.hostname;
  const port = window.location.port;

  // Dev: Vite runs on 5173, route to dedicated WS ports
  if (port && port !== "80" && port !== "443" && port !== "3001") {
    return `${proto}//${hostname}:3002${path}`;
  }

  // Prod: same-origin
  return `${proto}//${window.location.host}${path}`;
}

/**
 * Escopo do produto v1: interfonia sem fio (visitante ↔ morador/portaria).
 * Visitantes, pré-autorizações, entregas, veículos, correspondências, livro de
 * protocolo, câmeras, rondas, QR de visitante e reconhecimento facial continuam
 * no código, mas ficam fora do ar — no servidor as rotas nem são montadas
 * (EXTRA_MODULES_ENABLED), então exibi-los aqui só levaria a telas quebradas.
 * Reativar: VITE_EXTRA_MODULES=true no build + EXTRA_MODULES_ENABLED=true no servidor.
 */
export const EXTRAS_ENABLED: boolean =
  ((import.meta as any).env?.VITE_EXTRA_MODULES ?? "") === "true";

/**
 * Abertura remota de portao (IoT): fora da v1 por decisao de produto — o
 * sistema so faz interfonia. O codigo continua no repositorio; a vitrine de
 * dispositivos e as promessas de portao na landing so voltam com
 * VITE_GATE_ENABLED=true no build e GATE_ENABLED=true no servidor.
 */
export const GATE_ENABLED: boolean =
  ((import.meta as any).env?.VITE_GATE_ENABLED ?? "") === "true";
