import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowLeft,
  Camera,
  ScanLine,
  Car,
  PersonStanding,
  Loader2,
  CheckCircle2,
  XCircle,
  Shield,
  AlertTriangle,
  Scan,
  User,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  DoorOpen,
  Zap,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import Tesseract from "tesseract.js";
import { compressCanvas } from "@/lib/imageUtils";

/* ═══════════════════════════════════════════════════════════
   Portaria — Acesso Automático (Reconhecimento Facial + LPR)
   
   Integrações:
   - POST /api/gate/face-open  → reconhece rosto → abre portão pedestre
   - POST /api/gate/lpr-open   → lê placa → abre portão veicular
   ═══════════════════════════════════════════════════════════ */

const PLATE_REGEX = /[A-Z]{3}[\s\-]?\d[A-Z0-9]\d{2}/gi;

function extractPlate(text: string): string | null {
  const cleaned = text
    .toUpperCase()
    .replace(/[ÀÁÂ]/g, "A").replace(/[ÉÊ]/g, "E").replace(/[ÍÎ]/g, "I")
    .replace(/[ÓÔÕ]/g, "O").replace(/[ÚÛ]/g, "U")
    .replace(/[\n\r]/g, " ").replace(/[^A-Z0-9\s\-]/g, "");
  const matches = cleaned.match(PLATE_REGEX);
  if (!matches || matches.length === 0) return null;
  return matches[0].replace(/[\s\-]/g, "").slice(0, 7);
}

interface CameraData {
  id: number;
  nome: string;
  setor: string;
  url_stream: string;
  tipo_stream: string;
  ativa: number;
}

type Tab = "face" | "lpr";
type ActionStatus = "idle" | "capturing" | "processing" | "success" | "denied" | "error";

interface ActionResult {
  status: ActionStatus;
  message: string;
  person?: string;
  plate?: string;
  vehicle?: any;
  accessPoint?: string;
}

