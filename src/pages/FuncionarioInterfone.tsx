import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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
  Shield,
  X,
  Check,
  Clock,
  History,
  ArrowLeft,
  Headphones,
  Wifi,
  WifiOff,
  Search,
  Building,
} from "lucide-react";
import { apiFetch, getToken } from "@/lib/api";
import { useTheme } from "@/hooks/useTheme";
import ComoFunciona from "@/components/ComoFunciona";

const API = "/api";
const WS_URL = buildWsUrl("/ws/interfone");

interface IncomingCall {
  callId: string;
  visitanteNome: string;
  visitanteEmpresa: string | null;
  visitanteFoto: string | null;
  bloco: string;
  apartamento: string;
  visitorClientId: string;
  isPortariaCall?: boolean;
}

interface CallLog {
  id: number;
  bloco: string;
  apartamento: string;
  visitante_nome: string;
  status: string;
  resultado: string;
  duracao_segundos: number;
  created_at: string;
}

type CallState = "idle" | "ringing" | "connected" | "ended" | "calling";

interface MoradorItem {
  id: number;
  name: string;
  block: string;
  unit: string;
}

/* ═══════════════════════════════════════════════
   INTERFONE PORTARIA — Funcionário recebe chamadas
   ═══════════════════════════════════════════════ */
