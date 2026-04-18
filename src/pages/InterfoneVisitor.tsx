import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { buildWsUrl } from "@/lib/config";
import { compressCanvas } from "@/lib/imageUtils";
import { AppLogo } from "@/components/AppLogo";
import {
  Phone,
  PhoneOff,
  Building2,
  User,
  Camera,
  Briefcase,
  ArrowRight,
  Shield,
  CheckCircle2,
  XCircle,
  Loader2,
  MicOff,
  Mic,
  Volume2,
  DoorOpen,
  Clock,
  Headphones,
  Search,
  ChevronRight,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { ensureMediaDevicesAvailable, explainMediaError } from "@/lib/mediaDiagnostics";
import { useTheme } from "@/hooks/useTheme";

const API = "/api";
const WS_URL = buildWsUrl("/ws/interfone");

interface Apartamento {
  unit: string;
  moradores: { id: number; name: string; whatsapp?: string }[];
}

interface BlocoInfo {
  id: number;
  nome: string;
  apartamentos: Apartamento[];
}

// Block-specific token response
interface BlockTokenData {
  tipo: "bloco";
  condominio: string;
  condominio_id: number;
  bloco: string;
  apartamentos: Apartamento[];
}

// Condominium-wide token response
interface CondoTokenData {
  tipo: "condominio";
  condominio: string;
  condominio_id: number;
  blocos: BlocoInfo[];
}

type TokenData = BlockTokenData | CondoTokenData;

interface BlockInfo {
  condominio: string;
  condominio_id: number;
  bloco: string;
  apartamentos: Apartamento[];
}

type CallState = "idle" | "security" | "auth-pending" | "calling" | "connected" | "rejected" | "timeout" | "unavailable" | "ended" | "gate-opened";

/* ═══════════════════════════════════════════════
   INTERFONE DIGITAL — Página Pública do Visitante
   Visitante escaneia QR → escolhe apto → liga
   ═══════════════════════════════════════════════ */
export default function InterfoneVisitor() {
  const { isDark, p } = useTheme();
  const { token } = useParams<{ token: string }>();
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [blockInfo, setBlockInfo] = useState<BlockInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Condominium-wide: block selection
  const [selectedBloco, setSelectedBloco] = useState<BlocoInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Selection
  const [selectedApto, setSelectedApto] = useState<Apartamento | null>(null);
  const [selectedMorador, setSelectedMorador] = useState<{ id: number; name: string; whatsapp?: string } | null>(null);

  // Security
  const [securityLevel, setSecurityLevel] = useState(1);
  const [nameInput, setNameInput] = useState("");
  const [nameError, setNameError] = useState("");

  // Auth (Level 3)
  const [authForm, setAuthForm] = useState({ nome: "", empresa: "", foto: "" });
  const [authCapturing, setAuthCapturing] = useState(false);

  // Portaria direct call
  const [isPortariaCall, setIsPortariaCall] = useState(false);
  const [pushSent, setPushSent] = useState(false);

  // Call state
  const [callState, setCallState] = useState<CallState>("idle");
  const [callId, setCallId] = useState("");
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [callingCountdown, setCallingCountdown] = useState(40);

  // Refs to avoid stale closures in WS message handlers
  const callIdRef = useRef("");
  const callStateRef = useRef<CallState>("idle");

  // WebRTC / WebSocket refs
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const captureVideoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const ringtoneRef = useRef<{ ctx: AudioContext; interval: NodeJS.Timeout } | null>(null);

  // Load token data
  useEffect(() => {
    if (!token) return;
    apiFetch(`${API}/interfone/public/${token}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("QR Code inválido");
        return res.json();
      })
      .then((data: TokenData) => {
        setTokenData(data);
        if (data.tipo === "bloco") {
          // Block-specific token — set blockInfo directly
          setBlockInfo({
            condominio: data.condominio,
            condominio_id: data.condominio_id,
            bloco: data.bloco,
            apartamentos: data.apartamentos,
          });
        }
        // For condominio type, user will pick a block first
        setLoading(false);
      })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [token]);

  // Connect WebSocket
  const connectWS = useCallback(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      switch (msg.type) {
        case "call-answered":
          setCallState("connected");
          callStateRef.current = "connected";
          clearTimeout(timeoutRef.current!);
          stopRingtone();
          startCallTimer();
          initWebRTC();
          break;
        case "call-rejected":
          setCallState("rejected");
          callStateRef.current = "rejected";
          clearTimeout(timeoutRef.current!);
          cleanup();
          break;
        case "call-unavailable":
          setCallState("unavailable");
          callStateRef.current = "unavailable";
          cleanup();
          break;
        case "call-waiting-push":
          // Morador was offline but push was sent — extend timeout to 90s for push delivery
          console.log("[Visitor] Push sent to morador, extending timeout to 90s...");
          setPushSent(true);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          if (countdownRef.current) clearInterval(countdownRef.current);
          setCallingCountdown(90);
          countdownRef.current = setInterval(() => {
            setCallingCountdown((prev) => Math.max(0, prev - 1));
          }, 1000);
          timeoutRef.current = setTimeout(() => {
            setCallState("timeout");
            callStateRef.current = "timeout";
            cleanup();
          }, 90000);
          break;
        case "auth-accepted":
          setCallState("calling");
          callStateRef.current = "calling";
          startRingtone();
          // Now actually call
          sendCallRequest();
          break;
        case "auth-rejected":
          setCallState("rejected");
          cleanup();
          break;
        case "webrtc-offer":
          handleWebRTCOffer(msg.offer);
          break;
        case "webrtc-answer":
          if (pcRef.current) pcRef.current.setRemoteDescription(new RTCSessionDescription(msg.answer));
          break;
        case "ice-candidate":
          if (pcRef.current && msg.candidate) {
            pcRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate));
          }
          break;
        case "resend-offer":
          // Morador reconnected after handoff — resend WebRTC offer
          console.log("[Visitor] resend-offer received, reinitializing WebRTC");
          initWebRTC();
          break;
        case "call-ended":
          setCallState("ended");
          callStateRef.current = "ended";
          cleanup();
          break;
        case "gate-opened":
          setCallState("gate-opened");
          callStateRef.current = "gate-opened";
          break;
      }
    };

    ws.onerror = () => setError("Erro de conexão com o servidor.");
    ws.onclose = () => {
      if (callStateRef.current === "connected" || callStateRef.current === "calling") {
        setCallState("ended");
        callStateRef.current = "ended";
        cleanup();
      }
    };

    return ws;
  }, []);

  // Start call timer
  const startCallTimer = () => {
    setCallDuration(0);
    timerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  };

  // Format time
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  // Initialize WebRTC (visitor sends video + audio, receives only audio)
  const initWebRTC = async () => {
    try {
      ensureMediaDevicesAvailable();
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      });
      pcRef.current = pc;

      // Add local tracks
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // Receive remote audio from morador
      pc.ontrack = (event) => {
        if (!remoteAudioRef.current) return;
        const stream = event.streams[0] || new MediaStream([event.track]);
        remoteAudioRef.current.srcObject = stream;
        remoteAudioRef.current.volume = 1.0;
        remoteAudioRef.current.play().then(() => {
          console.log("[Visitor] Remote audio playing");
        }).catch((e) => {
          console.warn("[Visitor] Remote audio play blocked:", e);
        });
      };

      // ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: "ice-candidate",
            callId: callIdRef.current,
            candidate: event.candidate,
            targetType: "morador",
          }));
        }
      };

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      wsRef.current?.send(JSON.stringify({
        type: "webrtc-offer",
        callId: callIdRef.current,
        offer,
        targetType: "morador",
      }));
    } catch (err) {
      console.error("WebRTC error:", err);
      setError(explainMediaError(err));
      setCallState("ended");
    }
  };

  const handleWebRTCOffer = async (offer: RTCSessionDescriptionInit) => {
    // Visitor shouldn't normally receive offer, but handle gracefully
    if (!pcRef.current) return;
    await pcRef.current.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pcRef.current.createAnswer();
    await pcRef.current.setLocalDescription(answer);
    wsRef.current?.send(JSON.stringify({
      type: "webrtc-answer",
      callId: callIdRef.current,
      answer,
      targetType: "morador",
    }));
  };

  // Intermittent ringtone (phone-like ring pattern)
  const startRingtone = () => {
    stopRingtone();
    try {
      const ctx = new AudioContext();
      const playBeep = () => {
        // Two short beeps (ring-ring) – dual-tone for distinct sound
        for (let i = 0; i < 2; i++) {
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();
          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);
          osc1.frequency.value = 480;
          osc2.frequency.value = 620;
          osc1.type = "sine";
          osc2.type = "sine";
          gain.gain.value = 0.13;
          const startT = ctx.currentTime + i * 0.35;
          osc1.start(startT);
          osc2.start(startT);
          osc1.stop(startT + 0.25);
          osc2.stop(startT + 0.25);
        }
      };
      playBeep(); // first ring immediately
      const interval = setInterval(playBeep, 3000); // repeat every 3s
      ringtoneRef.current = { ctx, interval };
    } catch {}
  };

  const stopRingtone = () => {
    if (ringtoneRef.current) {
      clearInterval(ringtoneRef.current.interval);
      ringtoneRef.current.ctx.close().catch(() => {});
      ringtoneRef.current = null;
    }
  };

  // Clean up media
  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    stopRingtone();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current = null;
  };

  // Select apartment
  const handleSelectApto = async (apto: Apartamento) => {
    setSelectedApto(apto);
    if (apto.moradores.length === 1) {
      handleSelectMorador(apto.moradores[0], apto);
    }
  };

  // Select morador and check security level
  const handleSelectMorador = async (morador: { id: number; name: string; whatsapp?: string }, apto?: Apartamento) => {
    setSelectedMorador(morador);
    try {
      const res = await apiFetch(`${API}/interfone/public/security/${morador.id}`);
      const data = await res.json();
      if (data.silencioso) {
        setError("Este morador está em modo silencioso. Tente mais tarde.");
        return;
      }
      setSecurityLevel(data.nivel_seguranca);
      if (data.nivel_seguranca === 1) {
        // Direct call
        startCall(morador, apto || selectedApto!);
      } else {
        // Show security form
        setCallState("security");
      }
    } catch {
      // Default level 1
      startCall(morador, apto || selectedApto!);
    }
  };

  // Start the actual call
  const startCall = (morador: { id: number; name: string }, apto: Apartamento) => {
    setIsPortariaCall(false);
    const ws = connectWS();
    const newCallId = `CALL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setCallId(newCallId);
    callIdRef.current = newCallId;
    setCallState("calling");
    callStateRef.current = "calling";
    startRingtone();

    // Log call on server
    apiFetch(`${API}/interfone/calls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        condominio_id: tokenData?.condominio_id || blockInfo?.condominio_id,
        bloco: blockInfo?.bloco,
        apartamento: apto.unit,
        morador_id: morador.id,
        morador_nome: morador.name,
        visitante_nome: authForm.nome || null,
        visitante_empresa: authForm.empresa || null,
        visitante_foto: authForm.foto || null,
        nivel_seguranca: securityLevel,
        call_id: newCallId,
      }),
    }).catch(() => {});

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: "call-request",
        moradorId: morador.id,
        callId: newCallId,
        visitanteNome: authForm.nome || "Visitante",
        visitanteEmpresa: authForm.empresa || null,
        visitanteFoto: authForm.foto || null,
        nivelSeguranca: securityLevel,
        bloco: blockInfo?.bloco,
        apartamento: apto.unit,
      }));
    };

    // Timeout after 40 seconds
    setCallingCountdown(40);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCallingCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    timeoutRef.current = setTimeout(() => {
      setCallState("timeout");
      callStateRef.current = "timeout";
      cleanup();
    }, 40000);
  };

  // Start PORTARIA direct call (no security, no filters)
  const startPortariaCall = () => {
    const condominioId = tokenData?.condominio_id;
    if (!condominioId) return;
    setIsPortariaCall(true);
    setCallState("calling");
    callStateRef.current = "calling";
    startRingtone();
    const ws = connectWS();
    const newCallId = `PORTARIA-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setCallId(newCallId);
    callIdRef.current = newCallId;

    // Log call
    apiFetch(`${API}/interfone/calls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        condominio_id: condominioId,
        bloco: blockInfo?.bloco || selectedBloco?.nome || "ENTRADA",
        apartamento: "PORTARIA",
        morador_id: null,
        morador_nome: "Portaria",
        visitante_nome: "Visitante",
        visitante_empresa: null,
        visitante_foto: null,
        nivel_seguranca: 0,
        call_id: newCallId,
      }),
    }).catch(() => {});

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: "portaria-call",
        condominioId: condominioId,
        callId: newCallId,
        visitanteNome: "Visitante",
        bloco: blockInfo?.bloco || selectedBloco?.nome || "ENTRADA",
      }));
    };

    // Timeout after 40 seconds
    setCallingCountdown(40);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCallingCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    timeoutRef.current = setTimeout(() => {
      setCallState("timeout");
      callStateRef.current = "timeout";
      cleanup();
    }, 40000);
  };

  const sendCallRequest = () => {
    if (!wsRef.current || !selectedMorador || !selectedApto) return;
    const newCallId = `CALL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setCallId(newCallId);
    callIdRef.current = newCallId;
    wsRef.current.send(JSON.stringify({
      type: "call-request",
      moradorId: selectedMorador.id,
      callId: newCallId,
      visitanteNome: authForm.nome || "Visitante",
      visitanteEmpresa: authForm.empresa || null,
      visitanteFoto: authForm.foto || null,
      nivelSeguranca: securityLevel,
      bloco: blockInfo?.bloco,
      apartamento: selectedApto.unit,
    }));

    timeoutRef.current = setTimeout(() => {
      setCallState("timeout");
      callStateRef.current = "timeout";
      cleanup();
    }, 60000);
  };

  // Level 2 validation
  const handleNameValidation = () => {
    if (!nameInput.trim()) { setNameError("Digite o nome do morador."); return; }
    // Flexible comparison
    const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const inputNorm = normalize(nameInput);
    const moradorNorm = normalize(selectedMorador?.name || "");
    // Check if first name matches or full name matches
    const firstName = moradorNorm.split(" ")[0];
    if (inputNorm === moradorNorm || inputNorm === firstName || moradorNorm.includes(inputNorm)) {
      startCall(selectedMorador!, selectedApto!);
    } else {
      setNameError("Nome incorreto. Tente novamente.");
    }
  };

  // Level 3 - capture photo
  const handleCapturePhoto = async () => {
    setAuthCapturing(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      if (captureVideoRef.current) {
        captureVideoRef.current.srcObject = stream;
        await captureVideoRef.current.play();
        // Wait a moment then capture
        setTimeout(() => {
          const canvas = document.createElement("canvas");
          canvas.width = 320;
          canvas.height = 240;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(captureVideoRef.current!, 0, 0, 320, 240);
          setAuthForm((prev) => ({ ...prev, foto: compressCanvas(canvas, "face") }));
          stream.getTracks().forEach((t) => t.stop());
          setAuthCapturing(false);
        }, 1500);
      }
    } catch {
      setAuthCapturing(false);
      setError("Não foi possível acessar a câmera.");
    }
  };

  // Level 3 - submit authorization
  const handleAuthSubmit = () => {
    if (!authForm.nome.trim()) { setError("Nome é obrigatório."); return; }
    if (!authForm.empresa.trim()) { setError("Empresa/Motivo é obrigatório."); return; }
    if (!authForm.foto) { setError("Foto é obrigatória."); return; }
    setError("");
    setCallState("auth-pending");
    callStateRef.current = "auth-pending";

    const ws = connectWS();
    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: "auth-request",
        moradorId: selectedMorador!.id,
        callId: `AUTH-${Date.now()}`,
        visitanteNome: authForm.nome,
        visitanteEmpresa: authForm.empresa,
        visitanteFoto: authForm.foto,
      }));
    };

    // Timeout
    timeoutRef.current = setTimeout(() => {
      setCallState("timeout");
      callStateRef.current = "timeout";
    }, 60000);
  };

  // End call
  const handleEndCall = () => {
    wsRef.current?.send(JSON.stringify({ type: "call-end", callId: callIdRef.current }));
    setCallState("ended");
    callStateRef.current = "ended";
    cleanup();
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

  // Reset to apartment selection
  const handleBack = () => {
    setSelectedApto(null);
    setSelectedMorador(null);
    setCallState("idle");
    setNameInput("");
    setNameError("");
    setAuthForm({ nome: "", empresa: "", foto: "" });
    setError("");
    setIsPortariaCall(false);
    setPushSent(false);
    setSearchQuery("");
    cleanup();
  };

  // Back to block selection (condominium-wide mode)
  const handleBackToBlocks = () => {
    setSelectedBloco(null);
    setBlockInfo(null);
    setSelectedApto(null);
    setSelectedMorador(null);
    setCallState("idle");
    setSearchQuery("");
    setError("");
    cleanup();
  };

  // Select a block (condominium-wide mode)
  const handleSelectBlock = (bloco: BlocoInfo) => {
    setSelectedBloco(bloco);
    setBlockInfo({
      condominio: tokenData?.condominio || "",
      condominio_id: tokenData?.condominio_id || 0,
      bloco: bloco.nome,
      apartamentos: bloco.apartamentos,
    });
    setSearchQuery("");
  };

  // ─── RENDER ─────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: p.pageBg }}>
        <div style={{ color: p.text }} className="text-center">
          <div className="mx-auto flex items-center justify-center" style={{ width: 72, height: 72, borderRadius: 22, background: isDark ? "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)" : "linear-gradient(135deg, #e2e8f0, #f1f5f9)", border: isDark ? "2px solid rgba(255,255,255,0.2)" : "2px solid #cbd5e1", marginBottom: 20, boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
            <Loader2 className="animate-spin" style={{ color: p.text, width: 32, height: 32 }} />
          </div>
          <p style={{ fontSize: 16, fontWeight: 600, opacity: 0.9 }}>Carregando interfone...</p>
        </div>
      </div>
    );
  }

  if (error && !blockInfo && !tokenData) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: p.pageBg, padding: 24 }}>
        <div style={{ color: p.text }} className="text-center flex flex-col items-center">
          <div className="mx-auto flex items-center justify-center" style={{ width: 72, height: 72, borderRadius: 22, background: "rgba(239,68,68,0.15)", border: "2px solid rgba(239,68,68,0.4)", marginBottom: 20, boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
            <XCircle style={{ width: 32, height: 32, color: "#fca5a5" }} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>QR Code Inválido</h1>
          <p style={{ fontSize: 14, color: isDark ? "#93c5fd" : "#2563eb" }}>{error}</p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════
  // CALL IN PROGRESS
  // ═══════════════════════════════════
  if (callState === "calling" || callState === "connected" || callState === "gate-opened") {
    return (
      <div className="min-h-dvh flex flex-col items-center" style={{ background: p.pageBg }}>
        <div style={{ color: p.text, padding: "24px 20px" }} className="flex-1 flex flex-col items-center justify-center text-center">
          {/* Hidden video/audio elements */}
          <video ref={videoRef} autoPlay muted playsInline className="hidden" />
          <audio ref={remoteAudioRef} autoPlay playsInline />

          {callState === "gate-opened" ? (
            <>
              <div className="flex items-center justify-center" style={{ width: 88, height: 88, borderRadius: 26, background: "rgba(16,185,129,0.15)", border: "3px solid #10b981", marginBottom: 24, boxShadow: "0 8px 32px rgba(16,185,129,0.25)" }}>
                <DoorOpen style={{ width: 44, height: 44, color: "#34d399" }} />
              </div>
              <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 10 }}>Portão Aberto!</h2>
              <p style={{ fontSize: 15, color: isDark ? "#93c5fd" : "#2563eb" }}>Pode entrar. Bem-vindo!</p>
            </>
          ) : callState === "connected" ? (
            <>
              <div className="flex items-center justify-center animate-pulse" style={{ width: 88, height: 88, borderRadius: 26, background: "rgba(16,185,129,0.15)", border: "3px solid #10b981", marginBottom: 24, boxShadow: "0 8px 32px rgba(16,185,129,0.25)" }}>
                <Phone style={{ width: 44, height: 44, color: "#34d399" }} />
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Em chamada</h2>
              <p style={{ fontSize: 14, color: isDark ? "#93c5fd" : "#2563eb", marginBottom: 6 }}>{isPortariaCall ? "PORTARIA" : `Apto ${selectedApto?.unit}`} — Bloco {blockInfo?.bloco}</p>
              <p className="font-mono" style={{ fontSize: 36, fontWeight: 800, marginBottom: 24 }}>{formatTime(callDuration)}</p>
              <p style={{ fontSize: 13, color: "#7dd3fc", marginBottom: 32 }}>{isPortariaCall ? "A portaria pode ver você pela câmera." : "O morador pode ver você pela câmera."}</p>
            </>
          ) : (
            <>
              <div className="flex items-center justify-center" style={{ width: 88, height: 88, borderRadius: 26, background: p.btnBg, border: isDark ? "3px solid rgba(255,255,255,0.25)" : "3px solid #cbd5e1", marginBottom: 24, boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
                <Phone className="animate-pulse" style={{ width: 44, height: 44, color: p.text }} />
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Chamando...</h2>
              <p style={{ fontSize: 14, color: isDark ? "#93c5fd" : "#2563eb", marginBottom: 6 }}>{isPortariaCall ? "PORTARIA" : `Apto ${selectedApto?.unit}`} — Bloco {blockInfo?.bloco}</p>
              <p style={{ fontSize: 13, color: "#7dd3fc", marginTop: 8 }}>{isPortariaCall ? "Aguardando a portaria atender" : "Aguardando o morador atender"}</p>
              {pushSent && (
                <p style={{ fontSize: 12, color: "#fbbf24", marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  📲 Notificação enviada ao morador
                </p>
              )}
              <p className="font-mono" style={{ fontSize: 28, fontWeight: 800, marginTop: 16, color: p.text }}>{formatTime(callingCountdown)}</p>
            </>
          )}

          {/* Call controls */}
          <div className="flex" style={{ gap: 20, marginTop: 36 }}>
            <button
              onClick={handleToggleMute}
              className="flex items-center justify-center"
              style={{ width: 64, height: 64, borderRadius: 20, background: isMuted ? "#ef4444" : "rgba(255,255,255,0.12)", border: isDark ? "2px solid rgba(255,255,255,0.2)" : "2px solid #cbd5e1", boxShadow: "0 4px 14px rgba(0,0,0,0.2)", cursor: "pointer", transition: "transform 0.15s" }}
              onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.93)"; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
            >
              {isMuted ? <MicOff style={{ width: 26, height: 26, color: p.text }} /> : <Mic style={{ width: 26, height: 26, color: p.text }} />}
            </button>
            <button
              onClick={handleEndCall}
              className="flex items-center justify-center"
              style={{ width: 64, height: 64, borderRadius: 20, background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)", border: isDark ? "2px solid rgba(255,255,255,0.2)" : "2px solid #cbd5e1", boxShadow: "0 4px 14px rgba(239,68,68,0.4)", cursor: "pointer", transition: "transform 0.15s" }}
              onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.93)"; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
            >
              <PhoneOff style={{ width: 26, height: 26, color: p.text }} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════
  // STATUS SCREENS (rejected, timeout, etc)
  // ═══════════════════════════════════
  if (callState === "rejected" || callState === "timeout" || callState === "unavailable" || callState === "ended") {
    const messages: Record<string, { icon: typeof XCircle; color: string; title: string; desc: string }> = {
      rejected: { icon: XCircle, color: "#ef4444", title: "Chamada Recusada", desc: "O morador não aceitou a chamada." },
      timeout: { icon: Clock, color: "#f59e0b", title: "Sem Resposta", desc: "O morador não atendeu. Tente novamente." },
      unavailable: { icon: PhoneOff, color: "#64748b", title: "Morador Indisponível", desc: "O morador não está online no momento." },
      ended: { icon: Phone, color: "#003580", title: "Chamada Encerrada", desc: callDuration > 0 ? `Duração: ${formatTime(callDuration)}` : "A chamada foi finalizada." },
    };
    const m = messages[callState];
    const Icon = m.icon;

    // Build WhatsApp link if morador has whatsapp enabled
    const whatsappNumber = selectedMorador?.whatsapp;
    const whatsappLink = whatsappNumber
      ? `https://wa.me/55${whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent(
          `Olá! Sou visitante no ${blockInfo?.condominio || "condomínio"}, Bloco ${blockInfo?.bloco || ""}, Apto ${selectedApto?.unit || ""}. Tentei ligar pelo interfone mas não consegui contato.`
        )}`
      : null;

    return (
      <div className="min-h-dvh flex flex-col items-center justify-center" style={{ background: p.pageBg, padding: 24 }}>
        <div style={{ color: p.text, gap: 20 }} className="text-center flex flex-col items-center">
          <div className="flex items-center justify-center" style={{ width: 76, height: 76, borderRadius: 24, background: `${m.color}18`, border: `3px solid ${m.color}`, boxShadow: `0 8px 32px ${m.color}30` }}>
            <Icon style={{ width: 36, height: 36, color: m.color }} />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800 }}>{m.title}</h2>
          <p style={{ fontSize: 15, color: isDark ? "#93c5fd" : "#2563eb" }}>{m.desc}</p>
          <button
            onClick={handleBack}
            className="font-bold"
            style={{
              background: "#fff",
              color: "#003580",
              paddingLeft: 68,
              paddingRight: 68,
              paddingTop: 22,
              paddingBottom: 22,
              borderRadius: 18,
              fontSize: 15,
              border: "none",
              boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
              cursor: "pointer",
              transition: "transform 0.15s",
            }}
            onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.97)"; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
          >
            Tentar Novamente
          </button>
          {whatsappLink && callState !== "ended" && (
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold flex items-center justify-center no-underline"
              style={{
                background: "linear-gradient(135deg, #25d366 0%, #1da851 100%)",
                border: "3px solid #ffffff",
                color: p.text,
                paddingLeft: 68,
                paddingRight: 68,
                paddingTop: 22,
                paddingBottom: 22,
                borderRadius: 18,
                fontSize: 15,
                gap: 12,
                textDecoration: "none",
                boxShadow: "0 4px 14px rgba(37,211,102,0.35)",
                transition: "transform 0.15s",
              }}
            >
              <svg viewBox="0 0 24 24" fill="white" width="22" height="22">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Tentar pelo WhatsApp
            </a>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════
  // AUTH PENDING (Level 3)
  // ═══════════════════════════════════
  if (callState === "auth-pending") {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center" style={{ background: p.pageBg, padding: 24 }}>
        <div style={{ color: p.text }} className="text-center flex flex-col items-center">
          <div className="mx-auto flex items-center justify-center" style={{ width: 80, height: 80, borderRadius: 24, background: p.btnBg, border: isDark ? "2px solid rgba(255,255,255,0.2)" : "2px solid #cbd5e1", marginBottom: 24, boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
            <Loader2 className="animate-spin" style={{ width: 36, height: 36, color: p.text }} />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>Aguardando Autorização</h2>
          <p style={{ fontSize: 15, color: isDark ? "#93c5fd" : "#2563eb" }}>O morador está analisando seus dados...</p>
          <p style={{ fontSize: 13, color: "#7dd3fc", marginTop: 8 }}>Apto {selectedApto?.unit} — Bloco {blockInfo?.bloco}</p>
          <button
            onClick={handleBack}
            className="font-bold"
            style={{ marginTop: 36, padding: "14px 32px", borderRadius: 16, fontSize: 14, background: isDark ? "rgba(255,255,255,0.12)" : "#f0f4f8", border: isDark ? "2px solid rgba(255,255,255,0.25)" : "2px solid #cbd5e1", color: p.text, cursor: "pointer", boxShadow: "0 4px 14px rgba(0,0,0,0.15)", transition: "transform 0.15s" }}
            onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.96)"; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════
  // SECURITY FORM (Level 2 or 3)
  // ═══════════════════════════════════
  if (callState === "security") {
    return (
      <div className="min-h-dvh flex flex-col items-center" style={{ background: p.pageBg }}>
        <div className="flex-1 flex flex-col items-center justify-center" style={{ padding: "24px 20px" }}>
          <div className="w-full rounded-3xl" style={{ maxWidth: 480, padding: "40px 32px 32px", background: "#fff", boxShadow: "0 25px 60px rgba(0,0,0,0.35), 0 8px 20px rgba(0,0,0,0.15)" }}>
            {/* Header */}
            <div className="text-center" style={{ marginBottom: 32 }}>
              <div className="mx-auto flex items-center justify-center" style={{ width: 64, height: 64, borderRadius: 20, background: "linear-gradient(135deg, #003580 0%, #0056d2 100%)", marginBottom: 16, boxShadow: "0 4px 14px rgba(0,53,128,0.35)" }}>
                <Shield className="text-white" style={{ width: 32, height: 32 }} />
              </div>
              <h2 className="font-bold" style={{ fontSize: 24, color: "#003580", marginBottom: 6 }}>Verificação de Segurança</h2>
              <p style={{ fontSize: 14, color: "#64748b", fontWeight: 500 }}>
                Apto {selectedApto?.unit} — Bloco {blockInfo?.bloco}
              </p>
            </div>

            {securityLevel === 2 && (
              <>
                <p style={{ fontSize: 15, color: "#475569", marginBottom: 16 }}>
                  Para ligar, confirme o nome do morador:
                </p>
                <input
                  type="text"
                  placeholder="Nome do morador"
                  value={nameInput}
                  onChange={(e) => { setNameInput(e.target.value); setNameError(""); }}
                  className="w-full"
                  style={{
                    padding: "16px 20px",
                    borderRadius: 16,
                    border: `2px solid ${nameError ? "#ef4444" : "#e2e8f0"}`,
                    fontSize: 15,
                    outline: "none",
                    transition: "border-color 0.2s",
                    background: "#f8fafc",
                  }}
                  onFocus={(e) => { if (!nameError) e.currentTarget.style.borderColor = "#003580"; }}
                  onBlur={(e) => { if (!nameError) e.currentTarget.style.borderColor = "#e2e8f0"; }}
                />
                {nameError && <p className="text-red-500" style={{ fontSize: 13, marginTop: 8, fontWeight: 500 }}>{nameError}</p>}
                <button
                  onClick={handleNameValidation}
                  className="w-full text-white font-bold"
                  style={{
                    marginTop: 20,
                    padding: "18px 24px",
                    borderRadius: 16,
                    fontSize: 16,
                    background: "linear-gradient(135deg, #003580 0%, #0056d2 100%)",
                    border: "none",
                    boxShadow: "0 4px 14px rgba(0,53,128,0.35)",
                    cursor: "pointer",
                    transition: "transform 0.15s, box-shadow 0.15s",
                  }}
                  onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.98)"; }}
                  onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                >
                  Confirmar e Ligar
                </button>
              </>
            )}

            {securityLevel === 3 && (
              <>
                <p style={{ fontSize: 15, color: "#475569", marginBottom: 20 }}>
                  O morador requer identificação completa:
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  <div>
                    <label className="font-bold" style={{ fontSize: 13, color: "#003580" }}>Seu Nome *</label>
                    <input
                      type="text"
                      placeholder="Nome completo"
                      value={authForm.nome}
                      onChange={(e) => setAuthForm({ ...authForm, nome: e.target.value })}
                      className="w-full"
                      style={{ padding: "14px 18px", borderRadius: 14, border: "2px solid #e2e8f0", fontSize: 15, marginTop: 6, outline: "none", background: "#f8fafc" }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = "#003580"; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; }}
                    />
                  </div>
                  <div>
                    <label className="font-bold" style={{ fontSize: 13, color: "#003580" }}>Empresa / Motivo *</label>
                    <input
                      type="text"
                      placeholder="Ex: Visita familiar, Entrega, Manutenção"
                      value={authForm.empresa}
                      onChange={(e) => setAuthForm({ ...authForm, empresa: e.target.value })}
                      className="w-full"
                      style={{ padding: "14px 18px", borderRadius: 14, border: "2px solid #e2e8f0", fontSize: 15, marginTop: 6, outline: "none", background: "#f8fafc" }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = "#003580"; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; }}
                    />
                  </div>
                  <div>
                    <label className="font-bold" style={{ fontSize: 13, color: "#003580" }}>Foto do Rosto *</label>
                    {authForm.foto ? (
                      <div className="flex items-center gap-3" style={{ marginTop: 8 }}>
                        <img src={authForm.foto} alt="Foto" className="object-cover" style={{ width: 72, height: 72, borderRadius: 16, border: "3px solid #22c55e" }} />
                        <CheckCircle2 className="text-green-500" style={{ width: 24, height: 24 }} />
                        <button
                          onClick={() => setAuthForm({ ...authForm, foto: "" })}
                          className="text-red-500 font-bold"
                          style={{ fontSize: 14 }}
                        >
                          Refazer
                        </button>
                      </div>
                    ) : (
                      <>
                        <video ref={captureVideoRef} autoPlay playsInline muted className={authCapturing ? "w-full" : "hidden"} style={{ borderRadius: 16, marginTop: 6 }} />
                        <button
                          onClick={handleCapturePhoto}
                          disabled={authCapturing}
                          className="w-full font-bold flex items-center justify-center gap-2"
                          style={{ marginTop: 6, padding: "14px 18px", borderRadius: 14, fontSize: 15, background: "#f8fafc", border: "2px dashed #003580", color: "#003580", cursor: "pointer" }}
                        >
                          <Camera style={{ width: 18, height: 18 }} />
                          {authCapturing ? "Capturando..." : "Tirar Foto"}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {error && <p className="text-red-500" style={{ fontSize: 13, marginTop: 12, fontWeight: 500 }}>{error}</p>}

                <button
                  onClick={handleAuthSubmit}
                  className="w-full text-white font-bold"
                  style={{
                    marginTop: 24,
                    padding: "18px 24px",
                    borderRadius: 16,
                    fontSize: 16,
                    background: "linear-gradient(135deg, #003580 0%, #0056d2 100%)",
                    border: "none",
                    boxShadow: "0 4px 14px rgba(0,53,128,0.35)",
                    cursor: "pointer",
                    transition: "transform 0.15s, box-shadow 0.15s",
                  }}
                  onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.98)"; }}
                  onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                >
                  Enviar e Solicitar Chamada
                </button>
              </>
            )}

            <button
              onClick={handleBack}
              className="w-full font-medium"
              style={{ marginTop: 16, padding: "14px", borderRadius: 14, fontSize: 14, color: "#64748b", background: "transparent", border: "none", cursor: "pointer", transition: "color 0.15s" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#003580"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#64748b"; }}
            >
              ← Voltar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════
  // MORADOR SELECTION (multi-morador apartment)
  // ═══════════════════════════════════
  if (selectedApto && selectedApto.moradores.length > 1 && !selectedMorador) {
    return (
      <div className="min-h-dvh flex flex-col items-center" style={{ background: p.pageBg }}>
        {/* Header */}
        <div className="text-center w-full" style={{ color: p.text, maxWidth: 480, paddingTop: 48, paddingBottom: 24, paddingLeft: 24, paddingRight: 24 }}>
          <div className="mx-auto flex items-center justify-center" style={{ width: 64, height: 64, borderRadius: 20, background: isDark ? "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)" : "linear-gradient(135deg, #e2e8f0, #f1f5f9)", border: isDark ? "2px solid rgba(255,255,255,0.2)" : "2px solid #cbd5e1", marginBottom: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }}>
            <User style={{ width: 28, height: 28, color: p.text }} />
          </div>
          <p style={{ fontSize: 14, color: isDark ? "#93c5fd" : "#2563eb", marginBottom: 4 }}>{blockInfo?.condominio}</p>
          <h1 style={{ fontSize: 26, fontWeight: 800 }}>Apto {selectedApto.unit}</h1>
          <p style={{ fontSize: 14, color: isDark ? "#93c5fd" : "#2563eb", marginTop: 4 }}>Bloco {blockInfo?.bloco}</p>
        </div>

        <div className="flex-1 w-full" style={{ maxWidth: 480, paddingLeft: 24, paddingRight: 24, paddingBottom: 24 }}>
          <p className="text-center" style={{ fontSize: 15, color: isDark ? "#93c5fd" : "#2563eb", marginBottom: 20 }}>Para quem deseja ligar?</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {selectedApto.moradores.map((m) => (
              <button
                key={m.id}
                onClick={() => handleSelectMorador(m)}
                className="w-full flex items-center text-left"
                style={{ gap: 14, padding: "18px 20px", borderRadius: 18, background: p.btnBg, border: isDark ? "2px solid rgba(255,255,255,0.18)" : "2px solid #cbd5e1", cursor: "pointer", transition: "all 0.15s", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.14)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.35)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; }}
              >
                <div className="flex items-center justify-center" style={{ width: 48, height: 48, borderRadius: 16, background: isDark ? "rgba(255,255,255,0.12)" : "#f0f4f8", flexShrink: 0 }}>
                  <User style={{ width: 22, height: 22, color: p.text }} />
                </div>
                <span style={{ fontWeight: 700, fontSize: 15, color: p.text }}>{m.name}</span>
                <Phone style={{ width: 18, height: 18, color: isDark ? "#93c5fd" : "#2563eb", marginLeft: "auto" }} />
              </button>
            ))}
          </div>
          <button
            onClick={handleBack}
            className="block mx-auto font-medium"
            style={{ marginTop: 28, fontSize: 14, color: "#7dd3fc", background: "none", border: "none", cursor: "pointer", transition: "color 0.15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "#7dd3fc"; }}
          >
            ← Voltar para apartamentos
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════
  // BLOCK SELECTION (condominium-wide QR)
  // ═══════════════════════════════════
  if (tokenData?.tipo === "condominio" && !selectedBloco) {
    const condoData = tokenData as CondoTokenData;
    const normalizeSearch = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const query = normalizeSearch(searchQuery);

    // Filter blocks by search — also match apartment numbers inside blocks
    const filteredBlocos = query
      ? condoData.blocos.filter(b => {
          const nomeNorm = normalizeSearch(b.nome);
          if (nomeNorm.includes(query) || query.includes(nomeNorm)) return true;
          // If query contains "bloco" prefix, extract the rest
          const afterBloco = query.replace(/^bloco\s*/i, "");
          if (afterBloco && nomeNorm.includes(afterBloco)) return true;
          // Check if any unit matches
          return b.apartamentos.some(a => normalizeSearch(a.unit).includes(query));
        })
      : condoData.blocos;

    return (
      <div className="min-h-dvh flex flex-col items-center" style={{ background: p.pageBg }}>
        {/* Header */}
        <div className="text-center w-full" style={{ color: p.text, maxWidth: 520, paddingTop: 44, paddingBottom: 18, paddingLeft: 24, paddingRight: 24 }}>
          <AppLogo
            size={68}
            rounded={22}
            background={isDark ? "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)" : "linear-gradient(135deg, #e2e8f0, #f1f5f9)"}
            border={isDark ? "2px solid rgba(255,255,255,0.2)" : "2px solid #cbd5e1"}
            style={{ margin: "0 auto 16px", boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }}
          />
          <p style={{ fontSize: 13, color: isDark ? "#93c5fd" : "#2563eb", marginBottom: 4 }}>Interfone Digital</p>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>{condoData.condominio}</h1>
          <p style={{ fontSize: 13, color: "#7dd3fc", marginTop: 6 }}>{condoData.blocos.length} blocos disponíveis</p>
        </div>

        {/* PORTARIA Button */}
        <div className="w-full" style={{ maxWidth: 520, paddingLeft: 24, paddingRight: 24, marginBottom: 10 }}>
          <button
            onClick={startPortariaCall}
            className="w-full flex items-center"
            style={{
              gap: 16,
              padding: "18px 20px",
              borderRadius: 20,
              background: "linear-gradient(135deg, #00c853 0%, #00a63e 100%)",
              border: "3px solid #ffffff",
              boxShadow: "0 8px 32px rgba(0,200,83,0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
              minHeight: 80,
              cursor: "pointer",
              transition: "transform 0.15s, box-shadow 0.15s",
            }}
            onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.98)"; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
          >
            <Headphones className="text-white shrink-0 animate-pulse" style={{ width: 28, height: 28, marginLeft: 12 }} />
            <div className="flex-1 text-left">
              <span style={{ fontSize: 17, fontWeight: 800, color: p.text, letterSpacing: "0.03em", display: "block" }}>PORTARIA</span>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 2 }}>Clique aqui para falar com o porteiro / zelador</p>
            </div>
            <Phone className="text-white animate-pulse" style={{ width: 22, height: 22, marginRight: 12 }} />
          </button>
        </div>

        {/* Divider */}
        <div className="w-full" style={{ maxWidth: 520, paddingLeft: 24, paddingRight: 24, marginBottom: 16 }}>
          <div className="flex items-center" style={{ gap: 12 }}>
            <div className="flex-1" style={{ height: 1, background: isDark ? "rgba(255,255,255,0.12)" : "#f0f4f8" }} />
            <span style={{ fontSize: 12, color: "#7dd3fc", fontWeight: 600 }}>ou escolha o bloco</span>
            <div className="flex-1" style={{ height: 1, background: isDark ? "rgba(255,255,255,0.12)" : "#f0f4f8" }} />
          </div>
        </div>

        {/* Search Bar */}
        <div className="w-full" style={{ maxWidth: 520, paddingLeft: 24, paddingRight: 24, marginBottom: 16 }}>
          <div className="relative">
            <Search className="absolute top-1/2 -translate-y-1/2 text-gray-400" style={{ left: 20, width: 18, height: 18 }} />
            <input
              type="text"
              placeholder="Buscar bloco ou apartamento..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full outline-none"
              style={{ padding: "16px 44px 16px 50px", borderRadius: 16, fontSize: 15, background: "#ffffff", border: isDark ? "2px solid rgba(255,255,255,0.15)" : "2px solid #cbd5e1", color: "#1e293b", boxShadow: "0 4px 14px rgba(0,0,0,0.1)", transition: "border-color 0.2s" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.5)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute top-1/2 -translate-y-1/2"
                style={{ right: 16, fontSize: 14, fontWeight: 700, color: "#94a3b8", background: "none", border: "none", cursor: "pointer" }}
              >✕</button>
            )}
          </div>
        </div>

        {/* Block List */}
        <div className="flex-1 overflow-auto w-full" style={{ maxWidth: 520, paddingLeft: 24, paddingRight: 24, paddingBottom: 24 }}>
          {filteredBlocos.length > 0 ? (
            <div className="grid grid-cols-2" style={{ gap: 14 }}>
              {filteredBlocos.map((bloco) => (
                <button
                  key={bloco.id}
                  onClick={() => handleSelectBlock(bloco)}
                  className="flex items-center text-left"
                  style={{
                    gap: 12,
                    padding: "16px 14px",
                    borderRadius: 18,
                    background: isDark ? "rgba(255,255,255,0.07)" : "#f8fafc",
                    border: isDark ? "2px solid rgba(255,255,255,0.18)" : "2px solid #cbd5e1",
                    minHeight: 80,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.14)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.35)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.15)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)"; }}
                >
                  <div className="flex items-center justify-center shrink-0" style={{ width: 44, height: 44, borderRadius: 14, background: "rgba(255,255,255,0.1)" }}>
                    <Building2 style={{ width: 22, height: 22, color: p.text }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block" style={{ fontSize: 14, fontWeight: 700, color: p.text }}>Bloco {bloco.nome}</span>
                    <span style={{ fontSize: 12, color: isDark ? "#93c5fd" : "#2563eb" }}>
                      {bloco.apartamentos.length} {bloco.apartamentos.length === 1 ? "apto" : "aptos"}
                    </span>
                  </div>
                  <ChevronRight className="shrink-0" style={{ width: 18, height: 18, color: "#7dd3fc" }} />
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center" style={{ paddingTop: 48 }}>
              <div className="mx-auto flex items-center justify-center" style={{ width: 56, height: 56, borderRadius: 18, background: p.btnBg, marginBottom: 16 }}>
                <Search style={{ width: 24, height: 24, color: "#7dd3fc" }} />
              </div>
              <p style={{ fontSize: 14, color: isDark ? "#93c5fd" : "#2563eb" }}>Nenhum bloco encontrado para "{searchQuery}"</p>
              <button
                onClick={() => setSearchQuery("")}
                style={{ fontSize: 13, color: "#7dd3fc", marginTop: 10, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
              >
                Limpar busca
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center" style={{ paddingBottom: 24 }}>
          <p style={{ fontSize: 12, color: "#4b7dc7", fontWeight: 500, letterSpacing: "0.03em" }}>Interfone Digital — App Interfone</p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════
  // APARTMENT LIST (main screen)
  // ═══════════════════════════════════

  // Filter apartments by search query
  const aptoSearchNorm = searchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const filteredApartments = aptoSearchNorm && blockInfo
    ? blockInfo.apartamentos.filter(a => {
        const unitNorm = a.unit.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (unitNorm.includes(aptoSearchNorm)) return true;
        // Also search by morador name
        return a.moradores.some(m =>
          m.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(aptoSearchNorm)
        );
      })
    : blockInfo?.apartamentos || [];

  const isCondoMode = tokenData?.tipo === "condominio";

  return (
    <div className="min-h-dvh flex flex-col items-center" style={{ background: p.pageBg }}>
      {/* Header */}
      <div className="text-center w-full" style={{ color: p.text, maxWidth: 520, paddingTop: 44, paddingBottom: 18, paddingLeft: 24, paddingRight: 24 }}>
        <div className="mx-auto flex items-center justify-center" style={{ width: 68, height: 68, borderRadius: 22, background: isDark ? "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)" : "linear-gradient(135deg, #e2e8f0, #f1f5f9)", border: isDark ? "2px solid rgba(255,255,255,0.2)" : "2px solid #cbd5e1", marginBottom: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }}>
          <Phone style={{ width: 30, height: 30, color: p.text }} />
        </div>
        <p style={{ fontSize: 14, color: isDark ? "#93c5fd" : "#2563eb", marginBottom: 4 }}>{blockInfo?.condominio}</p>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: p.text }}>Bloco {blockInfo?.bloco}</h1>
        <p style={{ fontSize: 14, color: isDark ? "#93c5fd" : "#2563eb", marginTop: 8 }}>
          {blockInfo?.apartamentos.length} aptos — Escolha para ligar
        </p>
      </div>

      {error && (
        <div className="w-full" style={{ maxWidth: 520, paddingLeft: 24, paddingRight: 24, marginBottom: 16 }}>
          <div style={{ padding: "14px 18px", borderRadius: 16, background: "rgba(239,68,68,0.12)", border: "2px solid rgba(239,68,68,0.25)" }}>
            <p className="text-center" style={{ fontSize: 14, color: "#fca5a5" }}>{error}</p>
          </div>
        </div>
      )}

      {/* Apartments Area */}
      <div className="flex-1 w-full" style={{ maxWidth: 520, paddingLeft: 24, paddingRight: 24, paddingBottom: 24 }}>
        {/* ═══ PORTARIA BUTTON ═══ */}
        <div style={{ marginBottom: 10 }}>
          <button
            onClick={startPortariaCall}
            className="w-full flex items-center"
            style={{
              gap: 16,
              padding: "18px 20px",
              borderRadius: 20,
              background: "linear-gradient(135deg, #00c853 0%, #00a63e 100%)",
              border: "3px solid #ffffff",
              boxShadow: "0 8px 32px rgba(0,200,83,0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
              minHeight: 80,
              cursor: "pointer",
              transition: "transform 0.15s, box-shadow 0.15s",
            }}
            onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.98)"; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
          >
            <Headphones className="text-white shrink-0 animate-pulse" style={{ width: 28, height: 28, marginLeft: 12 }} />
            <div className="flex-1 text-left">
              <span style={{ fontSize: 17, fontWeight: 800, color: p.text, letterSpacing: "0.03em", display: "block" }}>PORTARIA</span>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 2 }}>Clique aqui para falar com o porteiro / zelador</p>
            </div>
            <Phone className="text-white animate-pulse" style={{ width: 22, height: 22, marginRight: 12 }} />
          </button>
        </div>

        {/* ═══ Divider ═══ */}
        <div className="flex items-center" style={{ gap: 12, marginBottom: 16 }}>
          <div className="flex-1" style={{ height: 1, background: isDark ? "rgba(255,255,255,0.12)" : "#f0f4f8" }} />
          <span style={{ fontSize: 12, color: "#7dd3fc", fontWeight: 600 }}>ou escolha um apartamento</span>
          <div className="flex-1" style={{ height: 1, background: isDark ? "rgba(255,255,255,0.12)" : "#f0f4f8" }} />
        </div>

        {/* ═══ Search Bar (shown when >8 apartments) ═══ */}
        {blockInfo && blockInfo.apartamentos.length > 8 && (
          <div className="relative" style={{ marginBottom: 16 }}>
            <Search className="absolute top-1/2 -translate-y-1/2 text-gray-400" style={{ left: 20, width: 18, height: 18 }} />
            <input
              type="text"
              placeholder="Buscar apartamento ou morador..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full outline-none"
              style={{ padding: "16px 44px 16px 50px", borderRadius: 16, fontSize: 15, background: "#ffffff", border: isDark ? "2px solid rgba(255,255,255,0.15)" : "2px solid #cbd5e1", color: "#1e293b", boxShadow: "0 4px 14px rgba(0,0,0,0.1)", transition: "border-color 0.2s" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.5)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute top-1/2 -translate-y-1/2"
                style={{ right: 16, fontSize: 14, fontWeight: 700, color: "#94a3b8", background: "none", border: "none", cursor: "pointer" }}
              >✕</button>
            )}
          </div>
        )}

        {filteredApartments.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3" style={{ gap: 14 }}>
            {filteredApartments.map((apto) => (
              <button
                key={apto.unit}
                onClick={() => handleSelectApto(apto)}
                className="flex flex-col items-center justify-center"
                style={{
                  padding: "18px 12px",
                  borderRadius: 18,
                  background: isDark ? "rgba(255,255,255,0.07)" : "#f8fafc",
                  border: isDark ? "2px solid rgba(255,255,255,0.18)" : "2px solid #cbd5e1",
                  minHeight: 80,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.14)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.35)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.15)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)"; }}
              >
                <span style={{ fontSize: 24, fontWeight: 800, color: p.text }}>{apto.unit}</span>
                <span style={{ fontSize: 11, color: isDark ? "#93c5fd" : "#2563eb", marginTop: 4 }}>
                  {apto.moradores.length} {apto.moradores.length === 1 ? "morador" : "moradores"}
                </span>
              </button>
            ))}
          </div>
        ) : searchQuery ? (
          <div className="text-center" style={{ paddingTop: 32 }}>
            <div className="mx-auto flex items-center justify-center" style={{ width: 48, height: 48, borderRadius: 16, background: p.btnBg, marginBottom: 12 }}>
              <Search style={{ width: 22, height: 22, color: "#7dd3fc" }} />
            </div>
            <p style={{ fontSize: 14, color: isDark ? "#93c5fd" : "#2563eb" }}>Nenhum apartamento encontrado</p>
            <button
              onClick={() => setSearchQuery("")}
              style={{ fontSize: 13, color: "#7dd3fc", marginTop: 10, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
            >
              Limpar busca
            </button>
          </div>
        ) : (
          <div className="text-center" style={{ paddingTop: 48 }}>
            <div className="mx-auto flex items-center justify-center" style={{ width: 56, height: 56, borderRadius: 18, background: p.btnBg, marginBottom: 16 }}>
              <Building2 style={{ width: 24, height: 24, color: "#7dd3fc" }} />
            </div>
            <p style={{ fontSize: 14, color: isDark ? "#93c5fd" : "#2563eb" }}>Nenhum morador cadastrado neste bloco.</p>
          </div>
        )}

        {/* Back to blocks button (condominium mode) */}
        {isCondoMode && (
          <button
            onClick={handleBackToBlocks}
            className="block mx-auto font-bold"
            style={{ marginTop: 36, fontSize: 15, color: "#7dd3fc", background: "none", border: "none", cursor: "pointer", transition: "color 0.15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "#7dd3fc"; }}
          >
            ← Voltar para Blocos
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="text-center" style={{ paddingBottom: 24 }}>
        <p style={{ fontSize: 12, color: "#4b7dc7", fontWeight: 500, letterSpacing: "0.03em" }}>Interfone Digital — App Interfone</p>
      </div>
    </div>
  );
}
