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
import { useAuth } from "@/hooks/useAuth";
import { buildWsUrl, isNative } from "@/lib/config";
import { getToken } from "@/lib/api";
import { stopIncomingCallVibration, vibrateIncomingCall } from "@/lib/mediaDiagnostics";
import { Phone, PhoneOff, PhoneIncoming } from "lucide-react";

const WS_URL = buildWsUrl("/ws/interfone");

interface IncomingCallData {
  callId: string;
  callerName: string;
  callerRole?: string;
  isInternal: boolean;
}

export default function GlobalIncomingCall() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const reconnectRef = useRef<NodeJS.Timeout | null>(null);

  // Don't render if not a morador, or if already on the interfone page
  const isMorador = user?.role === "morador";
  const isOnInterfonePage = location.pathname === "/morador/interfone";

  const playRingtone = useCallback(() => {
    try {
      if (!ringtoneRef.current) {
        const audio = new Audio("/sounds/ringtone-call.wav");
        audio.loop = true;
        audio.volume = 0.8;
        audio.play().catch(() => {});
        ringtoneRef.current = audio;
        vibrateIncomingCall();
      }
    } catch {}
  }, []);

  const stopRingtone = useCallback(() => {
    try {
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
        ringtoneRef.current = null;
      }
    } catch {}
    stopIncomingCallVibration();
    // Also stop push ringtone (from Web Push notification)
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
        ws.send(JSON.stringify({
          type: "register-morador",
          moradorId: user.id,
          condominioId: user.condominioId,
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
              setIncomingCall({
                callId: msg.callId,
                callerName: msg.visitanteNome || "Visitante",
                isInternal: false,
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

            case "call-ended":
            case "call-cancelled":
              setIncomingCall(null);
              stopRingtone();
              break;
          }
        } catch {}
      };

      ws.onclose = () => {
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

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      stopRingtone();
    };
  }, [isMorador, isOnInterfonePage, connectWs, stopRingtone]);

  const handleAnswer = () => {
    stopRingtone();
    const callData = incomingCall;
    // Send call-answer so the visitor gets notified immediately
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && callData) {
      wsRef.current.send(JSON.stringify({
        type: "call-answer",
        callId: callData.callId,
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
    // Navigate with call data so MoradorInterfone can pick up the active call
    navigate("/morador/interfone", { state: { pendingCall: callData } });
  };

  const handleReject = () => {
    stopRingtone();
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
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
