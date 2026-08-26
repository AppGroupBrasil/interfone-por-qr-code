/** Códigos com que o servidor fecha o socket que perdeu a vez. */
export const WS_REPLACED = 4002;      // outro contexto do mesmo aparelho assumiu
export const WS_BUSY_OTHER_DEVICE = 4003; // a chamada está em andamento em outro aparelho

const DEVICE_KEY = "interfone_device_id";
let deviceIdCache: string | null = null;

/**
 * Identidade estável deste aparelho/navegador. O servidor usa isto para saber
 * se um register novo é o MESMO aparelho a recarregar (pode assumir a conexão
 * da chamada) ou um SEGUNDO aparelho (não pode roubar a chamada em andamento).
 */
export function getDeviceId(): string {
  if (deviceIdCache) return deviceIdCache;
  const novo = `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  try {
    const salvo = localStorage.getItem(DEVICE_KEY);
    if (salvo) {
      deviceIdCache = salvo;
    } else {
      localStorage.setItem(DEVICE_KEY, novo);
      deviceIdCache = novo;
    }
  } catch {
    deviceIdCache = novo;
  }
  return deviceIdCache;
}

/**
 * Reconectar 2s depois de perder a vez deixava os dois contextos se derrubando
 * sem parar: a cada 2s o servidor mandava reenviar a oferta e a PeerConnection
 * recomeçava do zero (imagem piscava e caía, áudio nunca abria). Quem perde a
 * vez fica quieto e só volta quando a tela for usada de novo — a campainha
 * continua chegando por push.
 */
export function reconnectOnUse(cb: () => void): () => void {
  let disparado = false;
  const cleanup = () => {
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("focus", fire);
    window.removeEventListener("pointerdown", fire);
  };
  const fire = () => {
    if (disparado) return;
    disparado = true;
    cleanup();
    cb();
  };
  const onVisible = () => { if (document.visibilityState === "visible") fire(); };
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", fire);
  window.addEventListener("pointerdown", fire);
  return cleanup;
}