export default function FuncionarioInterfone() {
  const { isDark, p } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [wsConnected, setWsConnected] = useState(false);
  const [callState, setCallState] = useState<CallState>("idle");
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [callHistory, setCallHistory] = useState<CallLog[]>([]);

  // Internal call states
  const [showMoradorList, setShowMoradorList] = useState(false);
  const [moradores, setMoradores] = useState<MoradorItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isOutgoingCall, setIsOutgoingCall] = useState(false);
  const [outgoingTargetName, setOutgoingTargetName] = useState("");
  const [isInternalCall, setIsInternalCall] = useState(false);
  const peerTypeRef = useRef<string>("visitor");

  // Refs that mirror state — used inside WebSocket onmessage to avoid stale closures
  const isOutgoingCallRef = useRef(false);
  const incomingCallRef = useRef<IncomingCall | null>(null);

  // Keep refs in sync with state
  useEffect(() => { isOutgoingCallRef.current = isOutgoingCall; }, [isOutgoingCall]);
  useEffect(() => { incomingCallRef.current = incomingCall; }, [incomingCall]);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const callStateRef = useRef<CallState>("idle");
  const connectRef = useRef<(() => void) | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const manualWsCloseRef = useRef(false);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  // Keep callStateRef in sync
  useEffect(() => { callStateRef.current = callState; }, [callState]);

  // ─── Wake Lock: keep screen on during active calls ───
  const requestWakeLock = async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
        console.log("[Portaria] 🔒 Wake Lock acquired");
        wakeLockRef.current!.addEventListener("release", () => {
          console.log("[Portaria] 🔓 Wake Lock released");
        });
      }
    } catch (e) {
      console.warn("[Portaria] Wake Lock failed:", e);
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
  };

  // Acquire/release wake lock based on call state
  useEffect(() => {
    if (callState === "ringing" || callState === "connected" || callState === "calling") {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }
    return () => { releaseWakeLock(); };
  }, [callState]);

  // ─── Visibility change: re-acquire wake lock & reconnect WS when screen comes back ───
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Re-acquire wake lock if in a call (released when screen turns off)
        const cs = callStateRef.current;
        if (cs === "ringing" || cs === "connected" || cs === "calling") {
          requestWakeLock();
        }
        // Reconnect WS if it dropped while screen was off
        if (wsRef.current?.readyState !== WebSocket.OPEN && connectRef.current) {
          console.log("[Portaria] Visibility restored, reconnecting WS...");
          connectRef.current();
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Load call history
  useEffect(() => {
    apiFetch(`${API}/interfone/calls`)
      .then((res) => res.ok ? res.json() : [])
      .then((data) => setCallHistory(data.slice(0, 20)))
      .catch(() => {});
  }, [callState]);

  // Connect WebSocket and register as funcionario
  useEffect(() => {
    if (!user) return;

    const connect = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
        return;
      }

      const token = isNative ? getToken() : null;
      const wsUrl = token ? `${WS_URL}?token=${token}` : WS_URL;
      manualWsCloseRef.current = false;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (wsRef.current !== ws) return;
        setWsConnected(true);
        ws.send(JSON.stringify({
          type: "register-funcionario",
          funcionarioId: user.id,
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
          case "registered-funcionario":
            console.log("[Portaria] Registrado como funcionário para interfone");
            break;
          case "pong":
            break;
          case "incoming-call":
            setIncomingCall({
              callId: msg.callId,
              visitanteNome: msg.visitanteNome || "Visitante",
              visitanteEmpresa: msg.visitanteEmpresa,
              visitanteFoto: msg.visitanteFoto,
              bloco: msg.bloco,
              apartamento: msg.apartamento,
              visitorClientId: msg.visitorClientId,
              isPortariaCall: msg.isPortariaCall || false,
            });
            setIsInternalCall(false);
            peerTypeRef.current = "visitor";
            setCallState("ringing");
            playRingtone();
            break;
          case "webrtc-offer":
            handleWebRTCOffer(msg.offer, msg.callId);
            break;
          case "webrtc-answer":
            if (pcRef.current) pcRef.current.setRemoteDescription(new RTCSessionDescription(msg.answer));
            break;
          case "ice-candidate":
            if (pcRef.current && msg.candidate) {
              pcRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate));
            }
            break;
          case "call-ended":
            setCallState("ended");
            cleanup();
            setTimeout(() => { setCallState("idle"); setIsOutgoingCall(false); setIsInternalCall(false); }, 3000);
            break;
          case "internal-incoming-call":
            setIncomingCall({
              callId: msg.callId,
              visitanteNome: msg.callerName || "Morador",
              visitanteEmpresa: null,
              visitanteFoto: null,
              bloco: msg.bloco || "",
              apartamento: msg.apartamento || "",
              visitorClientId: msg.callerClientId,
              isPortariaCall: false,
            });
            setIsInternalCall(true);
            peerTypeRef.current = "morador";
            setCallState("ringing");
            playRingtone();
            break;
          case "call-answered":
            // Our outgoing internal call was answered — use REFS to avoid stale closure
            console.log("[Portaria] call-answered received, isOutgoing:", isOutgoingCallRef.current, "callId:", incomingCallRef.current?.callId);
            if (isOutgoingCallRef.current) {
              setCallState("connected");
              setCallDuration(0);
              timerRef.current = setInterval(() => setCallDuration((p) => p + 1), 1000);
              startOutgoingWebRTC(incomingCallRef.current?.callId || "", "morador");
            }
            break;
          case "resend-offer":
            // Morador reconnected after handoff — resend WebRTC offer
            console.log("[Portaria] resend-offer received, callId:", msg.callId);
            startOutgoingWebRTC(msg.callId, "morador");
            break;
          case "call-rejected":
            if (isOutgoingCallRef.current) {
              setCallState("ended");
              setIsOutgoingCall(false);
              setTimeout(() => setCallState("idle"), 3000);
            }
            break;
          case "call-unavailable":
            setCallState("idle");
            setIsOutgoingCall(false);
            break;
          case "call-waiting-push":
            // Morador offline but push was sent — keep ringing
            console.log("[Portaria] Push sent to morador, waiting...");
            break;
        }
      };

      ws.onclose = () => {
        // Only reconnect if this is still the active WS
        if (wsRef.current !== ws) return;
        wsRef.current = null;
        setWsConnected(false);
        if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
        if (manualWsCloseRef.current) return;
        // Auto-reconnect after 2 seconds (even if hidden — keep alive during calls)
        reconnectTimerRef.current = setTimeout(() => {
          const cs = callStateRef.current;
          if (!wsRef.current && (document.visibilityState !== "hidden" || cs === "connected" || cs === "calling" || cs === "ringing")) {
            connect();
          }
        }, 2000);
      };

      ws.onerror = () => {
        if (wsRef.current !== ws) return;
        setWsConnected(false);
      };
    };

    connectRef.current = connect;
    connect();

    return () => {
      manualWsCloseRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
      if (wsRef.current) {
        const ws = wsRef.current;
        wsRef.current = null;
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      }
      cleanup();
    };
  }, [user]);

  // Ringtone (via biblioteca centralizada)
  const playRingtone = () => {
    libPlayRingtone();
    vibrateIncomingCall();
  };
  const stopRingtone = () => {
    libStopRingtone();
    stopIncomingCallVibration();
  };

  // Helper: assign remote audio stream to audio element
  const playRemoteAudio = (track: MediaStreamTrack, streams: readonly MediaStream[]) => {
    const audioEl = remoteAudioRef.current;
    if (!audioEl) { console.warn("[Portaria] remoteAudioRef is null!"); return; }
    // Use the stream if available, otherwise create one from the track
    const stream = streams[0] || new MediaStream([track]);
    audioEl.srcObject = stream;
    audioEl.volume = 1.0;
    console.log("[Portaria] Audio element set:", { paused: audioEl.paused, muted: audioEl.muted, volume: audioEl.volume, trackEnabled: track.enabled, trackMuted: track.muted, trackState: track.readyState });
    audioEl.play().then(() => console.log("[Portaria] ✅ Audio playing")).catch((e) => console.error("[Portaria] ❌ Audio play FAILED:", e));
  };

  // Handle WebRTC offer from visitor (NOT used for outgoing calls)
  const handleWebRTCOffer = async (offer: RTCSessionDescriptionInit, callId: string) => {
    // Guard: don't process webrtc-offer if we're the one who initiated the call
    if (isOutgoingCallRef.current) {
      console.warn("[Portaria] Ignoring webrtc-offer during outgoing call");
      return;
    }
    try {
      // Close any existing PC first
      if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
      if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); }

      ensureMediaDevicesAvailable();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      });
      pcRef.current = pc;

      // Add audio only (funcionário doesn't send video)
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // Receive video + audio from visitor
      pc.ontrack = (event) => {
        console.log("[Portaria] ontrack received:", event.track.kind, event.streams.length);
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
        console.log("[Portaria] WebRTC connection state:", pc.connectionState);
      };

      pc.oniceconnectionstatechange = () => {
        console.log("[Portaria] ICE state:", pc.iceConnectionState);
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
      console.error("[Portaria] WebRTC error:", err);
      const message = explainMediaError(err);
      setCallState("ended");
      window.alert(message);
    }
  };

  // Answer call
  const handleAnswer = () => {
    if (!incomingCall || !wsRef.current) return;
    stopRingtone();
    setCallState("connected");
    setCallDuration(0);
    timerRef.current = setInterval(() => setCallDuration((p) => p + 1), 1000);

    wsRef.current.send(JSON.stringify({
      type: "call-answer",
      callId: incomingCall.callId,
    }));
  };

  // Reject call
  const handleReject = () => {
    if (!incomingCall || !wsRef.current) return;
    stopRingtone();
    wsRef.current.send(JSON.stringify({
      type: "call-reject",
      callId: incomingCall.callId,
    }));
    setCallState("idle");
    setIncomingCall(null);
  };

  // End call
  const handleEndCall = () => {
    if (!incomingCall || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: "call-end", callId: incomingCall.callId }));
    setCallState("ended");
    cleanup();
    setTimeout(() => setCallState("idle"), 3000);
  };

  // Open gate
  const handleOpenGate = () => {
    if (!incomingCall || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: "open-gate", callId: incomingCall.callId }));
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

  // ─── Internal call functions ───
  const fetchMoradores = async () => {
    try {
      const res = await apiFetch(`${API}/interfone/moradores-call`);
      if (res.ok) {
        const data = await res.json();
        setMoradores(data);
      }
    } catch {}
  };

  const handleOpenMoradorList = () => {
    fetchMoradores();
    setShowMoradorList(true);
    setSearchQuery("");
  };

  const handleCallMorador = (morador: MoradorItem) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const callId = `ICALL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setIsOutgoingCall(true);
    setIsInternalCall(true);
    setOutgoingTargetName(`${morador.name} — Bloco ${morador.block} Apto ${morador.unit}`);
    peerTypeRef.current = "morador";
    setIncomingCall({
      callId,
      visitanteNome: morador.name,
      visitanteEmpresa: null,
      visitanteFoto: null,
      bloco: morador.block,
      apartamento: morador.unit,
      visitorClientId: "",
    });
    setCallState("calling");
    setShowMoradorList(false);

    wsRef.current.send(JSON.stringify({
      type: "internal-call",
      targetUserId: morador.id,
      callId,
      callerName: user?.name || "Portaria",
    }));
  };

  const handleCancelOutgoing = () => {
    if (incomingCall && wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: "call-end", callId: incomingCall.callId }));
    }
    setCallState("idle");
    setIsOutgoingCall(false);
    setIsInternalCall(false);
    setIncomingCall(null);
    cleanup();
  };

  const startOutgoingWebRTC = async (callId: string, targetType: string) => {
    console.log("[Portaria] startOutgoingWebRTC called, callId:", callId, "targetType:", targetType);
    try {
      // Close any existing PC first
      if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
      if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); }

      ensureMediaDevicesAvailable();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      console.log("[Portaria] Got local audio stream, tracks:", stream.getAudioTracks().length);

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      });
      pcRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        console.log("[Portaria] outgoing ontrack:", event.track.kind, event.streams.length, "enabled:", event.track.enabled, "muted:", event.track.muted);
        if (event.track.kind === "audio") {
          playRemoteAudio(event.track, event.streams);
        }
      };

      pc.onconnectionstatechange = () => {
        console.log("[Portaria] outgoing WebRTC state:", pc.connectionState);
      };

      pc.oniceconnectionstatechange = () => {
        console.log("[Portaria] outgoing ICE state:", pc.iceConnectionState);
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
      console.error("[Portaria] outgoing WebRTC error:", err);
      const message = explainMediaError(err);
      setCallState("ended");
      window.alert(message);
    }
  };

  const filteredMoradores = moradores.filter((m) => {
    const q = searchQuery.toLowerCase();
    return m.name.toLowerCase().includes(q) || m.block.toLowerCase().includes(q) || m.unit.toLowerCase().includes(q);
  });

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const getCallStatusMeta = (status: string) => {
    if (status === "atendida") {
      return {
        label: "Atendida",
        iconBg: "rgba(16,185,129,0.12)",
        iconColor: "#10b981",
        badgeBg: "rgba(16,185,129,0.14)",
        badgeColor: "#047857",
      };
    }

    if (status === "recusada") {
      return {
        label: "Recusada",
        iconBg: "rgba(239,68,68,0.12)",
        iconColor: "#ef4444",
        badgeBg: "rgba(239,68,68,0.14)",
        badgeColor: "#b91c1c",
      };
    }

    return {
      label: "Não atendida",
      iconBg: "rgba(100,116,139,0.12)",
      iconColor: "#64748b",
      badgeBg: "rgba(100,116,139,0.14)",
      badgeColor: "#475569",
    };
  };

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: p.pageBg }}>
      {/* Permanent audio element for remote audio playback — always in DOM */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Header */}
      <header className="safe-area-top" style={{ background: p.headerBg, padding: "18px 24px", borderBottom: p.headerBorder, boxShadow: p.headerShadow }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} style={{ width: 40, height: 40, borderRadius: 12, background: p.btnBg, border: p.btnBorder, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: p.text }}>
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div style={{ flex: 1 }}>
            <h1 className="text-white flex items-center gap-2" style={{ fontWeight: 700, fontSize: 18 }}>
              <Headphones className="w-5 h-5" /> Interfone Portaria
            </h1>
            <p style={{ fontSize: 12, color: "rgba(147,197,253,0.8)", marginTop: 2 }}>
              Receba chamadas de visitantes
            </p>
          </div>
          <TutorialButton title="Interfone Portaria">
            <TSection icon={<span>📋</span>} title="O QUE É ESTA TELA?">
              <p>Aqui você <strong>recebe chamadas de visitantes</strong> que apertam o botão <strong>"PORTARIA"</strong> no interfone digital. É uma ligação direta, sem nenhum filtro ou nível de segurança.</p>
            </TSection>
            <TSection icon={<span>📞</span>} title="COMO FUNCIONA">
              <TStep n={1}>O visitante escaneia o <strong>QR Code</strong> na entrada do bloco</TStep>
              <TStep n={2}>Em vez de selecionar um apartamento, toca no botão <strong>"PORTARIA"</strong></TStep>
              <TStep n={3}>A chamada chega direto aqui — <strong>sem verificação, sem filtros</strong></TStep>
              <TStep n={4}>Você vê o <strong>vídeo do visitante</strong> em tempo real</TStep>
              <TStep n={5}>Fale com o visitante por <strong>áudio</strong> (ele não vê você)</TStep>
              <TStep n={6}>Pode <strong>abrir o portão</strong> remotamente direto pela tela</TStep>
            </TSection>
            <TSection icon={<span>🎮</span>} title="CONTROLES DURANTE A CHAMADA">
              <TBullet><strong>🔇 Mudo</strong> — Desliga seu microfone</TBullet>
              <TBullet><strong>🚪 Abrir Portão</strong> — Envia comando para abrir o portão</TBullet>
              <TBullet><strong>📞 Encerrar</strong> — Finaliza a chamada</TBullet>
            </TSection>
            <TSection icon={<span>📡</span>} title="STATUS DA CONEXÃO">
              <TBullet><strong>🟢 Verde</strong> — Conectado e pronto para receber chamadas</TBullet>
              <TBullet><strong>🔴 Vermelho</strong> — Desconectado, reconectando automaticamente</TBullet>
              <TBullet>Mantenha esta tela <strong>aberta</strong> para receber chamadas</TBullet>
              <TBullet>A conexão é <strong>reconectada automaticamente</strong> se cair</TBullet>
            </TSection>
            <TSection icon={<span>⭐</span>} title="DICAS">
              <TBullet>Esta tela recebe chamadas tanto de <strong>"PORTARIA"</strong> quanto de moradores ausentes</TBullet>
              <TBullet>O vídeo é <strong>unidirecional</strong> — você vê o visitante, ele só ouve sua voz</TBullet>
              <TBullet>Todas as chamadas ficam no <strong>histórico</strong> abaixo</TBullet>
              <TBullet>Ideal para <strong>porteiros e zeladores</strong> de plantão</TBullet>
            </TSection>
          </TutorialButton>
        </div>
      </header>

      <main className="flex-1 p-4 pb-8" style={{ maxWidth: 600, margin: "0 auto", width: "100%" }}>
        <ComoFunciona steps={[
          "📞 Portaria seleciona unidade e inicia chamada",
          "📱 Morador recebe chamada no app do celular",
          "🔊 Comunicação por áudio em tempo real",
          "✅ Morador autoriza ou recusa entrada pelo app",
        ]} />
        {/* Status */}
        <div className="text-center" style={{ paddingTop: "0.5cm", paddingBottom: "0.5cm" }}>
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{
              background: wsConnected
                ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                : "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
              boxShadow: wsConnected
                ? "0 0 24px rgba(16,185,129,0.4)"
                : "0 0 24px rgba(239,68,68,0.4)",
            }}
          >
            {wsConnected ? (
              <Wifi className="w-8 h-8 text-white" />
            ) : (
              <WifiOff className="w-8 h-8 text-white" />
            )}
          </div>
          <h2 className="text-lg font-bold" style={{ color: p.text }}>
            {wsConnected ? "Portaria Online" : "Reconectando..."}
          </h2>
          <p className="text-sm mt-1" style={{ color: isDark ? "rgba(255,255,255,0.7)" : "#475569" }}>
            {wsConnected
              ? "Aguardando chamadas de visitantes..."
              : "Tentando reconectar ao servidor..."}
          </p>
        </div>

        {/* ═══════════════════════════════════ */}
        {/* INCOMING CALL */}
        {/* ═══════════════════════════════════ */}
        {callState === "ringing" && incomingCall && (
          <div
            className="rounded-2xl p-6 mb-6"
            style={{
              background: "linear-gradient(135deg, #003580 0%, #002a66 100%)",
              boxShadow: "0 8px 32px rgba(0,53,128,0.4)",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          >
            <div className="text-center text-white">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: isDark ? "rgba(255,255,255,0.15)" : "#f0f4f8", border: isDark ? "3px solid rgba(255,255,255,0.3)" : "3px solid #cbd5e1" }}
              >
                <PhoneIncoming className="w-8 h-8 text-white" />
              </div>
              <p className="text-xs text-blue-200 mb-1">{isInternalCall ? "Chamada de morador" : "Chamada de visitante"}</p>
              <h3 className="text-xl font-bold mb-1">{incomingCall.visitanteNome}</h3>
              <p className="text-sm text-blue-200 mb-1">
                Bloco {incomingCall.bloco}
                {incomingCall.isPortariaCall ? " — PORTARIA" : ` — Apto ${incomingCall.apartamento}`}
              </p>
              <p className="text-xs text-blue-300 mb-6">
                {isInternalCall ? "📞 Chamada interna do morador" : "📞 Ligação direta — sem filtro de segurança"}
              </p>

              {/* Answer / Reject */}
              <div className="flex justify-center gap-6">
                <button
                  onClick={handleReject}
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: "#ef4444", boxShadow: "0 4px 16px rgba(239,68,68,0.5)" }}
                >
                  <PhoneOff className="w-7 h-7 text-white" />
                </button>
                <button
                  onClick={handleAnswer}
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: "#10b981", boxShadow: "0 4px 16px rgba(16,185,129,0.5)" }}
                >
                  <Phone className="w-7 h-7 text-white" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════ */}
        {/* OUTGOING CALL (CALLING) */}
        {/* ═══════════════════════════════════ */}
        {callState === "calling" && (
          <div
            className="rounded-2xl p-6 mb-6"
            style={{
              background: "linear-gradient(135deg, #003580 0%, #002a66 100%)",
              boxShadow: "0 8px 32px rgba(0,53,128,0.4)",
            }}
          >
            <div className="text-center text-white">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse"
                style={{ background: isDark ? "rgba(255,255,255,0.15)" : "#f0f4f8", border: isDark ? "3px solid rgba(255,255,255,0.3)" : "3px solid #cbd5e1" }}
              >
                <PhoneCall className="w-8 h-8 text-white" />
              </div>
              <p className="text-xs text-blue-200 mb-1">Chamando morador...</p>
              <h3 className="text-xl font-bold mb-1">{outgoingTargetName}</h3>
              <p className="text-sm text-blue-200 mb-6">Aguardando resposta...</p>
              <button
                onClick={handleCancelOutgoing}
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
                style={{ background: "#ef4444", boxShadow: "0 4px 16px rgba(239,68,68,0.5)" }}
              >
                <PhoneOff className="w-7 h-7 text-white" />
              </button>
              <p className="text-xs text-blue-300 mt-2">Cancelar</p>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════ */}
        {/* CONNECTED CALL */}
        {/* ═══════════════════════════════════ */}
        {callState === "connected" && incomingCall && (
          <div className="rounded-2xl overflow-hidden mb-6" style={{ background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)", boxShadow: "0 8px 32px rgba(0,53,128,0.4)" }}>
            {/* Video area for external calls / Audio-only for internal calls */}
            {!isInternalCall ? (
              <div className="relative" style={{ aspectRatio: "4/3", background: "#000" }}>
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: "rgba(0,0,0,0.6)" }}>
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs text-white font-bold">{formatTime(callDuration)}</span>
                </div>
                <div className="absolute top-3 right-3 px-3 py-1.5 rounded-full" style={{ background: "rgba(0,0,0,0.6)" }}>
                  <span className="text-xs text-white font-bold">{incomingCall.visitanteNome}</span>
                </div>
                <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-full" style={{ background: "rgba(0,0,0,0.6)" }}>
                  <span className="text-xs text-blue-200">
                    Bloco {incomingCall.bloco} {incomingCall.isPortariaCall ? "· PORTARIA" : `· Apto ${incomingCall.apartamento}`}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-white">
                <video ref={remoteVideoRef} autoPlay playsInline style={{ display: "none" }} />
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ background: isDark ? "rgba(255,255,255,0.15)" : "#f0f4f8", border: isDark ? "3px solid rgba(255,255,255,0.3)" : "3px solid #cbd5e1" }}
                >
                  <Phone className="w-10 h-10 text-white animate-pulse" />
                </div>
                <h3 className="text-lg font-bold">{incomingCall.visitanteNome}</h3>
                {incomingCall.bloco && (
                  <p className="text-sm text-blue-200 mt-1">Bloco {incomingCall.bloco} · Apto {incomingCall.apartamento}</p>
                )}
                <p className="text-xs text-blue-300 mt-2">Chamada interna · {formatTime(callDuration)}</p>
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center justify-center gap-4 p-4">
              <button
                onClick={handleToggleMute}
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: isMuted ? "#ef4444" : "rgba(255,255,255,0.15)" }}
              >
                {isMuted ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-white" />}
              </button>
              {!isInternalCall && (
                <button
                  onClick={handleOpenGate}
                  className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #10b981, #059669)", boxShadow: "0 4px 16px rgba(16,185,129,0.4)" }}
                >
                  <DoorOpen className="w-6 h-6 text-white" />
                </button>
              )}
              <button
                onClick={handleEndCall}
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: "#ef4444" }}
              >
                <PhoneOff className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════ */}
        {/* CALL ENDED */}
        {/* ═══════════════════════════════════ */}
        {callState === "ended" && (
          <div className="text-center py-6 mb-6 rounded-2xl" style={{ background: "var(--card)" }}>
            <Phone className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-bold text-foreground">Chamada encerrada</p>
            {callDuration > 0 && (
              <p className="text-xs text-muted-foreground mt-1">Duração: {formatTime(callDuration)}</p>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════ */}
        {/* LIGAR PARA MORADOR */}
        {/* ═══════════════════════════════════ */}
        {callState === "idle" && wsConnected && (
          <div style={{ marginBottom: "0.5cm" }}>
            <button
              onClick={handleOpenMoradorList}
              className="w-full flex items-center justify-center gap-3 rounded-2xl font-bold text-white transition-all hover:scale-[1.02] active:scale-95"
              style={{ background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)", border: isDark ? "2px solid rgba(255,255,255,0.5)" : "2px solid #cbd5e1", boxShadow: "0 4px 16px rgba(0,53,128,0.3)", paddingTop: "0.5cm", paddingBottom: "0.5cm" }}
            >
              <PhoneCall className="w-5 h-5" />
              Ligar para Morador
            </button>
          </div>
        )}

        {/* MORADOR LIST MODAL — Premium */}
        {showMoradorList && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
            style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowMoradorList(false); }}
          >
            <div
              className="w-full flex flex-col overflow-hidden"
              style={{
                maxWidth: 420,
                maxHeight: "80vh",
                borderRadius: "20px 20px 0 0",
                background: isDark ? "#1e293b" : "#ffffff",
                boxShadow: "0 -4px 40px rgba(0,0,0,0.2)",
                animation: "fadeInSlide 0.3s ease-out",
              }}
            >
              {/* Header */}
              <div style={{ padding: "24px 24px 0" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: "linear-gradient(135deg, #0062d1, #003d99)" }}
                    >
                      <PhoneCall className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold" style={{ color: isDark ? "#f1f5f9" : "#0f172a" }}>
                        Ligar para Morador
                      </h3>
                      <p className="text-xs" style={{ color: isDark ? "#94a3b8" : "#64748b" }}>
                        Selecione para iniciar chamada
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowMoradorList(false)}
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-90"
                    style={{ background: isDark ? "rgba(255,255,255,0.08)" : "#f1f5f9" }}
                  >
                    <X className="w-4 h-4" style={{ color: isDark ? "#94a3b8" : "#64748b" }} />
                  </button>
                </div>

                {/* Search */}
                <div
                  className="flex items-center gap-2.5 rounded-xl"
                  style={{
                    padding: "12px 14px",
                    marginTop: 20,
                    marginBottom: 20,
                    background: isDark ? "rgba(255,255,255,0.06)" : "#f1f5f9",
                    border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e2e8f0",
                  }}
                >
                  <Search className="w-4 h-4 shrink-0" style={{ color: isDark ? "#64748b" : "#94a3b8" }} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por nome, bloco ou apto..."
                    className="flex-1 bg-transparent text-sm outline-none"
                    style={{ color: isDark ? "#f1f5f9" : "#1e293b" }}
                    autoFocus
                  />
                </div>

                {/* Divider */}
                <div style={{ height: 1, background: isDark ? "rgba(255,255,255,0.06)" : "#e2e8f0" }} />
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto" style={{ padding: "16px 24px" }}>
                {filteredMoradores.length === 0 ? (
                  <div className="text-center py-10">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
                      style={{ background: isDark ? "rgba(255,255,255,0.06)" : "#f1f5f9" }}
                    >
                      <User className="w-5 h-5" style={{ color: isDark ? "#475569" : "#94a3b8" }} />
                    </div>
                    <p className="text-sm font-medium" style={{ color: isDark ? "#94a3b8" : "#64748b" }}>Nenhum morador encontrado</p>
                    <p className="text-xs mt-1" style={{ color: isDark ? "#475569" : "#94a3b8" }}>Tente outro nome ou apartamento</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {filteredMoradores.map((m, idx) => (
                      <button
                        key={m.id}
                        onClick={() => handleCallMorador(m)}
                        className="w-full flex items-center gap-3 text-left rounded-xl transition-all hover:scale-[1.01] active:scale-[0.98]"
                        style={{
                          padding: "12px",
                          background: isDark ? "rgba(255,255,255,0.04)" : "#f8fafc",
                          border: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid #e2e8f0",
                          animationDelay: `${idx * 40}ms`,
                        }}
                      >
                        {/* Avatar */}
                        <div className="relative shrink-0">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center"
                            style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}
                          >
                            <User className="w-4 h-4 text-white" />
                          </div>
                          <div
                            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
                            style={{ background: "#10b981", border: isDark ? "2px solid #1e293b" : "2px solid #f8fafc" }}
                          />
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: isDark ? "#f1f5f9" : "#1e293b" }}>{m.name}</p>
                          <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>
                            Bloco {m.block} · Apto {m.unit}
                          </p>
                        </div>
                        {/* Call button */}
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                          style={{ background: isDark ? "rgba(16,185,129,0.12)" : "rgba(16,185,129,0.1)" }}
                        >
                          <PhoneCall className="w-3.5 h-3.5" style={{ color: "#10b981" }} />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer count */}
              <div className="text-center" style={{ padding: "14px 24px 20px", borderTop: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid #e2e8f0" }}>
                <p className="text-xs" style={{ color: isDark ? "#475569" : "#94a3b8" }}>
                  {filteredMoradores.length} morador{filteredMoradores.length !== 1 ? "es" : ""} disponíve{filteredMoradores.length !== 1 ? "is" : "l"}
                </p>
              </div>
            </div>

            <style>{`
              @keyframes fadeInSlide {
                from { opacity: 0; transform: translateY(40px); }
                to   { opacity: 1; transform: translateY(0); }
              }
              @media (min-width: 640px) {
                @keyframes fadeInSlide {
                  from { opacity: 0; transform: scale(0.95); }
                  to   { opacity: 1; transform: scale(1); }
                }
              }
            `}</style>
          </div>
        )}

        {/* ═══════════════════════════════════ */}
        {/* CALL HISTORY */}
        {/* ═══════════════════════════════════ */}
        <div style={{ marginTop: "0.5cm" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              marginBottom: "0.5cm",
            }}
          >
            <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: p.text }}>
              <History className="w-4 h-4" style={{ color: p.text }} /> Últimas Chamadas
            </h3>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                padding: "6px 10px",
                borderRadius: "999px",
                background: isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)",
                color: p.textSecondary,
              }}
            >
              {callHistory.length} registro{callHistory.length === 1 ? "" : "s"}
            </span>
          </div>
          {callHistory.length === 0 ? (
            <div className="text-center py-8 rounded-xl" style={{ background: "var(--card)" }}>
              <Phone className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhuma chamada registrada</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {callHistory.map((log) => {
                const statusMeta = getCallStatusMeta(log.status);
                const createdAt = new Date(log.created_at);

                return (
                  <div
                    key={log.id}
                    style={{
                      background: "var(--card)",
                      borderRadius: "18px",
                      padding: "16px 18px",
                      boxShadow: isDark ? "0 10px 24px rgba(0,0,0,0.14)" : "0 10px 24px rgba(15,23,42,0.06)",
                      border: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(15,23,42,0.06)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
                      <div
                        className="shrink-0"
                        style={{
                          width: "44px",
                          height: "44px",
                          borderRadius: "14px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: statusMeta.iconBg,
                        }}
                      >
                        <Phone className="w-4 h-4" style={{ color: statusMeta.iconColor }} />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            justifyContent: "space-between",
                            gap: "12px",
                            marginBottom: "8px",
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <p className="text-sm font-bold text-foreground truncate">
                              {log.visitante_nome || "Visitante"}
                            </p>
                            <p style={{ fontSize: "12px", color: p.textSecondary, marginTop: "3px" }}>
                              Bloco {log.bloco} · Apto {log.apartamento}
                            </p>
                          </div>

                          <span
                            className="shrink-0"
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              padding: "6px 10px",
                              borderRadius: "999px",
                              background: statusMeta.badgeBg,
                              color: statusMeta.badgeColor,
                            }}
                          >
                            {statusMeta.label}
                          </span>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "10px",
                            flexWrap: "wrap",
                            paddingTop: "10px",
                            borderTop: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(15,23,42,0.08)",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                            {log.duracao_segundos > 0 && (
                              <span
                                style={{
                                  fontSize: "11px",
                                  color: p.textSecondary,
                                  background: isDark ? "rgba(255,255,255,0.05)" : "rgba(15,23,42,0.05)",
                                  padding: "5px 9px",
                                  borderRadius: "999px",
                                }}
                              >
                                Duração {formatTime(log.duracao_segundos)}
                              </span>
                            )}
                          </div>

                          <div style={{ textAlign: "right" }}>
                            <p style={{ fontSize: "11px", color: p.textSecondary, fontWeight: 600 }}>
                              {createdAt.toLocaleDateString("pt-BR")}
                            </p>
                            <p style={{ fontSize: "11px", color: p.textMuted }}>
                              {createdAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
