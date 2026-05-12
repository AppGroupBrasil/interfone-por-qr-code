import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import TutorialButton, { FlowPortaria, FlowMorador, TSection, TStep, TBullet } from "@/components/TutorialButton";
import { compressCanvas, compressImage } from "@/lib/imageUtils";
import {
  ArrowLeft,
  Mail,
  Plus,
  Camera,
  X,
  CheckCircle2,
  Package,
  Clock,
  Search,
  Copy,
  FileText,
  Download,
} from "lucide-react";
import SearchableSelect from "@/components/SearchableSelect";
import ReportModal from "@/components/ReportModal";
import { gerarPdfCorrespondencia, gerarRelatorioCorrespondencias, gerarRelatorioCorrespondenciasComGraficos } from "@/lib/pdfUtils";
import { APP_ORIGIN } from "@/lib/config";
import { apiFetch } from "@/lib/api";
import { useTheme } from "@/hooks/useTheme";
import ComoFunciona from "@/components/ComoFunciona";

const API_BASE = "/api";
const API = `${API_BASE}/correspondencias`;

interface Block { id: number; name: string }
interface Morador { id: number; name: string; unit: string | null; phone: string | null }
interface Correspondencia {
  id: number;
  protocolo: string;
  morador_name: string;
  bloco: string;
  apartamento: string;
  tipo: string;
  remetente: string | null;
  descricao: string | null;
  foto: string | null;
  status: string;
  created_at: string;
  retirado_at: string | null;
}

