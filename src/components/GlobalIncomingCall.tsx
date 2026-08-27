/**
 * ═══════════════════════════════════════════════════════════
 * Global Incoming Call Listener for Moradores
 * Connects to the interfone WebSocket on ANY page and shows
 * a call notification overlay when a call arrives.
 * Navigates to /morador/interfone when the user answers.
 * ═══════════════════════════════════════════════════════════
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { App as CapacitorApp } from "@capacitor/app";
import { useAuth } from "@/hooks/useAuth";
import { buildWsUrl, isNative } from "@/lib/config";
import { getToken, apiFetch, refreshSession, tokenPertoDeExpirar } from "@/lib/api";
import { startCallRing, stopCallRing } from "@/lib/callRing";
import { getDeviceId, reconnectOnUse, WS_REPLACED, WS_BUSY_OTHER_DEVICE } from "@/lib/wsSession";
import { registrarNavegador, marcarChamadaAtiva, EVENTO_REVALIDAR_CHAMADA } from "@/lib/appNav";
import { Phone, PhoneOff, PhoneIncoming } from "lucide-react";

const WS_URL = buildWsUrl("/ws/interfone");

interface IncomingCallData {
  callId: string;
  callerName: string;
  callerRole?: string;
  isInternal: boolean;
  visitanteEmpresa?: string | null;
  visitanteFoto?: string | null;
  nivelSeguranca?: number;
  bloco?: string;
  apartamento?: string;
  visitorClientId?: string;
}

export default function GlobalIncomingCall() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  // Espelho para os handlers do WS, que rodam fora do ciclo de render.
  const incomingCallRef = useRef<IncomingCallData | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<NodeJS.Timeout | null>(null);
  const renovandoRef = useRef(false);

  // A ref so serve se acompanhar o estado; sem isto ela fica null e a guarda
  // por callId nunca bloqueia nada.
  useEffect(() => {
    incomingCallRef.current = incomingCall;
    marcarChamadaAtiva(incomingCall?.callId ?? null);
  }, [incomingCall]);

  // Os listeners de push vivem fora do React; sem isso navegariam com
  // location.href, recarregando o WebView por cima de uma chamada.
  useEffect(() => registrarNavegador((path) => navigate(path)), [navigate]);

  // Escuta chamadas fora da tela do interfone: morador e também a portaria.
  // Sem isto o porteiro só recebia chamada com a tela do interfone aberta —
  // com o app em outra página (ou aberto pelo push) a chamada não tocava.
  const isMorador = user?.role === "morador";
  const isPortaria = user?.role === "funcionario" || user?.role === "sindico";
  const escutando = isMorador || isPortaria;
  const rotaInterfone = isPortaria ? "/portaria/interfone" : "/morador/interfone";
  const isOnInterfonePage = location.pathname === rotaInterfone;

  const playRingtone = useCallback(() => {
    startCallRing();
  }, []);

  const stopRingtone = useCallback(() => {
    stopCallRing();
    // Tira a notificação da bandeja (o som já é do CallRinger, não dela)
    globalThis.dispatchEvent(new Event("stop-push-ringtone"));
  }, []);

  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  // Consultado na hora em que o timer de reconexão dispara: sem isto, um timer
  // agendado antes de navegar pra tela do interfone reconectava o aviso global
  // lá dentro e derrubava o socket da chamada (tela azul + reconexão infinita).
  const shouldConnectRef = useRef(false);
  shouldConnectRef.current = !!user && escutando && !isOnInterfonePage;

  const enviarRegistro = useCallback((ws: WebSocket) => {
    if (!user) return;
    ws.send(JSON.stringify(isPortaria
      ? {
          type: "register-funcionario",
          funcionarioId: user.id,
          condominioId: user.condominioId,
        }
      : {
          type: "register-morador",
          moradorId: user.id,
          condominioId: user.condominioId,
          deviceId: getDeviceId(),
          page: "overlay", // não sei falar WebRTC: chamada reatada vai por handoff
        }));
  }, [user, isPortaria]);

  const connectWs = useCallback(() => {
    if (!user || !escutando || isOnInterfonePage) return;
    if (!shouldConnectRef.current) return;

    const token = isNative ? getToken() : null;

    // Token vencido = handshake recusado = campainha muda. Renova antes de abrir.
    if (isNative && tokenPertoDeExpirar(token)) {
      if (!renovandoRef.current) {
        renovandoRef.current = true;
        void refreshSession().then((ok) => {
          renovandoRef.current = false;
          if (!shouldConnectRef.current) return;
          if (reconnectRef.current) clearTimeout(reconnectRef.current);
          reconnectRef.current = setTimeout(connectWs, ok ? 0 : 30_000);
        });
      }
      return;
    }

    const wsUrl = token ? `${WS_URL}?token=${token}` : WS_URL;
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[Global Interfone] Connected as morador listener");
        (globalThis as any).__interfoneWsOpen = true;
        enviarRegistro(ws);
        // Start application-level heartbeat to keep connection alive through proxies
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        heartbeatRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 20_000); // every 20 seconds
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          switch (msg.type) {
            case "registered-funcionario":
            case "registered":
              console.log("[Global Interfone] Registered, listening for calls...");
              break;

            case "pong":
              // Heartbeat response — connection is alive
              break;

            case "incoming-call":
              try { ws.send(JSON.stringify({ type: "client-debug", tag: "overlay-ring", callId: msg.callId, ts: Date.now() })); } catch {}
              setIncomingCall({
                callId: msg.callId,
                callerName: msg.visitanteNome || "Visitante",
                isInternal: false,
                visitanteEmpresa: msg.visitanteEmpresa ?? null,
                visitanteFoto: msg.visitanteFoto ?? null,
                nivelSeguranca: msg.nivelSeguranca ?? 0,
                bloco: msg.bloco || "",
                apartamento: msg.apartamento || "",
                visitorClientId: msg.visitorClientId || "",
              });
              playRingtone();
              break;

            case "internal-incoming-call":
              setIncomingCall({
                callId: msg.callId,
                callerName: msg.callerName || "Portaria",
                callerRole: msg.callerRole,
                isInternal: true,
                // Portaria: a tela do interfone reata a chamada com estes dados.
                bloco: msg.bloco || "",
                apartamento: msg.apartamento || "",
                visitorClientId: msg.callerClientId || "",
              });
              playRingtone();
              break;

            // O app recarregou depois de atender e voltou numa página qualquer:
            // o servidor reata a chamada — levar pra tela do interfone, que é
            // quem sabe falar WebRTC (mesmo caminho do handoff).
            case "call-resumed": {
              stopRingtone();
              const resumed: IncomingCallData = {
                callId: msg.callId,
                callerName: msg.visitanteNome || "Visitante",
                isInternal: !!msg.isInternal,
                visitorClientId: msg.visitorClientId || "",
              };
              try {
                ws.send(JSON.stringify({ type: "call-handoff", callId: msg.callId }));
              } catch {}
              ws.onclose = null; // fechamento intencional: não reagendar reconexão
              (globalThis as any).__interfoneWsOpen = false;
              if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
              ws.close();
              wsRef.current = null;
              setIncomingCall(null);
              navigate(rotaInterfone, { state: { pendingCall: resumed } });
              break;
            }

            case "call-ended":
            case "call-cancelled":
              // Duas chamadas ao mesmo tempo na portaria: o fim de uma nao pode
              // apagar o aviso da outra.
              if (msg.callId && incomingCallRef.current && incomingCallRef.current.callId !== msg.callId) break;
              setIncomingCall(null);
              stopRingtone();
              break;
          }
        } catch {}
      };

      ws.onclose = (ev) => {
        (globalThis as any).__interfoneWsOpen = false;
        if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
        if (!shouldConnectRef.current) return;
        // Outro contexto do mesmo morador assumiu: insistir de 2 em 2s punha os
        // dois em loop de troca de socket. Volta só quando esta tela for usada.
        if (ev.code === WS_REPLACED || ev.code === WS_BUSY_OTHER_DEVICE) {
          console.log("[Global Interfone] Substituído por outra tela/aparelho — aguardando uso");
          reconnectOnUse(() => { if (shouldConnectRef.current) connectWs(); });
          return;
        }
        console.log("[Global Interfone] Disconnected, reconnecting in 2s...");
        reconnectRef.current = setTimeout(connectWs, 2000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (err) {
      console.error("[Global Interfone] WS error:", err);
      reconnectRef.current = setTimeout(connectWs, 2000);
    }
  }, [user, escutando, isPortaria, isOnInterfonePage, playRingtone, stopRingtone, enviarRegistro]);

  useEffect(() => {
    if (!escutando || isOnInterfonePage) {
      // Close WS if user navigated to interfone page (it has its own WS)
      if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
      if (wsRef.current) {
        wsRef.current.onclose = null; // fechamento nosso: não reagendar reconexão
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    connectWs();

    // Volta do 2º plano (inclusive abrindo pela notificação de chamada): o
    // socket pode estar morto OU ZUMBI (TCP aberto, JS suspenso), e no zumbi
    // nada chega e o aviso nunca aparece. Re-registrar no mesmo socket faz o
    // servidor reentregar a chamada pendente (pendingPushCalls); se ele morreu
    // de verdade, reconecta.
    const revalidar = () => {
      const atual = wsRef.current;
      if (atual && atual.readyState === WebSocket.OPEN) {
        try { enviarRegistro(atual); } catch {}
      } else {
        console.log("[Global Interfone] Socket caído, reconectando...");
        if (reconnectRef.current) clearTimeout(reconnectRef.current);
        connectWs();
      }
    };
    globalThis.addEventListener(EVENTO_REVALIDAR_CHAMADA, revalidar);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") revalidar();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const appStateListener = isNative
      ? CapacitorApp.addListener("appStateChange", ({ isActive }: { isActive: boolean }) => {
          if (isActive) revalidar();
        })
      : null;

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      globalThis.removeEventListener(EVENTO_REVALIDAR_CHAMADA, revalidar);
      appStateListener?.then((listener: { remove: () => Promise<void> }) => listener.remove()).catch(() => {});
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
      if (wsRef.current) {
        wsRef.current.onclose = null; // fechamento nosso: não reagendar reconexão
        wsRef.current.close();
        wsRef.current = null;
      }
      stopRingtone();
    };
  }, [escutando, isOnInterfonePage, connectWs, stopRingtone, enviarRegistro]);

  const handleAnswer = (e?: React.MouseEvent) => {
    stopRingtone();
    const callData = incomingCall;

    // Portaria: NÃO responde daqui. O handoff (call-answer + troca de socket)
    // depende do resend-offer, que só existe para o morador; aqui a chamada
    // segue tocando no servidor e quem atende de fato é a tela do interfone,
    // que reata pelo state e manda o call-answer já no socket definitivo.
    if (isPortaria) {
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
      (globalThis as any).__interfoneWsOpen = false;
      setIncomingCall(null);
      navigate(rotaInterfone, { state: { pendingCall: callData, autoAnswer: true } });
      return;
    }
    // Send call-answer so the visitor gets notified immediately
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && callData) {
      try {
        const ne = e?.nativeEvent as PointerEvent | undefined;
        wsRef.current.send(JSON.stringify({
          type: "client-debug",
          tag: "overlay-answer",
          callId: callData.callId,
          isTrusted: ne ? ne.isTrusted : null,
          pointerType: ne && "pointerType" in ne ? ne.pointerType : null,
          x: ne?.clientX ?? null,
          y: ne?.clientY ?? null,
          ts: Date.now(),
        }));
      } catch {}
      wsRef.current.send(JSON.stringify({
        type: "call-answer",
        callId: callData.callId,
        handoff: true,
      }));
      // Tell server to preserve the call during WS handoff
      wsRef.current.send(JSON.stringify({
        type: "call-handoff",
        callId: callData.callId,
      }));
    }
    // Close global WS — server won’t end the call because call-handoff cleared callId
    if (wsRef.current) {
      wsRef.current.onclose = null; // intencional: quem fala WebRTC agora é a tela do interfone
      wsRef.current.close();
      wsRef.current = null;
    }
    if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
    (globalThis as any).__interfoneWsOpen = false;
    setIncomingCall(null);
    // Registra atendida no histórico (MoradorInterfone só faz isso no fluxo sem handoff)
    if (callData && !callData.isInternal) {
      apiFetch(`/api/interfone/calls/${callData.callId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "atendida" }),
      }).catch(() => {});
    }
    // Navigate with call data so MoradorInterfone can pick up the active call
    navigate(rotaInterfone, { state: { pendingCall: callData } });
  };

  const handleReject = (e?: React.MouseEvent) => {
    stopRingtone();
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        const ne = e?.nativeEvent as PointerEvent | undefined;
        wsRef.current.send(JSON.stringify({
          type: "client-debug",
          tag: "overlay-reject",
          callId: incomingCall?.callId,
          isTrusted: ne ? ne.isTrusted : null,
          ts: Date.now(),
        }));
      } catch {}
      wsRef.current.send(JSON.stringify({
        type: "call-reject",
        callId: incomingCall?.callId,
      }));
    }
    setIncomingCall(null);
  };

  // Nada a mostrar: papel sem interfone, já na tela do interfone, ou sem chamada
  if (!escutando || isOnInterfonePage || !incomingCall) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0a1628] rounded-2xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl border border-[#003580]/30 animate-pulse-slow">
        {/* Caller icon */}
        <div className="w-20 h-20 rounded-full bg-[#003580] flex items-center justify-center mx-auto mb-4">
          <PhoneIncoming className="w-10 h-10 text-white animate-bounce" />
        </div>

        {/* Caller info */}
        <h2 className="text-white text-xl font-bold mb-1">
          {incomingCall.isInternal ? (isPortaria ? "Chamada do Morador" : "Chamada da Portaria") : "Chamada do Interfone"}
        </h2>
        <p className="text-gray-300 text-lg mb-6">{incomingCall.callerName}</p>

        {/* Action buttons */}
        <div className="flex justify-center gap-8">
          {/* Reject */}
          <button
            onClick={handleReject}
            className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center hover:bg-red-700 transition-colors shadow-lg"
          >
            <PhoneOff className="w-7 h-7 text-white" />
          </button>

          {/* Answer */}
          <button
            onClick={handleAnswer}
            className="w-16 h-16 rounded-full bg-green-600 flex items-center justify-center hover:bg-green-700 transition-colors shadow-lg animate-pulse"
          >
            <Phone className="w-7 h-7 text-white" />
          </button>
        </div>

        <p className="text-gray-400 text-sm mt-4">Toque para atender</p>
      </div>
    </div>
  );
}
