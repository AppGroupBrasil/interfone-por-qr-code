import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { compressCanvas } from "@/lib/imageUtils";
import {
  User,
  Camera,
  FileText,
  Phone,
  CheckCircle2,
  XCircle,
  Loader2,
  ShieldCheck,
  Building,
  Calendar,
  Clock,
  ScanFace,
  Image,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface PreAuth {
  id: number;
  morador_name: string;
  bloco: string | null;
  apartamento: string | null;
  visitante_nome: string;
  visitante_documento: string | null;
  visitante_telefone: string | null;
  visitante_foto: string | null;
  data_inicio: string;
  data_fim: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  observacao: string | null;
  status: string;
}

const API = "/api";

export default function AutoCadastroPreAuth() {
  const { token } = useParams<{ token: string }>();
  const [auth, setAuth] = useState<PreAuth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [nome, setNome] = useState("");
  const [documento, setDocumento] = useState("");
  const [telefone, setTelefone] = useState("");
  const [foto, setFoto] = useState("");
  const [documentoFoto, setDocumentoFoto] = useState("");

  // Face recognition (server-side — browser só captura foto)
  const [showCamera, setShowCamera] = useState(false);
  const [faceDetecting, setFaceDetecting] = useState(false);
  const [faceStatus, setFaceStatus] = useState<"idle" | "scanning" | "captured">("idle");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Document camera
  const [showDocCamera, setShowDocCamera] = useState(false);
  const docVideoRef = useRef<HTMLVideoElement>(null);
  const docStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    fetchAuth();
    return () => {
      stopCamera();
      stopDocCamera();
    };
  }, [token]);

  const fetchAuth = async () => {
    try {
      const res = await apiFetch(`${API}/pre-authorizations/auto-cadastro/${token}`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Link inválido ou expirado.");
        return;
      }
      const data = await res.json();
      setAuth(data);
      setNome(data.visitante_nome || "");
      setDocumento(data.visitante_documento || "");
      setTelefone(data.visitante_telefone || "");
      setFoto(data.visitante_foto || "");
    } catch {
      setError("Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  };

  const formatPhone = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits.length ? `(${digits}` : "";
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  };

  // ─── Face Recognition (server-side) ─────────────────────
  const startCamera = async () => {
    setShowCamera(true);
    setFaceStatus("idle");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      // Auto-start capture after 1s (simple photo capture, no ML in browser)
      setTimeout(() => startFaceCapture(), 1000);
    } catch {
      alert("Não foi possível acessar a câmera.");
      setShowCamera(false);
    }
  };

  const startFaceCapture = () => {
    setFaceStatus("scanning");
    setFaceDetecting(true);

    // Capture a photo after a short delay so user can position their face
    detectIntervalRef.current = setInterval(() => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;

      // Capture photo from video
      const capCanvas = document.createElement("canvas");
      capCanvas.width = videoRef.current.videoWidth;
      capCanvas.height = videoRef.current.videoHeight;
      const ctx = capCanvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        setFoto(compressCanvas(capCanvas, "face"));
      }

      // Stop capture
      if (detectIntervalRef.current) {
        clearInterval(detectIntervalRef.current);
        detectIntervalRef.current = null;
      }
      setFaceDetecting(false);
      setFaceStatus("captured");

      // Stop camera after capture
      setTimeout(() => {
        stopCameraStream();
        setShowCamera(false);
      }, 800);
    }, 2000);
  };

  const stopCameraStream = () => {
    if (detectIntervalRef.current) {
      clearInterval(detectIntervalRef.current);
      detectIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setFaceDetecting(false);
  };

  const stopCamera = () => {
    stopCameraStream();
    setShowCamera(false);
    setFaceStatus("idle");
  };

  // ─── Document Photo ────────────────────────────────────
  const startDocCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      docStreamRef.current = stream;
      if (docVideoRef.current) {
        docVideoRef.current.srcObject = stream;
      }
      setShowDocCamera(true);
    } catch {
      alert("Não foi possível acessar a câmera.");
    }
  };

  const stopDocCamera = () => {
    if (docStreamRef.current) {
      docStreamRef.current.getTracks().forEach((t) => t.stop());
      docStreamRef.current = null;
    }
    setShowDocCamera(false);
  };

  const captureDoc = () => {
    if (!docVideoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = docVideoRef.current.videoWidth;
    canvas.height = docVideoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(docVideoRef.current, 0, 0);
      setDocumentoFoto(compressCanvas(canvas, "document"));
      stopDocCamera();
    }
  };

  // ─── Submit ────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!nome.trim()) return alert("Preencha seu nome.");
    setSubmitting(true);
    try {
      const res = await apiFetch(`${API}/pre-authorizations/auto-cadastro/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitante_nome: nome,
          visitante_documento: documento,
          visitante_telefone: telefone,
          visitante_foto: foto,
          documento_foto: documentoFoto,
          face_descriptor: null,
        }),
      });
      if (res.ok) {
        setSuccess(true);
      } else {
        const data = await res.json();
        alert(data.error || "Erro ao salvar dados.");
      }
    } catch {
      alert("Erro de conexão.");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Render States ─────────────────────────────────────
  if (loading) {
    return (
      <div role="status" aria-live="polite" className="min-h-dvh flex items-center justify-center" style={{ background: "#f8fafc" }}>
        <Loader2 aria-hidden="true" className="w-8 h-8 animate-spin" style={{ color: "#6366f1" }} />
        <span className="sr-only">Carregando…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="min-h-dvh flex flex-col items-center justify-center px-6" style={{ background: "#f8fafc" }}>
        <XCircle aria-hidden="true" className="w-16 h-16 mb-4" style={{ color: "#ef4444" }} />
        <h1 className="text-xl font-bold text-foreground mb-2">Link Inválido</h1>
        <p className="text-sm text-muted-foreground text-center">{error}</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6" style={{ background: "#f0fdf4" }}>
        <CheckCircle2 className="w-16 h-16 mb-4" style={{ color: "#16a34a" }} />
        <h1 className="text-xl font-bold text-foreground mb-2">Cadastro Realizado!</h1>
        <p className="text-sm text-muted-foreground text-center">
          Seus dados foram enviados com sucesso.
          {foto && " Sua foto foi registrada."}
          {" "}A portaria já pode verificar sua entrada.
        </p>
        {auth && (
          <div
            className="mt-6 rounded-xl w-full max-w-sm"
            style={{ padding: "16px", backgroundColor: "#fff", border: "1px solid #e5e7eb" }}
          >
            <p className="text-xs text-muted-foreground mb-1">Destino</p>
            <p className="text-sm font-bold text-foreground">
              {auth.bloco} — Apt {auth.apartamento}
            </p>
            <p className="text-xs text-muted-foreground mt-2">Morador</p>
            <p className="text-sm font-medium text-foreground">{auth.morador_name}</p>
            <p className="text-xs text-muted-foreground mt-2">Período</p>
            <p className="text-sm text-foreground">
              {formatDate(auth.data_inicio)} a {formatDate(auth.data_fim)}
              {auth.hora_inicio && ` · ${auth.hora_inicio} às ${auth.hora_fim}`}
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-dvh" style={{ background: "#f8fafc" }}>
      {/* Header */}
      <header
        className="text-white px-4 py-6 text-center"
        style={{ background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)" }}
      >
        <div className="flex flex-col items-center gap-2 mb-3">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-xl">Auto Cadastro</h1>
            <p className="text-white/70 text-sm">Preencha seus dados para a portaria</p>
          </div>
        </div>

        {auth && (
          <div className="rounded-lg bg-white/10 px-4 py-3 mt-2">
            <div className="flex items-center justify-center gap-2 text-sm">
              <Building className="w-4 h-4" />
              <span>
                {auth.bloco} Apt {auth.apartamento} — Morador: {auth.morador_name}
              </span>
            </div>
            <div className="flex items-center justify-center gap-4 mt-1.5 text-xs text-white/70">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {formatDate(auth.data_inicio)} a {formatDate(auth.data_fim)}
              </span>
              {auth.hora_inicio && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {auth.hora_inicio} às {auth.hora_fim}
                </span>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Form */}
      <div style={{ padding: "24px 24px 100px" }}>
        {/* ── Biometria Facial ── */}
        <div style={{ marginBottom: "32px" }}>
          <label className="text-base font-bold mb-3 flex items-center gap-2 uppercase tracking-wider" style={{ color: "#1e293b" }}>
            <ScanFace className="w-5 h-5" style={{ color: "#6366f1" }} />
            Biometria Facial
          </label>

          {foto && faceStatus === "captured" ? (
            <div className="relative text-center">
              <div
                className="rounded-2xl overflow-hidden mx-auto"
                style={{ width: "160px", height: "160px", border: "3px solid #22c55e" }}
              >
                <img src={foto} alt="Foto" className="w-full h-full object-cover" />
              </div>
              <div
                className="mx-auto mt-2 flex items-center justify-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold text-white w-fit"
                style={{ backgroundColor: "#22c55e" }}
              >
                <CheckCircle2 className="w-3 h-3" />
                Biometria Capturada
              </div>
              <button
                onClick={() => {
                  setFoto("");
                  setFaceStatus("idle");
                }}
                className="mt-2 text-xs text-red-500 underline mx-auto block"
              >
                Tirar novamente
              </button>
            </div>
          ) : showCamera ? (
            <div className="rounded-2xl overflow-hidden relative" style={{ border: "3px solid #6366f1" }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full"
                style={{ maxHeight: "400px", objectFit: "contain", background: "#f1f5f9" }}
              />
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full"
                style={{ pointerEvents: "none" }}
              />
              <div
                className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-2 py-2 text-white text-xs font-bold"
                style={{ backgroundColor: faceDetecting ? "rgba(99, 102, 241, 0.85)" : "rgba(34, 197, 94, 0.85)" }}
              >
                {faceDetecting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Posicione seu rosto na câmera...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Rosto detectado!
                  </>
                )}
              </div>
              <button
                onClick={stopCamera}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={startCamera}
              className="w-full rounded-2xl flex flex-col items-center justify-center gap-3 transition-all"
              style={{
                height: "160px",
                border: "2px dashed #c7d2fe",
                backgroundColor: "#e6edf7",
              }}
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)" }}
              >
                <ScanFace className="w-7 h-7 text-white" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold" style={{ color: "#6366f1" }}>
                  Tirar Foto com Biometria
                </p>
                <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>
                  Sua biometria será usada na portaria para liberar sua entrada
                </p>
              </div>
            </button>
          )}
        </div>

        {/* ── Foto do Documento ── */}
        <div style={{ marginBottom: "32px" }}>
          <label className="text-base font-bold mb-3 flex items-center gap-2 uppercase tracking-wider" style={{ color: "#1e293b" }}>
            <Image className="w-5 h-5" style={{ color: "#f59e0b" }} />
            Foto do Documento
          </label>

          {documentoFoto ? (
            <div className="relative">
              <div
                className="rounded-xl overflow-hidden"
                style={{ border: "2px solid #f59e0b", maxHeight: "200px" }}
              >
                <img src={documentoFoto} alt="Documento" className="w-full object-cover" />
              </div>
              <button
                onClick={() => setDocumentoFoto("")}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          ) : showDocCamera ? (
            <div className="relative rounded-xl overflow-hidden" style={{ border: "2px solid #f59e0b" }}>
              <video
                ref={docVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full"
                style={{ maxHeight: "400px", objectFit: "contain", background: "#f1f5f9" }}
              />
              <div className="flex gap-2 justify-center py-2" style={{ backgroundColor: "#fffbeb" }}>
                <button
                  onClick={captureDoc}
                  className="px-6 py-2 rounded-full text-white text-sm font-medium"
                  style={{ backgroundColor: "#f59e0b" }}
                >
                  Fotografar Documento
                </button>
                <button
                  onClick={stopDocCamera}
                  className="px-4 py-2 rounded-full text-xs text-muted-foreground"
                  style={{ border: "1px solid #e5e7eb" }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={startDocCamera}
              className="w-full rounded-xl flex items-center gap-3 transition-all"
              style={{
                height: "64px",
                border: "2px dashed #fde68a",
                backgroundColor: "#fffbeb",
                padding: "0 16px",
              }}
            >
              <Camera className="w-6 h-6" style={{ color: "#f59e0b" }} />
              <div className="text-left">
                <p className="text-sm font-semibold" style={{ color: "#b45309" }}>
                  Fotografar RG / CPF / CNH
                </p>
                <p className="text-xs" style={{ color: "#64748b" }}>Use a câmera traseira</p>
              </div>
            </button>
          )}
        </div>

        {/* ── Nome ── */}
        <div style={{ marginBottom: "20px" }}>
          <label className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: "#1e293b" }}>
            <User className="w-4 h-4" style={{ color: "#6366f1" }} /> Nome Completo *
          </label>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Seu nome completo"
            style={{ backgroundColor: "#ffffff", color: "#0f172a", borderColor: "#cbd5e1" }}
            className="w-full h-12 rounded-lg border px-4 text-base placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>

        {/* ── Documento ── */}
        <div style={{ marginBottom: "20px" }}>
          <label className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: "#1e293b" }}>
            <FileText className="w-4 h-4" style={{ color: "#6366f1" }} /> Documento (CPF / RG)
          </label>
          <input
            type="text"
            value={documento}
            onChange={(e) => setDocumento(e.target.value)}
            placeholder="000.000.000-00"
            style={{ backgroundColor: "#ffffff", color: "#0f172a", borderColor: "#cbd5e1" }}
            className="w-full h-12 rounded-lg border px-4 text-base placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>

        {/* ── Telefone ── */}
        <div style={{ marginBottom: "32px" }}>
          <label className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: "#1e293b" }}>
            <Phone className="w-4 h-4" style={{ color: "#6366f1" }} /> Telefone
          </label>
          <input
            type="tel"
            value={telefone}
            onChange={(e) => setTelefone(formatPhone(e.target.value))}
            placeholder="(00) 00000-0000"
            style={{ backgroundColor: "#ffffff", color: "#0f172a", borderColor: "#cbd5e1" }}
            className="w-full h-12 rounded-lg border px-4 text-base placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>

        {/* ── Biometria status info ── */}
        <div
          className="rounded-xl flex items-center gap-3"
          style={{
            padding: "14px 18px",
            marginBottom: "24px",
            backgroundColor: foto ? "#f0fdf4" : "#fefce8",
            border: foto ? "1px solid #bbf7d0" : "1px solid #fde68a",
          }}
        >
          <ScanFace className="w-6 h-6 shrink-0" style={{ color: foto ? "#16a34a" : "#d97706" }} />
          <div className="flex-1">
            {foto ? (
              <>
                <p className="text-sm font-bold" style={{ color: "#15803d" }}>Foto registrada</p>
                <p className="text-xs" style={{ color: "#4b5563" }}>A portaria poderá confirmar sua identidade</p>
              </>
            ) : (
              <>
                <p className="text-sm font-bold" style={{ color: "#b45309" }}>Foto não registrada</p>
                <p className="text-xs" style={{ color: "#4b5563" }}>Tire uma foto para registrar sua biometria facial</p>
              </>
            )}
          </div>
        </div>

        {/* ── Submit ── */}
        <button
          onClick={handleSubmit}
          disabled={submitting || !nome.trim()}
          className="w-full h-12 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all"
          style={{
            backgroundColor: nome.trim() ? "#003580" : "#99b3d6",
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Enviar Meus Dados
            </>
          )}
        </button>
      </div>
    </div>
  );
}
