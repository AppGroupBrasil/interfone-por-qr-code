/* ═══════════════════════════════════════════════════════════
   Centralized API fetch wrapper
   - Web: sends credentials via cookie (same-origin)
   - Capacitor: sends Authorization Bearer header
   ═══════════════════════════════════════════════════════════ */

import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { API_BASE, isNative } from "./config";

const TOKEN_KEY = "auth_token";
const DEMO_BLOCKED_EVENT = "appinterfone:demo-blocked";

function isNativeRuntime(): boolean {
  return isNative || Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "web";
}

function getAlternateAppInterfoneUrl(url: string): string | null {
  if (url.startsWith("https://www.appinterfone.com.br")) {
    return url.replace("https://www.appinterfone.com.br", "https://appinterfone.com.br");
  }
  if (url.startsWith("https://appinterfone.com.br")) {
    return url.replace("https://appinterfone.com.br", "https://www.appinterfone.com.br");
  }
  return null;
}

function getNativeApiBase(): string {
  return API_BASE || "https://www.appinterfone.com.br";
}

function getRequestUrl(input: string | URL | Request): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
}

function resolveRequestUrl(url: string, nativeMode: boolean): string {
  if (url.startsWith("/")) {
    return (nativeMode ? getNativeApiBase() : API_BASE) + url;
  }
  return url;
}

function getDemoPath(url: string): string {
  const nativeBase = getNativeApiBase();
  if (url.startsWith(nativeBase)) {
    return url.slice(nativeBase.length);
  }
  if (API_BASE && url.startsWith(API_BASE)) {
    return url.slice(API_BASE.length);
  }
  return url;
}

function notifyDemoBlocked() {
  globalThis.dispatchEvent(new Event(DEMO_BLOCKED_EVENT));
}

function createDemoBlockedResponse(): Response {
  return new Response(JSON.stringify({ error: "Modo demonstração — ação bloqueada.", demo: true }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}

function buildHeaders(init?: RequestInit): Headers {
  return new Headers(init?.headers);
}

function buildFetchInit(init: RequestInit | undefined, headers: Headers, nativeMode: boolean): RequestInit {
  return {
    ...init,
    headers,
    credentials: nativeMode ? "omit" : "include",
  };
}

function parseNativeBody(body: BodyInit | null | undefined) {
  if (typeof body !== "string") {
    return body;
  }

  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

async function executeNativeRequest(url: string, method: string, headers: Headers, body: BodyInit | null | undefined): Promise<Response> {
  const nativeBody = parseNativeBody(body);
  const request = async (requestUrl: string) =>
    CapacitorHttp.request({
      url: requestUrl,
      method,
      headers: Object.fromEntries(headers.entries()),
      data: nativeBody,
      connectTimeout: 15000,
      readTimeout: 15000,
    });

  try {
    const nativeResponse = await request(url);
    return createNativeResponse(nativeResponse.status, nativeResponse.headers as HeadersInit, nativeResponse.data);
  } catch (nativeErr) {
    const altUrl = getAlternateAppInterfoneUrl(url);
    if (!altUrl) {
      console.error("Native HTTP request failed:", { url, nativeErr });
      throw new Error("Falha de conexão com o servidor. Verifique a internet do celular e tente novamente.");
    }

    try {
      const nativeResponse = await request(altUrl);
      return createNativeResponse(nativeResponse.status, nativeResponse.headers as HeadersInit, nativeResponse.data);
    } catch (altErr) {
      console.error("Native HTTP request failed:", { url, altUrl, nativeErr, altErr });
      throw new Error("Falha de conexão com o servidor. Verifique a internet do celular e tente novamente.");
    }
  }
}

function createNativeResponse(status: number, headers: HeadersInit, data: unknown): Response {
  const responseBody = typeof data === "string" ? data : JSON.stringify(data ?? null);
  return new Response(responseBody, { status, headers });
}

async function handleBlockedUserResponse(response: Response): Promise<void> {
  if (response.status !== 403) {
    return;
  }

  try {
    const cloned = response.clone();
    const body = await cloned.json();
    if (body.blocked) {
      clearToken();
      localStorage.setItem("blocked_message", body.error || "Usuário bloqueado! Entre em contato com seu síndico ou administradora.");
      globalThis.location.href = "/login";
    }
  } catch {
    // ignore parse errors
  }
}

// ─── Token helpers ───────────────────────────────────────
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {}
}

export function clearToken() {
  setToken(null);
}

// ─── Demo mode helpers ───────────────────────────────────
const DEMO_KEY = "appinterfone_demo";
function _isDemoMode(): boolean {
  try { return localStorage.getItem(DEMO_KEY) === "1"; } catch { return false; }
}

// Allowlisted auth paths that work even in demo mode
const DEMO_ALLOW = ["/api/auth/demo", "/api/auth/me", "/api/auth/logout"];

// Custom event fired when a mutating action is blocked in demo mode
export function onDemoBlocked(cb: () => void) {
  globalThis.addEventListener(DEMO_BLOCKED_EVENT, cb);
  return () => globalThis.removeEventListener(DEMO_BLOCKED_EVENT, cb);
}

// ─── apiFetch — drop-in replacement for fetch() ─────────
/**
 * Works exactly like `fetch()` but:
 * 1. Prepends API_BASE to relative URLs (needed in Capacitor).
 * 2. In Capacitor: attaches `Authorization: Bearer <token>` header.
 * 3. In Web: sends `credentials: "include"` (cookie-based, same-origin).
 */
export async function apiFetch(
  input: string | URL | Request,
  init?: RequestInit
): Promise<Response> {
  const nativeMode = isNativeRuntime();
  const url = resolveRequestUrl(getRequestUrl(input), nativeMode);
  const method = (init?.method || "GET").toUpperCase();

  // Prepend API_BASE to relative paths (e.g. "/api/auth/me" → "https://appinterfone.com.br/api/auth/me")
  // ─── Demo mode: block mutating requests ────────────────
  if (_isDemoMode() && ["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const path = getDemoPath(url);
    if (!DEMO_ALLOW.some(a => path.startsWith(a))) {
      notifyDemoBlocked();
      return createDemoBlockedResponse();
    }
  }

  const headers = buildHeaders(init);

  if (nativeMode) {
    // Capacitor: use Bearer token
    const token = getToken();
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const fetchInit = buildFetchInit(init, headers, nativeMode);

  if (nativeMode) {
    return executeNativeRequest(url, method, headers, fetchInit.body);
  }

  const response = await fetch(url, fetchInit).catch(() => {
    throw new Error("Falha de conexão com o servidor. Verifique a internet do celular e tente novamente.");
  });

  await handleBlockedUserResponse(response);
  return response;
}
