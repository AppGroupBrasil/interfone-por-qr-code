/* ═══════════════════════════════════════════════════════════
   Centralized API fetch wrapper
   - Web: sends credentials via cookie (same-origin)
   - Capacitor: sends Authorization Bearer header
   ═══════════════════════════════════════════════════════════ */

import { API_BASE, isNative } from "./config";

const TOKEN_KEY = "auth_token";

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
  window.addEventListener("appinterfone:demo-blocked", cb);
  return () => window.removeEventListener("appinterfone:demo-blocked", cb);
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
  let url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

  // Prepend API_BASE to relative paths (e.g. "/api/auth/me" → "https://appinterfone.com.br/api/auth/me")
  if (url.startsWith("/")) {
    url = API_BASE + url;
  }

  // ─── Demo mode: block mutating requests ────────────────
  const method = (init?.method || "GET").toUpperCase();
  if (_isDemoMode() && ["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const path = url.replace(API_BASE, "");
    if (!DEMO_ALLOW.some(a => path.startsWith(a))) {
      window.dispatchEvent(new Event("appinterfone:demo-blocked"));
      return new Response(JSON.stringify({ error: "Modo demonstração — ação bloqueada.", demo: true }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  const headers = new Headers(init?.headers);

  if (isNative) {
    // Capacitor: use Bearer token
    const token = getToken();
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const fetchInit: RequestInit = {
    ...init,
    headers,
    // Web: include cookies. Capacitor: no cookies, but harmless to include.
    credentials: isNative ? "omit" : "include",
  };

  let response: Response;
  try {
    response = await fetch(url, fetchInit);
  } catch (err) {
    // Mobile fallback: some networks/devices fail on one host but work on the other.
    if (isNative && (url.startsWith("https://www.appinterfone.com.br") || url.startsWith("https://appinterfone.com.br"))) {
      const altUrl = url.startsWith("https://www.appinterfone.com.br")
        ? url.replace("https://www.appinterfone.com.br", "https://appinterfone.com.br")
        : url.replace("https://appinterfone.com.br", "https://www.appinterfone.com.br");

      try {
        response = await fetch(altUrl, fetchInit);
      } catch {
        throw new Error("Falha de conexão com o servidor. Verifique a internet do celular e tente novamente.");
      }
    } else {
      throw new Error("Falha de conexão com o servidor. Verifique a internet do celular e tente novamente.");
    }
  }

  // Global blocked interceptor: if user's condomínio was blocked while logged in,
  // clear session and redirect to login with the blocked message.
  if (response.status === 403) {
    try {
      const cloned = response.clone();
      const body = await cloned.json();
      if (body.blocked) {
        clearToken();
        localStorage.setItem("blocked_message", body.error || "Usuário bloqueado! Entre em contato com seu síndico ou administradora.");
        window.location.href = "/login";
      }
    } catch {
      // ignore parse errors
    }
  }

  return response;
}
