import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  QrCode,
  Camera,
  User,
  FileText,
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Shield,
  MessageCircle,
  Phone,
  Scan,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import ComoFunciona from "@/components/ComoFunciona";

/* ═══════════════════════════════════════════════
   PORTEIRO — Leitor de QR Code de Visitante
   ═══════════════════════════════════════════════ */

interface VisitorPayload {
  type: string;
  v: number;
  id: string;
  visitante: {
    nome: string;
    documento: string;
    foto: string | null;
    parentesco: string;
    observacoes: string;
  };
  autorizacao: {
    dataInicio: string;
    horaInicio: string;
    dataFim: string;
    horaFim: string;
  };
  morador: {
    nome: string;
    bloco: string;
    unidade: string;
    condominio: string;
    telefone?: string;
  };
  createdAt: string;
}

const SCAN_LOG_KEY = "porteiro_qr_scan_log";

interface ScanLog {
  id: string;
  visitanteNome: string;
  moradorNome: string;
  bloco: string;
  unidade: string;
  scannedAt: string;
  status: "autorizado" | "expirado" | "invalido";
}

function loadScanLog(): ScanLog[] {
  try {
    const raw = localStorage.getItem(SCAN_LOG_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveScanLog(log: ScanLog[]) {
  localStorage.setItem(SCAN_LOG_KEY, JSON.stringify(log));
}

export default function PorteiroQRScanner() {
  const { isDark, p } = useTheme();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"scan" | "result" | "log">("scan");
  const [visitor, setVisitor] = useState<VisitorPayload | null>(null);
  const [scanStatus, setScanStatus] = useState<"autorizado" | "expirado" | "invalido">("autorizado");
  const [scanLog, setScanLog] = useState<ScanLog[]>(loadScanLog());
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const [notifiedInApp, setNotifiedInApp] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);

  // Start camera
  useEffect(() => {
    if (mode === "scan" && !showManualInput) {
      startCamera();
    }
    return () => stopCamera();
  }, [mode, showManualInput]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      // Camera not available — show manual input fallback
      setShowManualInput(true);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
  };

  const processQRData = (data: string) => {
    try {
      const parsed: VisitorPayload = JSON.parse(data);
      if ((parsed.type !== "APPINTERFONE_VISITOR" && parsed.type !== "PORTARIAX_VISITOR") || !parsed.visitante?.nome) {
        setScanStatus("invalido");
        setVisitor(null);
        setMode("result");
        return;
      }

      // Check validity
      const now = new Date();
      const start = new Date(`${parsed.autorizacao.dataInicio}T${parsed.autorizacao.horaInicio}`);
      const end = new Date(`${parsed.autorizacao.dataFim}T${parsed.autorizacao.horaFim}`);
      const isValid = now >= start && now <= end;

      const status = isValid ? "autorizado" : "expirado";

      setVisitor(parsed);
      setScanStatus(status);
      setMode("result");
      setNotifiedInApp(false);

      // Log scan
      const newLog: ScanLog = {
        id: parsed.id,
        visitanteNome: parsed.visitante.nome,
        moradorNome: parsed.morador.nome,
        bloco: parsed.morador.bloco,
        unidade: parsed.morador.unidade,
        scannedAt: new Date().toISOString(),
        status,
      };
      const updated = [newLog, ...scanLog].slice(0, 100);
      setScanLog(updated);
      saveScanLog(updated);

      stopCamera();

      // Auto-open WhatsApp if morador phone is in QR payload
      if (isValid && parsed.morador.telefone) {
        const url = buildWhatsAppUrl(parsed, parsed.morador.telefone);
        if (url) {
          setTimeout(() => { window.open(url, "_blank"); }, 500);
        }
      }
    } catch {
      setScanStatus("invalido");
      setVisitor(null);
      setMode("result");
    }
  };

  const handleManualSubmit = () => {
    if (!manualInput.trim()) return;
    processQRData(manualInput.trim());
    setManualInput("");
  };

  const buildWhatsAppUrl = (v: VisitorPayload, phone?: string) => {
    const msg = `*AVISO DE CHEGADA - PORTARIA*\n\nSeu visitante chegou!\n\nVisitante: ${v.visitante.nome}\n${v.visitante.documento ? `Documento: ${v.visitante.documento}\n` : ""}${v.visitante.parentesco ? `Parentesco: ${v.visitante.parentesco}\n` : ""}\nPortaria do ${v.morador.condominio}\n${new Date().toLocaleString("pt-BR")}`;
    const num = (phone || "").replace(/\D/g, "");
    if (!num) return null;
    const fullNum = num.startsWith("55") ? num : `55${num}`;
    return `https://wa.me/${fullNum}?text=${encodeURIComponent(msg)}`;
  };

  const handleNotifyWhatsApp = () => {
    if (!visitor) return;
    const phone = whatsappNumber.trim() || visitor.morador.telefone || "";
    const url = buildWhatsAppUrl(visitor, phone);
    if (url) window.open(url, "_blank");
    setShowWhatsAppModal(false);
    setWhatsappNumber("");
  };

  const handleNotifyInApp = () => {
    // Simulates an in-app notification to the morador's system
    setNotifiedInApp(true);
  };

  const resetScan = () => {
    setVisitor(null);
    setMode("scan");
    setShowManualInput(false);
  };

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: p.pageBg }}>
      {/* Header */}
      <header className="safe-area-top" style={{ background: p.headerBg, padding: "18px 24px", borderBottom: p.headerBorder, boxShadow: p.headerShadow }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} style={{ width: 40, height: 40, borderRadius: 12, background: p.btnBg, border: p.btnBorder, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: p.text }}>
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div style={{ flex: 1 }}>
            <h1 className="text-white flex items-center gap-2" style={{ fontWeight: 700, fontSize: 18 }}>
              <Scan className="w-5 h-5" /> Leitor QR Visitante
            </h1>
            <p style={{ fontSize: 12, color: isDark ? "rgba(255,255,255,0.6)" : "#64748b" }}>Escaneie o QR Code do visitante</p>
          </div>
          <button
            onClick={() => setMode(mode === "log" ? "scan" : "log")}
            style={{
              background: isDark ? "rgba(255,255,255,0.15)" : "#f0f4f8",
              border: isDark ? "2px solid rgba(255,255,255,0.3)" : "2px solid #cbd5e1",
              borderRadius: "12px",
              padding: "10px 16px",
              color: p.text,
              fontWeight: 700,
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            {mode === "log" ? "Scanner" : "Histórico"}
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto" style={{ padding: "16px 24px 120px" }}>

        <ComoFunciona steps={[
          "📱 Visitante apresenta QR Code na portaria",
          "📷 Porteiro escaneia código com a câmera",
          "✅ Sistema valida a autorização automaticamente",
          "🚪 Acesso liberado sem ligar para morador",
        ]} />

        {/* ═══ SCAN MODE ═══ */}
        {mode === "scan" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", alignItems: "center" }}>
            <div style={{
              background: "linear-gradient(135deg, #eef0f5, #e0e2ea)",
              borderRadius: "16px", padding: "16px", width: "100%",
              border: "2px solid #2d3354", textAlign: "center",
            }}>
              <Scan className="w-8 h-8 mx-auto" style={{ color: "#2d3354" }} />
              <p style={{ fontWeight: 700, fontSize: "15px", color: "#2d3354", marginTop: "8px" }}>
                Aponte a câmera para o QR Code
              </p>
              <p style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>
                O QR Code é gerado pelo morador no app
              </p>
            </div>

            {!showManualInput ? (
              <div style={{
                width: "100%", maxWidth: "400px", aspectRatio: "1",
                borderRadius: "20px", overflow: "hidden",
                border: "4px solid #6366f1", position: "relative",
                background: "#000",
              }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                <canvas ref={canvasRef} style={{ display: "none" }} />
                {/* Scan overlay */}
                <div style={{
                  position: "absolute", inset: 0,
                  border: "60px solid rgba(0,0,0,0.4)",
                  boxSizing: "border-box",
                }}>
                  <div style={{
                    width: "100%", height: "100%",
                    border: "2px solid #6366f1",
                    borderRadius: "8px",
                  }} />
                </div>
              </div>
            ) : (
              <div style={{ width: "100%", maxWidth: "400px" }}>
                <p style={{ fontWeight: 700, fontSize: "14px", color: "#374151", marginBottom: "8px" }}>
                  Câmera indisponível — cole o conteúdo do QR Code:
                </p>
                <textarea
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="Cole aqui o conteúdo do QR Code..."
                  rows={6}
                  style={{
                    width: "100%", padding: "14px", borderRadius: "12px",
                    border: "2px solid #d1d5db", fontSize: "13px", color: "#374151",
                    fontFamily: "monospace", resize: "none",
                  }}
                />
                <button
                  onClick={handleManualSubmit}
                  disabled={!manualInput.trim()}
                  style={{
                    width: "100%", padding: "14px", borderRadius: "12px", border: "none",
                    background: manualInput.trim() ? "#003580" : "#d1d5db",
                    color: p.text, fontWeight: 700, fontSize: "15px",
                    cursor: manualInput.trim() ? "pointer" : "not-allowed", marginTop: "10px",
                  }}
                >
                  Verificar QR Code
                </button>
              </div>
            )}

            <button
              onClick={() => setShowManualInput(!showManualInput)}
              style={{
                background: "none", border: "none", color: "#6366f1",
                fontWeight: 700, fontSize: "13px", cursor: "pointer",
              }}
            >
              {showManualInput ? "Usar Câmera" : "Inserir Manualmente"}
            </button>
          </div>
        )}

        {/* ═══ RESULT MODE ═══ */}
        {mode === "result" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* Status Banner */}
            <div style={{
              borderRadius: "16px", padding: "20px", textAlign: "center",
              background: scanStatus === "autorizado" ? "linear-gradient(135deg, #f0fdf4, #dcfce7)" : scanStatus === "expirado" ? "linear-gradient(135deg, #fef2f2, #fee2e2)" : "linear-gradient(135deg, #fffbeb, #fef3c7)",
              border: `2px solid ${scanStatus === "autorizado" ? "#86efac" : scanStatus === "expirado" ? "#fca5a5" : "#fde68a"}`,
            }}>
              {scanStatus === "autorizado" ? (
                <CheckCircle2 className="w-12 h-12 mx-auto" style={{ color: "#16a34a" }} />
              ) : scanStatus === "expirado" ? (
                <XCircle className="w-12 h-12 mx-auto" style={{ color: "#dc2626" }} />
              ) : (
                <AlertTriangle className="w-12 h-12 mx-auto" style={{ color: "#d97706" }} />
              )}
              <p style={{
                fontWeight: 800, fontSize: "20px", marginTop: "8px",
                color: scanStatus === "autorizado" ? "#166534" : scanStatus === "expirado" ? "#991b1b" : "#92400e",
              }}>
                {scanStatus === "autorizado" ? "ENTRADA AUTORIZADA" : scanStatus === "expirado" ? "AUTORIZAÇÃO EXPIRADA" : "QR CODE INVÁLIDO"}
              </p>
              <p style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>
                {scanStatus === "autorizado" ? "Este visitante possui autorização válida" : scanStatus === "expirado" ? "O período de autorização já terminou" : "Este QR Code não é uma autorização válida"}
              </p>
            </div>

            {/* Visitor Details */}
            {visitor && (
              <div style={{ background: "#fff", borderRadius: "16px", border: "2px solid #e5e7eb", padding: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "16px" }}>
                  {visitor.visitante.foto ? (
                    <img src={visitor.visitante.foto} alt="" style={{ width: "64px", height: "64px", borderRadius: "50%", objectFit: "cover", border: "3px solid #e5e7eb" }} />
                  ) : (
                    <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <User className="w-7 h-7" style={{ color: "#9ca3af" }} />
                    </div>
                  )}
                  <div>
                    <p style={{ fontWeight: 800, fontSize: "18px", color: "#374151" }}>{visitor.visitante.nome}</p>
                    {visitor.visitante.parentesco && (
                      <p style={{ fontSize: "13px", color: "#6b7280" }}>{visitor.visitante.parentesco}</p>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {visitor.visitante.documento && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", background: "#f8fafc", borderRadius: "10px" }}>
                      <FileText className="w-4 h-4" style={{ color: "#6b7280", flexShrink: 0 }} />
                      <div>
                        <p style={{ fontSize: "11px", color: "#9ca3af", fontWeight: 700 }}>DOCUMENTO</p>
                        <p style={{ fontSize: "14px", fontWeight: 700, color: "#374151" }}>{visitor.visitante.documento}</p>
                      </div>
                    </div>
                  )}

                  <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", background: "#f8fafc", borderRadius: "10px" }}>
                    <Calendar className="w-4 h-4" style={{ color: "#6b7280", flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: "11px", color: "#9ca3af", fontWeight: 700 }}>PERÍODO AUTORIZADO</p>
                      <p style={{ fontSize: "14px", fontWeight: 700, color: "#374151" }}>
                        {visitor.autorizacao.dataInicio} {visitor.autorizacao.horaInicio} — {visitor.autorizacao.dataFim} {visitor.autorizacao.horaFim}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", background: "#f8fafc", borderRadius: "10px" }}>
                    <User className="w-4 h-4" style={{ color: "#6b7280", flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: "11px", color: "#9ca3af", fontWeight: 700 }}>MORADOR RESPONSÁVEL</p>
                      <p style={{ fontSize: "14px", fontWeight: 700, color: "#374151" }}>
                        {visitor.morador.nome} — Bloco {visitor.morador.bloco} Apt {visitor.morador.unidade}
                      </p>
                    </div>
                  </div>

                  {visitor.visitante.observacoes && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", padding: "10px 14px", background: "#fffbeb", borderRadius: "10px", border: "1px solid #fde68a" }}>
                      <AlertTriangle className="w-4 h-4" style={{ color: "#d97706", flexShrink: 0, marginTop: "2px" }} />
                      <div>
                        <p style={{ fontSize: "11px", color: "#92400e", fontWeight: 700 }}>OBSERVAÇÕES</p>
                        <p style={{ fontSize: "14px", color: "#374151" }}>{visitor.visitante.observacoes}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "20px" }}>
                  <button
                    onClick={() => setShowWhatsAppModal(true)}
                    style={{
                      width: "100%", padding: "14px", borderRadius: "12px", border: "none",
                      background: "#25d366", color: p.text, fontWeight: 700, fontSize: "15px",
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                    }}
                  >
                    <MessageCircle className="w-5 h-5" /> Avisar Morador (WhatsApp)
                  </button>

                  <button
                    onClick={handleNotifyInApp}
                    disabled={notifiedInApp}
                    style={{
                      width: "100%", padding: "14px", borderRadius: "12px",
                      border: notifiedInApp ? "2px solid #86efac" : "2px solid #6366f1",
                      background: notifiedInApp ? "#f0fdf4" : "#fff",
                      color: notifiedInApp ? "#166534" : "#6366f1",
                      fontWeight: 700, fontSize: "15px",
                      cursor: notifiedInApp ? "default" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                    }}
                  >
                    {notifiedInApp ? (
                      <><CheckCircle2 className="w-5 h-5" /> Aviso Enviado no Sistema</>
                    ) : (
                      <><Shield className="w-5 h-5" /> Enviar Aviso no Sistema</>
                    )}
                  </button>

                  <button
                    onClick={resetScan}
                    style={{
                      width: "100%", padding: "14px", borderRadius: "12px",
                      border: "2px solid #d1d5db", background: "#fff",
                      color: "#6b7280", fontWeight: 700, fontSize: "15px", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                    }}
                  >
                    <Scan className="w-5 h-5" /> Escanear Outro QR
                  </button>
                </div>
              </div>
            )}

            {/* Invalid fallback */}
            {!visitor && scanStatus === "invalido" && (
              <div style={{ textAlign: "center", padding: "24px" }}>
                <button
                  onClick={resetScan}
                  style={{
                    padding: "14px 28px", borderRadius: "12px", border: "none",
                    background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)",
                    color: "#fff", fontWeight: 700, fontSize: "15px", cursor: "pointer",
                    display: "inline-flex", alignItems: "center", gap: "8px",
                  }}
                >
                  <Scan className="w-5 h-5" /> Tentar Novamente
                </button>
              </div>
            )}
          </div>
        )}

        {/* ═══ LOG MODE ═══ */}
        {mode === "log" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <p style={{ fontWeight: 700, fontSize: "14px", color: "#6b7280", textTransform: "uppercase" }}>
              Histórico de Leituras ({scanLog.length})
            </p>

            {scanLog.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 16px" }}>
                <Scan className="w-12 h-12 mx-auto" style={{ color: "#d1d5db" }} />
                <p style={{ fontWeight: 700, color: "#374151", marginTop: "12px" }}>Nenhuma leitura realizada</p>
              </div>
            ) : (
              scanLog.map((log, i) => (
                <div key={i} style={{
                  background: "#fff", borderRadius: "12px", padding: "14px 16px",
                  border: `2px solid ${log.status === "autorizado" ? "#86efac" : log.status === "expirado" ? "#fca5a5" : "#fde68a"}`,
                  display: "flex", alignItems: "center", gap: "12px",
                }}>
                  {log.status === "autorizado" ? (
                    <CheckCircle2 className="w-5 h-5" style={{ color: "#16a34a", flexShrink: 0 }} />
                  ) : log.status === "expirado" ? (
                    <XCircle className="w-5 h-5" style={{ color: "#dc2626", flexShrink: 0 }} />
                  ) : (
                    <AlertTriangle className="w-5 h-5" style={{ color: "#d97706", flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700, fontSize: "14px", color: "#374151" }}>{log.visitanteNome}</p>
                    <p style={{ fontSize: "12px", color: "#9ca3af" }}>
                      Morador: {log.moradorNome} · Bloco {log.bloco} Apt {log.unidade}
                    </p>
                    <p style={{ fontSize: "11px", color: "#d1d5db" }}>
                      {new Date(log.scannedAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <span style={{
                    fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "999px",
                    background: log.status === "autorizado" ? "#dcfce7" : log.status === "expirado" ? "#fee2e2" : "#fef3c7",
                    color: log.status === "autorizado" ? "#166534" : log.status === "expirado" ? "#991b1b" : "#92400e",
                  }}>
                    {log.status === "autorizado" ? "OK" : log.status === "expirado" ? "EXPIRADO" : "INVÁLIDO"}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* ═══ WhatsApp Modal ═══ */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center">
          <div
            className="bg-card w-full max-w-md rounded-t-3xl sm:rounded-3xl"
            style={{ padding: "24px" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              <h2 style={{ fontWeight: 800, fontSize: "18px", color: "#374151", display: "flex", alignItems: "center", gap: "8px" }}>
                <MessageCircle className="w-5 h-5" style={{ color: "#25d366" }} /> Avisar Morador
              </h2>
              <button onClick={() => setShowWhatsAppModal(false)} style={{ background: "none", border: "none", fontSize: "24px", color: "#9ca3af", cursor: "pointer" }}>×</button>
            </div>

            <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "16px" }}>
              Digite o número de WhatsApp do morador para enviar o aviso de chegada do visitante.
            </p>

            <div>
              <label style={{ display: "block", fontWeight: 700, fontSize: "13px", color: "#374151", marginBottom: "6px" }}>
                <Phone className="w-3.5 h-3.5 inline-block mr-1" style={{ verticalAlign: "-2px" }} />
                Número do Morador
              </label>
              <input
                type="tel"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="(11) 99999-9999"
                style={{
                  width: "100%", padding: "14px", borderRadius: "10px",
                  border: "2px solid #d1d5db", fontSize: "16px", fontWeight: 600, color: "#374151",
                }}
              />
            </div>

            <button
              onClick={handleNotifyWhatsApp}
              disabled={!whatsappNumber.trim()}
              style={{
                width: "100%", padding: "16px", borderRadius: "12px", border: "none",
                background: whatsappNumber.trim() ? "#25d366" : "#d1d5db",
                color: p.text, fontWeight: 700, fontSize: "16px",
                cursor: whatsappNumber.trim() ? "pointer" : "not-allowed", marginTop: "16px",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              }}
            >
              <MessageCircle className="w-5 h-5" /> Enviar Aviso pelo WhatsApp
            </button>

            {visitor && (
              <div style={{ marginTop: "16px", background: "#f8fafc", borderRadius: "10px", padding: "12px", border: "1px solid #e5e7eb" }}>
                <p style={{ fontSize: "12px", color: "#6b7280", fontWeight: 700, marginBottom: "4px" }}>Prévia da mensagem:</p>
                <p style={{ fontSize: "12px", color: "#374151", lineHeight: 1.5 }}>
                  🔔 AVISO DE CHEGADA<br />
                  Visitante: {visitor.visitante.nome}<br />
                  Morador: {visitor.morador.nome} — Bloco {visitor.morador.bloco} Apt {visitor.morador.unidade}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
