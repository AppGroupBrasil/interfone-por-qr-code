import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  ArrowLeft,
  DoorOpen,
  Car,
  Building,
  Waves,
  Dumbbell,
  PersonStanding,
  Loader2,
  Check,
  AlertCircle,
  Plus,
  Trash2,
  GripVertical,
  Pencil,
  X,
  Shield,
  ChevronDown,
  ChevronUp,
  History,
  Zap,
  Settings,
  Info,
  type LucideIcon,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

// ─── Icon mapping ─────────────────────────────────────────
const ICON_MAP: Record<string, LucideIcon> = {
  Car,
  PersonStanding,
  Building,
  Dumbbell,
  Waves,
  DoorOpen,
};

const ICON_OPTIONS = [
  { value: "Car", label: "Veicular", Icon: Car },
  { value: "PersonStanding", label: "Pedestre", Icon: PersonStanding },
  { value: "Building", label: "Bloco", Icon: Building },
  { value: "Dumbbell", label: "Academia", Icon: Dumbbell },
  { value: "Waves", label: "Piscina", Icon: Waves },
  { value: "DoorOpen", label: "Porta", Icon: DoorOpen },
];

const ROLE_OPTIONS = [
  { value: "morador", label: "Moradores" },
  { value: "funcionario", label: "Funcionários" },
  { value: "sindico", label: "Síndico" },
];

interface AccessPoint {
  id: number;
  condominio_id: number;
  name: string;
  icon: string;
  device_id: string | null;
  channel: number | null;
  enabled: number;
  pulse_duration: number;
  allowed_roles: string;
  order_index: number;
  is_custom: number;
  created_at: string;
  allow_manual_open: number;
  allow_botoeira_morador: number;
  allow_botoeira_portaria: number;
}

interface GateLog {
  id: number;
  user_name: string;
  action: string;
  details: string | null;
  created_at: string;
}

interface EwelinkDevice {
  deviceId: string;
  name: string;
  online: boolean;
  channelCount: number;
}

