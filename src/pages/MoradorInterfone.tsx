import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { App as CapacitorApp } from "@capacitor/app";
import { useAuth } from "@/hooks/useAuth";
import TutorialButton, { TSection, TStep, TBullet } from "@/components/TutorialButton";
import { buildWsUrl, isNative } from "@/lib/config";
import {
  ensureMediaDevicesAvailable,
  explainMediaError,
  stopIncomingCallVibration,
  vibrateIncomingCall,
} from "@/lib/mediaDiagnostics";
import { playRingtone as libPlayRingtone, stopRingtone as libStopRingtone } from "@/lib/ringtones";
import {
  Phone,
  PhoneOff,
  PhoneIncoming,
  PhoneCall,
  Mic,
  MicOff,
  Volume2,
  DoorOpen,
  User,
  Briefcase,
  Camera,
  Shield,
  ShieldAlert,
  Headphones,
  X,
  Check,
  Clock,
  History,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { apiFetch, getToken } from "@/lib/api";
import { useTheme } from "@/hooks/useTheme";

const API = "/api";
const WS_URL = buildWsUrl("/ws/interfone");

interface IncomingCall {
  callId: string;
  visitanteNome: string;
  visitanteEmpresa: string | null;
  visitanteFoto: string | null;
  nivelSeguranca: number;
  bloco: string;
  apartamento: string;
  visitorClientId: string;
}

interface AuthRequest {
  callId: string;
  visitanteNome: string;
  visitanteEmpresa: string;
  visitanteFoto: string;
  visitorClientId: string;
}

interface CallHistoryItem {
  id: number;
  bloco: string;
  apartamento: string;
  visitante_nome: string | null;
  visitante_empresa: string | null;
  status: string;
  duracao_segundos: number;
  created_at: string;
}

type ViewState = "listening" | "incoming" | "auth-request" | "connected" | "ended" | "calling";

/* ═══════════════════════════════════════════════
   MORADOR — Interfone Digital — Receber Chamadas
   Vídeo unidirecional: morador VÊ visitante,
   visitante SÓ OUVE o morador (sem vídeo)
   ═══════════════════════════════════════════════ */
export default function MoradorInterfone() {
  const { isDark, p } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [viewState, setViewState] = useState<ViewState>("listening");
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [authRequest, setAuthRequest] = useState<AuthRequest | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [history, setHistory] = useState<CallHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [gateOpened, setGateOpened] = useState(false);

  // Internal call states
  const [isOutgoingCall, setIsOutgoingCall] = useState(false);
  const [isInternalCall, setIsInternalCall] = useState(false);
  const peerTypeRef = useRef<string>("visitor");

  // Refs that mirror state — used inside WebSocket onmessage to avoid stale closures
  const isOutgoingCallRef = useRef(false);
  const incomingCallRef = useRef<IncomingCall | null>(null);

  // Keep refs in sync with state
  useEffect(() => { isOutgoingCallRef.current = isOutgoingCall; }, [isOutgoingCall]);
  useEffect(() => { incomingCallRef.current = incomingCall; }, [incomingCall]);

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const viewStateRef = useRef<ViewState>("listening");
  const connectRef = useRef<(() => void) | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  // Keep viewStateRef in sync
  useEffect(() => { viewStateRef.current = viewState; }, [viewState]);

  // ─── Wake Lock: keep screen on during active calls ───
  const requestWakeLock = async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
        console.log("[Morador] 🔒 Wake Lock acquired");
        wakeLockRef.current!.addEventListener("release", () => {
          console.log("[Morador] 🔓 Wake Lock released");
        });
      }
    } catch (e) {
      console.warn("[Morador] Wake Lock failed:", e);
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
  };

  // Acquire/release wake lock based on view state
  useEffect(() => {
    if (viewState === "incoming" || viewState === "connected" || viewState === "calling") {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }
    return () => { releaseWakeLock(); };
  }, [viewState]);

  // ─── Visibility change: re-acquire wake lock & reconnect WS when screen comes back ───
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const vs = viewStateRef.current;
        if (vs === "incoming" || vs === "connected" || vs === "calling") {
          requestWakeLock();
        }
        if (wsRef.current?.readyState !== WebSocket.OPEN && connectRef.current) {
          console.log("[Morador] Visibility restored, reconnecting WS...");
          connectRef.current();
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const appStateListener = isNative
      ? CapacitorApp.addListener("appStateChange", ({ isActive }: { isActive: boolean }) => {
          if (!isActive) return;
          const vs = viewStateRef.current;
          if (vs === "incoming" || vs === "connected" || vs === "calling") {
            requestWakeLock();
          }
          if (wsRef.current?.readyState !== WebSocket.OPEN && connectRef.current) {
            console.log("[Morador] App resumed, reconnecting WS...");
            connectRef.current();
          }
        })
      : null;

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      appStateListener?.then((listener: { remove: () => Promise<void> }) => listener.remove()).catch(() => {});
    };
  }, []);

  // Connect WebSocket and listen for calls
  useEffect(() => {
    if (!user) return;

    const connect = () => {
      // Close any previous orphaned WS
      if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
        wsRef.current.onclose = null; // prevent reconnect loop
        wsRef.current.close();
      }

      const token = isNative ? getToken() : null;
      const wsUrl = token ? `${WS_URL}?token=${token}` : WS_URL;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: "register-morador",
          moradorId: user.id,
          condominioId: user.condominioId,
        }));
        // Start heartbeat to keep connection alive through proxies
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        heartbeatRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 20_000);
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case "registered":
            console.log("📞 Interfone: ouvindo chamadas...");
            break;
          case "pong":
            break;

          // Server confirms call handoff from GlobalIncomingCall — resume the active call
          case "call-resumed": {
            console.log("[Morador] call-resumed from handoff, callId:", msg.callId);
            // The call data was set from location.state in the useEffect below
            // Now we're registered and the visitor's WebRTC offer will arrive on this WS
            break;
          }

          case "incoming-call":
            setIncomingCall(msg);
            setIsInternalCall(false);
            peerTypeRef.current = "visitor";
            setViewState("incoming");
            playRingtone();
            break;

          case "auth-request":
            setAuthRequest(msg);
            setViewState("auth-request");
            playRingtone();
            break;

          case "internal-incoming-call":
            setIncomingCall({
              callId: msg.callId,
              visitanteNome: msg.callerName || "Portaria",
              visitanteEmpresa: null,
              visitanteFoto: null,
              nivelSeguranca: 0,
              bloco: "",
              apartamento: "",
              visitorClientId: msg.callerClientId,
            });
            setIsInternalCall(true);
            peerTypeRef.current = "funcionario";
            setViewState("incoming");
            playRingtone();
            break;

          case "call-answered":
            // Our outgoing call to portaria was answered — use REFS to avoid stale closure
            console.log("[Morador] call-answered received, isOutgoing:", isOutgoingCallRef.current, "callId:", incomingCallRef.current?.callId);
            if (isOutgoingCallRef.current && incomingCallRef.current) {
              setViewState("connected");
              setCallDuration(0);
              setGateOpened(false);
              timerRef.current = setInterval(() => setCallDuration((prev) => prev + 1), 1000);
              startOutgoingWebRTC(incomingCallRef.current.callId, "funcionario");
            }
            break;

          case "call-rejected":
            if (isOutgoingCallRef.current) {
              setViewState("ended");
              setIsOutgoingCall(false);
              stopRingtone();
              cleanup();
            }
            break;

          case "call-unavailable":
            setViewState("listening");
            setIsOutgoingCall(false);
            break;

          case "webrtc-offer":
            handleWebRTCOffer(msg.offer, msg.callId);
            break;

          case "webrtc-answer":
            if (pcRef.current) {
              pcRef.current.setRemoteDescription(new RTCSessionDescription(msg.answer));
            }
            break;

          case "ice-candidate":
            if (pcRef.current && msg.candidate) {
              pcRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate));
            }
            break;

          case "call-ended":
            setViewState("ended");
            stopRingtone();
            cleanup();
            break;
        }
      };

      ws.onclose = () => {
        // Only reconnect if this is still the active WS
        if (wsRef.current !== ws) return;
        if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
        // Auto-reconnect after 2s (even if hidden — keep alive during calls)
        setTimeout(() => {
          if (wsRef.current !== ws) return; // another connect already happened
          const vs = viewStateRef.current;
          if (document.visibilityState !== "hidden" || vs === "connected" || vs === "calling" || vs === "incoming") {
            connect();
          }
        }, 2000);
      };

      ws.onerror = () => {};
    };

    connectRef.current = connect;
    connect();

    // Fetch call history
    fetchHistory();

    return () => {
      if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
      const ws = wsRef.current;
      wsRef.current = null; // prevents onclose from reconnecting
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.close();
      }
      cleanup();
    };
  }, [user]);

  // ─── Resume call handed off from GlobalIncomingCall ───
  useEffect(() => {
    const pending = (location.state as any)?.pendingCall;
    if (!pending?.callId) return;
    console.log("[Morador] Resuming handed-off call:", pending.callId, pending.callerName);

    // Build IncomingCall from the data passed by GlobalIncomingCall
    const resumedCall: IncomingCall = {
      callId: pending.callId,
      visitanteNome: pending.callerName || "Visitante",
      visitanteEmpresa: null,
      visitanteFoto: null,
      nivelSeguranca: 0,
      bloco: "",
      apartamento: "",
      visitorClientId: "",
    };
    setIncomingCall(resumedCall);
    setIsInternalCall(!!pending.isInternal);
    peerTypeRef.current = pending.isInternal ? "funcionario" : "visitor";
    setViewState("connected");
    setCallDuration(0);
    setGateOpened(false);
    timerRef.current = setInterval(() => setCallDuration((prev) => prev + 1), 1000);

    // Clear navigation state so refreshing the page doesn't replay
    window.history.replaceState({}, "");
  }, []); // run once on mount

  const fetchHistory = async () => {
    try {
      const res = await apiFetch(`${API}/interfone/calls`);
      if (res.ok) setHistory(await res.json());
    } catch {}
  };

  const playRingtone = () => {
    libPlayRingtone();
    vibrateIncomingCall();
  };
  const stopRingtone = () => {
    libStopRingtone();
    stopIncomingCallVibration();
    globalThis.dispatchEvent(new Event("stop-push-ringtone"));
  };

  // Helper: assign remote audio stream to audio element
  const playRemoteAudio = (track: MediaStreamTrack, streams: readonly MediaStream[]) => {
    const audioEl = remoteAudioRef.current;
    if (!audioEl) { console.warn("[Morador] remoteAudioRef is null!"); return; }
    const stream = streams[0] || new MediaStream([track]);
    audioEl.srcObject = stream;
    audioEl.volume = 1.0;
    console.log("[Morador] Audio element set:", { paused: audioEl.paused, muted: audioEl.muted, volume: audioEl.volume, trackEnabled: track.enabled, trackMuted: track.muted, trackState: track.readyState });
    audioEl.play().then(() => console.log("[Morador] ✅ Audio playing")).catch((e) => console.error("[Morador] ❌ Audio play FAILED:", e));
  };

  // Handle WebRTC offer from visitor / portaria
  const handleWebRTCOffer = async (offer: RTCSessionDescriptionInit, callId: string) => {
    // Guard: don't process webrtc-offer if we initiated the call
    if (isOutgoingCallRef.current) {
      console.warn("[Morador] Ignoring webrtc-offer during outgoing call");
      return;
    }
    try {
      // Close any existing PC first
      if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
      if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); }

      // Morador only sends audio (no video) for privacy
      ensureMediaDevicesAvailable();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      console.log("[Morador] handleWebRTCOffer: got audio, tracks:", stream.getAudioTracks().length, "enabled:", stream.getAudioTracks()[0]?.enabled);

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      });
      pcRef.current = pc;

      // Add audio track only (no video = unidirectional video)
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // Receive video+audio from visitor/portaria
      pc.ontrack = (event) => {
        console.log("[Morador] ontrack received:", event.track.kind, event.streams.length, "enabled:", event.track.enabled, "muted:", event.track.muted);
        if (event.track.kind === "audio") {
          playRemoteAudio(event.track, event.streams);
        }
        // Also assign to video element if available (for visitor video)
        if (event.streams[0] && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
          remoteVideoRef.current.play().catch(() => {});
        }
      };

      pc.onconnectionstatechange = () => {
        console.log("[Morador] WebRTC connection state:", pc.connectionState);
      };

      pc.oniceconnectionstatechange = () => {
        console.log("[Morador] ICE state:", pc.iceConnectionState);
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: "ice-candidate",
            callId,
            candidate: event.candidate,
            targetType: peerTypeRef.current,
          }));
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      wsRef.current?.send(JSON.stringify({
        type: "webrtc-answer",
        callId,
        answer,
        targetType: peerTypeRef.current,
      }));
    } catch (err) {
      console.error("WebRTC morador error:", err);
      const message = explainMediaError(err);
      setViewState("ended");
      window.alert(message);
    }
  };

  // Answer call
  const handleAnswer = () => {
    if (!incomingCall) return;
    stopRingtone();
    setViewState("connected");
    setCallDuration(0);
    setGateOpened(false);

    timerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    wsRef.current?.send(JSON.stringify({
      type: "call-answer",
      callId: incomingCall.callId,
    }));

    // Update call log (use full callId — server matches by call_id column)
    apiFetch(`${API}/interfone/calls/${incomingCall.callId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "atendida" }),
    }).catch(() => {});
  };

  // Reject call
  const handleReject = () => {
    if (!incomingCall) return;
    stopRingtone();
    wsRef.current?.send(JSON.stringify({
      type: "call-reject",
      callId: incomingCall.callId,
    }));
    setViewState("listening");
    setIncomingCall(null);
  };

  // Accept auth request (Level 3)
  const handleAcceptAuth = () => {
    if (!authRequest) return;
    stopRingtone();
    wsRef.current?.send(JSON.stringify({
      type: "auth-accepted",
      callId: authRequest.callId,
      visitorClientId: authRequest.visitorClientId,
    }));
    setViewState("listening");
    setAuthRequest(null);
    // The visitor will now initiate a regular call
  };

  // Reject auth request
  const handleRejectAuth = () => {
    if (!authRequest) return;
    stopRingtone();
    wsRef.current?.send(JSON.stringify({
      type: "auth-rejected",
      callId: authRequest.callId,
      visitorClientId: authRequest.visitorClientId,
    }));
    setViewState("listening");
    setAuthRequest(null);
  };

  // End call
  const handleEndCall = () => {
    if (incomingCall) {
      wsRef.current?.send(JSON.stringify({ type: "call-end", callId: incomingCall.callId }));
    }
    setViewState("ended");
    cleanup();
  };

  // Open gate
  const handleOpenGate = () => {
    if (incomingCall) {
      wsRef.current?.send(JSON.stringify({ type: "open-gate", callId: incomingCall.callId }));
      setGateOpened(true);
    }
  };

  // Toggle mute
  const handleToggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  // Cleanup
  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current = null;
    // Reset audio element but keep it in DOM (it's a JSX element)
    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
    }
    stopRingtone();
  };

  // ─── Internal call: Morador → Portaria ───
  const handleCallPortaria = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !user) return;
    const callId = `ICALL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setIsOutgoingCall(true);
    setIsInternalCall(true);
    peerTypeRef.current = "funcionario";
    setIncomingCall({
      callId,
      visitanteNome: "Portaria",
      visitanteEmpresa: null,
      visitanteFoto: null,
      nivelSeguranca: 0,
      bloco: "",
      apartamento: "",
      visitorClientId: "",
    });
    setViewState("calling");

    wsRef.current.send(JSON.stringify({
      type: "internal-call-portaria",
      callId,
      callerName: user.name || "Morador",
    }));
  };

  const handleCancelOutgoing = () => {
    if (incomingCall && wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: "call-end", callId: incomingCall.callId }));
    }
    setViewState("listening");
    setIsOutgoingCall(false);
    setIsInternalCall(false);
    setIncomingCall(null);
    cleanup();
  };

  const startOutgoingWebRTC = async (callId: string, targetType: string) => {
    console.log("[Morador] startOutgoingWebRTC called, callId:", callId, "targetType:", targetType);
    try {
      // Close any existing PC first
      if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
      if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); }

      ensureMediaDevicesAvailable();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      console.log("[Morador] Got local audio stream, tracks:", stream.getAudioTracks().length);

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      });
      pcRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        console.log("[Morador] outgoing ontrack:", event.track.kind, event.streams.length, "enabled:", event.track.enabled, "muted:", event.track.muted);
        if (event.track.kind === "audio") {
          playRemoteAudio(event.track, event.streams);
        }
      };

      pc.onconnectionstatechange = () => {
        console.log("[Morador] outgoing WebRTC state:", pc.connectionState);
      };

      pc.oniceconnectionstatechange = () => {
        console.log("[Morador] outgoing ICE state:", pc.iceConnectionState);
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: "ice-candidate",
            callId,
            candidate: event.candidate,
            targetType,
          }));
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      wsRef.current?.send(JSON.stringify({
        type: "webrtc-offer",
        callId,
        offer,
        targetType,
      }));
    } catch (err) {
      console.error("[Morador] outgoing WebRTC error:", err);
      const message = explainMediaError(err);
      setViewState("ended");
      window.alert(message);
    }
  };

  // Format time
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  // ─── AUTH REQUEST VIEW ───
  if (viewState === "auth-request" && authRequest) {
    return (
      <div className="min-h-dvh flex flex-col" style={{ background: isDark ? "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)" : "#ffffff" }}>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-white">
          <ShieldAlert className="w-10 h-10 mb-4 text-amber-400" />
          <h2 className="text-xl font-bold mb-1">Solicitação de Chamada</h2>
          <p className="text-sm text-blue-200 mb-6">Um visitante solicita autorização para ligar</p>

          {/* Visitor info card */}
          <div className="w-full max-w-sm rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.1)", border: isDark ? "2px solid rgba(255,255,255,0.2)" : "2px solid #cbd5e1" }}>
            {authRequest.visitanteFoto && (
              <img
                src={authRequest.visitanteFoto}
                alt="Foto do visitante"
                className="w-20 h-20 rounded-full mx-auto mb-3 object-cover"
                style={{ border: isDark ? "3px solid rgba(255,255,255,0.3)" : "3px solid #cbd5e1" }}
              />
            )}
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2">
                <User className="w-4 h-4 text-blue-200" />
                <span className="font-bold">{authRequest.visitanteNome}</span>
              </div>
              {authRequest.visitanteEmpresa && (
                <div className="flex items-center justify-center gap-2">
                  <Briefcase className="w-4 h-4 text-blue-200" />
                  <span className="text-sm text-blue-200">{authRequest.visitanteEmpresa}</span>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-4 mt-8">
            <button
              onClick={handleRejectAuth}
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: "#ef4444" }}
            >
              <X className="w-7 h-7 text-white" />
            </button>
            <button
              onClick={handleAcceptAuth}
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: "#10b981" }}
            >
              <Check className="w-7 h-7 text-white" />
            </button>
          </div>
          <div className="flex gap-12 mt-2 text-xs text-blue-200">
            <span>Recusar</span>
            <span>Aceitar</span>
          </div>
        </div>
      </div>
    );
  }

  // ─── INCOMING CALL VIEW ───
  if (viewState === "incoming" && incomingCall) {
    return (
      <div className="min-h-dvh flex flex-col" style={{ background: isDark ? "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)" : "#ffffff" }}>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-white">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4 animate-pulse" style={{ background: "rgba(16,185,129,0.2)", border: "3px solid #10b981" }}>
            <PhoneIncoming className="w-10 h-10 text-green-400" />
          </div>
          <h2 className="text-xl font-bold mb-1">{isInternalCall ? "Chamada da Portaria" : "Chamada do Interfone"}</h2>
          {!isInternalCall ? (
            <p className="text-sm text-blue-200">
              Bloco {incomingCall.bloco} — Apto {incomingCall.apartamento}
            </p>
          ) : (
            <p className="text-sm text-blue-200">A portaria está ligando para você</p>
          )}
          {incomingCall.visitanteNome && incomingCall.visitanteNome !== "Visitante" && (
            <p className="text-sm text-blue-100 mt-2 flex items-center gap-2">
              <User className="w-4 h-4" /> {incomingCall.visitanteNome}
            </p>
          )}

          {/* Answer / Reject */}
          <div className="flex gap-8 mt-10">
            <div className="text-center">
              <button
                onClick={handleReject}
                className="w-16 h-16 rounded-full flex items-center justify-center mb-2"
                style={{ background: "#ef4444" }}
              >
                <PhoneOff className="w-7 h-7 text-white" />
              </button>
              <span className="text-xs text-blue-200">Recusar</span>
            </div>
            <div className="text-center">
              <button
                onClick={handleAnswer}
                className="w-16 h-16 rounded-full flex items-center justify-center mb-2 animate-bounce"
                style={{ background: "#10b981" }}
              >
                <Phone className="w-7 h-7 text-white" />
              </button>
              <span className="text-xs text-blue-200">Atender</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── CALLING PORTARIA VIEW ───
  if (viewState === "calling") {
    return (
      <div className="min-h-dvh flex flex-col" style={{ background: isDark ? "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)" : "#ffffff" }}>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-white">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4 animate-pulse" style={{ background: isDark ? "rgba(255,255,255,0.15)" : "#f0f4f8", border: isDark ? "3px solid rgba(255,255,255,0.3)" : "3px solid #cbd5e1" }}>
            <PhoneCall className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-xl font-bold mb-1">Chamando Portaria...</h2>
          <p className="text-sm text-blue-200 mb-8">Aguardando resposta do porteiro</p>
          <button
            onClick={handleCancelOutgoing}
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: "#ef4444", boxShadow: "0 4px 16px rgba(239,68,68,0.5)" }}
          >
            <PhoneOff className="w-7 h-7 text-white" />
          </button>
          <p className="text-xs text-blue-300 mt-2">Cancelar</p>
        </div>
      </div>
    );
  }

  // ─── CONNECTED (IN CALL) VIEW ───
  if (viewState === "connected") {
    // Internal call (audio-only with portaria)
    if (isInternalCall) {
      return (
        <div className="min-h-dvh flex flex-col" style={{ background: isDark ? "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)" : "#ffffff" }}>
          <video ref={remoteVideoRef} autoPlay playsInline style={{ display: "none" }} />
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-white">
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center mb-6"
              style={{ background: isDark ? "rgba(255,255,255,0.15)" : "#f0f4f8", border: isDark ? "3px solid rgba(255,255,255,0.3)" : "3px solid #cbd5e1" }}
            >
              <Headphones className="w-12 h-12 text-white animate-pulse" />
            </div>
            <h2 className="text-xl font-bold mb-1">{incomingCall?.visitanteNome || "Portaria"}</h2>
            <p className="text-sm text-blue-200 mb-2">Chamada interna</p>
            <p className="text-lg font-mono text-blue-100">{formatTime(callDuration)}</p>

            <div className="flex items-center justify-center gap-6 mt-10">
              <button
                onClick={handleToggleMute}
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ background: isMuted ? "#ef4444" : "rgba(255,255,255,0.15)" }}
              >
                {isMuted ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
              </button>
              <button
                onClick={handleEndCall}
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ background: "#ef4444" }}
              >
                <PhoneOff className="w-6 h-6 text-white" />
              </button>
            </div>
          </div>
        </div>
      );
    }

    // External call (video from visitor)
    return (
      <div className="min-h-dvh flex flex-col" style={{ background: "#0a0a0a" }}>
        {/* Video from visitor (full screen) */}
        <div className="flex-1 relative">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
            style={{ position: "absolute", inset: 0 }}
          />

          {/* Overlay info */}
          <div className="absolute top-0 left-0 right-0 p-4" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 100%)" }}>
            <div className="flex items-center justify-between text-white">
              <div>
                <p className="text-sm font-bold">
                  {incomingCall?.visitanteNome || "Visitante"}
                </p>
                <p className="text-xs text-white/60">
                  Bloco {incomingCall?.bloco} — Apto {incomingCall?.apartamento}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-green-400" />
                <span className="text-sm font-mono">{formatTime(callDuration)}</span>
              </div>
            </div>
          </div>

          {/* Gate opened toast */}
          {gateOpened && (
            <div className="absolute top-16 left-4 right-4 p-3 rounded-xl flex items-center gap-2" style={{ background: "rgba(16,185,129,0.9)" }}>
              <DoorOpen className="w-5 h-5 text-white" />
              <span className="text-sm font-bold text-white">Portão Aberto!</span>
            </div>
          )}
        </div>

        {/* Controls bar */}
        <div className="p-6 flex items-center justify-center gap-4" style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.5) 100%)" }}>
          <button
            onClick={handleToggleMute}
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: isMuted ? "#ef4444" : "rgba(255,255,255,0.15)" }}
          >
            {isMuted ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
          </button>

          <button
            onClick={handleOpenGate}
            disabled={gateOpened}
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: gateOpened ? "#10b981" : "#003580", opacity: gateOpened ? 0.7 : 1 }}
          >
            <DoorOpen className="w-6 h-6 text-white" />
          </button>

          <button
            onClick={handleEndCall}
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: "#ef4444" }}
          >
            <PhoneOff className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>
    );
  }

  // ─── ENDED VIEW ───
  if (viewState === "ended") {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center p-6" style={{ background: isDark ? "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)" : "#ffffff" }}>
        <div className="text-center text-white">
          <Phone className="w-12 h-12 mx-auto text-blue-200" />
          <h2 className="text-xl font-bold" style={{ marginTop: "0.5cm" }}>Chamada Encerrada</h2>
          {callDuration > 0 && <p className="text-sm text-blue-200" style={{ marginTop: "0.5cm" }}>Duração: {formatTime(callDuration)}</p>}
          <button
            onClick={() => { setViewState("listening"); setIncomingCall(null); setCallDuration(0); setGateOpened(false); setIsOutgoingCall(false); setIsInternalCall(false); fetchHistory(); }}
            className="text-sm font-bold rounded-2xl"
            style={{ background: "#fff", color: "#003580", marginTop: "0.5cm", paddingLeft: "2cm", paddingRight: "2cm", paddingTop: "0.5cm", paddingBottom: "0.5cm" }}
          >
            Voltar ao Interfone
          </button>
        </div>
      </div>
    );
  }

  // ─── LISTENING / MAIN VIEW ───
  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {/* Permanent audio element for remote audio playback — always in DOM */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Header */}
      <header className="premium-header safe-area-top" style={{ padding: "18px 24px" }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} style={{ color: p.text }}>
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div style={{ flex: 1 }}>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <Phone className="w-5 h-5" /> Interfone Digital
            </h1>
            <p className="text-xs text-blue-200 mt-0.5">
              Apto {user?.unit} — Bloco {user?.block}
            </p>
          </div>
          <TutorialButton title="Interfone Digital">
            <TSection icon={<span>📋</span>} title="O QUE É ESTA TELA?">
              <p>Esta é a tela onde você <strong>recebe chamadas de visitantes</strong> pelo Interfone Digital. Quando alguém escaneia o QR Code do seu bloco e seleciona seu apartamento, a chamada aparece aqui.</p>
            </TSection>
            <TSection icon={<span>📞</span>} title="RECEBENDO UMA CHAMADA">
              <TStep n={1}>Visitante escaneia o QR Code na entrada do bloco</TStep>
              <TStep n={2}>Seleciona seu apartamento e passa pela verificação de segurança</TStep>
              <TStep n={3}>Você ouve o <strong>toque de chamada</strong> e vê os dados do visitante</TStep>
              <TStep n={4}>Toque em <strong>"Atender"</strong> (verde) para iniciar a conversa</TStep>
              <TStep n={5}>O <strong>vídeo do visitante</strong> aparece na tela — ele vê a câmera dele</TStep>
              <TStep n={6}>Você fala por <strong>áudio</strong> — o visitante <strong>NÃO vê você</strong> (privacidade total)</TStep>
              <p style={{ marginTop: "8px", fontSize: "13px", color: "#1e40af" }}>👉 <strong>Importante:</strong> A câmera é unidirecional — você vê o visitante, mas ele só ouve sua voz.</p>
            </TSection>
            <TSection icon={<span>🛡️</span>} title="NÍVEL 3 — AUTORIZAÇÃO">
              <TBullet>Se seu nível de segurança é <strong>3</strong>, você verá uma tela de autorização</TBullet>
              <TBullet>O visitante envia <strong>nome, empresa e foto</strong> antes de ligar</TBullet>
              <TBullet>Você vê todos os dados e decide: <strong>"Autorizar"</strong> ou <strong>"Recusar"</strong></TBullet>
              <TBullet>Só depois da autorização a chamada de vídeo é iniciada</TBullet>
            </TSection>
            <TSection icon={<span>🎮</span>} title="CONTROLES DURANTE A CHAMADA">
              <TBullet><strong>🔇 Mudo</strong> — Desliga seu microfone (visitante não te ouve)</TBullet>
              <TBullet><strong>🚪 Abrir Portão</strong> — Envia comando para abrir o portão remotamente</TBullet>
              <TBullet><strong>📞 Encerrar</strong> — Finaliza a chamada</TBullet>
              <TBullet>A chamada tem <strong>timeout de 60 segundos</strong> se ninguém atender</TBullet>
            </TSection>
            <TSection icon={<span>📊</span>} title="HISTÓRICO DE CHAMADAS">
              <TBullet>Todas as chamadas são registradas com <strong>data, hora e resultado</strong></TBullet>
              <TBullet>Veja quem ligou, duração e se foi atendida, recusada ou não atendida</TBullet>
              <TBullet>O histórico aparece na parte inferior desta tela</TBullet>
              <TBullet>Cores indicam o resultado: <strong>verde</strong> (atendida), <strong>vermelho</strong> (recusada), <strong>cinza</strong> (não atendida)</TBullet>
            </TSection>
            <TSection icon={<span>⭐</span>} title="DICAS IMPORTANTES">
              <TBullet>Mantenha o <strong>app aberto</strong> para receber chamadas em tempo real</TBullet>
              <TBullet>Configure seu <strong>nível de segurança</strong> nas configurações (ícone de escudo)</TBullet>
              <TBullet>Use o <strong>horário silencioso</strong> para não ser incomodado à noite</TBullet>
              <TBullet>O visitante <strong>não precisa instalar nenhum app</strong> — funciona pelo navegador</TBullet>
              <TBullet>Se precisar, <strong>bloqueie visitantes</strong> indesejados nas configurações</TBullet>
              <TBullet>Visitantes também podem usar o botão <strong>PORTARIA</strong> para ligar direto para o porteiro/zelador — essas chamadas <strong>não chegam para moradores</strong></TBullet>
            </TSection>
          </TutorialButton>
          <button
            onClick={() => navigate("/morador/interfone-config")}
            className="text-white p-2"
          >
            <Shield className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 pb-8" style={{ maxWidth: 600, margin: "0 auto", width: "100%", paddingLeft: "calc(1rem + 0.5cm)", paddingRight: "calc(1rem + 0.5cm)", paddingTop: "1rem" }}>

        {/* ── Como funciona dropdown ── */}
        <div style={{
          background: isDark ? "rgba(59,130,246,0.10)" : "#eff6ff",
          border: isDark ? "1px solid rgba(59,130,246,0.25)" : "1px solid #bfdbfe",
          borderRadius: 16,
          marginBottom: "1rem",
          overflow: "hidden",
        }}>
          <button
            onClick={() => setInfoOpen(!infoOpen)}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "0.875rem 1.25rem", background: "transparent", border: "none", cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>&#128222;</span>
              <span style={{ fontWeight: 700, fontSize: 14, color: isDark ? "#93c5fd" : "#1d4ed8" }}>
                Como funciona o Interfone
              </span>
            </div>
            {infoOpen
              ? <ChevronUp style={{ width: 18, height: 18, color: isDark ? "#93c5fd" : "#1d4ed8", flexShrink: 0 }} />
              : <ChevronDown style={{ width: 18, height: 18, color: isDark ? "#93c5fd" : "#1d4ed8", flexShrink: 0 }} />}
          </button>
          {infoOpen && (
            <div style={{ padding: "0 1.25rem 1rem", display: "flex", flexDirection: "column", gap: 8 }}>
              {([
                ["&#128222;", "O interfone virtual substitui o interfone fisico do apartamento. Quando alguem chama no painel da portaria, a ligacao cai diretamente no seu celular pelo app."],
                ["&#128276;", "Ao receber uma chamada, o app toca um som de interfone e exibe a tela de atendimento com nome e foto do visitante (se cadastrado)."],
                ["&#127911;", "Voce pode atender a chamada e conversar com quem esta na portaria usando o microfone e alto-falante do celular, como uma ligacao normal."],
                ["&#128682;", "Durante a chamada, voce pode autorizar a entrada tocando em 'Abrir Portao' — o sistema aciona a cancela automaticamente via SONOFF/eWeLink."],
                ["&#128683;", "Voce tambem pode recusar a entrada ou encerrar a chamada sem atender, registrando a ocorrencia no historico."],
                ["&#128247;", "Se o condominio tiver camera na portaria, voce ve a imagem ao vivo durante a chamada antes de decidir abrir ou nao."],
                ["&#128203;", "Todas as chamadas ficam registradas no historico com data, hora, nome do visitante e acao tomada (atendida, recusada, porta aberta)."],
                ["&#128100;", "Funciona para visitantes, entregadores, prestadores de servico e qualquer pessoa que se apresente na portaria."],
                ["&#128241;", "Nao precisa estar em casa — funciona de qualquer lugar com internet, transformando seu celular no interfone do apartamento."],
              ] as [string, string][]).map(([icon, text], i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }} dangerouslySetInnerHTML={{ __html: icon }} />
                  <p style={{ fontSize: 13, color: isDark ? "#cbd5e1" : "#334155", lineHeight: 1.5, margin: 0 }}>{text}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status */}
        <div className="text-center" style={{ paddingTop: "0.5cm", paddingBottom: "0.5cm" }}>
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: isDark ? "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)" : "#ffffff", border: "3px solid #e2e8f0" }}
          >
            <Phone className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-lg font-bold" style={{ color: "#003580" }}>Interfone Ativo</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Aguardando chamadas do interfone do bloco...
          </p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-green-600 font-medium">Online</span>
          </div>
        </div>

        {/* Quick config */}
        <div className="flex gap-3" style={{ marginBottom: "0.5cm" }}>
          <button
            onClick={() => navigate("/morador/interfone-config")}
            className="flex-1 flex items-center gap-2 rounded-xl text-sm font-bold"
            style={{ background: "#f8fafc", border: "2px solid #003580", color: "#003580", paddingTop: "0.45cm", paddingBottom: "0.45cm", paddingLeft: "0.75rem", paddingRight: "0.75rem" }}
          >
            <Shield className="w-4 h-4" /> Configurar Segurança
          </button>
        </div>

        {/* Ligar para Portaria */}
        <button
          onClick={handleCallPortaria}
          className="w-full flex items-center justify-center gap-3 rounded-2xl font-bold text-white transition-all hover:scale-[1.02] active:scale-95"
          style={{ background: isDark ? "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)" : "#ffffff", boxShadow: "0 4px 16px rgba(0,53,128,0.3)", paddingTop: "0.5cm", paddingBottom: "0.5cm", marginBottom: "0.5cm" }}
        >
          <PhoneCall className="w-5 h-5" />
          Ligar para Portaria
        </button>

        {/* Recent calls */}
        <h3 className="font-bold text-sm flex items-center gap-2" style={{ color: "#003580", marginBottom: "0.5cm" }}>
          <History className="w-4 h-4" /> Chamadas Recentes
        </h3>

        {history.length > 0 ? (
          <div className="space-y-2">
            {history.slice(0, 20).map((call) => (
              <div
                key={call.id}
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: "#fff", border: "1px solid #e2e8f0" }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    background: call.status === "atendida" ? "#dcfce7" : call.status === "recusada" ? "#fef2f2" : "#f8fafc",
                  }}
                >
                  {call.status === "atendida" ? (
                    <Phone className="w-4 h-4 text-green-600" />
                  ) : call.status === "recusada" ? (
                    <PhoneOff className="w-4 h-4 text-red-500" />
                  ) : (
                    <Clock className="w-4 h-4 text-slate-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {call.visitante_nome || "Visitante"}
                    {call.visitante_empresa ? ` — ${call.visitante_empresa}` : ""}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Bloco {call.bloco} • {new Date(call.created_at).toLocaleDateString("pt-BR")} {new Date(call.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    {call.duracao_segundos > 0 && ` • ${formatTime(call.duracao_segundos)}`}
                  </p>
                </div>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0"
                  style={{
                    background: call.status === "atendida" ? "#dcfce7" : call.status === "recusada" ? "#fef2f2" : "#f8fafc",
                    color: call.status === "atendida" ? "#15803d" : call.status === "recusada" ? "#dc2626" : "#64748b",
                  }}
                >
                  {call.status === "atendida" ? "Atendida" : call.status === "recusada" ? "Recusada" : call.status === "timeout" ? "Sem resposta" : call.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Phone className="w-10 h-10 mx-auto mb-2 text-slate-200" />
            <p className="text-sm text-muted-foreground">Nenhuma chamada recebida ainda</p>
          </div>
        )}
      </main>
    </div>
  );
}