export default function PortariaAcessoAuto() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>("face");
  const [cameras, setCameras] = useState<CameraData[]>([]);
  const [faceCamIdx, setFaceCamIdx] = useState(0);
  const [lprCamIdx, setLprCamIdx] = useState(0);
  const [result, setResult] = useState<ActionResult>({ status: "idle", message: "" });
  const [ocrProgress, setOcrProgress] = useState(0);
  const [autoScan, setAutoScan] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const faceImgRef = useRef<HTMLImageElement>(null);
  const lprImgRef = useRef<HTMLImageElement>(null);
  const autoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Load cameras ──────────────────────────────────────
  useEffect(() => {
    apiFetch("/api/cameras")
      .then((r) => r.json())
      .then((data: CameraData[]) => setCameras(data.filter((c) => c.ativa && c.url_stream)))
      .catch(() => {});
  }, []);

  const faceCameras = cameras.filter((c) =>
    ["entrada_principal", "portaria", "entrada_servico", "hall"].includes(c.setor)
  );
  const lprCameras = cameras.filter((c) =>
    ["garagem", "entrada_principal", "estacionamento", "portaria"].includes(c.setor)
  );
  // Fallback to all cameras if no specific sector cameras
  const activeFaceCams = faceCameras.length > 0 ? faceCameras : cameras;
  const activeLprCams = lprCameras.length > 0 ? lprCameras : cameras;

  const currentFaceCam = activeFaceCams.length > 0 ? activeFaceCams[faceCamIdx % activeFaceCams.length] : null;
  const currentLprCam = activeLprCams.length > 0 ? activeLprCams[lprCamIdx % activeLprCams.length] : null;

  // ─── Clear result after delay ──────────────────────────
  const showResult = (r: ActionResult, duration = 6000) => {
    setResult(r);
    if (resultTimeoutRef.current) clearTimeout(resultTimeoutRef.current);
    if (r.status !== "idle" && r.status !== "capturing" && r.status !== "processing") {
      resultTimeoutRef.current = setTimeout(() => setResult({ status: "idle", message: "" }), duration);
    }
  };

  // ─── Capture frame from img element ────────────────────
  const captureFrameFromImg = (imgRef: React.RefObject<HTMLImageElement | null>): string | null => {
    const img = imgRef.current;
    if (!img) return null;
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width || 640;
    canvas.height = img.naturalHeight || img.height || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    try {
      ctx.drawImage(img, 0, 0);
      return compressCanvas(canvas, "face");
    } catch {
      return null;
    }
  };

  // ─── Face Recognition → Open Gate ──────────────────────
  const handleFaceScan = useCallback(async () => {
    if (result.status === "capturing" || result.status === "processing") return;

    showResult({ status: "capturing", message: "Capturando imagem..." });

    const photo = captureFrameFromImg(faceImgRef);
    if (!photo) {
      showResult({ status: "error", message: "Não foi possível capturar imagem da câmera." });
      return;
    }

    showResult({ status: "processing", message: "Analisando rosto..." });

    try {
      const res = await apiFetch("/api/gate/face-open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo }),
      });
      const data = await res.json();

      if (data.opened) {
        showResult({
          status: "success",
          message: data.message || "Portão aberto!",
          person: data.person,
          accessPoint: data.accessPoint,
        });
      } else if (data.matched) {
        showResult({
          status: "denied",
          message: data.error || "Reconhecido mas não foi possível abrir.",
          person: data.person,
        });
      } else {
        showResult({
          status: "denied",
          message: data.error || data.message || "Pessoa não reconhecida.",
        });
      }
    } catch {
      showResult({ status: "error", message: "Erro de conexão com o servidor." });
    }
  }, [result.status]);

  // ─── LPR → Open Gate ──────────────────────────────────
  const handleLprScan = useCallback(async () => {
    if (result.status === "capturing" || result.status === "processing") return;

    showResult({ status: "capturing", message: "Capturando imagem..." });

    const img = lprImgRef.current;
    if (!img) {
      showResult({ status: "error", message: "Não foi possível capturar imagem da câmera." });
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width || 640;
    canvas.height = img.naturalHeight || img.height || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      showResult({ status: "error", message: "Erro ao processar imagem." });
      return;
    }

    try {
      ctx.drawImage(img, 0, 0);
    } catch {
      showResult({ status: "error", message: "Câmera não permitiu captura (CORS). Verifique configuração." });
      return;
    }

    // Crop bottom 50% for plate area
    const cropH = Math.round(canvas.height * 0.5);
    const cropY = Math.round(canvas.height * 0.5);
    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = canvas.width;
    cropCanvas.height = cropH;
    const cropCtx = cropCanvas.getContext("2d");
    if (!cropCtx) return;
    cropCtx.drawImage(canvas, 0, cropY, canvas.width, cropH, 0, 0, canvas.width, cropH);

    // Binarize for OCR
    const imageData = cropCtx.getImageData(0, 0, cropCanvas.width, cropCanvas.height);
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      const avg = (d[i] + d[i + 1] + d[i + 2]) / 3;
      const val = avg > 128 ? 255 : 0;
      d[i] = val; d[i + 1] = val; d[i + 2] = val;
    }
    cropCtx.putImageData(imageData, 0, 0);

    showResult({ status: "processing", message: "Lendo placa..." });
    setOcrProgress(0);

    try {
      const ocrResult = await Tesseract.recognize(cropCanvas.toDataURL("image/png"), "eng", {
        logger: (m) => {
          if (m.status === "recognizing text") setOcrProgress(Math.round(m.progress * 100));
        },
      });

      const plate = extractPlate(ocrResult.data.text);
      if (!plate) {
        showResult({ status: "denied", message: "Placa não identificada. Tente quando o veículo estiver mais visível." });
        return;
      }

      showResult({ status: "processing", message: `Placa detectada: ${plate}. Verificando...` });

      const res = await apiFetch("/api/gate/lpr-open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placa: plate }),
      });
      const data = await res.json();

      if (data.opened) {
        showResult({
          status: "success",
          message: data.message || "Portão aberto!",
          plate: data.placa,
          vehicle: data.vehicle,
          accessPoint: data.accessPoint,
        });
      } else if (data.authorized === false) {
        showResult({
          status: "denied",
          message: data.message || "Veículo não autorizado.",
          plate: data.placa,
          vehicle: data.vehicle,
        });
      } else {
        showResult({
          status: "error",
          message: data.error || "Falha ao abrir portão.",
          plate: data.placa,
        });
      }
    } catch {
      showResult({ status: "error", message: "Erro de conexão com o servidor." });
    }
  }, [result.status]);

  // ─── Auto-scan interval ────────────────────────────────
  useEffect(() => {
    if (autoScan) {
      autoIntervalRef.current = setInterval(() => {
        if (tab === "face") handleFaceScan();
        else handleLprScan();
      }, 5000);
    }
    return () => {
      if (autoIntervalRef.current) clearInterval(autoIntervalRef.current);
    };
  }, [autoScan, tab, handleFaceScan, handleLprScan]);

  // ─── Result color / icon ───────────────────────────────
  const getStatusColor = () => {
    switch (result.status) {
      case "success": return "#22c55e";
      case "denied": return "#ef4444";
      case "error": return "#f59e0b";
      default: return isDark ? "#93c5fd" : "#3b82f6";
    }
  };

  const getStatusIcon = () => {
    switch (result.status) {
      case "capturing": case "processing": return <Loader2 style={{ width: 28, height: 28, color: "#fff" }} className="animate-spin" />;
      case "success": return <CheckCircle2 style={{ width: 28, height: 28, color: "#fff" }} />;
      case "denied": return <AlertTriangle style={{ width: 28, height: 28, color: "#fff" }} />;
      case "error": return <XCircle style={{ width: 28, height: 28, color: "#fff" }} />;
      default: return null;
    }
  };

  const bg = isDark
    ? "linear-gradient(180deg, #001533 0%, #002254 25%, #003580 55%, #004aad 100%)"
    : "#f0f4f8";

  return (
    <div style={{ minHeight: "100dvh", background: bg, display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <header style={{
        position: "sticky", top: 0, zIndex: 40,
        background: isDark ? "linear-gradient(135deg, #001533 0%, #002a66 50%, #004aad 100%)" : "#ffffff",
        borderBottom: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e2e8f0",
        boxShadow: isDark ? "0 4px 20px rgba(0,0,0,0.3)" : "0 2px 8px rgba(0,0,0,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.5rem", height: "4.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <button onClick={() => navigate(-1)} style={{ padding: "0.5rem", borderRadius: 12, background: isDark ? "rgba(255,255,255,0.08)" : "#f8fafc", border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid #cbd5e1", color: isDark ? "#fff" : "#1e293b", cursor: "pointer" }}>
              <ArrowLeft style={{ width: 22, height: 22 }} />
            </button>
            <div>
              <span style={{ fontWeight: 800, fontSize: "1.05rem", color: isDark ? "#fff" : "#1e293b", display: "block" }}>Acesso Automático</span>
              <span style={{ fontSize: "0.8rem", color: isDark ? "#93c5fd" : "#475569", display: "block" }}>Reconhecimento Facial & LPR</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Shield style={{ width: 18, height: 18, color: isDark ? "rgba(255,255,255,0.4)" : "#94a3b8" }} />
            <span style={{ fontSize: "0.7rem", color: isDark ? "rgba(255,255,255,0.4)" : "#94a3b8", fontWeight: 700, letterSpacing: "0.05em" }}>APP INTERFONE</span>
          </div>
        </div>
      </header>

      <main style={{ flex: 1, overflow: "auto", padding: "1.25rem 1.5rem", paddingBottom: "6rem" }}>

        {/* ═══ Como funciona? ═══ */}
        <div style={{ marginBottom: "1.25rem" }}>
          <button
            onClick={() => setShowHelp(v => !v)}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "0.875rem 1.25rem", borderRadius: 16, cursor: "pointer", border: "none",
              background: "linear-gradient(135deg, #0ea5e9, #3b82f6)",
              boxShadow: "0 4px 16px rgba(14,165,233,0.3)",
              transition: "all 0.2s",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <HelpCircle style={{ width: 22, height: 22, color: "#fff" }} />
              <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#fff" }}>Como funciona?</span>
            </div>
            {showHelp
              ? <ChevronUp style={{ width: 20, height: 20, color: "#fff" }} />
              : <ChevronDown style={{ width: 20, height: 20, color: "#fff" }} />}
          </button>
          {showHelp && (
            <div style={{
              marginTop: 8, padding: "1.25rem", borderRadius: 16,
              background: isDark ? "rgba(255,255,255,0.06)" : "#f0f9ff",
              border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid #bae6fd",
            }}>
              <ol style={{ margin: 0, paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem", color: isDark ? "#e0f2fe" : "#0c4a6e", fontSize: "0.9rem", lineHeight: 1.5 }}>
                <li>A portaria / síndico pré-configura uma <strong>câmera para leitura de placas</strong>.</li>
                <li>Quando um veículo para em frente à câmera, o sistema <strong>lê a placa automaticamente</strong>.</li>
                <li>Se a placa estiver <strong>autorizada</strong>, o portão veicular abre automaticamente, <strong>sem confirmação</strong>. ✅</li>
                <li>Se <strong>não autorizada</strong>, o acesso é negado e a portaria é notificada. ❌</li>
              </ol>
              <hr style={{ margin: "0.75rem 0", border: "none", borderTop: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #bae6fd" }} />
              <p style={{ margin: 0, color: isDark ? "#93c5fd" : "#0369a1", fontSize: "0.85rem" }}>
                <strong>Reconhecimento Facial:</strong> A câmera captura o rosto, compara com visitantes e pré-autorizações cadastrados. Se houver match, o portão de pedestre abre automaticamente.
              </p>
            </div>
          )}
        </div>

        {/* ═══ Tab Selector ═══ */}
        <div style={{
          display: "flex", gap: 8, marginBottom: "1.25rem",
          background: isDark ? "rgba(255,255,255,0.04)" : "#f1f5f9",
          borderRadius: 16, padding: 4,
          border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e2e8f0",
        }}>
          <button
            onClick={() => { setTab("face"); setResult({ status: "idle", message: "" }); }}
            style={{
              flex: 1, padding: "0.75rem", borderRadius: 13, fontWeight: 700, fontSize: 14,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              background: tab === "face" ? "linear-gradient(135deg, #003580, #004aad)" : "transparent",
              color: tab === "face" ? "#fff" : (isDark ? "rgba(255,255,255,0.5)" : "#64748b"),
              border: "none", cursor: "pointer", transition: "all 0.2s",
            }}
          >
            <User style={{ width: 18, height: 18 }} />
            Facial
          </button>
          <button
            onClick={() => { setTab("lpr"); setResult({ status: "idle", message: "" }); }}
            style={{
              flex: 1, padding: "0.75rem", borderRadius: 13, fontWeight: 700, fontSize: 14,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              background: tab === "lpr" ? "linear-gradient(135deg, #003580, #004aad)" : "transparent",
              color: tab === "lpr" ? "#fff" : (isDark ? "rgba(255,255,255,0.5)" : "#64748b"),
              border: "none", cursor: "pointer", transition: "all 0.2s",
            }}
          >
            <Car style={{ width: 18, height: 18 }} />
            LPR (Placa)
          </button>
        </div>

        {/* ═══ Camera Feed ═══ */}
        <div style={{
          borderRadius: 20, overflow: "hidden", marginBottom: "1rem",
          background: isDark ? "rgba(0,0,0,0.4)" : "#000",
          border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid #e2e8f0",
          position: "relative", minHeight: 260,
        }}>
          {tab === "face" ? (
            currentFaceCam ? (
              <>
                <img
                  ref={faceImgRef}
                  src={currentFaceCam.url_stream}
                  crossOrigin="anonymous"
                  alt={currentFaceCam.nome}
                  style={{ width: "100%", height: "auto", display: "block", minHeight: 260, objectFit: "cover", background: "#111" }}
                />
                {/* Camera name overlay */}
                <div style={{
                  position: "absolute", top: 12, left: 12, padding: "6px 12px", borderRadius: 10,
                  background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <Camera style={{ width: 14, height: 14, color: "#93c5fd" }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{currentFaceCam.nome}</span>
                </div>
                {/* Face scan overlay lines */}
                {(result.status === "capturing" || result.status === "processing") && (
                  <div style={{
                    position: "absolute", inset: 0,
                    border: "3px solid rgba(59,130,246,0.6)",
                    borderRadius: 20,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <div style={{
                      width: 120, height: 160, borderRadius: "50%",
                      border: "2px dashed rgba(59,130,246,0.8)",
                    }} />
                  </div>
                )}
                {/* Camera navigation */}
                {activeFaceCams.length > 1 && (
                  <div style={{ position: "absolute", bottom: 12, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 8 }}>
                    <button onClick={() => setFaceCamIdx((i) => (i - 1 + activeFaceCams.length) % activeFaceCams.length)} style={{ padding: 6, borderRadius: 10, background: "rgba(0,0,0,0.5)", border: "none", color: "#fff", cursor: "pointer" }}>
                      <ChevronLeft style={{ width: 20, height: 20 }} />
                    </button>
                    <span style={{ padding: "6px 12px", borderRadius: 10, background: "rgba(0,0,0,0.5)", fontSize: 12, color: "#fff", fontWeight: 600, display: "flex", alignItems: "center" }}>
                      {(faceCamIdx % activeFaceCams.length) + 1}/{activeFaceCams.length}
                    </span>
                    <button onClick={() => setFaceCamIdx((i) => (i + 1) % activeFaceCams.length)} style={{ padding: 6, borderRadius: 10, background: "rgba(0,0,0,0.5)", border: "none", color: "#fff", cursor: "pointer" }}>
                      <ChevronRight style={{ width: 20, height: 20 }} />
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 260, gap: 12 }}>
                <Camera style={{ width: 40, height: 40, color: "#475569" }} />
                <p style={{ color: "#94a3b8", fontSize: 14 }}>Nenhuma câmera disponível</p>
              </div>
            )
          ) : (
            currentLprCam ? (
              <>
                <img
                  ref={lprImgRef}
                  src={currentLprCam.url_stream}
                  crossOrigin="anonymous"
                  alt={currentLprCam.nome}
                  style={{ width: "100%", height: "auto", display: "block", minHeight: 260, objectFit: "cover", background: "#111" }}
                />
                <div style={{
                  position: "absolute", top: 12, left: 12, padding: "6px 12px", borderRadius: 10,
                  background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <Camera style={{ width: 14, height: 14, color: "#93c5fd" }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{currentLprCam.nome}</span>
                </div>
                {/* LPR scan area overlay */}
                {(result.status === "capturing" || result.status === "processing") && (
                  <div style={{
                    position: "absolute", bottom: "10%", left: "10%", right: "10%", height: "30%",
                    border: "2px dashed rgba(59,130,246,0.7)", borderRadius: 12,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <ScanLine style={{ width: 24, height: 24, color: "rgba(59,130,246,0.8)" }} className="animate-pulse" />
                  </div>
                )}
                {activeLprCams.length > 1 && (
                  <div style={{ position: "absolute", bottom: 12, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 8 }}>
                    <button onClick={() => setLprCamIdx((i) => (i - 1 + activeLprCams.length) % activeLprCams.length)} style={{ padding: 6, borderRadius: 10, background: "rgba(0,0,0,0.5)", border: "none", color: "#fff", cursor: "pointer" }}>
                      <ChevronLeft style={{ width: 20, height: 20 }} />
                    </button>
                    <span style={{ padding: "6px 12px", borderRadius: 10, background: "rgba(0,0,0,0.5)", fontSize: 12, color: "#fff", fontWeight: 600, display: "flex", alignItems: "center" }}>
                      {(lprCamIdx % activeLprCams.length) + 1}/{activeLprCams.length}
                    </span>
                    <button onClick={() => setLprCamIdx((i) => (i + 1) % activeLprCams.length)} style={{ padding: 6, borderRadius: 10, background: "rgba(0,0,0,0.5)", border: "none", color: "#fff", cursor: "pointer" }}>
                      <ChevronRight style={{ width: 20, height: 20 }} />
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 260, gap: 12 }}>
                <Camera style={{ width: 40, height: 40, color: "#475569" }} />
                <p style={{ color: "#94a3b8", fontSize: 14 }}>Nenhuma câmera disponível</p>
              </div>
            )
          )}
        </div>

        {/* ═══ Result Banner ═══ */}
        {result.status !== "idle" && (
          <div style={{
            marginBottom: "1rem", padding: "1rem 1.25rem", borderRadius: 16,
            background: result.status === "success"
              ? "linear-gradient(135deg, rgba(34,197,94,0.15), rgba(22,163,74,0.08))"
              : result.status === "denied"
              ? "linear-gradient(135deg, rgba(239,68,68,0.15), rgba(220,38,38,0.08))"
              : result.status === "error"
              ? "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(217,119,6,0.08))"
              : (isDark ? "rgba(59,130,246,0.1)" : "#eff6ff"),
            border: `1.5px solid ${getStatusColor()}33`,
            display: "flex", alignItems: "center", gap: 14,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14, flexShrink: 0,
              background: `linear-gradient(135deg, ${getStatusColor()}, ${getStatusColor()}cc)`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {getStatusIcon()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 700, fontSize: 14, color: isDark ? "#fff" : "#1e293b", marginBottom: 2 }}>
                {result.status === "capturing" ? "Capturando..." :
                 result.status === "processing" ? "Processando..." :
                 result.status === "success" ? "Acesso Liberado!" :
                 result.status === "denied" ? "Acesso Negado" : "Erro"}
              </p>
              <p style={{ fontSize: 13, color: isDark ? "#93c5fd" : "#475569", lineHeight: 1.4 }}>
                {result.message}
              </p>
              {result.person && (
                <p style={{ fontSize: 12, color: getStatusColor(), fontWeight: 600, marginTop: 4 }}>
                  Pessoa: {result.person}
                </p>
              )}
              {result.vehicle && (
                <p style={{ fontSize: 12, color: getStatusColor(), fontWeight: 600, marginTop: 4 }}>
                  {result.vehicle.modelo} — {result.vehicle.motorista_nome || result.vehicle.morador_name}
                  {result.vehicle.bloco && ` (Bl. ${result.vehicle.bloco}`}
                  {result.vehicle.apartamento && ` Ap. ${result.vehicle.apartamento})`}
                </p>
              )}
              {result.status === "processing" && tab === "lpr" && ocrProgress > 0 && (
                <div style={{ marginTop: 6, height: 4, borderRadius: 2, background: isDark ? "rgba(255,255,255,0.1)" : "#e2e8f0", overflow: "hidden" }}>
                  <div style={{ width: `${ocrProgress}%`, height: "100%", background: "#3b82f6", borderRadius: 2, transition: "width 0.3s" }} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ Scan Button ═══ */}
        <button
          onClick={tab === "face" ? handleFaceScan : handleLprScan}
          disabled={result.status === "capturing" || result.status === "processing" || (tab === "face" ? !currentFaceCam : !currentLprCam)}
          style={{
            width: "100%", padding: "1rem", borderRadius: 16, fontWeight: 800, fontSize: 16,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            background: (result.status === "capturing" || result.status === "processing")
              ? (isDark ? "rgba(255,255,255,0.06)" : "#f1f5f9")
              : "linear-gradient(135deg, #003580, #004aad)",
            border: "none",
            color: (result.status === "capturing" || result.status === "processing") ? (isDark ? "#93c5fd" : "#64748b") : "#fff",
            cursor: (result.status === "capturing" || result.status === "processing") ? "not-allowed" : "pointer",
            boxShadow: (result.status === "capturing" || result.status === "processing") ? "none" : "0 4px 20px rgba(0,53,128,0.3)",
            transition: "all 0.2s",
            marginBottom: "1rem",
          }}
        >
          {(result.status === "capturing" || result.status === "processing") ? (
            <>
              <Loader2 style={{ width: 22, height: 22 }} className="animate-spin" />
              Processando...
            </>
          ) : tab === "face" ? (
            <>
              <Scan style={{ width: 22, height: 22 }} />
              Escanear Rosto
            </>
          ) : (
            <>
              <ScanLine style={{ width: 22, height: 22 }} />
              Ler Placa
            </>
          )}
        </button>

        {/* ═══ Auto-scan toggle ═══ */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0.875rem 1.25rem", borderRadius: 14, marginBottom: "1rem",
          background: isDark ? "rgba(255,255,255,0.04)" : "#f8fafc",
          border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e2e8f0",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Zap style={{ width: 18, height: 18, color: autoScan ? "#22c55e" : (isDark ? "#93c5fd" : "#64748b") }} />
            <div>
              <p style={{ fontWeight: 700, fontSize: 14, color: isDark ? "#fff" : "#1e293b" }}>Escaneamento Automático</p>
              <p style={{ fontSize: 12, color: isDark ? "#93c5fd" : "#64748b" }}>Escaneia a cada 5 segundos</p>
            </div>
          </div>
          <button
            onClick={() => setAutoScan(!autoScan)}
            style={{
              width: 52, height: 28, borderRadius: 14, padding: 2,
              background: autoScan ? "#22c55e" : (isDark ? "rgba(255,255,255,0.15)" : "#d1d5db"),
              border: "none", cursor: "pointer", transition: "background 0.2s",
              display: "flex", alignItems: "center",
            }}
          >
            <div style={{
              width: 24, height: 24, borderRadius: 12, background: "#fff",
              transition: "transform 0.2s",
              transform: autoScan ? "translateX(24px)" : "translateX(0px)",
              boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            }} />
          </button>
        </div>

        {/* ═══ Info banner ═══ */}
        <div style={{
          padding: "1rem 1.25rem", borderRadius: 16,
          background: isDark ? "rgba(59,130,246,0.08)" : "#eff6ff",
          border: isDark ? "1px solid rgba(59,130,246,0.15)" : "1px solid #bfdbfe",
          display: "flex", gap: 12, alignItems: "flex-start",
        }}>
          <DoorOpen style={{ width: 20, height: 20, color: "#3b82f6", flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 13, color: isDark ? "#93c5fd" : "#1e40af", lineHeight: 1.6 }}>
            {tab === "face" ? (
              <>
                <strong>Reconhecimento Facial:</strong> Ao identificar um visitante ou pessoa pré-autorizada cadastrada no sistema, o portão de pedestres será aberto automaticamente.
              </>
            ) : (
              <>
                <strong>Leitura de Placa (LPR):</strong> Ao identificar uma placa cadastrada e autorizada, o portão veicular será aberto automaticamente.
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
