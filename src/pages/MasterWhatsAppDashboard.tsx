/**
 * ═══════════════════════════════════════════════════════════
 * MASTER / ADMIN — Dashboard WhatsApp por Condomínio
 * Controle de habilitação, limites, uso e custos por
 * condomínio. Perfil master e administradora.
 * ═══════════════════════════════════════════════════════════
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/hooks/useTheme";
import { apiFetch } from "@/lib/api";
import {
  ArrowLeft,
  MessageCircle,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Building2,
  TrendingUp,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Save,
  CheckCircle,
  Search,
  BarChart3,
  Key,
  Phone,
  AlertCircle,
  Send,
} from "lucide-react";

interface CondominioWA {
  id: number;
  name: string;
  enabled: boolean;
  monthlyLimit: number;
  costPerMsg: number;
  sentToday: number;
  sentWeek: number;
  sentMonth: number;
  failedMonth: number;
  costMonth: number;
}

interface Totals {
  condominios: number;
  enabled: number;
  sentMonth: number;
  costMonth: number;
}

export default function MasterWhatsAppDashboard() {
  const { isDark, p } = useTheme();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [condominios, setCondominios] = useState<CondominioWA[]>([]);
  const [totals, setTotals] = useState<Totals>({ condominios: 0, enabled: 0, sentMonth: 0, costMonth: 0 });
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);

  // Global credentials state
  const [globalConfigOpen, setGlobalConfigOpen] = useState(false);
  const [globalApiKey, setGlobalApiKey] = useState("");
  const [globalSource, setGlobalSource] = useState("");
  const [globalAppName, setGlobalAppName] = useState("App Interfone");
  const [globalConfigured, setGlobalConfigured] = useState(false);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [savedGlobal, setSavedGlobal] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testingGlobal, setTestingGlobal] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Editable fields per condomínio
  const [editLimit, setEditLimit] = useState<Record<number, string>>({});
  const [editCost, setEditCost] = useState<Record<number, string>>({});

  const loadData = async () => {
    try {
      const res = await apiFetch("/api/whatsapp/stats/all");
      if (res.ok) {
        const data = await res.json();
        setCondominios(data.condominios || []);
        setTotals(data.totals || { condominios: 0, enabled: 0, sentMonth: 0, costMonth: 0 });
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadData(); loadGlobalConfig(); }, []);

  const loadGlobalConfig = async () => {
    try {
      const res = await apiFetch("/api/whatsapp/global-config");
      if (res.ok) {
        const data = await res.json();
        setGlobalApiKey(data.whatsapp_gupshup_apikey || "");
        setGlobalSource(data.whatsapp_gupshup_source || "");
        setGlobalAppName(data.whatsapp_gupshup_appname || "App Interfone");
        setGlobalConfigured(data._configured === "true");
      }
    } catch {}
  };

  const saveGlobalConfig = async () => {
    setSavingGlobal(true);
    setSavedGlobal(false);
    try {
      const body: Record<string, string> = {
        whatsapp_gupshup_source: globalSource,
        whatsapp_gupshup_appname: globalAppName,
      };
      if (globalApiKey && !globalApiKey.startsWith("••••")) {
        body.whatsapp_gupshup_apikey = globalApiKey;
      }
      const res = await apiFetch("/api/whatsapp/global-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setSavedGlobal(true);
        setGlobalConfigured(true);
        setTimeout(() => setSavedGlobal(false), 3000);
      }
    } catch {}
    setSavingGlobal(false);
  };

  const handleTestGlobal = async () => {
    if (!testPhone) return;
    setTestingGlobal(true);
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
    setTestingGlobal(false);
  };

  const toggleEnabled = async (condo: CondominioWA) => {
    const newVal = !condo.enabled;
    setCondominios(prev => prev.map(c => c.id === condo.id ? { ...c, enabled: newVal } : c));
    setTotals(prev => ({ ...prev, enabled: prev.enabled + (newVal ? 1 : -1) }));
    await apiFetch(`/api/whatsapp/config/${condo.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ whatsapp_enabled: newVal ? "true" : "false" }),
    });
  };

  const saveCondoSettings = async (condo: CondominioWA) => {
    setSavingId(condo.id);
    const body: Record<string, string> = {};
    if (editLimit[condo.id] !== undefined) body.whatsapp_monthly_limit = editLimit[condo.id];
    if (editCost[condo.id] !== undefined) body.whatsapp_cost_per_msg = editCost[condo.id];
    await apiFetch(`/api/whatsapp/config/${condo.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSavingId(null);
    setSavedId(condo.id);
    setTimeout(() => setSavedId(null), 2000);
    loadData();
  };

  const filtered = condominios.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const inputStyle: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 10,
    border: `1px solid ${isDark ? "rgba(255,255,255,0.15)" : "#d1d5db"}`,
    background: isDark ? "rgba(255,255,255,0.06)" : "#fff",
    color: p.text,
    fontSize: 14,
    outline: "none",
    width: "100%",
  };

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: p.pageBg }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: p.accent }} />
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: p.pageBg }}>
      {/* Header */}
      <header className="sticky top-0 z-40" style={{ background: p.headerBg, borderBottom: p.headerBorder, boxShadow: p.headerShadow, color: p.text }}>
        <div className="flex items-center gap-3" style={{ padding: "1rem 1.5rem", height: "4.5rem" }}>
          <button onClick={() => navigate(-1)} style={{ width: 40, height: 40, borderRadius: 12, background: p.btnBg, border: p.btnBorder, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: p.text }}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <MessageCircle className="w-4 h-4" style={{ color: "#25d366" }} />
          <span style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>WhatsApp</span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto" style={{ padding: "1.5rem", paddingBottom: "8rem" }}>

        {/* ── Global Credentials Card ── */}
        <div style={{
          background: p.cardBg,
          borderRadius: 16,
          border: globalConfigured
            ? isDark ? "1px solid rgba(37,211,102,0.3)" : "1px solid #86efac"
            : isDark ? "1px solid rgba(245,158,11,0.4)" : "1px solid #fbbf24",
          marginBottom: "1.25rem",
          overflow: "hidden",
        }}>
          <button
            onClick={() => setGlobalConfigOpen(!globalConfigOpen)}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "1rem 1.25rem", background: "transparent", border: "none", cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Key size={18} style={{ color: globalConfigured ? "#25d366" : "#f59e0b" }} />
              <span style={{ fontWeight: 700, fontSize: 15, color: p.text }}>
                Credenciais Gupshup (Global)
              </span>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 8,
                background: globalConfigured
                  ? isDark ? "rgba(34,197,94,0.15)" : "#dcfce7"
                  : isDark ? "rgba(245,158,11,0.15)" : "#fef3c7",
                color: globalConfigured ? "#22c55e" : "#f59e0b",
              }}>
                {globalConfigured ? "Configurado" : "Pendente"}
              </span>
            </div>
            {globalConfigOpen ? <ChevronUp size={18} style={{ color: p.textMuted }} /> : <ChevronDown size={18} style={{ color: p.textMuted }} />}
          </button>

          {globalConfigOpen && (
            <div style={{
              padding: "0 1.25rem 1.25rem",
              borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "#f1f5f9"}`,
              paddingTop: "1rem",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}>
              <p style={{ fontSize: 12, color: p.textMuted, lineHeight: 1.5, margin: 0 }}>
                Estas credenciais são compartilhadas por <strong>todos os condomínios</strong>. O número WhatsApp aparecerá como <strong>"App Interfone"</strong> para todos.
              </p>

              {/* API Key */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: p.textMuted, display: "block", marginBottom: 4 }}>
                  <Key size={12} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} />
                  API Key (Gupshup)
                </label>
                <input
                  type="password"
                  value={globalApiKey}
                  onChange={e => setGlobalApiKey(e.target.value)}
                  placeholder="Sua API Key do Gupshup"
                  style={inputStyle}
                />
              </div>

              {/* Source Number */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: p.textMuted, display: "block", marginBottom: 4 }}>
                  <Phone size={12} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} />
                  Número de Origem (com DDI)
                </label>
                <input
                  type="tel"
                  value={globalSource}
                  onChange={e => setGlobalSource(e.target.value)}
                  placeholder="15557952901"
                  style={inputStyle}
                />
                <p style={{ fontSize: 10, color: p.textMuted, marginTop: 4 }}>
                  Número WhatsApp Business registrado no Gupshup.
                </p>
              </div>

              {/* App Name */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: p.textMuted, display: "block", marginBottom: 4 }}>
                  <MessageCircle size={12} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} />
                  Nome do App (Gupshup)
                </label>
                <input
                  type="text"
                  value={globalAppName}
                  onChange={e => setGlobalAppName(e.target.value)}
                  placeholder="App Interfone"
                  style={inputStyle}
                />
              </div>

              {/* Save button */}
              <button
                onClick={saveGlobalConfig}
                disabled={savingGlobal}
                style={{
                  padding: "12px",
                  borderRadius: 12,
                  border: "none",
                  background: savedGlobal ? "#16a34a" : "#25d366",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: savingGlobal ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  opacity: savingGlobal ? 0.7 : 1,
                }}
              >
                {savingGlobal ? <Loader2 size={16} className="animate-spin" /> : savedGlobal ? <CheckCircle size={16} /> : <Save size={16} />}
                {savingGlobal ? "Salvando..." : savedGlobal ? "Credenciais Salvas!" : "Salvar Credenciais"}
              </button>

              {/* Test section */}
              <div style={{
                marginTop: 4,
                padding: "1rem",
                borderRadius: 12,
                background: isDark ? "rgba(255,255,255,0.03)" : "#f8fafc",
                border: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid #e2e8f0",
              }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: p.textMuted, display: "block", marginBottom: 8 }}>
                  <Send size={12} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} />
                  Testar Conexão
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="tel"
                    value={testPhone}
                    onChange={e => setTestPhone(e.target.value)}
                    placeholder="Número para teste (ex: 5511999999999)"
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    onClick={handleTestGlobal}
                    disabled={testingGlobal || !testPhone}
                    style={{
                      padding: "10px 16px",
                      borderRadius: 10,
                      border: "none",
                      background: "#25d366",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: testingGlobal || !testPhone ? "not-allowed" : "pointer",
                      opacity: testingGlobal || !testPhone ? 0.6 : 1,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {testingGlobal ? <Loader2 size={14} className="animate-spin" /> : "Enviar"}
                  </button>
                </div>
                {testResult && (
                  <div style={{
                    marginTop: 8,
                    padding: "8px 12px",
                    borderRadius: 10,
                    background: testResult.success ? (isDark ? "rgba(34,197,94,0.12)" : "#f0fdf4") : (isDark ? "rgba(239,68,68,0.12)" : "#fef2f2"),
                    border: testResult.success ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(239,68,68,0.3)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    color: testResult.success ? "#22c55e" : "#ef4444",
                  }}>
                    {testResult.success ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                    {testResult.message}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Summary Cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: "1.25rem" }}>
          {[
            { label: "Condominios", value: totals.condominios, icon: Building2, color: "#3b82f6" },
            { label: "WhatsApp Ativo", value: totals.enabled, icon: MessageCircle, color: "#25d366" },
            { label: "Msgs / Mês", value: totals.sentMonth, icon: TrendingUp, color: "#8b5cf6" },
            { label: "Custo / Mês", value: `R$ ${totals.costMonth.toFixed(2)}`, icon: DollarSign, color: "#f59e0b" },
          ].map(card => (
            <div key={card.label} style={{
              background: p.cardBg,
              borderRadius: 16,
              border: p.cardBorder,
              padding: "1rem",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
            }}>
              <card.icon size={22} style={{ color: card.color }} />
              <span style={{ fontSize: 22, fontWeight: 800, color: p.text }}>{card.value}</span>
              <span style={{ fontSize: 11, color: p.textMuted, fontWeight: 600 }}>{card.label}</span>
            </div>
          ))}
        </div>

        {/* ── Search ── */}
        <div style={{ position: "relative", marginBottom: "1rem" }}>
          <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: p.textMuted }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar condomínio..."
            style={{ ...inputStyle, paddingLeft: 38 }}
          />
        </div>

        {/* ── Condominio list ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(condo => {
            const isExpanded = expandedId === condo.id;
            const limitVal = editLimit[condo.id] ?? String(condo.monthlyLimit || "");
            const costVal = editCost[condo.id] ?? String(condo.costPerMsg || "0.05");
            const pctUsed = condo.monthlyLimit > 0 ? Math.min((condo.sentMonth / condo.monthlyLimit) * 100, 100) : 0;
            const nearLimit = condo.monthlyLimit > 0 && condo.sentMonth >= condo.monthlyLimit * 0.8;

            return (
              <div key={condo.id} style={{
                background: p.cardBg,
                borderRadius: 16,
                border: nearLimit && condo.enabled ? `1px solid ${isDark ? "rgba(245,158,11,0.5)" : "#fbbf24"}` : p.cardBorder,
                overflow: "hidden",
              }}>
                {/* Row principal */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "0.875rem 1rem",
                  gap: 10,
                }}>
                  {/* Toggle */}
                  <button
                    onClick={() => toggleEnabled(condo)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: condo.enabled ? "#25d366" : (isDark ? "#64748b" : "#94a3b8"), flexShrink: 0 }}
                  >
                    {condo.enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                  </button>

                  {/* Name + stats summary */}
                  <div style={{ flex: 1, minWidth: 0 }} onClick={() => setExpandedId(isExpanded ? null : condo.id)}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: p.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {condo.name}
                    </div>
                    <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 11, color: p.textMuted }}>
                      <span>Hoje: <strong style={{ color: p.text }}>{condo.sentToday}</strong></span>
                      <span>Sem: <strong style={{ color: p.text }}>{condo.sentWeek}</strong></span>
                      <span>Mês: <strong style={{ color: p.text }}>{condo.sentMonth}</strong></span>
                    </div>
                    {/* Progress bar if limit defined */}
                    {condo.monthlyLimit > 0 && (
                      <div style={{ marginTop: 6, height: 4, borderRadius: 4, background: isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb", overflow: "hidden" }}>
                        <div style={{
                          height: "100%",
                          borderRadius: 4,
                          width: `${pctUsed}%`,
                          background: pctUsed >= 90 ? "#ef4444" : pctUsed >= 70 ? "#f59e0b" : "#25d366",
                          transition: "width 0.3s",
                        }} />
                      </div>
                    )}
                  </div>

                  {/* Cost badge */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: condo.costMonth > 0 ? "#f59e0b" : p.textMuted }}>
                      R$ {condo.costMonth.toFixed(2)}
                    </div>
                    <div style={{ fontSize: 10, color: p.textMuted }}>/mês</div>
                  </div>

                  {/* Expand */}
                  <button onClick={() => setExpandedId(isExpanded ? null : condo.id)} style={{ background: "none", border: "none", cursor: "pointer", color: p.textMuted, flexShrink: 0 }}>
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                </div>

                {/* Expanded panel */}
                {isExpanded && (
                  <div style={{
                    padding: "0.75rem 1rem 1rem",
                    borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "#f1f5f9"}`,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}>
                    {/* Stats detail */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                      {[
                        { label: "Hoje", sent: condo.sentToday, cost: +(condo.sentToday * condo.costPerMsg).toFixed(2) },
                        { label: "Semana", sent: condo.sentWeek, cost: +(condo.sentWeek * condo.costPerMsg).toFixed(2) },
                        { label: "Mês", sent: condo.sentMonth, cost: +(condo.sentMonth * condo.costPerMsg).toFixed(2) },
                      ].map(s => (
                        <div key={s.label} style={{
                          background: isDark ? "rgba(255,255,255,0.04)" : "#f8fafc",
                          borderRadius: 12,
                          padding: "0.75rem",
                          textAlign: "center",
                          border: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid #e2e8f0",
                        }}>
                          <div style={{ fontSize: 10, color: p.textMuted, fontWeight: 600 }}>{s.label}</div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: p.text, marginTop: 2 }}>{s.sent}</div>
                          <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 600 }}>R$ {s.cost.toFixed(2)}</div>
                        </div>
                      ))}
                    </div>

                    {condo.failedMonth > 0 && (
                      <div style={{
                        fontSize: 12,
                        color: "#ef4444",
                        background: isDark ? "rgba(239,68,68,0.1)" : "#fef2f2",
                        padding: "8px 12px",
                        borderRadius: 10,
                        border: "1px solid rgba(239,68,68,0.2)",
                      }}>
                        {condo.failedMonth} mensagens falharam este mês
                      </div>
                    )}

                    {/* Limit + cost config */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: p.textMuted, display: "block", marginBottom: 4 }}>
                          Limite mensal (0 = ilimitado)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={limitVal}
                          onChange={e => setEditLimit(prev => ({ ...prev, [condo.id]: e.target.value }))}
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: p.textMuted, display: "block", marginBottom: 4 }}>
                          Custo/msg (R$)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={costVal}
                          onChange={e => setEditCost(prev => ({ ...prev, [condo.id]: e.target.value }))}
                          style={inputStyle}
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => saveCondoSettings(condo)}
                      disabled={savingId === condo.id}
                      style={{
                        padding: "10px",
                        borderRadius: 12,
                        border: "none",
                        background: savedId === condo.id ? "#16a34a" : "#25d366",
                        color: "#fff",
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: savingId === condo.id ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        opacity: savingId === condo.id ? 0.7 : 1,
                      }}
                    >
                      {savingId === condo.id ? <Loader2 size={14} className="animate-spin" /> : savedId === condo.id ? <CheckCircle size={14} /> : <Save size={14} />}
                      {savingId === condo.id ? "Salvando..." : savedId === condo.id ? "Salvo!" : "Salvar Limites"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "3rem 1rem", color: p.textMuted }}>
              <BarChart3 size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
              <p style={{ fontSize: 14, fontWeight: 600 }}>Nenhum condomínio encontrado</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
