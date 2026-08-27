/**
 * Navegação de fora do React (listeners de push) sem recarregar o app.
 *
 * `location.href` remonta o WebView inteiro: no Android isso matava o aviso
 * global no meio de uma chamada — o socket que estava com ela fechava sem
 * mandar call-handoff, e no cold start ainda saía um segundo boot. Aqui o
 * roteador do app registra o navigate e a navegação vira SPA.
 */
type Navegador = (path: string) => void;

/** Pede ao aviso global que se re-registre e reveja se há chamada pendente. */
export const EVENTO_REVALIDAR_CHAMADA = "appinterfone:revalidar-chamada";

/** Avisa a interface quando uma chamada entra ou sai da tela. */
export const EVENTO_CHAMADA_ATIVA = "appinterfone:chamada-ativa";

export function haChamadaAtiva(): boolean {
  return callAtiva !== null;
}

export function revalidarChamada(): void {
  globalThis.dispatchEvent(new Event(EVENTO_REVALIDAR_CHAMADA));
}

let navegador: Navegador | null = null;
let callAtiva: string | null = null;
let timerAbertura: ReturnType<typeof setTimeout> | null = null;

/** O aviso global registra o navigate do React Router ao montar. */
export function registrarNavegador(fn: Navegador): () => void {
  navegador = fn;
  return () => {
    if (navegador === fn) navegador = null;
  };
}

export function abrirNoApp(path: string): void {
  if (globalThis.location?.pathname === path) return;
  if (navegador) navegador(path);
  else globalThis.location.href = path; // app ainda não montou o roteador
}

/** Chamada tocando/em andamento no aviso global. */
export function marcarChamadaAtiva(callId: string | null): void {
  const antes = callAtiva !== null;
  callAtiva = callId;
  if (callId && timerAbertura) {
    clearTimeout(timerAbertura);
    timerAbertura = null;
  }
  // Só na virada: o aviso global reafirma a chamada a cada render.
  if (antes !== (callId !== null)) {
    globalThis.dispatchEvent(new CustomEvent(EVENTO_CHAMADA_ATIVA, { detail: callId !== null }));
  }
}

/**
 * Rede de segurança do toque na notificação: se em `ms` nenhuma chamada
 * apareceu (visitante desistiu, chamada expirou), abre a tela do interfone pra
 * o toque não terminar em nada. Cancelado assim que uma chamada aparece.
 */
export function abrirSeChamadaNaoAparecer(path: string, ms = 6000): void {
  if (callAtiva) return;
  if (timerAbertura) clearTimeout(timerAbertura);
  timerAbertura = setTimeout(() => {
    timerAbertura = null;
    if (!callAtiva) abrirNoApp(path);
  }, ms);
}