export default function CorrespondenciasPorteiro() {
  const { isDark, p } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();

  // List state
  const [correspondencias, setCorrespondencias] = useState<Correspondencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pendente");
  const [searchTerm, setSearchTerm] = useState("");

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [moradores, setMoradores] = useState<Morador[]>([]);
  const [selectedMoradorId, setSelectedMoradorId] = useState("");
  const [bloco, setBloco] = useState("");
  const [apartamento, setApartamento] = useState("");
  const [tipo, setTipo] = useState("encomenda");
  const [remetente, setRemetente] = useState("");
  const [descricao, setDescricao] = useState("");
  const [foto, setFoto] = useState<string | null>(null);

  // Photo refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Success message
  const [successMsg, setSuccessMsg] = useState("");

  // Expanded card
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Report modal
  const [showReport, setShowReport] = useState(false);

  // WhatsApp modal state
  const [whatsappModal, setWhatsappModal] = useState<{
    show: boolean;
    waUrl: string;
    moradorName: string;
    moradorPhone: string;
    protocolo: string;
    tipoCorr: string;
  } | null>(null);

  const fetchCorrespondencias = async () => {
    try {
      const url = filter !== "todas" ? `${API}?status=${filter}` : API;
      const res = await fetch(url, {  });
      if (res.ok) setCorrespondencias(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchCorrespondencias();
  }, [filter]);

  // Fetch blocks
  const fetchBlocks = async () => {
    try {
      const res = await apiFetch(`${API_BASE}/blocos`);
      if (res.ok) setBlocks(await res.json());
    } catch {
      setBlocks([{ id: 1, name: "Bloco A" }, { id: 2, name: "Bloco B" }, { id: 3, name: "Bloco C" }]);
    }
  };

  // Fetch moradores for block
  const fetchMoradoresBloco = async (b: string) => {
    if (!b) { setMoradores([]); return; }
    try {
      const res = await apiFetch(`${API_BASE}/visitors/moradores-bloco?bloco=${encodeURIComponent(b)}`, {  });
      if (res.ok) setMoradores(await res.json());
    } catch { setMoradores([]); }
  };

  const handleSelectMorador = (moradorId: string) => {
    setSelectedMoradorId(moradorId);
    if (!moradorId) { setApartamento(""); return; }
    const m = moradores.find((x) => String(x.id) === moradorId);
    if (m) setApartamento(m.unit || "");
  };

  useEffect(() => { fetchBlocks(); }, []);

  // Camera functions
  const openCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setStream(s);
      setShowCamera(true);
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = s;
      }, 100);
    } catch { setFormError("Não foi possível acessar a câmera."); }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0);
    setFoto(compressCanvas(canvas, "general"));
    closeCamera();
  };

  const closeCamera = () => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    setShowCamera(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const compressed = await compressImage(reader.result as string, "general");
      setFoto(compressed);
    };
    reader.readAsDataURL(file);
  };

  const resetForm = () => {
    setBloco(""); setApartamento(""); setSelectedMoradorId("");
    setMoradores([]); setTipo("encomenda"); setRemetente("");
    setDescricao(""); setFoto(null); setFormError("");
  };

  const handleSubmit = async () => {
    if (!bloco || !apartamento) {
      setFormError("Selecione bloco e apartamento.");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const morador = moradores.find((x) => String(x.id) === selectedMoradorId);
      const morador_name = morador ? morador.name : `Morador Bloco ${bloco} Apto ${apartamento}`;

      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          morador_id: selectedMoradorId ? Number(selectedMoradorId) : null,
          morador_name,
          bloco,
          apartamento,
          tipo,
          remetente,
          descricao,
          foto,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setFormError(data.error || "Erro ao registrar.");
        return;
      }

      const data = await res.json();
      setSuccessMsg(`Correspondência registrada! Protocolo: ${data.protocolo}`);
      setTimeout(() => setSuccessMsg(""), 5000);

      // Build WhatsApp message with correspondence info
      const moradorObj = moradores.find((x) => String(x.id) === selectedMoradorId);
      const moradorPhone = moradorObj?.phone || "";
      const cleanPhone = moradorPhone.replace(/\D/g, "");
      const fullPhone = cleanPhone && !cleanPhone.startsWith("55") ? `55${cleanPhone}` : cleanPhone;

      const tipoLabelMap: Record<string, string> = {
        encomenda: "Encomenda", carta: "Carta", sedex: "Sedex",
        pac: "PAC", notificacao: "Notificacao", outro: "Outro",
      };

      const now = new Date();
      const dateStr = now.toLocaleDateString("pt-BR");
      const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

      const msgLines = [
        `*AVISO DE CORRESPONDENCIA*`,
        ``,
        `Ola ${morador_name}! Voce tem uma correspondencia na portaria.`,
        ``,
        `*Protocolo:* ${data.protocolo}`,
        `*Tipo:* ${tipoLabelMap[tipo] || tipo}`,
        `*Data:* ${dateStr}`,
        `*Hora:* ${timeStr}`,
        `*Bloco:* ${bloco} | *Apto:* ${apartamento}`,
      ];

      if (remetente) msgLines.push(`*Remetente:* ${remetente}`);
      if (descricao) msgLines.push(`*Descricao:* ${descricao}`);

      // If photo exists, include public link (assinado com HMAC).
      if (foto && data.foto_token) {
        const fotoUrl = `${APP_ORIGIN}/api/correspondencias/foto/${data.protocolo}?t=${data.foto_token}`;
        msgLines.push(``, `*Foto da correspondencia:*`, fotoUrl);
      }

      msgLines.push(``, `Por favor, retire na portaria.`);

      const msg = msgLines.join("\n");
      const waUrl = fullPhone
        ? `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`
        : `https://wa.me/?text=${encodeURIComponent(msg)}`;

      // Auto-open WhatsApp
      window.open(waUrl, "_blank");

      resetForm();
      setShowForm(false);
      fetchCorrespondencias();
    } catch {
      setFormError("Erro de conexão.");
    } finally {
      setSaving(false);
    }
  };

  const handleRetirar = async (id: number) => {
    try {
      const res = await apiFetch(`${API}/${id}/retirar`, {
        method: "PUT",
      });
      if (res.ok) fetchCorrespondencias();
    } catch (err) {
      console.error(err);
    }
  };

  const tipoLabel: Record<string, string> = {
    encomenda: "📦 Encomenda",
    carta: "✉️ Carta",
    sedex: "📮 Sedex",
    pac: "📬 PAC",
    notificacao: "📄 Notificação",
    outro: "📋 Outro",
  };

  const formatDate = (d: string) => {
    const dt = new Date(d);
    return dt.toLocaleDateString("pt-BR") + " " + dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const filteredCorrespondencias = correspondencias.filter((c) => {
    if (!searchTerm.trim()) return true;
    const s = searchTerm.toLowerCase();
    return (
      c.protocolo.toLowerCase().includes(s) ||
      c.morador_name.toLowerCase().includes(s) ||
      (c.bloco || "").toLowerCase().includes(s) ||
      (c.apartamento || "").toLowerCase().includes(s) ||
      (c.remetente || "").toLowerCase().includes(s)
    );
  });

  // ═══════════ Styles ═══════════
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 14px", borderRadius: "12px",
    border: "1px solid #cbd5e1", fontSize: "14px", background: "#fff",
    color: "#0f172a", outline: "none", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    fontWeight: 600, fontSize: "13px", color: "#1e293b",
    marginBottom: "6px", display: "block",
  };

  return (
    <div className="min-h-dvh" style={{ background: p.pageBg, paddingBottom: "6rem" }}>
      {/* Header */}
      <header style={{ color: p.text, background: p.headerBg, padding: "1rem 1.5rem", borderBottom: p.headerBorder, boxShadow: p.headerShadow }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button onClick={() => navigate("/dashboard")} style={{ width: 40, height: 40, borderRadius: 12, background: p.btnBg, border: p.btnBorder, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: p.text }}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontWeight: 700, fontSize: 18 }}>Aviso de Correspondência</h1>
            <p style={{ color: isDark ? "rgba(255,255,255,0.6)" : "#64748b", fontSize: 12 }}>Registrar e gerenciar correspondências</p>
          </div>
          <TutorialButton title="Correspondencias">
            <TSection icon={<span>📋</span>} title="O QUE E ESTA FUNCAO?">
              <p>Registra e gerencia <strong>todas as correspondencias</strong> (encomendas, cartas, documentos, pacotes) que chegam na portaria. O porteiro registra cada correspondencia, o sistema envia <strong>notificacao automatica no WhatsApp</strong> do morador, e tudo fica registrado com foto, tipo, origem, data e hora.</p>
            </TSection>
            <FlowPortaria>
              <TStep n={1}>Chegou uma encomenda, carta ou pacote na portaria</TStep>
              <TStep n={2}>Toque em <strong>+</strong> para registrar nova correspondencia</TStep>
              <TStep n={3}>Selecione o <strong>morador destinatario</strong> (busca por nome, bloco ou unidade)</TStep>
              <TStep n={4}>Informe o <strong>tipo</strong>: Encomenda, Carta, Documento, Pacote, Sedex</TStep>
              <TStep n={5}>Informe a <strong>origem</strong>: Correios, Mercado Livre, Amazon, Shopee, Sedex, Documento, etc.</TStep>
              <TStep n={6}>Tire uma <strong>foto do pacote</strong> (opcional mas recomendado como comprovante)</TStep>
              <TStep n={7}>Toque em <strong>"Registrar"</strong> — sistema salva e envia <strong>WhatsApp automatico</strong> ao morador</TStep>
              <p style={{ marginTop: "8px", fontSize: "13px", color: "#2d3354" }}>👉 <strong>O morador ve:</strong> Recebe WhatsApp "Voce tem uma correspondencia na portaria" + aparece no app com status "Aguardando retirada" e a foto do pacote.</p>
            </FlowPortaria>
            <FlowMorador>
              <TStep n={1}>Morador recebe a notificacao e vai ate a portaria</TStep>
              <TStep n={2}>Voce localiza a correspondencia e entrega ao morador</TStep>
              <TStep n={3}>Toque em <strong>"Confirmar Retirada"</strong> no app</TStep>
              <TStep n={4}>Status muda para <strong>"Retirada"</strong> com data, hora e porteiro responsavel</TStep>
              <p style={{ marginTop: "8px", fontSize: "13px", color: "#166534" }}>👉 <strong>Registro completo:</strong> O morador tambem ve a atualizacao no app dele. Historico fica disponivel para consulta.</p>
            </FlowMorador>
            <TSection icon={<span>🔍</span>} title="STATUS DAS CORRESPONDENCIAS">
              <TBullet><strong style={{ color: "#d97706" }}>Aguardando retirada</strong> — Chegou na portaria, esperando morador buscar (destaque amarelo)</TBullet>
              <TBullet><strong style={{ color: "#16a34a" }}>Retirada</strong> — Morador ja buscou (com data e hora)</TBullet>
            </TSection>
            <TSection icon={<span>🔧</span>} title="FUNCOES DISPONIVEIS">
              <TBullet><strong>Notificacao WhatsApp automatica</strong> — O morador recebe aviso instantaneo quando voce registra</TBullet>
              <TBullet><strong>Foto da correspondencia</strong> — Tire foto para comprovante (evita reclamacoes de extravio)</TBullet>
              <TBullet><strong>Busca rapida</strong> — Pesquise por morador, tipo ou origem</TBullet>
              <TBullet><strong>Filtro por status</strong> — Veja apenas pendentes ou apenas retiradas</TBullet>
              <TBullet><strong>Relatorio PDF</strong> — Gere relatorios de correspondencias por periodo</TBullet>
            </TSection>
            <TSection icon={<span>⭐</span>} title="DICAS IMPORTANTES">
              <TBullet><strong>Sempre tire foto</strong> de encomendas e pacotes — e a melhor forma de se proteger de reclamacoes</TBullet>
              <TBullet>Correspondencias <strong>pendentes ha mais de 3 dias</strong> devem ser re-notificadas ao morador</TBullet>
              <TBullet>Use a <strong>busca por status</strong> para ver rapidamente tudo que esta pendente de retirada</TBullet>
              <TBullet>O morador recebe <strong>WhatsApp automatico</strong> — voce nao precisa ligar ou avisar pessoalmente</TBullet>
            </TSection>
          </TutorialButton>
        </div>
      </header>

      <main style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>

        <ComoFunciona steps={[
          "✉️ Portaria registra correspondência com foto",
          "📱 Morador recebe aviso no WhatsApp e no app",
          "🏢 Morador apresenta QR Code ou protocolo para retirar",
          "✅ Portaria confirma retirada no sistema",
        ]} />

        {/* Success message */}
        {successMsg && (
          <div style={{
            background: "#dcfce7", border: "1px solid #86efac", borderRadius: "12px",
            padding: "12px 16px", display: "flex", alignItems: "center", gap: "8px",
            color: "#166534", fontSize: "14px", fontWeight: 600,
          }}>
            <CheckCircle2 className="w-5 h-5" /> {successMsg}
          </div>
        )}

        {/* New button */}
        <button
          onClick={() => { setShowForm(!showForm); if (!showForm) resetForm(); }}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            width: "100%", padding: "14px", borderRadius: "14px", border: isDark ? "2px solid rgba(255,255,255,0.5)" : "2px solid #cbd5e1",
            background: showForm ? "#ef4444" : "linear-gradient(135deg, #0062d1 0%, #003580 100%)",
            color: "#fff", fontSize: "15px", fontWeight: 700, cursor: "pointer",
          }}
        >
          {showForm ? <><X className="w-5 h-5" /> Cancelar</> : <><Plus className="w-5 h-5" /> Registrar Correspondência</>}
        </button>

        {/* ═══════════ FORM ═══════════ */}
        {showForm && (
          <div style={{
            background: "#fff", borderRadius: "16px", padding: "20px",
            border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "16px",
          }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#1e293b", margin: 0 }}>
              Nova Correspondência
            </h3>

            {formError && (
              <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "10px", padding: "10px 14px", color: "#991b1b", fontSize: "13px" }}>
                {formError}
              </div>
            )}

            {/* Tipo */}
            <div>
              <label style={labelStyle}>Tipo de Correspondência *</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)}
                style={{ ...inputStyle, cursor: "pointer" }}>
                <option value="encomenda">📦 Encomenda</option>
                <option value="carta">✉️ Carta</option>
                <option value="sedex">📮 Sedex</option>
                <option value="pac">📬 PAC</option>
                <option value="notificacao">📄 Notificação</option>
                <option value="outro">📋 Outro</option>
              </select>
            </div>

            {/* Bloco */}
            <div>
              <label style={labelStyle}>Bloco *</label>
              <select
                value={bloco}
                onChange={(e) => {
                  setBloco(e.target.value);
                  setApartamento("");
                  setSelectedMoradorId("");
                  fetchMoradoresBloco(e.target.value);
                }}
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                <option value="">Selecione o bloco</option>
                {blocks.map((b) => (
                  <option key={b.id} value={b.name}>{b.name}</option>
                ))}
              </select>
            </div>

            {/* Morador */}
            {bloco && moradores.length > 0 && (
              <div>
                <label style={labelStyle}>Morador</label>
                <SearchableSelect
                  value={selectedMoradorId}
                  onChange={(val) => handleSelectMorador(val)}
                  placeholder="Selecione o morador"
                  searchPlaceholder="Buscar por nome ou apartamento..."
                  options={moradores.map((m) => ({
                    value: String(m.id),
                    label: `${m.name} — Apto ${m.unit}`,
                    searchText: `${m.name} ${m.unit}`.toLowerCase(),
                  }))}
                />
              </div>
            )}

            {/* Apartamento (fallback) */}
            {!selectedMoradorId && (
              <div>
                <label style={labelStyle}>Apartamento *</label>
                <input type="text" value={apartamento} onChange={(e) => setApartamento(e.target.value)}
                  placeholder="Ex: 101" style={inputStyle} />
              </div>
            )}

            {/* Remetente */}
            <div>
              <label style={labelStyle}>Remetente</label>
              <input type="text" value={remetente} onChange={(e) => setRemetente(e.target.value)}
                placeholder="Ex: Amazon, Mercado Livre..." style={inputStyle} />
            </div>

            {/* Descrição */}
            <div>
              <label style={labelStyle}>Descrição</label>
              <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)}
                placeholder="Informações sobre a correspondência..."
                rows={3}
                style={{ ...inputStyle, resize: "vertical" }} />
            </div>

            {/* Foto */}
            <div>
              <label style={labelStyle}>Foto da Correspondência</label>
              {foto ? (
                <div style={{ position: "relative" }}>
                  <img src={foto} alt="Foto" style={{ width: "100%", borderRadius: "12px", maxHeight: "400px", objectFit: "contain", background: "#f1f5f9" }} />
                  <button
                    onClick={() => setFoto(null)}
                    style={{
                      position: "absolute", top: "8px", right: "8px",
                      background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%",
                      width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", color: p.text,
                    }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : showCamera ? (
                <div style={{ position: "relative", borderRadius: "12px", overflow: "hidden" }}>
                  <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", borderRadius: "12px" }} />
                  <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: "10px" }}>
                    <button onClick={capturePhoto} style={{
                      padding: "10px 24px", borderRadius: "10px", border: "none",
                      background: "#6366f1", color: p.text, fontWeight: 700, cursor: "pointer",
                    }}>📸 Capturar</button>
                    <button onClick={closeCamera} style={{
                      padding: "10px 24px", borderRadius: "10px", border: "none",
                      background: "#ef4444", color: p.text, fontWeight: 700, cursor: "pointer",
                    }}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: "10px" }}>
                  <button onClick={openCamera} style={{
                    flex: 1, padding: "12px", borderRadius: "12px", border: "2px dashed #cbd5e1",
                    background: "#f8fafc", cursor: "pointer", display: "flex", flexDirection: "column",
                    alignItems: "center", gap: "6px", color: "#64748b", fontSize: "13px", fontWeight: 600,
                  }}>
                    <Camera className="w-6 h-6" /> Câmera
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} style={{
                    flex: 1, padding: "12px", borderRadius: "12px", border: "2px dashed #cbd5e1",
                    background: "#f8fafc", cursor: "pointer", display: "flex", flexDirection: "column",
                    alignItems: "center", gap: "6px", color: "#64748b", fontSize: "13px", fontWeight: 600,
                  }}>
                    <Package className="w-6 h-6" /> Galeria
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} style={{ display: "none" }} />
                </div>
              )}
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={saving}
              style={{
                width: "100%", padding: "14px", borderRadius: "14px", border: "none",
                background: saving ? "#94a3b8" : "linear-gradient(135deg, #10b981, #059669)",
                color: "#fff", fontSize: "15px", fontWeight: 700, cursor: saving ? "default" : "pointer",
              }}
            >
              {saving ? "Registrando..." : "✅ Registrar Correspondência"}
            </button>
          </div>
        )}

        {/* ═══════════ FILTERS / SEARCH ═══════════ */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          {[
            { v: "pendente", l: "Pendentes" },
            { v: "retirada", l: "Retiradas" },
            { v: "todas", l: "Todas" },
          ].map((f) => (
            <button
              key={f.v}
              onClick={() => setFilter(f.v)}
              style={{
                padding: "8px 16px", borderRadius: "20px", border: "none",
                background: filter === f.v ? "#6366f1" : "#e2e8f0",
                color: filter === f.v ? "#fff" : "#475569",
                fontSize: "13px", fontWeight: 600, cursor: "pointer",
              }}
            >
              {f.l}
            </button>
          ))}
          <button
            onClick={() => setShowReport(true)}
            style={{
              marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px",
              padding: "10px 20px", borderRadius: "8px", border: "2px solid #d97706",
              background: "#fff",
              color: "#d97706", fontSize: "14px", fontWeight: 700, cursor: "pointer",
            }}
          >
            <FileText className="w-4 h-4" /> Relatório
          </button>
        </div>

        <ReportModal
          show={showReport}
          onClose={() => setShowReport(false)}
          onGenerate={(dateFrom, dateTo, withCharts) => {
            const from = new Date(dateFrom + "T00:00:00");
            const to = new Date(dateTo + "T23:59:59");
            const filteredByDate = correspondencias.filter((c) => {
              const d = new Date(c.created_at);
              return d >= from && d <= to;
            });
            if (withCharts) {
              gerarRelatorioCorrespondenciasComGraficos(filteredByDate, dateFrom, dateTo, user?.condominio_nome);
            } else {
              gerarRelatorioCorrespondencias(filteredByDate, dateFrom, dateTo, user?.condominio_nome);
            }
          }}
          title="Gerar relatorio de Correspondencias por periodo"
        />

        {/* Search bar */}
        <div style={{ position: "relative" }}>
          <Search className="w-4 h-4" style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por protocolo, morador, bloco..."
            style={{ ...inputStyle, paddingLeft: "40px" }}
          />
        </div>

        {/* ═══════════ LIST ═══════════ */}
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "3rem" }}>
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredCorrespondencias.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "3rem 1rem", color: "#94a3b8",
          }}>
            <Mail className="w-12 h-12 mx-auto mb-3" style={{ opacity: 0.4 }} />
            <p style={{ fontWeight: 600, fontSize: "15px" }}>Nenhuma correspondência encontrada</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {filteredCorrespondencias.map((c) => {
              const isExpanded = expandedId === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => setExpandedId(isExpanded ? null : c.id)}
                  style={{
                    background: "#fff", borderRadius: "16px", border: "1px solid #e2e8f0",
                    overflow: "hidden", cursor: "pointer", transition: "all 0.2s",
                  }}
                >
                  {/* Card header */}
                  <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: 0 }}>
                      <div style={{
                        width: "44px", height: "44px", borderRadius: "12px",
                        background: c.status === "pendente" ? "#fef3c7" : "#dcfce7",
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}>
                        {c.status === "pendente"
                          ? <Clock className="w-5 h-5" style={{ color: "#d97706" }} />
                          : <CheckCircle2 className="w-5 h-5" style={{ color: "#16a34a" }} />}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontWeight: 700, fontSize: "14px", color: "#1e293b", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {c.morador_name}
                        </p>
                        <p style={{ fontSize: "12px", color: "#64748b", margin: 0 }}>
                          Bloco {c.bloco} · Apto {c.apartamento} · {tipoLabel[c.tipo] || c.tipo}
                        </p>
                      </div>
                    </div>
                    <div style={{
                      padding: "4px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700,
                      background: c.status === "pendente" ? "#fef3c7" : "#dcfce7",
                      color: c.status === "pendente" ? "#92400e" : "#166534",
                      flexShrink: 0,
                    }}>
                      {c.status === "pendente" ? "Pendente" : "Retirada"}
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div style={{
                      padding: "0 16px 16px", borderTop: "1px solid #f1f5f9",
                      display: "flex", flexDirection: "column", gap: "10px", paddingTop: "12px",
                    }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <div>
                          <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600 }}>PROTOCOLO</span>
                          <p style={{ fontSize: "13px", fontWeight: 700, color: "#6366f1", margin: "2px 0 0" }}>{c.protocolo}</p>
                        </div>
                        <div>
                          <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600 }}>DATA/HORA</span>
                          <p style={{ fontSize: "13px", color: "#1e293b", margin: "2px 0 0" }}>{formatDate(c.created_at)}</p>
                        </div>
                      </div>

                      {c.remetente && (
                        <div>
                          <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600 }}>REMETENTE</span>
                          <p style={{ fontSize: "13px", color: "#1e293b", margin: "2px 0 0" }}>{c.remetente}</p>
                        </div>
                      )}

                      {c.descricao && (
                        <div>
                          <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600 }}>DESCRIÇÃO</span>
                          <p style={{ fontSize: "13px", color: "#1e293b", margin: "2px 0 0" }}>{c.descricao}</p>
                        </div>
                      )}

                      {c.foto && (
                        <div>
                          <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600 }}>FOTO</span>
                          <img src={c.foto} alt="Correspondência" style={{
                            width: "100%", borderRadius: "10px", maxHeight: "400px",
                            objectFit: "contain", marginTop: "4px", background: "#f1f5f9",
                          }} />
                        </div>
                      )}

                      {c.retirado_at && (
                        <div>
                          <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600 }}>RETIRADA EM</span>
                          <p style={{ fontSize: "13px", color: "#16a34a", fontWeight: 600, margin: "2px 0 0" }}>
                            {formatDate(c.retirado_at)}
                          </p>
                        </div>
                      )}

                      {c.status === "pendente" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRetirar(c.id); }}
                          style={{
                            width: "100%", padding: "12px", borderRadius: "12px", border: "none",
                            background: "linear-gradient(135deg, #10b981, #059669)",
                            color: "#fff", fontWeight: 700, fontSize: "14px", cursor: "pointer",
                            marginTop: "4px",
                          }}
                        >
                          Marcar como Retirada
                        </button>
                      )}

                      {/* PDF button */}
                      <button
                        onClick={(ev) => { ev.stopPropagation(); gerarPdfCorrespondencia(c, user?.condominio_nome); }}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                          width: "100%", padding: "10px", borderRadius: "10px", border: "none",
                          background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)",
                          color: "#fff", fontSize: "13px", fontWeight: 700, cursor: "pointer",
                          marginTop: "4px",
                        }}
                      >
                        <Download className="w-4 h-4" /> Baixar PDF deste Registro
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ═══ WhatsApp Modal ═══ */}
      {whatsappModal?.show && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "16px",
        }}>
          <div style={{
            background: "#fff", borderRadius: "20px", padding: "24px",
            width: "100%", maxWidth: "400px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{
                  width: "40px", height: "40px", borderRadius: "50%", background: "#25d366",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.96 11.96 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.316 0-4.469-.756-6.209-2.034l-.356-.28-3.278 1.099 1.099-3.278-.28-.356A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
                  </svg>
                </div>
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: "16px", color: "#0f172a" }}>Correspondência Registrada!</h3>
                  <p style={{ fontSize: "12px", color: "#64748b" }}>Envie o aviso via WhatsApp</p>
                </div>
              </div>
              <button onClick={() => setWhatsappModal(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px" }}>
                <X className="w-5 h-5" style={{ color: "#94a3b8" }} />
              </button>
            </div>

            {/* Info card */}
            <div style={{
              background: "#f0fdf4", borderRadius: "12px", padding: "14px",
              border: "1px solid #86efac", marginBottom: "16px",
            }}>
              <p style={{ fontSize: "13px", color: "#15803d", fontWeight: 600 }}>
                <CheckCircle2 className="w-4 h-4" style={{ display: "inline", verticalAlign: "middle", marginRight: "6px" }} />
                Protocolo: <strong>{whatsappModal.protocolo}</strong>
              </p>
              <p style={{ fontSize: "12px", color: "#16a34a", marginTop: "4px" }}>
                {whatsappModal.tipoCorr} para <strong>{whatsappModal.moradorName}</strong>
              </p>
            </div>

            {/* Buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                onClick={() => { window.open(whatsappModal.waUrl, "_blank"); }}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                  padding: "14px", borderRadius: "14px", background: "#25d366",
                  border: "none", color: p.text, fontWeight: 700, fontSize: "15px",
                  cursor: "pointer", width: "100%",
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.96 11.96 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.316 0-4.469-.756-6.209-2.034l-.356-.28-3.278 1.099 1.099-3.278-.28-.356A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
                </svg>
                Enviar Aviso via WhatsApp
              </button>
              <button
                onClick={() => setWhatsappModal(null)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                  padding: "12px", borderRadius: "12px",
                  background: "transparent", border: "1px solid #e2e8f0",
                  color: "#64748b", fontWeight: 600, fontSize: "14px",
                  cursor: "pointer", width: "100%",
                }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
