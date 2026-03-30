import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ShieldCheck,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  Loader2,
  MessageSquare,
  Link2,
  User,
  Building,
  ScanFace,
  Camera,
  Fingerprint,
  FileText,
  Download,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import ReportModal from "@/components/ReportModal";
import TutorialButton, { FlowPortaria, FlowMorador, TSection, TStep, TBullet } from "@/components/TutorialButton";
import { gerarPdfPreAuth, gerarRelatorioPreAuths, gerarRelatorioPreAuthsComGraficos } from "@/lib/pdfUtils";
import { apiFetch } from "@/lib/api";
import { useTheme } from "@/hooks/useTheme";

interface PreAuth {
  id: number;
  morador_name: string;
  morador_phone: string | null;
  bloco: string | null;
  apartamento: string | null;
  visitante_nome: string;
  visitante_documento: string | null;
  visitante_telefone: string | null;
  visitante_foto: string | null;
  tipo: string;
  data_inicio: string;
  data_fim: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  observacao: string | null;
  status: string;
  entrada_confirmada_at: string | null;
  token: string;
  created_at: string;
}

interface FaceDescriptorEntry {
  id: number;
  visitante_nome: string;
  face_descriptor: number[];
}

const API = "/api";

export default function AutorizacoesPrevias() {
  const { isDark, p } = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [auths, setAuths] = useState<PreAuth[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ativa");
  const [confirming, setConfirming] = useState<number | null>(null);
  const [showReport, setShowReport] = useState(false);

  // Face recognition matching (server-side)
  const [showFaceScanner, setShowFaceScanner] = useState(false);
  const [faceScanning, setFaceScanning] = useState(false);
  const [faceLoading, setFaceLoading] = useState(false);
  const [faceMatch, setFaceMatch] = useState<{ id: number; nome: string; distance: number } | null>(null);
  const [faceNoMatch, setFaceNoMatch] = useState(false);
  const scanVideoRef = useRef<HTMLVideoElement>(null);
  const scanCanvasRef = useRef<HTMLCanvasElement>(null);
  const scanStreamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAuths = async () => {
    try {
      const params = new URLSearchParams();
      if (filter !== "todas") params.append("status", filter);
      if (search) params.append("search", search);

      const res = await apiFetch(`${API}/pre-authorizations?${params}`);
      if (res.ok) {
        const data = await res.json();
        setAuths(data);
      }
    } catch (err) {
      console.error("Erro ao buscar autorizações:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuths();
  }, [filter]);

  useEffect(() => {
    const timer = setTimeout(() => fetchAuths(), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Auto-refresh every 15s
  useEffect(() => {
    const interval = setInterval(fetchAuths, 15000);
    return () => clearInterval(interval);
  }, [filter, search]);

  // Cleanup face scanner on unmount
  useEffect(() => {
    return () => stopFaceScanner();
  }, []);

  // ─── Face Recognition Functions (server-side) ────────────────────
  const startFaceScanner = async () => {
    setShowFaceScanner(true);
    setFaceMatch(null);
    setFaceNoMatch(false);
    setFaceScanning(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      scanStreamRef.current = stream;
      if (scanVideoRef.current) {
        scanVideoRef.current.srcObject = stream;
        scanVideoRef.current.play();
      }
      setTimeout(() => startFaceCapture(), 1000);
    } catch {
      alert("Não foi possível acessar a câmera.");
      setShowFaceScanner(false);
    }
  };

  const startFaceCapture = () => {
    setFaceScanning(true);
    let frameCount = 0;

    scanIntervalRef.current = setInterval(async () => {
      if (!scanVideoRef.current || scanVideoRef.current.readyState < 2) return;
      frameCount++;

      // A cada 1.5s, capturar e enviar ao servidor
      if (frameCount % 3 === 0) {
        const canvas = document.createElement("canvas");
        canvas.width = scanVideoRef.current.videoWidth;
        canvas.height = scanVideoRef.current.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(scanVideoRef.current, 0, 0);
        const photo = canvas.toDataURL("image/jpeg", 0.7);

        // Parar captura enquanto aguarda servidor
        if (scanIntervalRef.current) {
          clearInterval(scanIntervalRef.current);
          scanIntervalRef.current = null;
        }

        try {
          const res = await apiFetch(`${API}/face/compare-preauths`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ photo }),
          });

          if (!res.ok) {
            // Servidor ainda carregando, tentar novamente
            startFaceCapture();
            return;
          }

          const data = await res.json();

          if (data.matched && data.preAuth) {
            setFaceScanning(false);
            setFaceMatch({
              id: data.preAuth.id,
              nome: data.preAuth.visitante_nome,
              distance: data.distance,
            });
            setTimeout(() => {
              stopFaceScannerStream();
              setShowFaceScanner(false);
            }, 1500);
          } else if (data.error && data.error.includes("rosto")) {
            // Nenhum rosto detectado, continuar
            startFaceCapture();
          } else {
            // Não encontrou match
            setFaceScanning(false);
            setFaceNoMatch(true);
            setTimeout(() => {
              stopFaceScannerStream();
              setShowFaceScanner(false);
            }, 2000);
          }
        } catch (err) {
          console.error("Face matching error:", err);
          startFaceCapture();
        }
      }
    }, 500);

    // Timeout after 20s
    setTimeout(() => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
        setFaceScanning(false);
        setFaceNoMatch(true);
        setTimeout(() => {
          stopFaceScannerStream();
          setShowFaceScanner(false);
        }, 2000);
      }
    }, 20000);
  };

  const stopFaceScannerStream = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (scanStreamRef.current) {
      scanStreamRef.current.getTracks().forEach((t) => t.stop());
      scanStreamRef.current = null;
    }
    setFaceScanning(false);
  };

  const stopFaceScanner = () => {
    stopFaceScannerStream();
    setShowFaceScanner(false);
    setFaceMatch(null);
    setFaceNoMatch(false);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  };

  const isExpired = (auth: PreAuth) => {
    const now = new Date();
    const endDate = new Date(auth.data_fim + "T23:59:59");
    return now > endDate;
  };

  const isWithinSchedule = (auth: PreAuth) => {
    const now = new Date();
    const startDate = new Date(auth.data_inicio + "T00:00:00");
    const endDate = new Date(auth.data_fim + "T23:59:59");
    if (now < startDate || now > endDate) return false;

    if (auth.hora_inicio && auth.hora_fim) {
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      if (currentTime < auth.hora_inicio || currentTime > auth.hora_fim) return false;
    }
    return true;
  };

  const handleConfirmEntry = async (auth: PreAuth) => {
    setConfirming(auth.id);
    try {
      const res = await apiFetch(`${API}/pre-authorizations/${auth.id}/confirmar-entrada`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        // Enviar WhatsApp ao morador com informações de entrada
        if (auth.morador_phone) {
          const now = new Date();
          const dataHora = now.toLocaleString("pt-BR");

          const msgLines = [
            `*Portaria - Confirmacao de Entrada*`,
            ``,
            `O visitante autorizado chegou:`,
            ``,
            `*Visitante:* ${auth.visitante_nome}`,
            auth.visitante_documento ? `*Documento:* ${auth.visitante_documento}` : "",
            `*Destino:* ${auth.bloco || ""} - Apt ${auth.apartamento || ""}`,
            `*Entrada:* ${dataHora}`,
            auth.observacao ? `*Obs:* ${auth.observacao}` : "",
            ``,
            `Entrada confirmada pela portaria.`,
          ].filter(Boolean);

          const message = encodeURIComponent(msgLines.join("\n"));
          const phone = auth.morador_phone.replace(/\D/g, "");
          window.open(`https://wa.me/55${phone}?text=${message}`, "_blank");
        }

        fetchAuths();
      }
    } catch (err) {
      console.error("Erro ao confirmar entrada:", err);
    } finally {
      setConfirming(null);
    }
  };

  const statusStyle = (status: string) => {
    switch (status) {
      case "ativa": return { bg: "#dcfce7", color: "#16a34a", label: "Ativa", icon: CheckCircle2 };
      case "utilizada": return { bg: "#e8e9ef", color: "#2d3354", label: "Utilizada", icon: CheckCircle2 };
      case "expirada": return { bg: "#f3f4f6", color: "#6b7280", label: "Expirada", icon: Clock };
      case "cancelada": return { bg: "#fef2f2", color: "#dc2626", label: "Cancelada", icon: XCircle };
      default: return { bg: "#f3f4f6", color: "#6b7280", label: status, icon: Clock };
    }
  };

  const activeAuths = auths.filter((a) => a.status === "ativa" && !isExpired(a));
  const otherAuths = auths.filter((a) => a.status !== "ativa" || isExpired(a));

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: p.pageBg }}>
      {/* Header */}
      <header className="sticky top-0 z-40" style={{ background: p.headerBg, borderBottom: p.headerBorder, boxShadow: p.headerShadow, color: p.text }}>
        <div style={{ padding: "0 24px", height: "4.5rem", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => navigate(-1)} style={{ width: 40, height: 40, borderRadius: 12, background: p.btnBg, border: p.btnBorder, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 style={{ fontWeight: 700, fontSize: 16 }}>Autorizações Prévias</h1>
            <p style={{ color: isDark ? "rgba(255,255,255,0.6)" : "#64748b", fontSize: 11 }}>Visitantes pré-autorizados pelos moradores</p>
          </div>
          <TutorialButton title="Autorizacoes Previas">
            <TSection icon={<span>📋</span>} title="O QUE E ESTA FUNCAO?">
              <p>Lista todas as <strong>autorizacoes de visitantes criadas pelos moradores</strong>. Quando um morador autoriza um visitante pelo app, a autorizacao aparece aqui automaticamente para o porteiro consultar. Quando o visitante chegar, o porteiro so confirma e libera a entrada.</p>
            </TSection>
            <FlowMorador>
              <TStep n={1}>Morador abre o app e toca em <strong>"Autorizar Visitante"</strong></TStep>
              <TStep n={2}>Preenche <strong>nome do visitante</strong>, data e horario da visita</TStep>
              <TStep n={3}>Envia a autorizacao — pode adicionar CPF e veiculo (opcional)</TStep>
              <TStep n={4}>A autorizacao e <strong>enviada automaticamente</strong> para a portaria</TStep>
              <p style={{ marginTop: "8px", fontSize: "13px", color: "#166534" }}>👉 <strong>Portaria ve:</strong> A autorizacao aparece nesta lista com status "Ativa" e todos os dados do visitante.</p>
            </FlowMorador>
            <FlowPortaria>
              <TStep n={1}>Visitante chega na portaria e se identifica</TStep>
              <TStep n={2}>Porteiro <strong>busca o nome</strong> na lista de autorizacoes ou usa reconhecimento facial</TStep>
              <TStep n={3}>Confirma que a autorizacao esta <strong>ativa e dentro do horario</strong></TStep>
              <TStep n={4}>Toca em <strong>"Confirmar Entrada"</strong> para liberar o visitante</TStep>
              <TStep n={5}>O sistema registra a entrada com data, hora e porteiro responsavel</TStep>
              <p style={{ marginTop: "8px", fontSize: "13px", color: "#2d3354" }}>👉 <strong>O morador ve:</strong> No app, o status muda para "Utilizada" com a data e hora da entrada.</p>
            </FlowPortaria>
            <TSection icon={<span>🔍</span>} title="STATUS DAS AUTORIZACOES">
              <TBullet><strong style={{ color: "#16a34a" }}>Ativa</strong> — Visitante autorizado e pode entrar (dentro da data/horario)</TBullet>
              <TBullet><strong style={{ color: "#2d3354" }}>Utilizada</strong> — Visitante ja entrou (autorizacao consumida)</TBullet>
              <TBullet><strong style={{ color: "#d97706" }}>Pendente</strong> — Ainda nao chegou a data/hora da visita</TBullet>
              <TBullet><strong style={{ color: "#dc2626" }}>Expirada</strong> — O prazo venceu sem o visitante aparecer</TBullet>
              <TBullet><strong style={{ color: "#6b7280" }}>Cancelada</strong> — Morador cancelou a autorizacao</TBullet>
            </TSection>
            <TSection icon={<span>⭐</span>} title="DICAS IMPORTANTES">
              <TBullet>Use a <strong>busca</strong> para encontrar autorizacoes rapidamente pelo nome do visitante ou morador</TBullet>
              <TBullet>Autorizacoes <strong>expiram automaticamente</strong> apos o horario definido pelo morador</TBullet>
              <TBullet>O morador pode <strong>cancelar</strong> uma autorizacao a qualquer momento pelo app</TBullet>
              <TBullet>Visitantes frequentes podem ter <strong>varias autorizacoes</strong> ativas simultaneamente</TBullet>
            </TSection>
          </TutorialButton>
          <div className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-full shrink-0">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="text-xs font-bold">{activeAuths.length}</span>
          </div>
        </div>
      </header>

      {/* Face Scanner */}
      {showFaceScanner && (
        <div style={{ padding: "12px 24px 0" }}>
          <div className="rounded-2xl overflow-hidden relative" style={{ border: "3px solid #6366f1" }}>
            <video
              ref={scanVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full"
              style={{ maxHeight: "400px", objectFit: "contain", background: "#f1f5f9" }}
            />
            <canvas
              ref={scanCanvasRef}
              className="absolute top-0 left-0 w-full h-full"
              style={{ pointerEvents: "none" }}
            />
            <div
              className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-2 py-2.5 text-white text-xs font-bold"
              style={{
                backgroundColor: faceMatch
                  ? "rgba(22, 163, 74, 0.9)"
                  : faceNoMatch
                  ? "rgba(220, 38, 38, 0.9)"
                  : faceLoading
                  ? "rgba(99, 102, 241, 0.85)"
                  : faceScanning
                  ? "rgba(99, 102, 241, 0.85)"
                  : "rgba(99, 102, 241, 0.85)",
              }}
            >
              {faceLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Carregando reconhecimento facial...
                </>
              ) : faceMatch ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Visitante identificado: {faceMatch.nome}
                </>
              ) : faceNoMatch ? (
                <>
                  <XCircle className="w-4 h-4" />
                  Nenhuma correspondência encontrada
                </>
              ) : faceScanning ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Escaneando rosto... Posicione o visitante na câmera
                </>
              ) : (
                <>
                  <Camera className="w-3.5 h-3.5" />
                  Iniciando câmera...
                </>
              )}
            </div>
            <button
              onClick={stopFaceScanner}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Face Match Result Banner */}
      {faceMatch && !showFaceScanner && (
        <div
          className="mx-6 mt-3 rounded-xl flex items-center gap-3 animate-pulse"
          style={{ padding: "12px 16px", backgroundColor: "#dcfce7", border: "2px solid #16a34a" }}
        >
          <Fingerprint className="w-6 h-6 shrink-0" style={{ color: "#16a34a" }} />
          <div className="flex-1">
            <p className="text-sm font-bold" style={{ color: "#16a34a" }}>Visitante Identificado por Biometria</p>
            <p className="text-xs text-muted-foreground">
              <strong>{faceMatch.nome}</strong> — Reconhecimento: {(1 - faceMatch.distance) >= 0.55 ? "✅ Excelente" : "✔ Suficiente"}
            </p>
          </div>
          <button onClick={() => setFaceMatch(null)} className="text-xs underline" style={{ color: "#16a34a" }}>
            Fechar
          </button>
        </div>
      )}

      {/* Search + Face Scan Button */}
      <div style={{ padding: "12px 20px" }}>
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0 flex items-center gap-2 h-10 rounded-lg border border-border bg-card" style={{ paddingLeft: "24px", paddingRight: "12px" }}>
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Buscar visitante, morador..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none min-w-0"
            />
          </div>
          <button
            onClick={startFaceScanner}
            disabled={showFaceScanner}
            className="shrink-0 flex items-center gap-2 text-white text-xs font-bold transition-all"
            style={{
              backgroundColor: showFaceScanner ? "#668ecc" : "#003580",
              height: "40px",
              padding: "0 16px",
              borderRadius: "10px",
              whiteSpace: "nowrap",
            }}
            title="Identificar visitante por biometria facial"
          >
            <ScanFace className="w-4 h-4 shrink-0" />
            Scan
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ padding: "0 24px 12px" }}>
        <div className="flex gap-3 overflow-x-auto items-center">
          {[
            { val: "ativa", label: "Ativas" },
            { val: "todas", label: "Todas" },
            { val: "utilizada", label: "Utilizadas" },
            { val: "cancelada", label: "Canceladas" },
          ].map((f) => (
            <button
              key={f.val}
              onClick={() => setFilter(f.val)}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all"
              style={{
                backgroundColor: filter === f.val ? "#003580" : "#fff",
                color: filter === f.val ? "#fff" : "#374151",
                border: filter === f.val ? "2px solid #003580" : "2px solid #d1d5db",
                minWidth: "80px",
                textAlign: "center",
              }}
            >
              {f.label}
            </button>
          ))}
          <button
            onClick={() => setShowReport(true)}
            className="ml-auto flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all"
            style={{ backgroundColor: "#fff", color: "#d97706", border: "2px solid #d97706", minWidth: "100px" }}
          >
            <FileText className="w-4 h-4" />
            Relatório
          </button>
        </div>
      </div>

      <ReportModal
        show={showReport}
        onClose={() => setShowReport(false)}
        title="Relatorio de Autorizacoes Previas"
        onGenerate={(dateFrom, dateTo, withCharts) => {
          const filtered = auths.filter((a) => {
            const d = a.created_at?.split("T")[0] || "";
            return d >= dateFrom && d <= dateTo;
          });
          if (withCharts) {
            gerarRelatorioPreAuthsComGraficos(filtered, dateFrom, dateTo, user?.condominio_nome);
          } else {
            gerarRelatorioPreAuths(filtered, dateFrom, dateTo, user?.condominio_nome);
          }
        }}
      />

      {/* List */}
      <main className="flex-1 overflow-y-auto" style={{ padding: "8px 24px 100px" }}>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : auths.length === 0 ? (
          <div className="text-center py-16">
            <ShieldCheck className="w-12 h-12 mx-auto mb-3" style={{ color: p.textDim }} />
            <p className="text-sm" style={{ color: p.text }}>Nenhuma autorização encontrada</p>
            <p className="text-xs mt-1" style={{ color: isDark ? "rgba(255,255,255,0.6)" : "#64748b" }}>
              As autorizações são criadas pelos moradores
            </p>
          </div>
        ) : (
          <>
            {/* Active authorizations */}
            {activeAuths.length > 0 && (
              <div className="mb-4">
                <h2 className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "#16a34a" }} />
                  AUTORIZAÇÕES ATIVAS ({activeAuths.length})
                </h2>
                <div className="space-y-3">
                  {activeAuths.map((a) => (
                    <AuthCard
                      key={a.id}
                      auth={a}
                      isWithinSchedule={isWithinSchedule(a)}
                      confirming={confirming === a.id}
                      onConfirm={() => handleConfirmEntry(a)}
                      formatDate={formatDate}
                      highlighted={faceMatch?.id === a.id}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Other authorizations */}
            {otherAuths.length > 0 && filter !== "ativa" && (
              <div>
                <h2 className="text-xs font-bold text-muted-foreground mb-2">HISTÓRICO</h2>
                <div className="space-y-2">
                  {otherAuths.map((a) => {
                    const st = statusStyle(a.status);
                    return (
                      <div
                        key={a.id}
                        className="rounded-xl border border-border"
                        style={{ padding: "12px 14px", opacity: 0.7 }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-foreground">{a.visitante_nome}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {a.morador_name} · {a.bloco} Apt {a.apartamento} · {formatDate(a.data_inicio)}
                            </p>
                          </div>
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ color: st.color, backgroundColor: `${st.color}15` }}
                          >
                            {st.label}
                          </span>
                        </div>
                        {a.status === "utilizada" && a.entrada_confirmada_at && (
                          <p className="text-[10px] mt-1" style={{ color: "#2d3354" }}>
                            Entrada: {new Date(a.entrada_confirmada_at).toLocaleString("pt-BR")}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ─── Active Auth Card ────────────────────────────────────
function AuthCard({
  auth,
  isWithinSchedule,
  confirming,
  onConfirm,
  formatDate,
  highlighted,
}: {
  auth: PreAuth;
  isWithinSchedule: boolean;
  confirming: boolean;
  onConfirm: () => void;
  formatDate: (d: string) => string;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`rounded-xl overflow-hidden ${highlighted ? "ring-4 ring-green-400 ring-offset-2" : ""}`}
      style={{
        border: highlighted ? "2px solid #16a34a" : isWithinSchedule ? "2px solid #16a34a" : "2px solid #e5e7eb",
        backgroundColor: highlighted ? "#dcfce7" : isWithinSchedule ? "#f0fdf4" : "#fff",
      }}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-3 py-1.5"
        style={{
          backgroundColor: isWithinSchedule ? "#16a34a" : "#6b7280",
        }}
      >
        <span className="text-[10px] text-white font-bold flex items-center gap-1">
          {auth.tipo === "auto_cadastro" ? (
            <><Link2 className="w-3 h-3" /> AUTO CADASTRO — Enviado pelo morador</>
          ) : (
            <><ShieldCheck className="w-3 h-3" /> AUTORIZAÇÃO SIMPLES</>
          )}
        </span>
        {isWithinSchedule && (
          <span className="text-[9px] text-white/90 bg-white/20 px-1.5 py-0.5 rounded-full font-bold">
            DENTRO DO HORÁRIO
          </span>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: "14px 16px" }}>
        {/* Visitor info */}
        <div className="flex items-start gap-3 mb-3">
          {auth.visitante_foto ? (
            <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-border">
              <img src={auth.visitante_foto} alt="" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div
              className="w-14 h-14 rounded-xl shrink-0 flex items-center justify-center"
              style={{ backgroundColor: "#f3f4f6", border: "1px solid #e5e7eb" }}
            >
              <User className="w-6 h-6 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1">
            <h3 className="font-bold text-foreground text-base">{auth.visitante_nome}</h3>
            {auth.visitante_documento && (
              <p className="text-xs text-muted-foreground">Doc: {auth.visitante_documento}</p>
            )}
            {auth.visitante_telefone && (
              <p className="text-xs text-muted-foreground">Tel: {auth.visitante_telefone}</p>
            )}
          </div>
        </div>

        {/* Morador info */}
        <div
          className="rounded-lg flex items-center gap-2 mb-3"
          style={{ padding: "8px 12px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}
        >
          <Building className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-medium text-foreground">
              {auth.bloco} — Apt {auth.apartamento}
            </p>
            <p className="text-[10px] text-muted-foreground">
              Autorizado por: <strong>{auth.morador_name}</strong>
            </p>
          </div>
        </div>

        {/* Schedule */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground mb-3">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {formatDate(auth.data_inicio)} a {formatDate(auth.data_fim)}
          </span>
          {auth.hora_inicio && (
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {auth.hora_inicio} às {auth.hora_fim || "--"}
            </span>
          )}
        </div>

        {/* Observação */}
        {auth.observacao && (
          <div
            className="rounded-lg mb-3"
            style={{ padding: "8px 12px", backgroundColor: "#fefce8", border: "1px solid #fde68a" }}
          >
            <p className="text-[11px] text-amber-700 flex items-start gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{auth.observacao}</span>
            </p>
          </div>
        )}

        {/* Biometric Match Badge */}
        {highlighted && (
          <div
            className="rounded-lg mb-3 flex items-center gap-2"
            style={{ padding: "8px 12px", backgroundColor: "#dcfce7", border: "1px solid #86efac" }}
          >
            <Fingerprint className="w-4 h-4" style={{ color: "#16a34a" }} />
            <span className="text-xs font-bold" style={{ color: "#16a34a" }}>
              ✓ Identidade confirmada por biometria facial
            </span>
          </div>
        )}

        {/* Confirm Entry Button */}
        <button
          onClick={onConfirm}
          disabled={confirming}
          className="w-full flex items-center justify-center gap-2 rounded-xl text-white font-semibold text-sm transition-all"
          style={{
            height: "48px",
            backgroundColor: "#25d366",
            opacity: confirming ? 0.6 : 1,
          }}
        >
          {confirming ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.96 11.96 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.316 0-4.469-.756-6.209-2.034l-.356-.28-3.278 1.099 1.099-3.278-.28-.356A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
              </svg>
              Confirmar Entrada e Avisar Morador
            </>
          )}
        </button>

        {/* Baixar PDF */}
        <button
          onClick={() => gerarPdfPreAuth(auth)}
          className="w-full flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all"
          style={{
            height: "40px",
            marginTop: "8px",
            backgroundColor: "#e6edf7",
            color: "#003580",
            border: "1px solid #ddd6fe",
          }}
        >
          <Download className="w-4 h-4" />
          Baixar PDF deste Registro
        </button>
      </div>
    </div>
  );
}
