/* ═══════════════════════════════════════════════════════════
   Capacitor / Web environment configuration
   ═══════════════════════════════════════════════════════════ */

/** True when running inside a Capacitor native shell (Android/iOS) */
export const isNative: boolean =
  typeof window !== "undefined" &&
  !!(window as any).Capacitor?.isNativePlatform?.();

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
  isNative ? (envApiBase || "https://www.appinterfone.com.br") : "";

/**
 * Public-facing origin used to build shareable links (QR codes, WhatsApp, etc.).
 * In Capacitor the WebView origin is capacitor://localhost — unusable for links.
 */
export const APP_ORIGIN: string =
  (import.meta as any).env?.VITE_APP_ORIGIN ??
  (isNative ? "https://www.appinterfone.com.br" : window.location.origin);

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
