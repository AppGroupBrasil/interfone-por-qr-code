import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import TutorialButton, { FlowMorador, TSection, TStep, TBullet } from "@/components/TutorialButton";
import { compressImage } from "@/lib/imageUtils";
import { APP_ORIGIN } from "@/lib/config";
import { apiFetch } from "@/lib/api";
import {
  ArrowLeft,
  QrCode,
  Camera,
  User,
  FileText,
  Clock,
  Calendar,
  Plus,
  Trash2,
  Share2,
  Download,
  CheckCircle2,
  AlertTriangle,
  Eye,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import ComoFunciona from "@/components/ComoFunciona";

/* ═══════════════════════════════════════════════
   MORADOR — Gerar QR Code de Visitante
   ═══════════════════════════════════════════════ */

interface VisitorQR {
  id: string;
  nome: string;
  documento: string;
  foto: string | null;
  dataInicio: string;
  horaInicio: string;
  dataFim: string;
  horaFim: string;
  parentesco: string;
  observacoes: string;
  createdAt: string;
  status: "ativo" | "expirado" | "utilizado";
}

const STORAGE_KEY = "morador_qr_visitantes";
const CONFIG_KEY = "sindico_qr_config";

interface QRConfig {
  fotoObrigatoria: boolean;
  documentoObrigatorio: boolean;
  parentescoObrigatorio: boolean;
  observacoesObrigatorio: boolean;
}

const defaultConfig: QRConfig = {
  fotoObrigatoria: false,
  documentoObrigatorio: true,
  parentescoObrigatorio: false,
  observacoesObrigatorio: false,
};

function loadConfig(): QRConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) return { ...defaultConfig, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return defaultConfig;
}

