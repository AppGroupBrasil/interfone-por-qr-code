import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  ArrowLeft,
  DoorOpen,
  Wifi,
  WifiOff,
  Loader2,
  Check,
  AlertCircle,
  RefreshCw,
  History,
  Zap,
  Clock,
  Shield,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface GateLog {
  id: number;
  user_name: string;
  action: string;
  details: string | null;
  created_at: string;
}

export default function SindicoGateConfig() {
  const { isDark, p } = useTheme();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState<{
    online: boolean;
    configured: boolean;
    enabled: boolean;
    deviceName?: string;
  } | null>(null);
  const [logs, setLogs] = useState<GateLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [saved, setSaved] = useState(false);

  const [config, setConfig] = useState({
    gate_enabled: "false",
    gate_device_name: "",
    gate_pulse_duration: "1000",
    gate_device_configured: false,
  });

  // Fetch config and status on mount
  useEffect(() => {
    Promise.all([
      apiFetch("/api/gate/config").then((r) => (r.ok ? r.json() : {})),
      apiFetch("/api/gate/status").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([cfg, status]) => {
        if (cfg && Object.keys(cfg).length) {
          setConfig((prev) => ({ ...prev, ...cfg }));
        }
        if (status) setDeviceStatus(status);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const saveConfig = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await apiFetch("/api/gate/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gate_enabled: config.gate_enabled,
          gate_device_name: config.gate_device_name,
          gate_pulse_duration: config.gate_pulse_duration,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        const statusRes = await apiFetch("/api/gate/status");
        if (statusRes.ok) setDeviceStatus(await statusRes.json());
      }
    } catch {}
    setSaving(false);
  };

  const fetchLogs = async () => {
    try {
      const res = await apiFetch("/api/gate/logs?limit=30");
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch {}
  };

  const toggleLogs = () => {
    if (!showLogs) fetchLogs();
    setShowLogs(!showLogs);
  };

  const actionLabel = (action: string) => {
    switch (action) {
      case "open":
        return "🚪 Portão aberto";
      case "open_failed":
        return "❌ Falha ao abrir";
      case "toggle_on":
        return "⚡ Ligou";
      case "toggle_off":
        return "⚡ Desligou";
      case "config_updated":
        return "⚙️ Config atualizada";
      default:
        return action;
    }
  };

  const pulseSec = (parseInt(config.gate_pulse_duration) || 1000) / 1000;

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: p.pageBg }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: p.accentBright }} />
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: p.pageBg }}>
      {/* Header */}
      <header className="sticky top-0 z-30 safe-area-top" style={{ background: p.headerBg, borderBottom: p.headerBorder, boxShadow: p.headerShadow, padding: "18px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => navigate(-1)} style={{ width: 40, height: 40, borderRadius: 12, background: p.btnBg, border: p.btnBorder, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: p.text, flexShrink: 0 }}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontWeight: 700, fontSize: 18, color: p.text, display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
              <DoorOpen className="w-5 h-5" /> Módulo Portão
            </h1>
            <p style={{ fontSize: 12, color: "rgba(147,197,253,0.8)", marginTop: 2, marginBottom: 0 }}>Controle de acesso IoT</p>
          </div>
          <button
            onClick={() => navigate("/biblioteca-dispositivos")}
            style={{ padding: "8px 14px", fontSize: 12, fontWeight: 700, borderRadius: 12, background: p.btnBg, border: p.btnBorder, color: p.text, cursor: "pointer", flexShrink: 0 }}
          >
            📦 Dispositivos
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 640, margin: "0 auto", width: "100%", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem", paddingBottom: "3rem" }}>

        {/* Status Card */}
        <div style={{ background: p.cardBg, border: p.cardBorder, borderRadius: 16, padding: "1rem 1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: p.textSecondary }}>Status do Dispositivo</span>
            {deviceStatus?.configured ? (
              deviceStatus.online ? (
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#22c55e", fontWeight: 600 }}>
                  <Wifi className="w-3.5 h-3.5" /> Online
                </span>
              ) : (
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#f87171", fontWeight: 600 }}>
                  <WifiOff className="w-3.5 h-3.5" /> Offline
                </span>
              )
            ) : (
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#f59e0b", fontWeight: 600 }}>
                <AlertCircle className="w-3.5 h-3.5" /> Aguardando instalação
              </span>
            )}
          </div>
          {deviceStatus?.deviceName && (
            <p style={{ fontSize: 13, color: p.text, fontWeight: 600, margin: 0 }}>{deviceStatus.deviceName}</p>
          )}
          {!config.gate_device_configured && (
            <p style={{ fontSize: 12, color: p.textMuted, marginTop: 6, marginBottom: 0 }}>
              O dispositivo do portão será configurado pela equipe App Interfone durante a instalação.
            </p>
          )}
        </div>

        {/* Enable/Disable Card */}
        <div style={{ background: p.cardBg, border: p.cardBorder, borderRadius: 16, padding: "1rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontWeight: 700, fontSize: 14, color: p.text, margin: 0 }}>Portão habilitado</p>
            <p style={{ fontSize: 12, color: p.textMuted, marginTop: 3, marginBottom: 0 }}>Ativa o botão "Abrir Portão" para os funcionários</p>
          </div>
          <button
            onClick={() =>
              setConfig((prev) => ({
                ...prev,
                gate_enabled: prev.gate_enabled === "true" ? "false" : "true",
              }))
            }
            disabled={!config.gate_device_configured}
            style={{
              width: 48, height: 26, borderRadius: 13, border: "none",
              cursor: config.gate_device_configured ? "pointer" : "not-allowed",
              background: config.gate_enabled === "true" ? "#22c55e" : "rgba(148,163,184,0.4)",
              display: "flex", alignItems: "center",
              justifyContent: config.gate_enabled === "true" ? "flex-end" : "flex-start",
              opacity: config.gate_device_configured ? 1 : 0.4,
              transition: "background 0.2s",
              flexShrink: 0,
            }}
          >
            <span style={{ width: 20, height: 20, background: "#fff", borderRadius: "50%", margin: "0 3px", boxShadow: "0 1px 4px rgba(0,0,0,0.3)", display: "block" }} />
          </button>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: p.divider }} />

        {/* Device Name Card */}
        <div style={{ background: p.cardBg, border: p.cardBorder, borderRadius: 16, padding: "1rem 1.25rem" }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: p.textSecondary, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Nome do portão
          </label>
          <p style={{ fontSize: 12, color: p.textMuted, marginBottom: 8, marginTop: 0 }}>
            Nome exibido para os funcionários ao abrir o portão
          </p>
          <input
            type="text"
            placeholder="Ex: Portão Principal"
            value={config.gate_device_name}
            onChange={(e) =>
              setConfig((prev) => ({ ...prev, gate_device_name: e.target.value }))
            }
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 10,
              border: p.cardBorder, background: p.surfaceBg,
              color: p.text, fontSize: 14, outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Pulse Duration Card */}
        <div style={{ background: p.cardBg, border: p.cardBorder, borderRadius: 16, padding: "1rem 1.25rem" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: p.textSecondary, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            <Clock className="w-3.5 h-3.5" /> Tempo de acionamento
          </label>
          <p style={{ fontSize: 12, color: p.textMuted, marginBottom: 10, marginTop: 0 }}>
            Duração do pulso ao abrir o portão:{" "}
            <strong style={{ color: p.text }}>{pulseSec}s</strong>
          </p>
          <input
            type="range"
            min="500"
            max="5000"
            step="250"
            value={config.gate_pulse_duration}
            onChange={(e) =>
              setConfig((prev) => ({ ...prev, gate_pulse_duration: e.target.value }))
            }
            style={{ width: "100%", accentColor: "#3b82f6" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: p.textMuted, marginTop: 4 }}>
            <span>0.5s</span>
            <span>2.5s</span>
            <span>5s</span>
          </div>
        </div>

        {/* Save button */}
        <button
          onClick={saveConfig}
          disabled={saving}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
            gap: 8, padding: "14px", borderRadius: 14,
            background: saved ? "#22c55e" : p.btnGrad,
            color: "#fff", fontWeight: 700, fontSize: 15,
            border: "none", cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.7 : 1, transition: "background 0.2s",
          }}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" />
            : saved ? <Check className="w-4 h-4" />
            : <Zap className="w-4 h-4" />}
          {saved ? "Salvo!" : "Salvar Configuração"}
        </button>

        {/* Logs Card */}
        <div style={{ background: p.cardBg, border: p.cardBorder, borderRadius: 16, padding: "1rem 1.25rem" }}>
          <button
            onClick={toggleLogs}
            style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: p.accentBright, fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            <History className="w-4 h-4" />
            {showLogs ? "Ocultar histórico" : "Ver histórico de acionamentos"}
          </button>

          {showLogs && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 2 }}>
              {logs.length === 0 ? (
                <p style={{ fontSize: 12, color: p.textMuted, margin: 0 }}>Nenhum registro ainda.</p>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", fontSize: 12, padding: "8px 0", borderBottom: `1px solid ${p.divider}` }}
                  >
                    <div>
                      <p style={{ fontWeight: 600, color: p.text, margin: 0 }}>{actionLabel(log.action)}</p>
                      <p style={{ color: p.textMuted, margin: 0 }}>{log.user_name}</p>
                      {log.details && <p style={{ color: p.textMuted, margin: 0 }}>{log.details}</p>}
                    </div>
                    <span style={{ whiteSpace: "nowrap", marginLeft: 8, color: p.textMuted }}>
                      {new Date(log.created_at + "Z").toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))
              )}
              <button
                onClick={fetchLogs}
                style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: p.accentBright, background: "none", border: "none", cursor: "pointer", marginTop: 8, padding: 0 }}
              >
                <RefreshCw className="w-3 h-3" /> Atualizar
              </button>
            </div>
          )}
        </div>

        {/* Info Card — App Interfone branded */}
        <div style={{ background: p.cardBg, border: p.cardBorder, borderRadius: 16, padding: "1rem 1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: p.iconBoxBg, border: p.iconBoxBorder, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Shield className="w-4 h-4" style={{ color: p.iconColor }} />
            </div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: p.text, margin: 0 }}>Módulo Portão — App Interfone</h3>
          </div>
          <p style={{ fontSize: 12, color: p.textMuted, marginBottom: 8, marginTop: 0 }}>
            O módulo de controle do portão permite que os funcionários abram o portão
            diretamente pelo sistema, com registro completo de todos os acionamentos.
          </p>
          <ul style={{ fontSize: 12, color: p.textSecondary, display: "flex", flexDirection: "column", gap: 4, paddingLeft: 16, margin: 0 }}>
            <li>Abertura remota com um toque na tela</li>
            <li>Histórico completo de quem abriu e quando</li>
            <li>Integração com reconhecimento facial de visitantes</li>
            <li>Controle de permissões por tipo de usuário</li>
          </ul>
          {!config.gate_device_configured && (
            <p style={{ fontSize: 12, color: "#f59e0b", marginTop: 10, marginBottom: 0 }}>
              Para ativar, solicite a instalação do módulo de portão à equipe App Interfone.
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
