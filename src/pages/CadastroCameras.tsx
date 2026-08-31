import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import TutorialButton, { TSection, TStep, TBullet } from "@/components/TutorialButton";
import {
  ArrowLeft,
  Plus,
  Camera,
  Pencil,
  Trash2,
  X,
  MapPin,
  Wifi,
  WifiOff,
  Loader2,
  Save,
  Video,
  Monitor,
  type LucideIcon,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import ComoFunciona from "@/components/ComoFunciona";

// ─── Types ───────────────────────────────────────────────
interface CameraData {
  id: number;
  nome: string;
  setor: string;
  localizacao: string | null;
  url_stream: string | null;
  tipo_stream: string;
  protocolo: string;
  ip: string | null;
  porta: number | null;
  usuario: string | null;
  senha: string | null;
  ativa: number;
  ordem: number;
}

const SETORES = [
  { value: "portaria", label: "Portaria" },
  { value: "garagem", label: "Garagem" },
  { value: "hall", label: "Hall / Entrada" },
  { value: "piscina", label: "Piscina" },
  { value: "academia", label: "Academia" },
  { value: "playground", label: "Playground" },
  { value: "salao_festas", label: "Salão de Festas" },
  { value: "perimetro", label: "Perímetro" },
  { value: "elevador", label: "Elevador" },
  { value: "estacionamento", label: "Estacionamento" },
  { value: "area_comum", label: "Área Comum" },
  { value: "outros", label: "Outros" },
];

const TIPOS_STREAM = [
  { value: "mjpeg", label: "MJPEG (HTTP)" },
  { value: "hls", label: "HLS (m3u8)" },
  { value: "rtsp_proxy", label: "RTSP (via proxy)" },
  { value: "snapshot", label: "Snapshot (imagem)" },
  { value: "webrtc", label: "WebRTC" },
];

const emptyForm: Omit<CameraData, "id"> = {
  nome: "",
  setor: "portaria",
  localizacao: "",
  url_stream: "",
  tipo_stream: "mjpeg",
  protocolo: "http",
  ip: "",
  porta: null,
  usuario: "",
  senha: "",
  ativa: 1,
  ordem: 0,
};

export default function CadastroCameras() {
  const { user } = useAuth();
  const { isDark, p } = useTheme();
  const navigate = useNavigate();

  const [cameras, setCameras] = useState<CameraData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const fetchCameras = async () => {
    try {
      const res = await apiFetch("/api/cameras");
      if (res.ok) {
        const data = await res.json();
        setCameras(data);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchCameras();
  }, []);

  const openNew = () => {
    setEditingId(null);
    setForm({ ...emptyForm, ordem: cameras.length });
    setShowForm(true);
  };

  const openEdit = (camera: CameraData) => {
    setEditingId(camera.id);
    setForm({
      nome: camera.nome,
      setor: camera.setor,
      localizacao: camera.localizacao || "",
      url_stream: camera.url_stream || "",
      tipo_stream: camera.tipo_stream,
      protocolo: camera.protocolo,
      ip: camera.ip || "",
      porta: camera.porta,
      usuario: camera.usuario || "",
      senha: camera.senha || "",
      ativa: camera.ativa,
      ordem: camera.ordem,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) return;
    setSaving(true);
    try {
      const url = editingId ? `/api/cameras/${editingId}` : "/api/cameras";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowForm(false);
        fetchCameras();
      }
    } catch {}
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir esta câmera?")) return;
    setDeleting(id);
    try {
      await apiFetch(`/api/cameras/${id}`, { method: "DELETE" });
      fetchCameras();
    } catch {}
    setDeleting(null);
  };

  const handleToggle = async (id: number) => {
    try {
      await apiFetch(`/api/cameras/${id}/toggle`, { method: "PATCH" });
      fetchCameras();
    } catch {}
  };

  const getSetorLabel = (value: string) => SETORES.find((s) => s.value === value)?.label || value;

  const labelStyle: React.CSSProperties = {
    fontWeight: 600, fontSize: "13px", color: isDark ? "#cbd5e1" : "#374151",
    marginBottom: "6px", display: "block",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 14px", borderRadius: "10px", fontSize: "14px",
    border: `1.5px solid ${isDark ? "rgba(255,255,255,0.1)" : "#e2e8f0"}`,
    background: isDark ? "rgba(255,255,255,0.05)" : "#fff",
    color: p.textHeading,
    outline: "none",
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle, appearance: "none" as const, cursor: "pointer",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", backgroundSize: "16px",
    paddingRight: "36px",
  };

  if (loading) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: p.pageBg }}>
      {/* ═══ Header ═══ */}
      <header className="sticky top-0 z-40" style={{ background: p.headerBg, borderBottom: p.headerBorder, boxShadow: p.headerShadow, color: p.text }}>
        <div className="flex items-center justify-between" style={{ padding: "1rem 1.5rem", height: "4.5rem" }}>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} style={{ width: 40, height: 40, borderRadius: 12, background: p.btnBg, border: p.btnBorder, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: p.text }}>
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <span style={{ fontWeight: 700, fontSize: 18 }} className="block">Cadastro de Câmeras</span>
              <span style={{ fontSize: 12, color: isDark ? "rgba(255,255,255,0.6)" : "#64748b" }}>{cameras.length} câmera{cameras.length !== 1 ? "s" : ""} cadastrada{cameras.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
          <TutorialButton title="Cadastro de Câmeras">
            <TSection icon={<span>📋</span>} title="O QUE É ESTA FUNÇÃO?">
              <p>Cadastra e configura as <strong>câmeras de segurança</strong> do condomínio para monitoramento ao vivo. Aqui você adiciona cada câmera com seu endereço de stream (URL), define o setor onde ela está instalada e testa a conexão. As câmeras cadastradas aparecem automaticamente na tela de <strong>Monitoramento</strong>.</p>
            </TSection>
            <TSection icon={<span>🏗️</span>} title="COMO CADASTRAR UMA CÂMERA">
              <TStep n={1}>Clique em <strong>"+"</strong> para adicionar nova câmera</TStep>
              <TStep n={2}>Informe o <strong>nome</strong> da câmera (ex: "Entrada Principal", "Garagem Bloco A", "Playground")</TStep>
              <TStep n={3}>Selecione o <strong>setor</strong>: Entrada Principal, Garagem, Portaria, Área Comum, Elevador, etc.</TStep>
              <TStep n={4}>Cole a <strong>URL de stream</strong> da câmera. Formatos aceitos:</TStep>
              <TBullet>→ <strong>MJPEG</strong>: http://IP:porta/video (mais compatível)</TBullet>
              <TBullet>→ <strong>HLS</strong>: http://IP:porta/stream.m3u8 (qualidade superior)</TBullet>
              <TBullet>→ <strong>RTSP</strong>: rtsp://IP:porta/stream (profissional)</TBullet>
              <TStep n={5}>Configure <strong>usuário e senha</strong> da câmera se necessário (algumas câmeras exigem autenticação)</TStep>
              <TStep n={6}>Clique em <strong>"Testar Conexão"</strong> para verificar se a câmera responde</TStep>
              <TStep n={7}>Se o teste passar, clique em <strong>"Salvar"</strong></TStep>
              <p style={{ marginTop: "8px", fontSize: "13px", color: "#2d3354" }}>👉 A câmera salva aparece automaticamente na tela de Monitoramento de Câmeras.</p>
            </TSection>
            <TSection icon={<span>🔧</span>} title="GERENCIANDO CÂMERAS">
              <TBullet><strong>Editar</strong> — Altere nome, setor, URL ou credenciais da câmera</TBullet>
              <TBullet><strong>Excluir</strong> — Remova câmeras que não estão mais instaladas</TBullet>
              <TBullet><strong>Status</strong> — Indicador verde (online) ou vermelho (offline) em tempo real</TBullet>
              <TBullet><strong>Testar</strong> — Teste a conexão a qualquer momento para verificar se está funcionando</TBullet>
            </TSection>
            <TSection icon={<span>🏢</span>} title="SETORES DISPONÍVEIS">
              <TBullet><strong>Entrada Principal</strong> — Portão de entrada de pedestres e veículos</TBullet>
              <TBullet><strong>Garagem</strong> — Estacionamento coberto e descoberto</TBullet>
              <TBullet><strong>Portaria</strong> — Visão da guarita e recepção</TBullet>
              <TBullet><strong>Área Comum</strong> — Playground, piscina, churrasqueira, salão de festas</TBullet>
              <TBullet><strong>Elevador</strong> — Interior dos elevadores</TBullet>
              <TBullet><strong>Corredor</strong> — Corredores internos dos blocos</TBullet>
            </TSection>
            <TSection icon={<span>⭐</span>} title="DICAS IMPORTANTES">
              <TBullet>A URL da câmera geralmente é informada pelo <strong>técnico de CFTV</strong> que instalou as câmeras</TBullet>
              <TBullet>As câmeras precisam estar na <strong>mesma rede</strong> que o servidor ou ter acesso remoto configurado</TBullet>
              <TBullet>Se a câmera aparece offline, verifique se ela está <strong>ligada e conectada à rede</strong></TBullet>
              <TBullet>Formato <strong>MJPEG</strong> é o mais compatível com a maioria das câmeras do mercado</TBullet>
              <TBullet>Use nomes descritivos (ex: "Entrada Bloco A" em vez de "Cam01") para facilitar o monitoramento</TBullet>
            </TSection>
          </TutorialButton>
          <button
            onClick={openNew}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      </header>

      <main style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "12px", paddingBottom: "6rem" }}>
        <ComoFunciona steps={[
          "📹 Cadastre câmeras RTSP do condomínio",
          "⚙️ Configure nome, URL e localização de cada câmera",
          "🖥️ Portaria visualiza em tempo real no monitoramento",
          "📸 Snapshots e gravações disponíveis",
        ]} />
        {cameras.length === 0 ? (
          <div style={{ textAlign: "center", paddingTop: "4rem" }}>
            <Camera className="w-16 h-16 mx-auto mb-4" style={{ color: isDark ? "#475569" : "#cbd5e1" }} />
            <p style={{ fontSize: "16px", fontWeight: 600, color: p.textSecondary, marginBottom: "8px" }}>
              Nenhuma câmera cadastrada
            </p>
            <p style={{ fontSize: "13px", color: p.textMuted, marginBottom: "24px" }}>
              Cadastre as câmeras do condomínio para começar o monitoramento
            </p>
            <button
              onClick={openNew}
              style={{
                padding: "12px 28px", borderRadius: "12px", border: "none",
                background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)", color: "#fff",
                fontWeight: 600, fontSize: "14px", cursor: "pointer",
              }}
            >
              <Plus className="w-4 h-4 inline mr-2" style={{ verticalAlign: "-2px" }} />
              Cadastrar Câmera
            </button>
          </div>
        ) : (
          cameras.map((camera) => (
            <div
              key={camera.id}
              style={{
                borderRadius: "16px", padding: "16px",
                background: isDark ? "rgba(255,255,255,0.04)" : "#fff",
                border: `1.5px solid ${p.divider}`,
                opacity: camera.ativa ? 1 : 0.5,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    width: "44px", height: "44px", borderRadius: "12px",
                    background: camera.ativa
                      ? "#003580"
                      : isDark ? "rgba(255,255,255,0.06)" : "#e2e8f0",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}
                >
                  <Video className="w-5 h-5" style={{ color: camera.ativa ? "#fff" : "#94a3b8" }} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: p.textHeading }}>
                    {camera.nome}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
                    <span style={{
                      fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "6px",
                      background: isDark ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.08)",
                      color: "#6366f1",
                    }}>
                      {getSetorLabel(camera.setor)}
                    </span>
                    {camera.localizacao && (
                      <span style={{ fontSize: "11px", color: p.textMuted, display: "flex", alignItems: "center", gap: "3px" }}>
                        <MapPin className="w-3 h-3" /> {camera.localizacao}
                      </span>
                    )}
                  </div>
                  {camera.ip && (
                    <p style={{ fontSize: "11px", color: p.textMuted, marginTop: "4px" }}>
                      {camera.protocolo}://{camera.ip}{camera.porta ? `:${camera.porta}` : ""}
                    </p>
                  )}
                </div>

                <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                  <button
                    onClick={() => handleToggle(camera.id)}
                    style={{
                      width: "36px", height: "36px", borderRadius: "10px", border: "none",
                      background: camera.ativa
                        ? isDark ? "rgba(16,185,129,0.15)" : "rgba(16,185,129,0.1)"
                        : isDark ? "rgba(239,68,68,0.15)" : "rgba(239,68,68,0.1)",
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                    title={camera.ativa ? "Desativar" : "Ativar"}
                  >
                    {camera.ativa
                      ? <Wifi className="w-4 h-4" style={{ color: "#10b981" }} />
                      : <WifiOff className="w-4 h-4" style={{ color: "#ef4444" }} />}
                  </button>
                  <button
                    onClick={() => openEdit(camera)}
                    style={{
                      width: "36px", height: "36px", borderRadius: "10px", border: "none",
                      background: isDark ? "rgba(255,255,255,0.06)" : "#f1f5f9",
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <Pencil className="w-4 h-4" style={{ color: p.textSecondary }} />
                  </button>
                  <button
                    onClick={() => handleDelete(camera.id)}
                    disabled={deleting === camera.id}
                    style={{
                      width: "36px", height: "36px", borderRadius: "10px", border: "none",
                      background: isDark ? "rgba(239,68,68,0.12)" : "rgba(239,68,68,0.08)",
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    {deleting === camera.id
                      ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#ef4444" }} />
                      : <Trash2 className="w-4 h-4" style={{ color: "#ef4444" }} />}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </main>

      {/* ═══ Form Modal ═══ */}
      {showForm && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 100,
            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
          }}
          onClick={() => setShowForm(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: "500px", maxHeight: "90dvh", overflowY: "auto",
              borderRadius: "24px 24px 0 0", padding: "24px",
              background: isDark ? "#1e293b" : "#fff",
            }}
          >
            {/* Modal header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: 700, color: p.textHeading }}>
                {editingId ? "Editar Câmera" : "Nova Câmera"}
              </h2>
              <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px" }}>
                <X className="w-6 h-6" style={{ color: p.textSecondary }} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Nome */}
              <div>
                <label style={labelStyle}>Nome da Câmera *</label>
                <input
                  style={inputStyle}
                  placeholder="Ex: Câmera Portaria Principal"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                />
              </div>

              {/* Setor + Localização */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={labelStyle}>Setor</label>
                  <select
                    style={selectStyle}
                    value={form.setor}
                    onChange={(e) => setForm({ ...form, setor: e.target.value })}
                  >
                    {SETORES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Localização</label>
                  <input
                    style={inputStyle}
                    placeholder="Ex: Bloco A - Térreo"
                    value={form.localizacao || ""}
                    onChange={(e) => setForm({ ...form, localizacao: e.target.value })}
                  />
                </div>
              </div>

              {/* Tipo de Stream */}
              <div>
                <label style={labelStyle}>Tipo de Stream</label>
                <select
                  style={selectStyle}
                  value={form.tipo_stream}
                  onChange={(e) => setForm({ ...form, tipo_stream: e.target.value })}
                >
                  {TIPOS_STREAM.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* URL do Stream */}
              <div>
                <label style={labelStyle}>URL do Stream</label>
                <input
                  style={inputStyle}
                  placeholder="Ex: http://192.168.1.100:8080/video"
                  value={form.url_stream || ""}
                  onChange={(e) => setForm({ ...form, url_stream: e.target.value })}
                />
                <p style={{ fontSize: "11px", color: p.textMuted, marginTop: "4px" }}>
                  URL completa do stream da câmera (MJPEG, HLS ou snapshot)
                </p>
              </div>

              {/* IP + Porta */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "10px" }}>
                <div>
                  <label style={labelStyle}>IP da Câmera</label>
                  <input
                    style={inputStyle}
                    placeholder="192.168.1.100"
                    value={form.ip || ""}
                    onChange={(e) => setForm({ ...form, ip: e.target.value })}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Porta</label>
                  <input
                    style={inputStyle}
                    type="number"
                    placeholder="8080"
                    value={form.porta || ""}
                    onChange={(e) => setForm({ ...form, porta: e.target.value ? parseInt(e.target.value) : null })}
                  />
                </div>
              </div>

              {/* Usuário + Senha */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={labelStyle}>Usuário</label>
                  <input
                    style={inputStyle}
                    placeholder="admin"
                    value={form.usuario || ""}
                    onChange={(e) => setForm({ ...form, usuario: e.target.value })}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Senha</label>
                  <input
                    style={inputStyle}
                    type="password"
                    value={form.senha || ""}
                    onChange={(e) => setForm({ ...form, senha: e.target.value })}
                  />
                </div>
              </div>

              {/* Ordem */}
              <div>
                <label style={labelStyle}>Ordem de exibição</label>
                <input
                  style={inputStyle}
                  type="number"
                  min="0"
                  value={form.ordem}
                  onChange={(e) => setForm({ ...form, ordem: parseInt(e.target.value) || 0 })}
                />
              </div>

              {/* Save button */}
              <button
                onClick={handleSave}
                disabled={saving || !form.nome.trim()}
                style={{
                  width: "100%", padding: "14px", borderRadius: "12px", border: "none",
                  background: form.nome.trim()
                    ? "#2d3354"
                    : isDark ? "rgba(255,255,255,0.06)" : "#e2e8f0",
                  color: form.nome.trim() ? "#fff" : "#94a3b8",
                  fontWeight: 700, fontSize: "15px", cursor: form.nome.trim() ? "pointer" : "not-allowed",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                  marginTop: "2.4rem",
                }}
              >
                {saving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    {editingId ? "Salvar Alterações" : "Cadastrar Câmera"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
