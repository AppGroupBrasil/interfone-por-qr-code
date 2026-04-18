import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useState, useEffect } from "react";
import {
  ArrowLeft,
  DoorOpen,
  Loader2,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  TestTube,
  Building2,
  Wifi,
  WifiOff,
  RefreshCw,
  Save,
  Zap,
  Link2,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { AppLogo } from "@/components/AppLogo";

interface DeviceInfo {
  deviceId: string;
  name: string;
  brandName: string;
  productModel: string;
  online: boolean;
  switchState: string;
}

interface Assignment {
  condominio_id: number;
  condominio_name: string;
  device_id: string;
  device_name: string;
  enabled: string;
  pulse_duration: string;
}

interface Condominio {
  id: number;
  name: string;
}

type Tab = "credentials" | "devices" | "assignments";

export default function MasterGateConfig() {
  const { user } = useAuth();
  const { isDark, p } = useTheme();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tab, setTab] = useState<Tab>("credentials");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
  } | null>(null);
  const [showSecrets, setShowSecrets] = useState(false);

  // OAuth status
  const [oauthAuthorized, setOauthAuthorized] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);

  // Credentials
  const [creds, setCreds] = useState({
    gate_ewelink_appid: "",
    gate_ewelink_appsecret: "",
    gate_ewelink_email: "",
    gate_ewelink_password: "",
    gate_ewelink_region: "us",
  });

  // Devices from API
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);

  // Assignments
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [condominios, setCondominios] = useState<Condominio[]>([]);

  // Assign modal
  const [assignModal, setAssignModal] = useState<{
    device: DeviceInfo;
    condominioId: string;
  } | null>(null);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (user.role !== "master" && user.role !== "administradora") {
      navigate("/dashboard");
      return;
    }
    fetchAll();

    // Handle OAuth callback redirect
    const oauthResult = searchParams.get("oauth");
    if (oauthResult === "success") {
      setTestResult({ success: true, message: "Autorização eWeLink realizada com sucesso!" });
      setOauthAuthorized(true);
      setSearchParams({}, { replace: true });
    } else if (oauthResult === "error") {
      const msg = searchParams.get("msg") || "Erro na autorização";
      setTestResult({ success: false, error: msg });
      setSearchParams({}, { replace: true });
    }
  }, [user]);

  async function fetchOAuthStatus() {
    try {
      const res = await apiFetch("/api/gate/oauth-status");
      if (res.ok) {
        const data = await res.json();
        setOauthAuthorized(data.authorized);
      }
    } catch {}
  }

  async function authorizeOAuth() {
    setAuthorizing(true);
    try {
      const res = await apiFetch("/api/gate/oauth-url");
      if (res.ok) {
        const data = await res.json();
        // Open eWeLink auth page in the same window (will redirect back)
        window.location.href = data.url;
      } else {
        const data = await res.json();
        setTestResult({ success: false, error: data.error || "Erro ao gerar URL de autorização." });
      }
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
    }
    setAuthorizing(false);
  }

  async function fetchAll() {
    setLoading(true);
    try {
      const [credsRes, assignRes, condRes, oauthRes] = await Promise.all([
        apiFetch("/api/gate/master-config"),
        apiFetch("/api/gate/all-assignments"),
        apiFetch("/api/condominios"),
        apiFetch("/api/gate/oauth-status"),
      ]);

      if (credsRes.ok) {
        const data = await credsRes.json();
        setCreds((prev) => ({ ...prev, ...data }));
      }
      if (assignRes.ok) {
        setAssignments(await assignRes.json());
      }
      if (condRes.ok) {
        const data = await condRes.json();
        setCondominios(Array.isArray(data) ? data : data.condominios || []);
      }
      if (oauthRes.ok) {
        const data = await oauthRes.json();
        setOauthAuthorized(data.authorized);
      }
    } catch (err) {
      console.error("Erro ao carregar:", err);
    }
    setLoading(false);
  }

  async function saveCreds() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await apiFetch("/api/gate/master-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(creds),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        const data = await res.json();
        alert(data.error || "Erro ao salvar.");
      }
    } catch (err: any) {
      alert(err.message);
    }
    setSaving(false);
  }

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await apiFetch("/api/gate/test", { method: "POST" });
      const data = await res.json();
      setTestResult(data);
      if (data.devices) {
        setDevices(data.devices);
        setTab("devices");
      }
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
    }
    setTesting(false);
  }

  async function fetchDevices() {
    setLoadingDevices(true);
    try {
      const res = await apiFetch("/api/gate/devices");
      if (res.ok) {
        const data = await res.json();
        setDevices(data.devices || []);
      }
    } catch {}
    setLoadingDevices(false);
  }

  async function assignDevice() {
    if (!assignModal) return;
    setAssigning(true);
    try {
      const res = await apiFetch("/api/gate/assign-device", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          condominio_id: parseInt(assignModal.condominioId),
          device_id: assignModal.device.deviceId,
          device_name: assignModal.device.name || assignModal.device.deviceId,
        }),
      });
      if (res.ok) {
        setAssignModal(null);
        // Refresh assignments
        const aRes = await apiFetch("/api/gate/all-assignments");
        if (aRes.ok) setAssignments(await aRes.json());
      } else {
        const data = await res.json();
        alert(data.error || "Erro ao atribuir.");
      }
    } catch (err: any) {
      alert(err.message);
    }
    setAssigning(false);
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "credentials", label: "Credenciais" },
    { key: "devices", label: "Dispositivos" },
    { key: "assignments", label: "Atribuições" },
  ];

  if (loading) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30" style={{ background: p.headerBg, borderBottom: p.headerBorder, boxShadow: p.headerShadow, color: p.text }}>
        <div className="px-6 h-20 flex items-center gap-4">
          <button onClick={() => navigate("/dashboard")} className="p-2">
            <ArrowLeft className="w-8 h-8" />
          </button>
          <DoorOpen className="w-8 h-8" />
          <span className="font-semibold text-xl">
            Smart Switches — Configuração Global
          </span>
          <button
            onClick={() => navigate("/biblioteca-dispositivos")}
            className="ml-auto px-3 py-1.5 text-xs font-bold rounded-lg"
            style={{ background: isDark ? "rgba(255,255,255,0.15)" : "#f0f4f8", color: p.text, border: "none", cursor: "pointer" }}
          >
            📦 Dispositivos
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-4 gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key);
                if (t.key === "devices" && devices.length === 0) fetchDevices();
              }}
              className={`flex-1 py-4 text-base font-semibold rounded-t-lg transition ${
                tab === t.key
                  ? "bg-background text-foreground"
                  : "text-white/70 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <div style={{ maxWidth: "720px", margin: "0 auto", paddingTop: "1cm", paddingLeft: "1rem", paddingRight: "1rem", paddingBottom: "32px", display: "flex", flexDirection: "column", gap: "32px" }}>
        {/* ── Tab: Credentials ── */}
        {tab === "credentials" && (
          <>
            <div
              className="rounded-xl p-5 border"
              style={{
                background: isDark
                  ? "rgba(234,179,8,0.06)"
                  : "rgba(234,179,8,0.04)",
                borderColor: isDark
                  ? "rgba(234,179,8,0.2)"
                  : "rgba(234,179,8,0.15)",
              }}
            >
              <p className="text-base text-amber-600 dark:text-amber-400">
                ⚠️ Estas credenciais são da <strong>conta eWeLink corporativa do App Interfone</strong>.
                São compartilhadas por TODOS os condomínios. Nunca exponha ao cliente.
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-base font-medium text-muted-foreground mb-2">
                  App ID (CoolKit)
                </label>
                <input
                  type="text"
                  value={creds.gate_ewelink_appid}
                  onChange={(e) =>
                    setCreds((p) => ({
                      ...p,
                      gate_ewelink_appid: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-4 rounded-xl border border-border bg-card text-foreground text-lg"
                />
              </div>

              <div>
                <label className="block text-base font-medium text-muted-foreground mb-2">
                  App Secret
                </label>
                <div className="relative">
                  <input
                    type={showSecrets ? "text" : "password"}
                    value={creds.gate_ewelink_appsecret}
                    onChange={(e) =>
                      setCreds((p) => ({
                        ...p,
                        gate_ewelink_appsecret: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-4 pr-14 rounded-xl border border-border bg-card text-foreground text-lg"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecrets(!showSecrets)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showSecrets ? (
                      <EyeOff className="w-6 h-6" />
                    ) : (
                      <Eye className="w-6 h-6" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-base font-medium text-muted-foreground mb-2">
                  E-mail da Conta
                </label>
                <input
                  type="email"
                  value={creds.gate_ewelink_email}
                  onChange={(e) =>
                    setCreds((p) => ({
                      ...p,
                      gate_ewelink_email: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-4 rounded-xl border border-border bg-card text-foreground text-lg"
                />
              </div>

              <div>
                <label className="block text-base font-medium text-muted-foreground mb-2">
                  Região do Servidor
                </label>
                <select
                  value={creds.gate_ewelink_region}
                  onChange={(e) =>
                    setCreds((p) => ({
                      ...p,
                      gate_ewelink_region: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-4 rounded-xl border border-border bg-card text-foreground text-lg"
                >
                  <option value="us">Américas (us)</option>
                  <option value="eu">Europa (eu)</option>
                  <option value="cn">China (cn)</option>
                  <option value="as">Ásia (as)</option>
                </select>
              </div>
            </div>

            {/* OAuth Authorization */}
            <div
              className="rounded-xl p-5 border"
              style={{
                background: oauthAuthorized
                  ? isDark ? "rgba(34,197,94,0.06)" : "rgba(34,197,94,0.04)"
                  : isDark ? "rgba(59,130,246,0.06)" : "rgba(59,130,246,0.04)",
                borderColor: oauthAuthorized
                  ? isDark ? "rgba(34,197,94,0.2)" : "rgba(34,197,94,0.15)"
                  : isDark ? "rgba(59,130,246,0.2)" : "rgba(59,130,246,0.15)",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ShieldCheck className={`w-6 h-6 ${oauthAuthorized ? "text-green-500" : "text-blue-500"}`} />
                  <div>
                    <p className={`text-base font-semibold ${oauthAuthorized ? "text-green-600 dark:text-green-400" : "text-blue-600 dark:text-blue-400"}`}>
                      {oauthAuthorized ? "Autorizado com eWeLink" : "Autorização Pendente"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {oauthAuthorized
                        ? "Token OAuth ativo. Você pode listar dispositivos e testar a conexão."
                        : "Salve as credenciais acima e clique para autorizar via eWeLink."}
                    </p>
                  </div>
                </div>
                {!oauthAuthorized && (
                  <button
                    onClick={authorizeOAuth}
                    disabled={authorizing || !creds.gate_ewelink_appid || !creds.gate_ewelink_appsecret}
                    className="shrink-0 flex items-center gap-2 px-5 py-3 rounded-xl bg-[#003580] text-white text-base font-semibold disabled:opacity-50"
                  >
                    {authorizing ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <ExternalLink className="w-5 h-5" />
                    )}
                    Autorizar com eWeLink
                  </button>
                )}
                {oauthAuthorized && (
                  <button
                    onClick={authorizeOAuth}
                    disabled={authorizing}
                    className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-muted-foreground border border-border"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Reautorizar
                  </button>
                )}
              </div>
            </div>

            {/* Test + Save */}
            <div className="flex gap-4">
              <button
                onClick={testConnection}
                disabled={
                  testing ||
                  !creds.gate_ewelink_appid ||
                  !oauthAuthorized
                }
                className="flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-[#003580] text-white text-lg font-semibold disabled:opacity-50"
              >
                {testing ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <TestTube className="w-6 h-6" />
                )}
                Testar Conexão
              </button>
              <button
                onClick={saveCreds}
                disabled={saving}
                className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-xl text-white text-lg font-semibold disabled:opacity-50 ${
                  saved ? "bg-emerald-500" : "btn-grad-blue"
                }`}
              >
                {saving ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <Save className="w-6 h-6" />
                )}
                {saved ? "Salvo!" : "Salvar"}
              </button>
            </div>

            {testResult && (
              <div
                className={`rounded-xl p-5 text-base flex items-start gap-3 ${
                  testResult.success
                    ? "bg-green-500/10 text-green-500 border border-green-500/20"
                    : "bg-red-500/10 text-red-400 border border-red-500/20"
                }`}
              >
                {testResult.success ? (
                  <Check className="w-6 h-6 mt-0.5 shrink-0" />
                ) : (
                  <AlertCircle className="w-6 h-6 mt-0.5 shrink-0" />
                )}
                <span>{testResult.message || testResult.error}</span>
              </div>
            )}
          </>
        )}

        {/* ── Tab: Devices ── */}
        {tab === "devices" && (
          <>
            {/* Info Banner: Multi-channel */}
            <div style={{
              background: isDark
                ? "linear-gradient(135deg, rgba(0,98,209,0.2) 0%, rgba(16,185,129,0.12) 100%)"
                : "linear-gradient(135deg, rgba(0,98,209,0.08) 0%, rgba(16,185,129,0.06) 100%)",
              border: isDark ? "1.5px solid rgba(0,98,209,0.35)" : "1.5px solid rgba(0,98,209,0.2)",
              borderRadius: 16,
              padding: "16px 20px",
              marginBottom: 16,
              display: "flex",
              gap: 14,
              alignItems: "flex-start",
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: "linear-gradient(135deg, #0062d1, #10b981)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <span style={{ fontSize: 20 }}>💡</span>
              </div>
              <div>
                <p className="font-bold text-sm" style={{ marginBottom: 4 }}>
                  1 dispositivo multi-canal = várias portas
                </p>
                <p className="text-xs text-muted-foreground" style={{ lineHeight: 1.6 }}>
                  Dispositivos como o <strong>SONOFF 4CH</strong> possuem <strong>4 relês independentes</strong> em um único aparelho.
                  Cada canal (saída) controla um ponto de acesso diferente (portão veicular, pedestre, bloco, academia).
                  Atribua o dispositivo ao condomínio aqui e depois configure os canais em <strong>Portaria Virtual → Acessos</strong>.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-lg text-muted-foreground">
                Dispositivos registrados na conta eWeLink
              </p>
              <button
                onClick={fetchDevices}
                disabled={loadingDevices}
                className="flex items-center gap-2 text-base text-primary font-medium"
              >
                {loadingDevices ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <RefreshCw className="w-5 h-5" />
                )}
                Atualizar
              </button>
            </div>

            {devices.length === 0 ? (
              <div className="text-center py-16">
                <DoorOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg text-muted-foreground">
                  Nenhum dispositivo encontrado.
                </p>
                <p className="text-base text-muted-foreground mt-2">
                  Verifique as credenciais na aba "Credenciais" e clique em
                  "Testar".
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {devices.map((d) => {
                  const assigned = assignments.find(
                    (a) => a.device_id === d.deviceId
                  );
                  return (
                    <div
                      key={d.deviceId}
                      className="rounded-xl border border-border bg-card p-5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-lg font-semibold text-foreground truncate">
                            {d.name || d.deviceId}
                          </p>
                          <p className="text-base text-muted-foreground">
                            {d.productModel || d.brandName || "Switch"} ·{" "}
                            <span className="font-mono text-sm">
                              {d.deviceId}
                            </span>
                          </p>
                          <div className="flex items-center gap-3 mt-2">
                            {d.online ? (
                              <span className="flex items-center gap-1.5 text-sm text-green-500">
                                <Wifi className="w-5 h-5" /> Online
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5 text-sm text-red-400">
                                <WifiOff className="w-5 h-5" /> Offline
                              </span>
                            )}
                            {assigned && (
                              <span className="flex items-center gap-1.5 text-sm text-sky-500">
                                <Link2 className="w-5 h-5" />{" "}
                                {assigned.condominio_name}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            setAssignModal({
                              device: d,
                              condominioId: assigned?.condominio_id?.toString() || "",
                            })
                          }
                          className="shrink-0 ml-4 px-5 py-3 rounded-xl bg-[#003580]/10 text-[#003580] text-base font-semibold border border-[#003580]/20"
                        >
                          {assigned ? "Reatribuir" : "Atribuir"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── Tab: Assignments ── */}
        {tab === "assignments" && (
          <>
            <p className="text-lg text-muted-foreground">
              Dispositivos atribuídos a condomínios
            </p>

            {assignments.length === 0 ? (
              <div className="text-center py-16">
                <AppLogo size={64} rounded={16} style={{ margin: "0 auto 16px" }} />
                <p className="text-lg text-muted-foreground">
                  Nenhum dispositivo atribuído ainda.
                </p>
                <p className="text-base text-muted-foreground mt-2">
                  Vá na aba "Dispositivos" para atribuir.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {assignments.map((a) => (
                  <div
                    key={a.condominio_id}
                    className="rounded-xl border border-border bg-card p-5"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-lg font-semibold text-foreground">
                          {a.condominio_name}
                        </p>
                        <p className="text-base text-muted-foreground">
                          {a.device_name || a.device_id} ·{" "}
                          <span className="font-mono text-sm">
                            {a.device_id}
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-sm px-3 py-1 rounded-full ${
                            a.enabled === "true"
                              ? "bg-green-500/10 text-green-500"
                              : "bg-zinc-500/10 text-zinc-400"
                          }`}
                        >
                          {a.enabled === "true" ? "Ativo" : "Inativo"}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {(parseInt(a.pulse_duration || "1000") / 1000).toFixed(1)}s
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Assign Modal ── */}
      {assignModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl border border-border w-full max-w-lg p-8 space-y-6">
            <h3 className="text-xl font-bold text-foreground text-center">
              Atribuir Dispositivo
            </h3>
            <p className="text-base text-muted-foreground text-center">
              Dispositivo:{" "}
              <strong>
                {assignModal.device.name || assignModal.device.deviceId}
              </strong>
            </p>

            <div>
              <label className="block text-base font-medium text-muted-foreground mb-2">
                Condomínio
              </label>
              <select
                value={assignModal.condominioId}
                onChange={(e) =>
                  setAssignModal((p) => p ? { ...p, condominioId: e.target.value } : null)
                }
                className="w-full px-4 py-4 rounded-xl border border-border bg-background text-foreground text-lg"
              >
                <option value="">Selecione...</option>
                {condominios.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setAssignModal(null)}
                className="flex-1 px-6 py-4 rounded-xl border border-border text-lg text-muted-foreground"
              >
                Cancelar
              </button>
              <button
                onClick={assignDevice}
                disabled={!assignModal.condominioId || assigning}
                className="flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-[#003580] text-white text-lg font-semibold disabled:opacity-50"
              >
                {assigning ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <Zap className="w-6 h-6" />
                )}
                Atribuir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
