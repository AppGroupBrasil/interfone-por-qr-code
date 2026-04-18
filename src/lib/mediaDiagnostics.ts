export function explainMediaError(err: unknown): string {
  const anyErr = err as { name?: string; message?: string } | undefined;
  const isWeb = typeof window !== "undefined";
  const insecureContext = isWeb && !window.isSecureContext;
  const hostname = isWeb ? window.location.hostname : "";
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";

  if (isWeb && insecureContext && !isLocalhost) {
    return "No navegador do celular, microfone e camera exigem HTTPS. Para testar chamada com audio no celular, abra o sistema em https://www.appinterfone.com.br ou use o app nativo.";
  }

  switch (anyErr?.name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "O navegador bloqueou o microfone ou a camera. Libere as permissoes do site e tente novamente.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "Nao foi encontrado microfone ou camera disponivel neste aparelho.";
    case "NotReadableError":
    case "TrackStartError":
      return "O microfone ou a camera ja estao em uso por outro app. Feche o outro app e tente novamente.";
    case "OverconstrainedError":
    case "ConstraintNotSatisfiedError":
      return "Este aparelho nao suportou a configuracao de audio/video solicitada.";
    case "SecurityError":
      return "O navegador bloqueou o acesso ao microfone/camera por seguranca. Use HTTPS ou o app nativo.";
    default:
      return anyErr?.message || "Nao foi possivel iniciar o audio/video da chamada neste aparelho.";
  }
}

export function ensureMediaDevicesAvailable() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Este navegador nao suporta captura de microfone/camera para chamadas.");
  }
}

export function vibrateIncomingCall() {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([700, 250, 700, 250, 700]);
    }
  } catch {}
}

export function stopIncomingCallVibration() {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(0);
    }
  } catch {}
}