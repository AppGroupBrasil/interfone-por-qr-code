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
import { getToken, apiFetch } from "@/lib/api";
import { startCallRing, stopCallRing } from "@/lib/callRing";
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
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<NodeJS.Timeout | null>(null);

  // Don't render if not a morador, or if already on the interfone page
  const isMorador = user?.role === "morador";
  const isOnInterfonePage = location.pathname === "/morador/interfone";

  const playRingtone = useCallback(() => {
    startCallRing();
  }, []);

  const stopRingtone = useCallback(() => {
    stopCallRing();
    // Tira a notificação da bandeja (o som já é do CallRinger, não dela)
    globalThis.dispatchEvent(new Event("stop-push-ringtone"));
  }, []);

  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  const connectWs = useCallback(() => {
    if (!user || !isMorador || isOnInterfonePage) return;

    const token = isNative ? getToken() : null;
    const wsUrl = token ? `${WS_URL}?token=${token}` : WS_URL;
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[Global Interfone] Connected as morador listener");
        (globalThis as any).__interfoneWsOpen = true;
        ws.send(JSON.stringify({
          type: "register-morador",
          moradorId: user.id,
          condominioId: user.condominioId,
          page: "overlay", // não sei falar WebRTC: chamada reatada vai por handoff
        }));
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
              ws.close();
              wsRef.current = null;
              setIncomingCall(null);
              navigate("/morador/interfone", { state: { pendingCall: resumed } });
              break;
            }

            case "call-ended":
            case "call-cancelled":
              setIncomingCall(null);
              stopRingtone();
              break;
          }
        } catch {}
      };

      ws.onclose = () => {
        (globalThis as any).__interfoneWsOpen = false;
        if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
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
  }, [user, isMorador, isOnInterfonePage, playRingtone, stopRingtone]);

  useEffect(() => {
    if (!isMorador || isOnInterfonePage) {
      // Close WS if user navigated to interfone page (it has its own WS)
      if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    connectWs();

    // Reconnect immediately when tab becomes visible (browser may have killed WS in background)
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)) {
        console.log("[Global Interfone] Tab visible, reconnecting...");
        if (reconnectRef.current) clearTimeout(reconnectRef.current);
        connectWs();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const appStateListener = isNative
      ? CapacitorApp.addListener("appStateChange", ({ isActive }: { isActive: boolean }) => {
          if (isActive && (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)) {
            console.log("[Global Interfone] App resumed, reconnecting...");
            if (reconnectRef.current) clearTimeout(reconnectRef.current);
            connectWs();
          }
        })
      : null;

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      appStateListener?.then((listener: { remove: () => Promise<void> }) => listener.remove()).catch(() => {});
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      stopRingtone();
    };
  }, [isMorador, isOnInterfonePage, connectWs, stopRingtone]);

  const handleAnswer = (e?: React.MouseEvent) => {
    stopRingtone();
    const callData = incomingCall;
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
      wsRef.current.close();
      wsRef.current = null;
    }
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
    navigate("/morador/interfone", { state: { pendingCall: callData } });
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

  // Don't render anything if not morador, on interfone page, or no call
  if (!isMorador || isOnInterfonePage || !incomingCall) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0a1628] rounded-2xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl border border-[#003580]/30 animate-pulse-slow">
        {/* Caller icon */}
        <div className="w-20 h-20 rounded-full bg-[#003580] flex items-center justify-center mx-auto mb-4">
          <PhoneIncoming className="w-10 h-10 text-white animate-bounce" />
        </div>

        {/* Caller info */}
        <h2 className="text-white text-xl font-bold mb-1">
          {incomingCall.isInternal ? "Chamada da Portaria" : "Chamada do Interfone"}
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
