/**
 * ═══════════════════════════════════════════════════════════
 * SÍNDICO — Configuração WhatsApp
 * Permite habilitar/desabilitar WhatsApp e escolher quais
 * tipos de notificação o condomínio recebe.
 * ═══════════════════════════════════════════════════════════
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { useTheme } from "@/hooks/useTheme";
import {
  ArrowLeft,
  Save,
  Loader2,
  CheckCircle,
  MessageCircle,
  ToggleLeft,
  ToggleRight,
  Send,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  List,
  TrendingUp,
  DollarSign,
  BarChart3,
  Users,
  Package,
  ShieldAlert,
  DoorOpen,
  CalendarCheck,
  Car,
  ClipboardList,
  BookOpen,
  Bell,
  Info,
  ExternalLink,
} from "lucide-react";

// ─── Notification types definition ───
const NOTIFICATION_TYPES = [
  { key: "whatsapp_notify_visitor_arrival", label: "Chegada de Visitantes", description: "Notifica quando um visitante chega na portaria", icon: Users, color: "#3b82f6" },
  { key: "whatsapp_notify_delivery", label: "Deliveries / Encomendas", description: "Notifica sobre entregas aguardando retirada", icon: Package, color: "#f59e0b" },
  { key: "whatsapp_notify_security_alert", label: "Alertas de Segurança", description: "Envia alertas de segurança importantes", icon: ShieldAlert, color: "#ef4444" },
  { key: "whatsapp_notify_gate_opened", label: "Abertura de Portão", description: "Confirma quando o portão é aberto remotamente", icon: DoorOpen, color: "#22c55e" },
  { key: "whatsapp_notify_pre_authorization", label: "Pré-Autorizações", description: "Avisa sobre visitantes pré-autorizados", icon: CalendarCheck, color: "#10b981" },
  { key: "whatsapp_notify_vehicle_access", label: "Acesso de Veículos", description: "Notifica sobre entrada/saída de veículos", icon: Car, color: "#6366f1" },
  { key: "whatsapp_notify_ronda", label: "Rondas", description: "Registros de rondas de segurança", icon: ClipboardList, color: "#14b8a6" },
  { key: "whatsapp_notify_livro_protocolo", label: "Livro de Protocolo", description: "Registros do livro de protocolo/ocorrências", icon: BookOpen, color: "#d946ef" },
];

export default function SindicoWhatsAppConfig() {
  const { isDark, p } = useTheme();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [enabled, setEnabled] = useState(false);
  const [notifications, setNotifications] = useState<Record<string, boolean>>({});
  const [testPhone, setTestPhone] = useState("");
  const [infoOpen, setInfoOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [globalConfigured, setGlobalConfigured] = useState(false);
  const [stats, setStats] = useState<{ today: { sent: number; total: number }; week: { sent: number; total: number }; month: { sent: number; total: number }; costPerMsg: number; monthlyLimit: number; estimatedCostMonth: number; estimatedCostWeek: number; estimatedCostToday: number } | null>(null);

  // Load current config
  useEffect(() => {
    apiFetch("/api/whatsapp/config")
      .then(r => r.ok ? r.json() : null)
      .then(cfg => {
        if (cfg) {
          setEnabled(cfg.whatsapp_enabled === "true");
          setGlobalConfigured(cfg._global_configured === "true");
          const notifs: Record<string, boolean> = {};
          for (const nt of NOTIFICATION_TYPES) {
            notifs[nt.key] = cfg[nt.key] === undefined || cfg[nt.key] === null ? true : cfg[nt.key] === "true";
          }
          setNotifications(notifs);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));

    apiFetch("/api/whatsapp/stats")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setStats(data); })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setSaveError("");
    try {
      const body: Record<string, string> = {
        whatsapp_enabled: enabled ? "true" : "false",
      };
      for (const nt of NOTIFICATION_TYPES) {
        body[nt.key] = notifications[nt.key] ? "true" : "false";
      }

      const res = await apiFetch("/api/whatsapp/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 5000);
      } else {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.error || `Erro ao salvar (${res.status})`);
        setTimeout(() => setSaveError(""), 5000);
      }
    } catch (err: any) {
      setSaveError("Erro de conexão com o servidor");
      setTimeout(() => setSaveError(""), 5000);
    }
    setSaving(false);
  };

  const handleTest = async () => {
    if (!testPhone) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await apiFetch("/api/whatsapp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: testPhone }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({ success: true, message: "Mensagem de teste enviada com sucesso!" });
      } else {
        setTestResult({ success: false, message: data.error || "Falha ao enviar mensagem de teste" });
      }
    } catch {
      setTestResult({ success: false, message: "Erro de conexão" });
    }
    setTesting(false);
  };

  const loadLogs = async () => {
    try {
      const res = await apiFetch("/api/whatsapp/logs?limit=20");
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setLogsTotal(data.total || 0);
      }
    } catch {}
  };

  const toggleLogs = () => {
    if (!logsOpen) loadLogs();
    setLogsOpen(!logsOpen);
  };

  const toggleNotification = (key: string) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const enabledCount = Object.values(notifications).filter(Boolean).length;

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: p.pageBg }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: p.accent }} />
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: `1px solid ${isDark ? "rgba(255,255,255,0.15)" : "#d1d5db"}`,
    background: isDark ? "rgba(255,255,255,0.06)" : "#fff",
    color: p.text,
    fontSize: 15,
    outline: "none",
  };

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: p.pageBg }}>
      {/* Header */}
      <header className="sticky top-0 z-40" style={{ background: p.headerBg, borderBottom: p.headerBorder, boxShadow: p.headerShadow, color: p.text }}>
        <div className="flex items-center gap-3" style={{ padding: "1rem 1.5rem", height: "4.5rem" }}>
          <button onClick={() => navigate(-1)} style={{ width: 40, height: 40, borderRadius: 12, background: p.btnBg, border: p.btnBorder, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: p.text }}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <MessageCircle className="w-5 h-5" style={{ color: "#25d366" }} />
          <span style={{ fontWeight: 700, fontSize: 18, flex: 1 }}>Notificações WhatsApp</span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto" style={{ padding: "1.5rem", paddingBottom: "8rem" }}>

        {/* ── Info dropdown ── */}
        <div style={{
          background: isDark ? "rgba(37,211,102,0.12)" : "#e8f9ee",
          border: isDark ? "2px solid rgba(37,211,102,0.4)" : "2px solid #25d366",
          borderRadius: 16,
          marginBottom: "1.25rem",
          overflow: "hidden",
          boxShadow: isDark ? "0 2px 12px rgba(37,211,102,0.15)" : "0 2px 12px rgba(37,211,102,0.18)",
        }}>
          <button
            onClick={() => setInfoOpen(!infoOpen)}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "1rem 1.25rem", background: isDark ? "rgba(37,211,102,0.08)" : "rgba(37,211,102,0.08)", border: "none", cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: isDark ? "rgba(37,211,102,0.2)" : "#25d366",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Info size={17} style={{ color: isDark ? "#86efac" : "#fff" }} />
              </div>
              <span style={{ fontWeight: 800, fontSize: 15, color: isDark ? "#86efac" : "#15803d" }}>
                Como funciona?
              </span>
            </div>
            {infoOpen ? <ChevronUp size={20} style={{ color: isDark ? "#86efac" : "#25d366" }} /> : <ChevronDown size={20} style={{ color: isDark ? "#86efac" : "#25d366" }} />}
          </button>
          {infoOpen && (
            <div style={{ padding: "0 1.25rem 1.25rem", fontSize: 13, lineHeight: 1.7, color: isDark ? "#bbf7d0" : "#15803d" }}>
              <p>Escolha abaixo quais funções deseja receber mensagens automáticas pelo WhatsApp.</p>

              <p style={{ marginTop: 10 }}>
                Para ativar o envio de mensagens, solicite a ativação junto ao <strong>suporte do sistema</strong>.
              </p>

              <div style={{
                background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                borderRadius: 12,
                padding: "0.875rem 1rem",
                marginTop: 12,
                border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #d1fae5",
              }}>
                <p style={{ fontWeight: 700, marginBottom: 6, fontSize: 13 }}>💰 Sobre os custos</p>
                <p style={{ fontSize: 12.5 }}>
                  O WhatsApp cobra de empresas por cada mensagem enviada através de seus sistemas.
                  O custo de <strong>R$ 0,09</strong> por mensagem é composto por:
                </p>
                <ul style={{ paddingLeft: 18, marginTop: 6, fontSize: 12.5 }}>
                  <li>Valor cobrado pelo WhatsApp na categoria <strong>Utilidade</strong></li>
                  <li>Custo da API para processamento e envio das mensagens</li>
                  <li>Impostos incidentes na emissão da nota fiscal ao condomínio/empresa</li>
                </ul>
                <p style={{ marginTop: 8, fontSize: 12.5 }}>
                  Para mais informações sobre os valores cobrados pelo WhatsApp, consulte a página oficial:
                </p>
                <a
                  href="https://business.whatsapp.com/products/platform-pricing?lang=pt_BR&country=Brasil&currency=D%C3%B3lar%20(USD)&category=Utilidade"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    marginTop: 6,
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: isDark ? "#86efac" : "#166534",
                    textDecoration: "underline",
                  }}
                >
                  <ExternalLink size={13} />
                  WhatsApp Business — Preços por plataforma
                </a>
              </div>

              <div style={{
                background: isDark ? "rgba(59,130,246,0.1)" : "#eff6ff",
                borderRadius: 12,
                padding: "0.875rem 1rem",
                marginTop: 12,
                border: isDark ? "1px solid rgba(59,130,246,0.2)" : "1px solid #bfdbfe",
              }}>
                <p style={{ fontWeight: 700, marginBottom: 4, fontSize: 13, color: isDark ? "#93c5fd" : "#1e40af" }}>📩 Já incluso sem custo adicional</p>
                <p style={{ fontSize: 12.5, color: isDark ? "#93c5fd" : "#1e40af" }}>
                  Todos os usuários já recebem <strong>gratuitamente</strong> as notificações por <strong>E-mail</strong> e <strong>Push Notification</strong> (notificação no celular). O envio pelo WhatsApp é <strong>opcional</strong>.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Usage Stats ── */}
        {stats && (
          <div style={{
            background: p.cardBg,
            borderRadius: 16,
            border: p.cardBorder,
            padding: "1.25rem",
            marginBottom: "1.25rem",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <BarChart3 size={18} style={{ color: "#8b5cf6" }} />
              <span style={{ fontWeight: 700, fontSize: 15, color: p.text }}>Uso de Mensagens</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {[
                { label: "Hoje", sent: stats.today.sent, cost: stats.estimatedCostToday },
                { label: "Semana", sent: stats.week.sent, cost: stats.estimatedCostWeek },
                { label: "Mês", sent: stats.month.sent, cost: stats.estimatedCostMonth },
              ].map(s => (
                <div key={s.label} style={{
                  background: isDark ? "rgba(255,255,255,0.04)" : "#f8fafc",
                  borderRadius: 12,
                  padding: "0.75rem",
                  textAlign: "center",
                  border: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid #e2e8f0",
                }}>
                  <div style={{ fontSize: 10, color: p.textMuted, fontWeight: 600 }}>{s.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: p.text, marginTop: 2 }}>{s.sent}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 3, color: "#f59e0b" }}>
                    <DollarSign size={10} /> R$ {s.cost.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
            {stats.monthlyLimit > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: p.textMuted, marginBottom: 4 }}>
                  <span>{stats.month.sent} / {stats.monthlyLimit} msgs</span>
                  <span>{Math.round((stats.month.sent / stats.monthlyLimit) * 100)}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 6, background: isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb", overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    borderRadius: 6,
                    width: `${Math.min((stats.month.sent / stats.monthlyLimit) * 100, 100)}%`,
                    background: (stats.month.sent / stats.monthlyLimit) >= 0.9 ? "#ef4444" : (stats.month.sent / stats.monthlyLimit) >= 0.7 ? "#f59e0b" : "#25d366",
                    transition: "width 0.3s",
                  }} />
                </div>
              </div>
            )}
            <div style={{ marginTop: 10, fontSize: 11, color: p.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
              <TrendingUp size={12} />
              Custo por mensagem: R$ {stats.costPerMsg.toFixed(2)}
            </div>
          </div>
        )}

        {/* ── Toggle Habilitado ── */}
        <div style={{
          background: p.cardBg,
          borderRadius: 16,
          border: enabled
            ? isDark ? "1px solid rgba(37,211,102,0.3)" : "1px solid #86efac"
            : p.cardBorder,
          padding: "1.25rem",
          marginBottom: "1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <MessageCircle size={20} style={{ color: enabled ? "#25d366" : (isDark ? "#64748b" : "#94a3b8") }} />
            <div>
              <span style={{ fontWeight: 700, fontSize: 15, color: p.text, display: "block" }}>WhatsApp Ativo</span>
              <span style={{ fontSize: 11, color: p.textMuted }}>
                {enabled ? "Notificações ativas para este condomínio" : "Notificações desativadas"}
              </span>
            </div>
          </div>
          <button
            onClick={() => setEnabled(!enabled)}
            style={{ background: "none", border: "none", cursor: "pointer", color: enabled ? "#25d366" : (isDark ? "#64748b" : "#94a3b8") }}
          >
            {enabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
          </button>
        </div>

        {/* ── Status das credenciais globais ── */}
        {!globalConfigured && (
          <div style={{
            background: isDark ? "rgba(245,158,11,0.08)" : "#fffbeb",
            border: isDark ? "1px solid rgba(245,158,11,0.25)" : "1px solid #fde68a",
            borderRadius: 14,
            padding: "0.875rem 1.25rem",
            marginBottom: "1rem",
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 13,
            color: isDark ? "#fbbf24" : "#92400e",
          }}>
            <AlertCircle size={18} />
            <span>WhatsApp ainda não configurado pelo administrador. Contacte o suporte.</span>
          </div>
        )}

        {/* ── Notification Types ── */}
        <div style={{
          background: p.cardBg,
          borderRadius: 16,
          border: p.cardBorder,
          padding: "1.25rem",
          marginBottom: "1rem",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Bell size={18} style={{ color: "#3b82f6" }} />
              <span style={{ fontWeight: 700, fontSize: 15, color: p.text }}>Tipos de Notificação</span>
            </div>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 10,
              background: isDark ? "rgba(59,130,246,0.15)" : "#dbeafe",
              color: isDark ? "#93c5fd" : "#1d4ed8",
            }}>
              {enabledCount}/{NOTIFICATION_TYPES.length}
            </span>
          </div>

          <p style={{ fontSize: 12, color: p.textMuted, marginBottom: 14, lineHeight: 1.5 }}>
            Escolha quais notificações o condomínio recebe por WhatsApp. Desative as que não fazem sentido para o seu condomínio.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {NOTIFICATION_TYPES.map(nt => {
              const isOn = notifications[nt.key] ?? true;
              const Icon = nt.icon;
              return (
                <div
                  key={nt.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "0.75rem 0.875rem",
                    borderRadius: 12,
                    background: isDark ? "rgba(255,255,255,0.03)" : "#f8fafc",
                    border: isOn
                      ? `1px solid ${isDark ? "rgba(37,211,102,0.2)" : "#bbf7d0"}`
                      : isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid #e2e8f0",
                    transition: "border 0.2s",
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: isOn
                      ? isDark ? `${nt.color}18` : `${nt.color}12`
                      : isDark ? "rgba(255,255,255,0.04)" : "#f1f5f9",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                    transition: "background 0.2s",
                  }}>
                    <Icon size={18} style={{ color: isOn ? nt.color : (isDark ? "#64748b" : "#94a3b8"), transition: "color 0.2s" }} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: isOn ? p.text : p.textMuted, transition: "color 0.2s" }}>
                      {nt.label}
                    </div>
                    <div style={{ fontSize: 11, color: p.textMuted, marginTop: 1 }}>
                      {nt.description}
                    </div>
                  </div>

                  <button
                    onClick={() => toggleNotification(nt.key)}
                    style={{
                      background: "none", border: "none", cursor: "pointer", flexShrink: 0,
                      color: isOn ? "#25d366" : (isDark ? "#64748b" : "#94a3b8"),
                      transition: "color 0.2s",
                    }}
                  >
                    {isOn ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Save button ── */}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 14,
            border: "none",
            background: saved ? "#16a34a" : "#25d366",
            color: "#fff",
            fontWeight: 700,
            fontSize: 15,
            cursor: saving ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginBottom: "1.5rem",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : saved ? <CheckCircle size={18} /> : <Save size={18} />}
          {saving ? "Salvando..." : saved ? "Salvo!" : "Salvar Configurações"}
        </button>

        {/* ── Save confirmation ── */}
        {saved && (
          <div style={{
            background: isDark ? "rgba(34,197,94,0.12)" : "#f0fdf4",
            border: isDark ? "1px solid rgba(34,197,94,0.3)" : "2px solid #22c55e",
            borderRadius: 14,
            padding: "1rem 1.25rem",
            marginBottom: "1.5rem",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}>
            <CheckCircle size={22} style={{ color: "#22c55e", flexShrink: 0 }} />
            <div>
              <span style={{ fontWeight: 700, fontSize: 14, color: isDark ? "#86efac" : "#166534", display: "block" }}>
                Configurações salvas com sucesso!
              </span>
              <span style={{ fontSize: 12, color: isDark ? "#bbf7d0" : "#15803d" }}>
                As preferências de notificação foram atualizadas.
              </span>
            </div>
          </div>
        )}

        {/* ── Save error ── */}
        {saveError && (
          <div style={{
            background: isDark ? "rgba(239,68,68,0.12)" : "#fef2f2",
            border: isDark ? "1px solid rgba(239,68,68,0.3)" : "2px solid #ef4444",
            borderRadius: 14,
            padding: "1rem 1.25rem",
            marginBottom: "1.5rem",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}>
            <AlertCircle size={22} style={{ color: "#ef4444", flexShrink: 0 }} />
            <div>
              <span style={{ fontWeight: 700, fontSize: 14, color: isDark ? "#fca5a5" : "#991b1b", display: "block" }}>
                Erro ao salvar
              </span>
              <span style={{ fontSize: 12, color: isDark ? "#fecaca" : "#b91c1c" }}>
                {saveError}
              </span>
            </div>
          </div>
        )}

        {/* ── Test section ── */}
        {enabled && globalConfigured && (
          <div style={{
            background: p.cardBg,
            borderRadius: 16,
            border: p.cardBorder,
            padding: "1.25rem",
            marginBottom: "1rem",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Send size={14} style={{ color: p.textMuted }} />
              <span style={{ fontWeight: 700, fontSize: 14, color: p.text }}>Testar Envio</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="tel"
                value={testPhone}
                onChange={e => setTestPhone(e.target.value)}
                placeholder="Número com DDI (ex: 5511999999999)"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                onClick={handleTest}
                disabled={testing || !testPhone}
                style={{
                  padding: "12px 20px",
                  borderRadius: 12,
                  border: "none",
                  background: "#25d366",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: testing || !testPhone ? "not-allowed" : "pointer",
                  opacity: testing || !testPhone ? 0.6 : 1,
                  whiteSpace: "nowrap",
                }}
              >
                {testing ? <Loader2 size={16} className="animate-spin" /> : "Enviar"}
              </button>
            </div>
            {testResult && (
              <div style={{
                marginTop: 10,
                padding: "10px 14px",
                borderRadius: 10,
                background: testResult.success ? (isDark ? "rgba(34,197,94,0.12)" : "#f0fdf4") : (isDark ? "rgba(239,68,68,0.12)" : "#fef2f2"),
                border: testResult.success ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(239,68,68,0.3)",
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: testResult.success ? "#22c55e" : "#ef4444",
              }}>
                {testResult.success ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                {testResult.message}
              </div>
            )}
          </div>
        )}

        {/* ── Logs section ── */}
        <div style={{
          background: p.cardBg,
          borderRadius: 16,
          border: p.cardBorder,
          overflow: "hidden",
        }}>
          <button
            onClick={toggleLogs}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "1rem 1.25rem", background: "transparent", border: "none", cursor: "pointer", color: p.text,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <List size={18} />
              <span style={{ fontWeight: 700, fontSize: 14 }}>Histórico de Mensagens</span>
              {logsTotal > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 700, background: isDark ? "rgba(59,130,246,0.2)" : "#dbeafe",
                  color: isDark ? "#93c5fd" : "#1d4ed8", padding: "2px 8px", borderRadius: 10,
                }}>
                  {logsTotal}
                </span>
              )}
            </div>
            {logsOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {logsOpen && (
            <div style={{ padding: "0 1.25rem 1rem" }}>
              {logs.length === 0 ? (
                <p style={{ fontSize: 13, color: p.textMuted, textAlign: "center", padding: "1rem 0" }}>
                  Nenhuma mensagem enviada ainda.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {logs.map((log: any) => (
                    <div key={log.id} style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      background: isDark ? "rgba(255,255,255,0.04)" : "#f8fafc",
                      border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e2e8f0",
                      fontSize: 12,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 600, color: p.text }}>
                          {log.phone}
                        </span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 6,
                          background: log.status === "sent" ? "#dcfce7" : "#fecaca",
                          color: log.status === "sent" ? "#166534" : "#991b1b",
                        }}>
                          {log.status === "sent" ? "Enviado" : "Falha"}
                        </span>
                      </div>
                      <div style={{ color: p.textMuted, fontSize: 11, marginTop: 4 }}>
                        {log.template_name} • {new Date(log.created_at).toLocaleString("pt-BR")}
                      </div>
                      {log.error && (
                        <div style={{ color: "#ef4444", fontSize: 11, marginTop: 2 }}>
                          {log.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