function loadVisitors(): VisitorQR[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveVisitors(list: VisitorQR[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function generateQRData(visitor: VisitorQR, morador: { nome?: string; block?: string; unit?: string; condominio_nome?: string }) {
  const payload = {
    type: "APPINTERFONE_VISITOR",
    v: 1,
    id: visitor.id,
    visitante: {
      nome: visitor.nome,
      documento: visitor.documento,
      foto: visitor.foto,
      parentesco: visitor.parentesco,
      observacoes: visitor.observacoes,
    },
    autorizacao: {
      dataInicio: visitor.dataInicio,
      horaInicio: visitor.horaInicio,
      dataFim: visitor.dataFim,
      horaFim: visitor.horaFim,
    },
    morador: {
      nome: morador.nome || "",
      bloco: morador.block || "",
      unidade: morador.unit || "",
      condominio: morador.condominio_nome || "",
      telefone: (morador as any).phone || "",
    },
    createdAt: visitor.createdAt,
  };
  return JSON.stringify(payload);
}

export default function MoradorQRVisitante() {
  const { isDark, p } = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const config = loadConfig();

  const [visitors, setVisitors] = useState<VisitorQR[]>(loadVisitors());
  const [showForm, setShowForm] = useState(false);
  const [viewQR, setViewQR] = useState<VisitorQR | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [nome, setNome] = useState("");
  const [documento, setDocumento] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
  const [dataInicio, setDataInicio] = useState(() => new Date().toISOString().slice(0, 10));
  const [horaInicio, setHoraInicio] = useState("08:00");
  const [dataFim, setDataFim] = useState(() => new Date().toISOString().slice(0, 10));
  const [horaFim, setHoraFim] = useState("18:00");
  const [parentesco, setParentesco] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);

  const updateStatus = (list: VisitorQR[]): VisitorQR[] => {
    const now = new Date();
    return list.map((v) => {
      if (v.status === "utilizado") return v;
      const end = new Date(`${v.dataFim}T${v.horaFim}`);
      if (now > end) return { ...v, status: "expirado" as const };
      return { ...v, status: "ativo" as const };
    });
  };

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const compressed = await compressImage(reader.result as string, "face");
      setFoto(compressed);
    };
    reader.readAsDataURL(file);
  };

  const isFormValid = () => {
    if (!nome.trim()) return false;
    if (config.documentoObrigatorio && !documento.trim()) return false;
    if (config.fotoObrigatoria && !foto) return false;
    if (config.parentescoObrigatorio && !parentesco.trim()) return false;
    if (config.observacoesObrigatorio && !observacoes.trim()) return false;
    if (!dataInicio || !horaInicio || !dataFim || !horaFim) return false;
    return true;
  };

  const handleCreate = () => {
    if (!isFormValid()) return;
    const newVisitor: VisitorQR = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      nome: nome.trim(),
      documento: documento.trim(),
      foto,
      dataInicio,
      horaInicio,
      dataFim,
      horaFim,
      parentesco: parentesco.trim(),
      observacoes: observacoes.trim(),
      createdAt: new Date().toISOString(),
      status: "ativo",
    };
    const updated = updateStatus([newVisitor, ...visitors]);
    setVisitors(updated);
    saveVisitors(updated);
    resetForm();
    setShowForm(false);
    setViewQR(newVisitor);
  };

  const handleDelete = (id: string) => {
    const updated = visitors.filter((v) => v.id !== id);
    setVisitors(updated);
    saveVisitors(updated);
  };

  const resetForm = () => {
    setNome("");
    setDocumento("");
    setFoto(null);
    setDataInicio(new Date().toISOString().slice(0, 10));
    setHoraInicio("08:00");
    setDataFim(new Date().toISOString().slice(0, 10));
    setHoraFim("18:00");
    setParentesco("");
    setObservacoes("");
  };

  const handleShare = async (visitor: VisitorQR) => {
    const qrData = generateQRData(visitor, user || {});

    // Cria token curto no servidor
    let qrLink = "";
    try {
      const resp = await apiFetch("/api/visitor-qr/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qr_data: qrData,
          visitor_name: visitor.nome,
          visitor_doc: visitor.documento || "",
          visitor_parentesco: visitor.parentesco || "",
          data_inicio: visitor.dataInicio,
          hora_inicio: visitor.horaInicio,
          data_fim: visitor.dataFim,
          hora_fim: visitor.horaFim,
          morador_nome: user?.name || "",
          bloco: user?.block || "",
          unidade: user?.unit || "",
          condominio_nome: user?.condominio_nome || "",
        }),
      });
      const data = await resp.json();
      if (data.token) {
        qrLink = `${APP_ORIGIN}/visitante/qr/${data.token}`;
      }
    } catch (err) {
      console.warn("Erro ao criar share token:", err);
    }

    const lines = [
      `\u{1F511} Autorização de Entrada - ${user?.condominio_nome || "Condomínio"}`,
      ``,
      `Visitante: ${visitor.nome}`,
      `Validade: ${visitor.dataInicio} ${visitor.horaInicio} até ${visitor.dataFim} ${visitor.horaFim}`,
      `Morador: ${user?.name || ""} - Bloco ${user?.block || ""} Apt ${user?.unit || ""}`,
      ``,
      ...(qrLink ? [`\u{1F4F2} Acesse seu QR Code:`, qrLink, ``] : []),
      `Apresente o QR Code na portaria.`,
    ];
    const text = lines.join("\n");

    if (navigator.share) {
      navigator.share({ title: "Autorização de Entrada", text }).catch(() => {
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
      });
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    }
  };

  const statusColor = (s: string) => {
    if (s === "ativo") return { bg: "#dcfce7", text: "#166534", label: "ATIVO" };
    if (s === "expirado") return { bg: "#fee2e2", text: "#991b1b", label: "EXPIRADO" };
    return { bg: "#e8e9ef", text: "#2d3354", label: "UTILIZADO" };
  };

  const displayVisitors = updateStatus(visitors);

  return (
    <div style={{ minHeight: '100dvh', background: isDark ? "linear-gradient(180deg, #001533 0%, #002254 25%, #003580 55%, #004aad 100%)" : "#f0f4f8", display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 40, background: isDark ? "linear-gradient(135deg, #001533 0%, #002a66 50%, #004aad 100%)" : "#ffffff", borderBottom: isDark ? '1px solid rgba(255,255,255,0.08)' : "1px solid #e2e8f0", boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.3)' : "0 2px 8px rgba(0,0,0,0.06)", padding: '18px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={() => navigate(-1)} style={{ padding: '0.5rem', borderRadius: 14, background: isDark ? 'rgba(255,255,255,0.08)' : '#f8fafc', border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #cbd5e1', color: isDark ? '#fff' : "#1e293b", cursor: 'pointer' }}>
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontWeight: 800, fontSize: '1.125rem', color: isDark ? '#fff' : "#1e293b", display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <QrCode className="w-5 h-5" /> QR Code de Visitante
            </h1>
            <p style={{ fontSize: '0.75rem', color: isDark ? '#93c5fd' : "#475569", margin: 0 }}>Gere autorizações com QR Code</p>
          </div>
          <TutorialButton title="QR Code de Visitante">
            <TSection icon={<span>📋</span>} title="O QUE É ESTA FUNÇÃO?">
              <p>Gere <strong>QR Codes de autorização</strong> para seus visitantes. Você cria a autorização, compartilha o QR Code por WhatsApp, e o visitante apresenta na portaria. O porteiro escaneia e libera a entrada instantaneamente — <strong>sem precisar ligar para você</strong>.</p>
            </TSection>
            <FlowMorador>
              <TStep n={1}>Toque em <strong>"+Novo"</strong> para criar uma autorização</TStep>
              <TStep n={2}>Informe o <strong>nome completo do visitante</strong></TStep>
              <TStep n={3}>Adicione <strong>CPF</strong> e <strong>veículo</strong> (opcional — ajuda a portaria identificar)</TStep>
              <TStep n={4}>Defina a <strong>data e horário de validade</strong> (até quando o QR Code funciona)</TStep>
              <TStep n={5}>O sistema gera o <strong>QR Code automaticamente</strong></TStep>
              <TStep n={6}>Toque em <strong>"Compartilhar"</strong> para enviar por WhatsApp ao visitante</TStep>
              <p style={{ marginTop: "8px", fontSize: "13px", color: "#166534" }}>👉 <strong>Na portaria:</strong> O porteiro escaneia o QR Code com o app, vê todos os dados (nome, morador, bloco, horário) e libera a entrada com um toque.</p>
            </FlowMorador>
            <TSection icon={<span>🔧</span>} title="FUNÇÕES DISPONÍVEIS">
              <TBullet><strong>Compartilhar via WhatsApp</strong> — Envie o QR Code diretamente para o visitante por WhatsApp</TBullet>
              <TBullet><strong>Baixar imagem</strong> — Salve o QR Code como imagem no seu celular</TBullet>
              <TBullet><strong>Múltiplas autorizações</strong> — Crie vários QR Codes para visitantes diferentes ao mesmo tempo</TBullet>
              <TBullet><strong>Validade configurável</strong> — Defina até que data e hora o QR Code funciona</TBullet>
              <TBullet><strong>Excluir</strong> — Cancele uma autorização a qualquer momento (o QR Code para de funcionar)</TBullet>
            </TSection>
            <TSection icon={<span>📱</span>} title="COMO O VISITANTE USA">
              <TStep n={1}>Recebe o QR Code por <strong>WhatsApp</strong> de você</TStep>
              <TStep n={2}>Chega na portaria e mostra o <strong>QR Code na tela do celular</strong></TStep>
              <TStep n={3}>O porteiro <strong>escaneia com o app</strong> e vê todos os dados</TStep>
              <TStep n={4}>Porteiro <strong>libera a entrada</strong> com um toque</TStep>
            </TSection>
            <TSection icon={<span>⭐</span>} title="DICAS IMPORTANTES">
              <TBullet>O QR Code <strong>expira automaticamente</strong> na data/hora definida — não funciona depois</TBullet>
              <TBullet>Cada QR Code é <strong>único</strong> — não pode ser reusado por outra pessoa</TBullet>
              <TBullet>Ideal para <strong>festas e eventos</strong> — crie vários QR Codes de uma vez</TBullet>
              <TBullet>O visitante <strong>não precisa instalar nenhum app</strong> — só mostra o QR Code na tela</TBullet>
              <TBullet>Se o visitante perder o QR Code, você pode <strong>compartilhar novamente</strong></TBullet>
            </TSection>
          </TutorialButton>
        </div>
      </header>

      <main style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 120px' }}>

        <ComoFunciona steps={[
          "📋 Gere QR Code para seu visitante antecipadamente",
          "📱 Envie o QR Code por WhatsApp ou link",
          "🚪 Visitante apresenta QR Code na portaria",
          "✅ Acesso liberado sem ligar para você",
        ]} />

        {/* Full-width + Novo button */}
        {!showForm && !viewQR && (
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: '14px',
              border: isDark ? '1.5px solid rgba(255,255,255,0.15)' : '1.5px solid #cbd5e1',
              background: isDark ? 'linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.06))' : 'linear-gradient(135deg, #e2e8f0, #f1f5f9)',
              color: isDark ? '#fff' : "#1e293b",
              fontWeight: 700,
              fontSize: '15px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginBottom: '16px',
              transition: 'all 0.2s',
            }}
          >
            <Plus className="w-5 h-5" /> Novo
          </button>
        )}

        {/* Empty state */}
        {displayVisitors.length === 0 && !showForm && !viewQR && (
          <div style={{ textAlign: 'center', padding: '48px 16px' }}>
            <div style={{ width: 72, height: 72, borderRadius: 22, background: isDark ? 'linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04))' : 'linear-gradient(135deg, #e2e8f0, #f1f5f9)', border: isDark ? '1.5px solid rgba(255,255,255,0.1)' : '1.5px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
              <QrCode className="w-9 h-9" style={{ color: isDark ? '#93c5fd' : "#475569" }} />
            </div>
            <p style={{ fontWeight: 700, fontSize: '18px', color: isDark ? '#fff' : "#1e293b", marginTop: '16px' }}>
              Nenhuma autorização criada
            </p>
            <p style={{ fontSize: '14px', color: isDark ? '#93c5fd' : "#475569", marginTop: '8px', lineHeight: 1.6 }}>
              Crie QR Codes para seus visitantes. O porteiro poderá escanear e verificar todas as informações.
            </p>
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              style={{
                marginTop: '24px',
                padding: '14px 28px',
                borderRadius: '12px',
                border: isDark ? '1.5px solid rgba(255,255,255,0.15)' : '1.5px solid #cbd5e1',
                background: isDark ? 'linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.06))' : 'linear-gradient(135deg, #e2e8f0, #f1f5f9)',
                color: isDark ? '#fff' : "#1e293b",
                fontWeight: 700,
                fontSize: '15px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Plus className="w-5 h-5" /> Criar QR Code
            </button>
          </div>
        )}

        {/* List */}
        {displayVisitors.length > 0 && !viewQR && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <p style={{ fontWeight: 700, fontSize: '14px', color: isDark ? '#93c5fd' : "#475569", textTransform: 'uppercase' }}>
              Autorizações ({displayVisitors.length})
            </p>
            {displayVisitors.map((v) => {
              const sc = statusColor(v.status);
              const isExpanded = expandedId === v.id;
              return (
                <div key={v.id} style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#f8fafc', borderRadius: '14px', border: isDark ? '1.5px solid rgba(255,255,255,0.1)' : '1.5px solid #cbd5e1', overflow: 'hidden' }}>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : v.id)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '14px 16px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    {v.foto ? (
                      <img src={v.foto} alt="" style={{ width: '44px', height: '44px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: isDark ? 'rgba(255,255,255,0.08)' : '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <User className="w-5 h-5" style={{ color: isDark ? '#93c5fd' : "#475569" }} />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: '15px', color: isDark ? '#fff' : "#1e293b", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.nome}</p>
                      <p style={{ fontSize: '12px', color: isDark ? '#93c5fd' : "#475569" }}>
                        {v.dataInicio} {v.horaInicio} — {v.dataFim} {v.horaFim}
                      </p>
                    </div>
                    <span style={{ background: sc.bg, color: sc.text, fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "999px" }}>
                      {sc.label}
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4" style={{ color: isDark ? '#93c5fd' : "#475569", flexShrink: 0 }} /> : <ChevronDown className="w-4 h-4" style={{ color: isDark ? '#93c5fd' : "#475569", flexShrink: 0 }} />}
                  </button>

                  {isExpanded && (
                    <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                      {v.documento && (
                        <p style={{ fontSize: '13px', color: isDark ? '#93c5fd' : "#475569" }}><strong style={{ color: isDark ? '#fff' : "#1e293b" }}>Documento:</strong> {v.documento}</p>
                      )}
                      {v.parentesco && (
                        <p style={{ fontSize: '13px', color: isDark ? '#93c5fd' : "#475569" }}><strong style={{ color: isDark ? '#fff' : "#1e293b" }}>Parentesco:</strong> {v.parentesco}</p>
                      )}
                      {v.observacoes && (
                        <p style={{ fontSize: '13px', color: isDark ? '#93c5fd' : "#475569" }}><strong style={{ color: isDark ? '#fff' : "#1e293b" }}>Obs:</strong> {v.observacoes}</p>
                      )}
                      <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                        <button
                          onClick={() => setViewQR(v)}
                          style={{
                            flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
                            background: isDark ? 'linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.06))' : 'linear-gradient(135deg, #e2e8f0, #f1f5f9)', color: isDark ? '#fff' : "#1e293b",
                            fontWeight: 700, fontSize: '13px', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                          }}
                        >
                          <Eye className="w-4 h-4" /> Ver QR Code
                        </button>
                        <button
                          onClick={() => handleShare(v)}
                          style={{
                            padding: '10px 14px', borderRadius: '10px',
                            border: '1.5px solid rgba(99,102,241,0.4)', background: 'rgba(99,102,241,0.15)',
                            color: '#a5b4fc', fontWeight: 700, fontSize: '13px', cursor: 'pointer',
                          }}
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(v.id)}
                          style={{
                            padding: '10px 14px', borderRadius: '10px',
                            border: '1.5px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)',
                            color: '#fca5a5', cursor: 'pointer',
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ═══ QR Code View ═══ */}
        {viewQR && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
            <button
              onClick={() => setViewQR(null)}
              style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: isDark ? '#93c5fd' : "#475569", fontWeight: 700, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <ArrowLeft className="w-4 h-4" /> Voltar à lista
            </button>

            <div style={{
              background: "#fff", borderRadius: "20px", padding: "28px",
              border: "3px solid #6366f1", textAlign: "center", width: "100%", maxWidth: "380px",
            }}>
              <div style={{ background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)", borderRadius: "14px", padding: "16px", marginBottom: "20px" }}>
                <QrCode className="w-8 h-8 mx-auto" style={{ color: "#fff" }} />
                <p style={{ color: "#fff", fontWeight: 800, fontSize: "16px", marginTop: "6px" }}>AUTORIZAÇÃO DE ENTRADA</p>
                <p style={{ color: isDark ? "rgba(255,255,255,0.7)" : "#475569", fontSize: "12px" }}>{user?.condominio_nome || "Condomínio"}</p>
              </div>

              {viewQR.foto && (
                <img
                  src={viewQR.foto}
                  alt={viewQR.nome}
                  style={{ width: "80px", height: "80px", borderRadius: "50%", objectFit: "cover", margin: "0 auto 12px", border: "3px solid #e5e7eb" }}
                />
              )}

              <p style={{ fontWeight: 800, fontSize: "18px", color: "#374151" }}>{viewQR.nome}</p>
              {viewQR.documento && <p style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>Doc: {viewQR.documento}</p>}
              {viewQR.parentesco && <p style={{ fontSize: "13px", color: "#6b7280" }}>Parentesco: {viewQR.parentesco}</p>}

              <div style={{ margin: "20px 0", background: "#f8fafc", borderRadius: "12px", padding: "12px", border: "1px solid #e5e7eb" }}>
                <p style={{ fontSize: "12px", color: "#6b7280", fontWeight: 700, marginBottom: "4px" }}>VÁLIDO DE</p>
                <p style={{ fontSize: "14px", fontWeight: 700, color: "#374151" }}>{viewQR.dataInicio} às {viewQR.horaInicio}</p>
                <p style={{ fontSize: "12px", color: "#6b7280", fontWeight: 700, marginTop: "8px", marginBottom: "4px" }}>ATÉ</p>
                <p style={{ fontSize: "14px", fontWeight: 700, color: "#374151" }}>{viewQR.dataFim} às {viewQR.horaFim}</p>
              </div>

              <div style={{ margin: "16px 0" }}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(generateQRData(viewQR, user || {}))}`}
                  alt="QR Code"
                  style={{ width: "220px", height: "220px", margin: "0 auto", borderRadius: "12px" }}
                />
              </div>

              <p style={{ fontSize: "11px", color: "#9ca3af" }}>
                Morador: {user?.name || "N/A"} · Bloco {user?.block || "—"} Apt {user?.unit || "—"}
              </p>
            </div>

            <div style={{ display: "flex", gap: "10px", width: "100%", maxWidth: "380px" }}>
              <button
                onClick={() => handleShare(viewQR)}
                style={{
                  flex: 1, padding: "14px", borderRadius: "12px", border: "none",
                  background: "#25d366", color: p.text, fontWeight: 700, fontSize: "14px",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                }}
              >
                <Share2 className="w-5 h-5" /> Enviar por WhatsApp
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ═══ FORM MODAL ═══ */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div
            style={{ background: isDark ? 'linear-gradient(180deg, #002a66 0%, #003580 100%)' : '#ffffff', width: '100%', maxWidth: '28rem', borderRadius: '24px 24px 0 0', maxHeight: '90vh', overflowY: 'auto', padding: '24px', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #cbd5e1', boxShadow: isDark ? 'none' : '0 -4px 20px rgba(0,0,0,0.15)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ fontWeight: 800, fontSize: '18px', color: isDark ? '#fff' : "#1e293b", display: 'flex', alignItems: 'center', gap: '8px' }}>
                <QrCode className="w-5 h-5" style={{ color: isDark ? '#93c5fd' : "#475569" }} /> Novo QR Code
              </h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: '24px', color: isDark ? '#93c5fd' : "#475569", cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Foto */}
              <div>
                <label style={{ display: "block", fontWeight: 700, fontSize: "13px", color: isDark ? '#93c5fd' : "#475569", marginBottom: "6px" }}>
                  Foto do Visitante {config.fotoObrigatoria ? <span style={{ color: "#dc2626" }}>*</span> : "(opcional)"}
                </label>
                <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: "none" }} />
                {foto ? (
                  <div style={{ position: "relative", width: "80px", height: "80px" }}>
                    <img src={foto} alt="" style={{ width: "80px", height: "80px", borderRadius: "12px", objectFit: "cover" }} />
                    <button
                      onClick={() => setFoto(null)}
                      style={{ position: "absolute", top: "-6px", right: "-6px", width: "22px", height: "22px", borderRadius: "50%", background: "#dc2626", color: p.text, border: "none", fontWeight: 700, fontSize: "14px", cursor: "pointer" }}
                    >×</button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileRef.current?.click()}
                    style={{
                      width: "80px", height: "80px", borderRadius: "12px",
                      border: isDark ? '2px dashed rgba(255,255,255,0.2)' : '2px dashed #cbd5e1', background: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc',
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                      gap: "4px", cursor: "pointer", color: isDark ? '#93c5fd' : "#475569",
                    }}
                  >
                    <Camera className="w-5 h-5" />
                    <span style={{ fontSize: "10px", fontWeight: 600 }}>Foto</span>
                  </button>
                )}
              </div>

              {/* Nome */}
              <div>
                <label style={{ display: "block", fontWeight: 700, fontSize: "13px", color: isDark ? '#93c5fd' : "#475569", marginBottom: "6px" }}>
                  Nome do Visitante <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Nome completo do visitante"
                  style={{
                    width: "100%", padding: "12px 14px", borderRadius: "10px",
                    border: isDark ? '1.5px solid rgba(255,255,255,0.12)' : '1.5px solid #cbd5e1', fontSize: "15px", fontWeight: 600, color: isDark ? '#fff' : "#1e293b", background: isDark ? 'rgba(255,255,255,0.06)' : '#ffffff',
                  }}
                />
              </div>

              {/* Documento */}
              <div>
                <label style={{ display: "block", fontWeight: 700, fontSize: "13px", color: isDark ? '#93c5fd' : "#475569", marginBottom: "6px" }}>
                  Documento (RG/CPF) {config.documentoObrigatorio ? <span style={{ color: "#dc2626" }}>*</span> : "(opcional)"}
                </label>
                <input
                  type="text"
                  value={documento}
                  onChange={(e) => setDocumento(e.target.value)}
                  placeholder="Número do documento"
                  style={{
                    width: "100%", padding: "12px 14px", borderRadius: "10px",
                    border: isDark ? '1.5px solid rgba(255,255,255,0.12)' : '1.5px solid #cbd5e1', fontSize: "15px", fontWeight: 600, color: isDark ? '#fff' : "#1e293b", background: isDark ? 'rgba(255,255,255,0.06)' : '#ffffff',
                  }}
                />
              </div>

              {/* Parentesco */}
              <div>
                <label style={{ display: "block", fontWeight: 700, fontSize: "13px", color: isDark ? '#93c5fd' : "#475569", marginBottom: "6px" }}>
                  Parentesco / Relação {config.parentescoObrigatorio ? <span style={{ color: "#dc2626" }}>*</span> : "(opcional)"}
                </label>
                <input
                  type="text"
                  value={parentesco}
                  onChange={(e) => setParentesco(e.target.value)}
                  placeholder='Ex: "Mãe", "Prestador de serviço", "Amigo"'
                  style={{
                    width: "100%", padding: "12px 14px", borderRadius: "10px",
                    border: isDark ? '1.5px solid rgba(255,255,255,0.12)' : '1.5px solid #cbd5e1', fontSize: "15px", fontWeight: 600, color: isDark ? '#fff' : "#1e293b", background: isDark ? 'rgba(255,255,255,0.06)' : '#ffffff',
                  }}
                />
              </div>

              {/* Data/Hora Início */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontWeight: 700, fontSize: "13px", color: isDark ? '#93c5fd' : "#475569", marginBottom: "6px" }}>
                    <Calendar className="w-3.5 h-3.5 inline-block mr-1" style={{ verticalAlign: "-2px" }} />
                    Data Início <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    style={{ width: "100%", padding: "12px 10px", borderRadius: "10px", border: isDark ? '1.5px solid rgba(255,255,255,0.12)' : '1.5px solid #cbd5e1', fontSize: "14px", fontWeight: 600, color: isDark ? '#fff' : "#1e293b", background: isDark ? 'rgba(255,255,255,0.06)' : '#ffffff' }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontWeight: 700, fontSize: "13px", color: isDark ? '#93c5fd' : "#475569", marginBottom: "6px" }}>
                    <Clock className="w-3.5 h-3.5 inline-block mr-1" style={{ verticalAlign: "-2px" }} />
                    Hora Início <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <input
                    type="time"
                    value={horaInicio}
                    onChange={(e) => setHoraInicio(e.target.value)}
                    style={{ width: "100%", padding: "12px 10px", borderRadius: "10px", border: isDark ? '1.5px solid rgba(255,255,255,0.12)' : '1.5px solid #cbd5e1', fontSize: "14px", fontWeight: 600, color: isDark ? '#fff' : "#1e293b", background: isDark ? 'rgba(255,255,255,0.06)' : '#ffffff' }}
                  />
                </div>
              </div>

              {/* Data/Hora Fim */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontWeight: 700, fontSize: "13px", color: isDark ? '#93c5fd' : "#475569", marginBottom: "6px" }}>
                    <Calendar className="w-3.5 h-3.5 inline-block mr-1" style={{ verticalAlign: "-2px" }} />
                    Data Fim <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    style={{ width: "100%", padding: "12px 10px", borderRadius: "10px", border: isDark ? '1.5px solid rgba(255,255,255,0.12)' : '1.5px solid #cbd5e1', fontSize: "14px", fontWeight: 600, color: isDark ? '#fff' : "#1e293b", background: isDark ? 'rgba(255,255,255,0.06)' : '#ffffff' }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontWeight: 700, fontSize: "13px", color: isDark ? '#93c5fd' : "#475569", marginBottom: "6px" }}>
                    <Clock className="w-3.5 h-3.5 inline-block mr-1" style={{ verticalAlign: "-2px" }} />
                    Hora Fim <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <input
                    type="time"
                    value={horaFim}
                    onChange={(e) => setHoraFim(e.target.value)}
                    style={{ width: "100%", padding: "12px 10px", borderRadius: "10px", border: isDark ? '1.5px solid rgba(255,255,255,0.12)' : '1.5px solid #cbd5e1', fontSize: "14px", fontWeight: 600, color: isDark ? '#fff' : "#1e293b", background: isDark ? 'rgba(255,255,255,0.06)' : '#ffffff' }}
                  />
                </div>
              </div>

              {/* Observações */}
              <div>
                <label style={{ display: "block", fontWeight: 700, fontSize: "13px", color: isDark ? '#93c5fd' : "#475569", marginBottom: "6px" }}>
                  Observações {config.observacoesObrigatorio ? <span style={{ color: "#dc2626" }}>*</span> : "(opcional)"}
                </label>
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Informações adicionais para o porteiro"
                  rows={2}
                  style={{
                    width: "100%", padding: "12px 14px", borderRadius: "10px",
                    border: isDark ? '1.5px solid rgba(255,255,255,0.12)' : '1.5px solid #cbd5e1', fontSize: "14px", fontWeight: 600, color: isDark ? '#fff' : "#1e293b", background: isDark ? 'rgba(255,255,255,0.06)' : '#ffffff',
                    resize: "none",
                  }}
                />
              </div>

              {/* Submit */}
              <button
                onClick={handleCreate}
                disabled={!isFormValid()}
                style={{
                  width: "100%", padding: "16px", borderRadius: "12px",
                  border: isDark ? '1.5px solid rgba(255,255,255,0.15)' : '2px solid #003580',
                  background: isDark ? (isFormValid() ? 'linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.08))' : 'rgba(255,255,255,0.04)') : (isFormValid() ? '#003580' : '#e2e8f0'),
                  color: isDark ? p.text : (isFormValid() ? '#ffffff' : '#94a3b8'), fontWeight: 700, fontSize: "16px",
                  cursor: isFormValid() ? "pointer" : "not-allowed",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                  marginTop: "8px",
                }}
              >
                <QrCode className="w-5 h-5" /> Gerar QR Code
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