export default function SindicoAccessConfig() {
  const { user } = useAuth();
  const { isDark, p } = useTheme();
  const navigate = useNavigate();

  const [accessPoints, setAccessPoints] = useState<AccessPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Edit modal
  const [editingAP, setEditingAP] = useState<AccessPoint | null>(null);
  const [editForm, setEditForm] = useState({ name: "", icon: "DoorOpen", pulse_duration: 1000, allowed_roles: ["morador", "funcionario", "sindico"] as string[], allow_manual_open: false, allow_botoeira_morador: false, allow_botoeira_portaria: false });

  // New AP modal
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ name: "", icon: "DoorOpen", pulse_duration: 1000, allowed_roles: ["morador", "funcionario", "sindico"] as string[] });

  // Devices & Logs
  const [devices, setDevices] = useState<EwelinkDevice[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [logs, setLogs] = useState<GateLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  // ─── Fetch access points ───────────────────────────────
  const fetchAPs = async () => {
    try {
      const res = await apiFetch("/api/gate/access-points");
      if (res.ok) {
        const data = await res.json();
        setAccessPoints(data);
      }
    } catch {
      setError("Erro ao carregar pontos de acesso.");
    } finally {
      setLoading(false);
    }
  };

  // ─── Seed default access points ────────────────────────
  const seedDefaults = async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/gate/access-points/seed", { method: "POST" });
      if (res.ok) {
        await fetchAPs();
      }
    } catch {
      setError("Erro ao criar pontos padrão.");
    } finally {
      setLoading(false);
    }
  };

  // ─── Fetch devices (for assignment dropdown) ───────────
  const fetchDevices = async () => {
    setDevicesLoading(true);
    try {
      const res = await apiFetch("/api/gate/devices");
      if (res.ok) {
        const data = await res.json();
        setDevices(data.devices || []);
      }
    } catch {
      // Master-only, may fail for sindico
    } finally {
      setDevicesLoading(false);
    }
  };

  // ─── Fetch logs ────────────────────────────────────────
  const fetchLogs = async () => {
    try {
      const res = await apiFetch("/api/gate/logs?limit=50");
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchAPs();
    fetchLogs();
    // Try to load devices (works for master, may fail silently for sindico)
    fetchDevices();
  }, []);

  // ─── Toggle enabled ────────────────────────────────────
  const toggleEnabled = async (ap: AccessPoint) => {
    setSaving(ap.id);
    setError("");
    try {
      const res = await apiFetch(`/api/gate/access-points/${ap.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !ap.enabled }),
      });
      if (res.ok) {
        setAccessPoints((prev) =>
          prev.map((a) => (a.id === ap.id ? { ...a, enabled: a.enabled ? 0 : 1 } : a))
        );
      } else {
        const data = await res.json();
        setError(data.error || "Erro ao atualizar.");
      }
    } catch {
      setError("Erro de conexão.");
    } finally {
      setSaving(null);
    }
  };

  // ─── Assign device ─────────────────────────────────────
  const assignDevice = async (apId: number, deviceId: string, channel?: number | null) => {
    setSaving(apId);
    try {
      const res = await apiFetch(`/api/gate/access-points/${apId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_id: deviceId || null, channel: deviceId ? (channel ?? null) : null }),
      });
      if (res.ok) {
        setAccessPoints((prev) =>
          prev.map((a) => (a.id === apId ? { ...a, device_id: deviceId || null, channel: deviceId ? (channel ?? null) : null } : a))
        );
        flashSuccess("Dispositivo atribuído!");
      }
    } catch {
      setError("Erro ao atribuir dispositivo.");
    } finally {
      setSaving(null);
    }
  };

  // ─── Save edit ──────────────────────────────────────────
  const saveEdit = async () => {
    if (!editingAP) return;
    setSaving(editingAP.id);
    try {
      const res = await apiFetch(`/api/gate/access-points/${editingAP.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          icon: editForm.icon,
          pulse_duration: editForm.pulse_duration,
          allowed_roles: editForm.allowed_roles,
          allow_manual_open: editForm.allow_manual_open,
          allow_botoeira_morador: editForm.allow_botoeira_morador,
          allow_botoeira_portaria: editForm.allow_botoeira_portaria,
        }),
      });
      if (res.ok) {
        await fetchAPs();
        setEditingAP(null);
        flashSuccess("Ponto de acesso atualizado!");
      }
    } catch {
      setError("Erro ao salvar.");
    } finally {
      setSaving(null);
    }
  };

  // ─── Create new ─────────────────────────────────────────
  const createNew = async () => {
    if (!newForm.name.trim()) {
      setError("Nome é obrigatório.");
      return;
    }
    setSaving(-1);
    try {
      const res = await apiFetch("/api/gate/access-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newForm.name,
          icon: newForm.icon,
          pulse_duration: newForm.pulse_duration,
          allowed_roles: newForm.allowed_roles,
          enabled: false,
        }),
      });
      if (res.ok) {
        await fetchAPs();
        setShowNew(false);
        setNewForm({ name: "", icon: "DoorOpen", pulse_duration: 1000, allowed_roles: ["morador", "funcionario", "sindico"] });
        flashSuccess("Ponto de acesso criado!");
      }
    } catch {
      setError("Erro ao criar.");
    } finally {
      setSaving(null);
    }
  };

  // ─── Delete ─────────────────────────────────────────────
  const deleteAP = async (ap: AccessPoint) => {
    if (!confirm(`Excluir "${ap.name}"?`)) return;
    setSaving(ap.id);
    try {
      const res = await apiFetch(`/api/gate/access-points/${ap.id}`, { method: "DELETE" });
      if (res.ok) {
        setAccessPoints((prev) => prev.filter((a) => a.id !== ap.id));
        flashSuccess("Excluído!");
      }
    } catch {
      setError("Erro ao excluir.");
    } finally {
      setSaving(null);
    }
  };

  const flashSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 3000);
  };

  const getIcon = (iconName: string): LucideIcon => ICON_MAP[iconName] || DoorOpen;

  const formatDate = (d: string) => {
    try {
      return new Date(d + "Z").toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch {
      return d;
    }
  };

  const actionLabel = (action: string) => {
    const map: Record<string, string> = {
      open: "Abriu portão",
      access_point_open: "Abriu acesso",
      access_point_open_failed: "Falha ao abrir",
      toggle_on: "Ligou",
      toggle_off: "Desligou",
      config_updated: "Config atualizada",
    };
    return map[action] || action;
  };

  // ─── Render ─────────────────────────────────────────────
  return (
    <div className="min-h-dvh flex flex-col" style={{ background: p.pageBg }}>
      {/* Header */}
      <header className="sticky top-0 z-40" style={{ background: p.headerBg, borderBottom: p.headerBorder, boxShadow: p.headerShadow, color: p.text }}>
        <div className="flex items-center justify-between" style={{ padding: "1rem 2rem", height: "4.5rem" }}>
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} style={{ width: 40, height: 40, borderRadius: 12, background: p.btnBg, border: p.btnBorder, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: p.text }}>
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <span style={{ fontWeight: 700, fontSize: 18 }}>Portaria Virtual</span>
              <span style={{ fontSize: 13, color: isDark ? "rgba(255,255,255,0.6)" : "#64748b" }} className="block">Configuração de acessos</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5" style={{ color: p.textDim }} />
            <span style={{ fontSize: 12, color: p.textDim, fontWeight: 700, letterSpacing: "0.05em" }}>APP INTERFONE</span>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto" style={{ padding: "1.5rem", paddingBottom: "8rem", display: "flex", flexDirection: "column", gap: "1.2rem" }}>
        {/* Success / Error */}
        {success && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-emerald-500 text-sm">
            <Check className="w-4 h-4" /> {success}
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-red-500 text-sm">
            <AlertCircle className="w-4 h-4" /> {error}
            <button onClick={() => setError("")} className="ml-auto"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* ═══ Aviso de Segurança — Instalação Física ═══ */}
        <div style={{
          padding: '1rem 1.25rem', borderRadius: 16,
          background: isDark ? 'rgba(245,158,11,0.1)' : '#fffbeb',
          border: isDark ? '1px solid rgba(245,158,11,0.25)' : '1px solid #fde68a',
          display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
        }}>
          <AlertCircle style={{ width: 22, height: 22, color: '#f59e0b', flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: '0.82rem', lineHeight: 1.5, color: isDark ? '#fde68a' : '#92400e' }}>
            <p style={{ fontWeight: 700, marginBottom: 4 }}>⚡ Requisitos de Instalação Física</p>
            <p style={{ margin: '2px 0' }}>• O módulo IoT (SONOFF/Shelly) deve estar ligado na <strong>botoeira do motor do portão</strong>, nunca diretamente na alimentação do motor.</p>
            <p style={{ margin: '2px 0' }}>• Wi-Fi <strong>dedicado e estável (2.4 GHz)</strong> com sinal forte no local do módulo é obrigatório.</p>
            <p style={{ margin: '2px 0' }}>• Configure no app eWeLink: <strong>Power-on State = OFF</strong> e <strong>Inching Mode = Desabilitado</strong>.</p>
            <p style={{ margin: '2px 0' }}>• Nosso sistema usa <strong>modo Pulse</strong> — o relé liga e desliga automaticamente (1s), como apertar e soltar um botão.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : accessPoints.length === 0 ? (
          /* Empty state — seed defaults */
          <div className="text-center py-16 space-y-4">
            <DoorOpen className="w-16 h-16 mx-auto" style={{ color: "rgba(100, 116, 139, 0.3)" }} />
            <p className="text-lg font-semibold" style={{ color: "#003580" }}>Nenhum ponto de acesso configurado</p>
            <p className="text-sm" style={{ color: "#64748b" }}>
              Crie os pontos de acesso padrão ou adicione manualmente.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={seedDefaults}
                className="py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                style={{ minWidth: 220, paddingLeft: 40, paddingRight: 40 }}
              >
                <Zap className="w-4 h-4" /> Criar Padrões
              </button>
              <button
                onClick={() => setShowNew(true)}
                className="py-3 rounded-lg border border-primary text-primary font-medium hover:bg-primary/10 transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                style={{ minWidth: 220, paddingLeft: 40, paddingRight: 40 }}
              >
                <Plus className="w-4 h-4" /> Criar Personalizado
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* ─── Info Banner: Multi-channel ─────────── */}
            <div style={{
              background: "linear-gradient(135deg, rgba(0,98,209,0.15) 0%, rgba(16,185,129,0.10) 100%)",
              border: "1.5px solid rgba(0,98,209,0.3)",
              borderRadius: 16,
              padding: "16px 20px",
              display: "flex",
              gap: 14,
              alignItems: "flex-start",
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: "linear-gradient(135deg, #0062d1, #10b981)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <Info className="w-5 h-5 text-white" />
              </div>
              <div>
                <p style={{ fontWeight: 700, fontSize: 14, color: "#ffffff", marginBottom: 6 }}>
                  💡 Como funciona: 1 dispositivo = várias portas
                </p>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", lineHeight: 1.6 }}>
                  Um <strong>smart switch de 4 canais</strong> (ex: SONOFF 4CH) possui <strong>4 relês independentes</strong> dentro de um único aparelho.
                  Cada canal controla um ponto de acesso diferente (portão, fechadura, etc.).
                  Selecione o dispositivo e o <strong>canal correspondente</strong> em cada ponto abaixo.
                </p>
                <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {["Canal 1 → Portão Veicular", "Canal 2 → Portão Pedestre", "Canal 3 → Bloco", "Canal 4 → Academia"].map((t) => (
                    <span key={t} style={{
                      fontSize: 11, fontWeight: 600, color: "#ffffff",
                      background: "rgba(0,98,209,0.3)", borderRadius: 8, padding: "4px 10px",
                    }}>{t}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* ─── Access Points List ─────────────────── */}
            <div className="mb-10" style={{ display: "flex", flexDirection: "column", gap: "0.5cm" }}>
              {accessPoints.map((ap) => {
                const IconComp = getIcon(ap.icon);
                const isSaving = saving === ap.id;
                let roles: string[] = [];
                try { roles = JSON.parse(ap.allowed_roles || "[]"); } catch { /* noop */ }

                return (
                  <div
                    key={ap.id}
                    className={`ui-card rounded-2xl p-4 transition-all ${ap.enabled ? "border-l-4 border-l-emerald-500" : "opacity-70 border-l-4 border-l-transparent"}`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Icon */}
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)", border: "1.5px solid rgba(255,255,255,0.35)" }}>
                        <IconComp className="w-6 h-6 text-white" />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold truncate" style={{ color: "#ffffff" }}>{ap.name}</p>
                          {ap.is_custom ? (
                            <span className="text-[10px] bg-purple-500/10 text-purple-500 px-2 py-0.5 rounded-full font-medium">
                              PERSONALIZADO
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ap.device_id ? "bg-white/15 text-white" : "bg-orange-500/20 text-orange-400"}`}>
                            {ap.device_id ? (ap.channel !== null && ap.channel !== undefined ? `Canal ${ap.channel + 1}` : "Dispositivo vinculado") : "Sem dispositivo"}
                          </span>
                          <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.6)" }}>
                            {ap.pulse_duration}ms · {roles.map(r => r === "morador" ? "Morad." : r === "funcionario" ? "Func." : "Sínd.").join(", ")}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Toggle */}
                        <button
                          onClick={() => toggleEnabled(ap)}
                          disabled={isSaving}
                          className={`relative w-12 h-7 rounded-full transition-all ${ap.enabled ? "bg-emerald-500" : "bg-muted-foreground/30"}`}
                        >
                          <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all ${ap.enabled ? "left-5.5" : "left-0.5"}`} />
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => {
                            setEditingAP(ap);
                            let parsedRoles: string[] = [];
                            try { parsedRoles = JSON.parse(ap.allowed_roles || "[]"); } catch { parsedRoles = ["morador", "funcionario", "sindico"]; }
                            setEditForm({
                              name: ap.name,
                              icon: ap.icon,
                              pulse_duration: ap.pulse_duration,
                              allowed_roles: parsedRoles,
                              allow_manual_open: !!ap.allow_manual_open,
                              allow_botoeira_morador: !!ap.allow_botoeira_morador,
                              allow_botoeira_portaria: !!ap.allow_botoeira_portaria,
                            });
                          }}
                          className="p-2 rounded-lg hover:bg-[#003580]/5 transition-all"
                          style={{ color: "#64748b" }}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => deleteAP(ap)}
                          disabled={isSaving}
                          className="p-2 rounded-lg hover:bg-red-500/10 text-red-400 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Device assignment (if devices loaded) */}
                    {devices.length > 0 && (
                      <div className="mt-4 pt-4 border-t" style={{ borderColor: "rgba(0, 53, 128, 0.05)" }}>
                        <label className="text-xs mb-1 block" style={{ color: "#64748b" }}>Dispositivo smart switch:</label>
                        <select
                          value={ap.device_id || ""}
                          onChange={(e) => {
                            const devId = e.target.value;
                            const dev = devices.find((d) => d.deviceId === devId);
                            // If multi-channel, default to channel 0
                            assignDevice(ap.id, devId, dev && dev.channelCount > 1 ? (ap.channel ?? 0) : null);
                          }}
                          disabled={isSaving}
                          className="w-full rounded-lg px-3 py-2 text-sm"
                          style={{ background: "#f8fafc", border: "1px solid rgba(0, 53, 128, 0.1)", color: "#003580" }}
                        >
                          <option value="">— Nenhum —</option>
                          {devices.map((d) => (
                            <option key={d.deviceId} value={d.deviceId}>
                              {d.name} {d.online ? "🟢" : "🔴"} {d.channelCount > 1 ? `(${d.channelCount} canais)` : ""}
                            </option>
                          ))}
                        </select>
                        {/* Channel selector for multi-channel devices */}
                        {ap.device_id && (() => {
                          const dev = devices.find((d) => d.deviceId === ap.device_id);
                          if (!dev || dev.channelCount <= 1) return null;
                          return (
                            <div className="mt-2">
                              <label className="text-xs mb-1 block" style={{ color: "#64748b" }}>Canal (saída do relê):</label>
                              <select
                                value={ap.channel ?? 0}
                                onChange={(e) => assignDevice(ap.id, ap.device_id!, parseInt(e.target.value))}
                                disabled={isSaving}
                                className="w-full rounded-lg px-3 py-2 text-sm"
                                style={{ background: "#f8fafc", border: "1px solid rgba(0, 53, 128, 0.1)", color: "#003580" }}
                              >
                                {Array.from({ length: dev.channelCount }, (_, i) => (
                                  <option key={i} value={i}>Canal {i + 1}</option>
                                ))}
                              </select>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add button */}
            <button
              onClick={() => setShowNew(true)}
              className="w-full rounded-xl font-medium hover:opacity-90 transition-all flex items-center justify-center gap-2 mb-6"
              style={{ background: "#ffffff", color: "#003580", minHeight: "60px" }}
            >
              <Plus className="w-5 h-5" style={{ color: "#003580" }} /> Adicionar Acesso Personalizado
            </button>

            {/* Logs section */}
            <button
              onClick={() => { setShowLogs(!showLogs); if (!showLogs) fetchLogs(); }}
              className="w-full rounded-xl font-medium hover:opacity-90 transition-all flex items-center justify-center gap-2"
              style={{ background: "#ffffff", color: "#003580", minHeight: "60px" }}
            >
              <History className="w-5 h-5" style={{ color: "#003580" }} />
              Histórico de Acionamentos
              {showLogs ? <ChevronUp className="w-4 h-4" style={{ color: "#003580" }} /> : <ChevronDown className="w-4 h-4" style={{ color: "#003580" }} />}
            </button>

            {showLogs && (
              <div className="mt-4 space-y-3">
                {logs.length === 0 ? (
                  <p className="text-sm text-center py-4" style={{ color: "#64748b" }}>Nenhum registro.</p>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: "rgba(0, 53, 128, 0.02)" }}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: "#003580" }}>{log.user_name}</p>
                        <p className="text-xs" style={{ color: "#64748b" }}>{actionLabel(log.action)} {log.details ? `· ${log.details}` : ""}</p>
                      </div>
                      <span className="text-[10px] shrink-0" style={{ color: "#64748b" }}>{formatDate(log.created_at)}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}

        {/* ─── Edit Modal ────────────────────────────── */}
        {editingAP && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(241,245,249,0.92)", backdropFilter: "blur(8px)" }} onClick={() => setEditingAP(null)}>
            <div className="w-full max-w-md overflow-hidden" style={{ borderRadius: 20, boxShadow: "0 25px 60px rgba(0,0,0,0.12), 0 4px 20px rgba(0,0,0,0.06)", border: "1px solid rgba(0,53,128,0.08)" }} onClick={(e) => e.stopPropagation()}>
              {/* Header bar */}
              <div style={{ background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)", padding: "20px 24px" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Settings className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-white">Editar Acesso</h3>
                  </div>
                  <button onClick={() => setEditingAP(null)} style={{ width: 32, height: 32, borderRadius: 8, background: isDark ? "rgba(255,255,255,0.15)" : "#f0f4f8", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}>
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div style={{ background: "#ffffff", padding: "24px", display: "flex", flexDirection: "column", gap: "0.5cm" }}>
                {/* Name */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, display: "block" }}>Nome do acesso</label>
                  <input
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full"
                    style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "12px 16px", fontSize: 15, color: "#1e293b", outline: "none", transition: "border 0.2s" }}
                  />
                </div>

                {/* Icon */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, display: "block" }}>Ícone</label>
                  <div className="flex gap-2 flex-wrap">
                    {ICON_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setEditForm({ ...editForm, icon: opt.value })}
                        style={{
                          width: 48, height: 48, borderRadius: 12, border: editForm.icon === opt.value ? "2px solid #003580" : "1.5px solid #e2e8f0",
                          background: editForm.icon === opt.value ? "#eef2ff" : "#f8fafc",
                          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.2s"
                        }}
                      >
                        <opt.Icon style={{ width: 22, height: 22, color: editForm.icon === opt.value ? "#003580" : "#94a3b8" }} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pulse duration */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Duração do pulso</label>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#003580", background: "#eef2ff", padding: "2px 10px", borderRadius: 20 }}>{editForm.pulse_duration}ms</span>
                  </div>
                  <input
                    type="range"
                    min={500}
                    max={5000}
                    step={100}
                    value={editForm.pulse_duration}
                    onChange={(e) => setEditForm({ ...editForm, pulse_duration: parseInt(e.target.value) })}
                    className="w-full"
                    style={{ accentColor: "#003580" }}
                  />
                </div>

                {/* Allowed roles */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, display: "block" }}>Quem pode abrir</label>
                  <div className="flex gap-2 flex-wrap">
                    {ROLE_OPTIONS.map((role) => {
                      const active = editForm.allowed_roles.includes(role.value);
                      return (
                        <button
                          key={role.value}
                          onClick={() => {
                            setEditForm({
                              ...editForm,
                              allowed_roles: active
                                ? editForm.allowed_roles.filter((r) => r !== role.value)
                                : [...editForm.allowed_roles, role.value],
                            });
                          }}
                          style={{
                            padding: "8px 18px", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
                            border: active ? "2px solid #003580" : "1.5px solid #e2e8f0",
                            background: active ? "#003580" : "#f8fafc",
                            color: active ? "#ffffff" : "#64748b"
                          }}
                        >
                          {role.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Allow manual open toggle */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, display: "block" }}>Abertura por biometria do celular</label>
                  <button
                    onClick={() => setEditForm({ ...editForm, allow_manual_open: !editForm.allow_manual_open })}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                      borderRadius: 12, cursor: "pointer", transition: "all 0.2s",
                      border: editForm.allow_manual_open ? "2px solid #003580" : "1.5px solid #e2e8f0",
                      background: editForm.allow_manual_open ? "#eef2ff" : "#f8fafc",
                    }}
                  >
                    <div style={{
                      width: 44, height: 24, borderRadius: 12, position: "relative", flexShrink: 0, transition: "all 0.2s",
                      background: editForm.allow_manual_open ? "#003580" : "#cbd5e1",
                    }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: 10, background: "#fff", position: "absolute", top: 2,
                        left: editForm.allow_manual_open ? 22 : 2, transition: "all 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                      }} />
                    </div>
                    <div style={{ flex: 1, textAlign: "left" }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: editForm.allow_manual_open ? "#003580" : "#64748b" }}>
                        {editForm.allow_manual_open ? "Habilitado" : "Desabilitado"}
                      </p>
                      <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                        Permite abrir pelo botão com biometria do celular (impressão digital / Face ID).
                      </p>
                    </div>
                  </button>
                </div>

                {/* Botoeira for Morador */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, display: "block" }}>Botoeira — Morador</label>
                  <button
                    onClick={() => setEditForm({ ...editForm, allow_botoeira_morador: !editForm.allow_botoeira_morador })}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                      borderRadius: 12, cursor: "pointer", transition: "all 0.2s",
                      border: editForm.allow_botoeira_morador ? "2px solid #059669" : "1.5px solid #e2e8f0",
                      background: editForm.allow_botoeira_morador ? "#ecfdf5" : "#f8fafc",
                    }}
                  >
                    <div style={{
                      width: 44, height: 24, borderRadius: 12, position: "relative", flexShrink: 0, transition: "all 0.2s",
                      background: editForm.allow_botoeira_morador ? "#059669" : "#cbd5e1",
                    }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: 10, background: "#fff", position: "absolute", top: 2,
                        left: editForm.allow_botoeira_morador ? 22 : 2, transition: "all 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                      }} />
                    </div>
                    <div style={{ flex: 1, textAlign: "left" }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: editForm.allow_botoeira_morador ? "#059669" : "#64748b" }}>
                        {editForm.allow_botoeira_morador ? "Habilitado" : "Desabilitado"}
                      </p>
                      <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                        Permite que o morador abra com um toque + confirmação (botoeira virtual).
                      </p>
                    </div>
                  </button>
                </div>

                {/* Botoeira for Portaria */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, display: "block" }}>Botoeira — Portaria</label>
                  <button
                    onClick={() => setEditForm({ ...editForm, allow_botoeira_portaria: !editForm.allow_botoeira_portaria })}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                      borderRadius: 12, cursor: "pointer", transition: "all 0.2s",
                      border: editForm.allow_botoeira_portaria ? "2px solid #d97706" : "1.5px solid #e2e8f0",
                      background: editForm.allow_botoeira_portaria ? "#fffbeb" : "#f8fafc",
                    }}
                  >
                    <div style={{
                      width: 44, height: 24, borderRadius: 12, position: "relative", flexShrink: 0, transition: "all 0.2s",
                      background: editForm.allow_botoeira_portaria ? "#d97706" : "#cbd5e1",
                    }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: 10, background: "#fff", position: "absolute", top: 2,
                        left: editForm.allow_botoeira_portaria ? 22 : 2, transition: "all 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                      }} />
                    </div>
                    <div style={{ flex: 1, textAlign: "left" }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: editForm.allow_botoeira_portaria ? "#d97706" : "#64748b" }}>
                        {editForm.allow_botoeira_portaria ? "Habilitado" : "Desabilitado"}
                      </p>
                      <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                        Permite que funcionários da portaria abram com um toque + confirmação.
                      </p>
                    </div>
                  </button>
                </div>

                {/* Save button */}
                <button
                  onClick={saveEdit}
                  disabled={saving !== null}
                  className="w-full flex items-center justify-center gap-2 font-bold text-white disabled:opacity-50 transition-all active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)", padding: "14px 0", borderRadius: 14, fontSize: 16, border: "none", cursor: "pointer", marginTop: "0.5cm" }}
                >
                  {saving !== null ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                  Salvar Alterações
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── New AP Modal ──────────────────────────── */}
        {showNew && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(241,245,249,0.92)", backdropFilter: "blur(8px)" }} onClick={() => setShowNew(false)}>
            <div className="w-full max-w-md overflow-hidden" style={{ borderRadius: 20, boxShadow: "0 25px 60px rgba(0,0,0,0.12), 0 4px 20px rgba(0,0,0,0.06)", border: "1px solid rgba(0,53,128,0.08)" }} onClick={(e) => e.stopPropagation()}>
              {/* Header bar */}
              <div style={{ background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)", padding: "20px 24px" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Plus className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-white">Novo Ponto de Acesso</h3>
                  </div>
                  <button onClick={() => setShowNew(false)} style={{ width: 32, height: 32, borderRadius: 8, background: isDark ? "rgba(255,255,255,0.15)" : "#f0f4f8", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}>
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div style={{ background: "#ffffff", padding: "24px", display: "flex", flexDirection: "column", gap: "0.5cm" }}>
                {/* Name */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, display: "block" }}>Nome do acesso</label>
                  <input
                    value={newForm.name}
                    onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                    placeholder="Ex: Portão do Estacionamento"
                    className="w-full"
                    style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: "12px 16px", fontSize: 15, color: "#1e293b", outline: "none", transition: "border 0.2s" }}
                  />
                </div>

                {/* Icon */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, display: "block" }}>Ícone</label>
                  <div className="flex gap-2 flex-wrap">
                    {ICON_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setNewForm({ ...newForm, icon: opt.value })}
                        style={{
                          width: 48, height: 48, borderRadius: 12, border: newForm.icon === opt.value ? "2px solid #003580" : "1.5px solid #e2e8f0",
                          background: newForm.icon === opt.value ? "#eef2ff" : "#f8fafc",
                          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.2s"
                        }}
                      >
                        <opt.Icon style={{ width: 22, height: 22, color: newForm.icon === opt.value ? "#003580" : "#94a3b8" }} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pulse duration */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Duração do pulso</label>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#003580", background: "#eef2ff", padding: "2px 10px", borderRadius: 20 }}>{newForm.pulse_duration}ms</span>
                  </div>
                  <input
                    type="range"
                    min={500}
                    max={5000}
                    step={100}
                    value={newForm.pulse_duration}
                    onChange={(e) => setNewForm({ ...newForm, pulse_duration: parseInt(e.target.value) })}
                    className="w-full"
                    style={{ accentColor: "#003580" }}
                  />
                </div>

                {/* Allowed roles */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, display: "block" }}>Quem pode abrir</label>
                  <div className="flex gap-2 flex-wrap">
                    {ROLE_OPTIONS.map((role) => {
                      const active = newForm.allowed_roles.includes(role.value);
                      return (
                        <button
                          key={role.value}
                          onClick={() => {
                            setNewForm({
                              ...newForm,
                              allowed_roles: active
                                ? newForm.allowed_roles.filter((r) => r !== role.value)
                                : [...newForm.allowed_roles, role.value],
                            });
                          }}
                          style={{
                            padding: "8px 18px", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
                            border: active ? "2px solid #003580" : "1.5px solid #e2e8f0",
                            background: active ? "#003580" : "#f8fafc",
                            color: active ? "#ffffff" : "#64748b"
                          }}
                        >
                          {role.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Create button */}
                <button
                  onClick={createNew}
                  disabled={saving !== null}
                  className="w-full flex items-center justify-center gap-2 font-bold text-white disabled:opacity-50 transition-all active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)", padding: "14px 0", borderRadius: 14, fontSize: 16, border: "none", cursor: "pointer", marginTop: "0.5cm" }}
                >
                  {saving === -1 ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                  Criar Acesso
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
