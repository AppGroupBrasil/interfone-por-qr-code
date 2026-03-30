import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import {
  ArrowLeft,
  UserCheck,
  UserX,
  Clock,
  Search,
  CheckCircle2,
  XCircle,
  Loader2,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
  Building2,
  Phone,
  Mail,
  Home,
  MessageCircle,
  Save,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

interface PendingMorador {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  perfil: string | null;
  unit: string | null;
  block: string | null;
  condominio_id: number | null;
  created_at: string;
}

export default function LiberacaoCadastros() {
  const { isDark, p } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pendentes, setPendentes] = useState<PendingMorador[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [autoCadastroEnabled, setAutoCadastroEnabled] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState("");

  // Notification states
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [whatsappSaving, setWhatsappSaving] = useState(false);

  useEffect(() => {
    fetchPendentes();
    fetchConfig();
  }, []);

  async function fetchPendentes() {
    setLoading(true);
    try {
      const res = await apiFetch("/api/moradores/pendentes");
      if (res.ok) {
        const data = await res.json();
        setPendentes(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchConfig() {
    setConfigLoading(true);
    try {
      const res = await apiFetch("/api/condominio-config");
      if (res.ok) {
        const data = await res.json();
        setAutoCadastroEnabled(data.feature_auto_cadastro === "true");
        setEmailEnabled(data.notify_email_enabled === "true");
        setEmailAddress(data.notify_email_address || "");
        setWhatsappEnabled(data.notify_whatsapp_enabled === "true");
        setWhatsappPhone(data.notify_whatsapp_phone || "");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setConfigLoading(false);
    }
  }

  async function toggleAutoCadastro() {
    const newValue = !autoCadastroEnabled;
    setConfigLoading(true);
    try {
      const res = await apiFetch("/api/condominio-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature_auto_cadastro: String(newValue) }),
      });
      if (res.ok) {
        setAutoCadastroEnabled(newValue);
        setSuccessMsg(newValue ? "Aprovação ativada!" : "Aprovação desativada!");
        setTimeout(() => setSuccessMsg(""), 3000);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Erro ao alterar configuração");
      }
    } catch (err) {
      console.error("Toggle error:", err);
      alert("Erro de conexão ao alterar configuração");
    } finally {
      setConfigLoading(false);
    }
  }

  async function saveEmailNotification(enabled?: boolean) {
    setEmailSaving(true);
    const newEnabled = enabled !== undefined ? enabled : emailEnabled;
    try {
      const res = await apiFetch("/api/condominio-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notify_email_enabled: String(newEnabled),
          notify_email_address: emailAddress.trim(),
        }),
      });
      if (res.ok) {
        setEmailEnabled(newEnabled);
        setSuccessMsg(newEnabled ? "Notificação por e-mail ativada!" : "Notificação por e-mail desativada!");
        setTimeout(() => setSuccessMsg(""), 3000);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Erro ao salvar configuração de e-mail");
      }
    } catch (err) {
      console.error("Email save error:", err);
      alert("Erro de conexão ao salvar e-mail");
    } finally {
      setEmailSaving(false);
    }
  }

  async function saveWhatsappNotification(enabled?: boolean) {
    setWhatsappSaving(true);
    const newEnabled = enabled !== undefined ? enabled : whatsappEnabled;
    try {
      const res = await apiFetch("/api/condominio-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notify_whatsapp_enabled: String(newEnabled),
          notify_whatsapp_phone: whatsappPhone.trim(),
        }),
      });
      if (res.ok) {
        setWhatsappEnabled(newEnabled);
        setSuccessMsg(newEnabled ? "Notificação por WhatsApp ativada!" : "Notificação por WhatsApp desativada!");
        setTimeout(() => setSuccessMsg(""), 3000);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Erro ao salvar configuração de WhatsApp");
      }
    } catch (err) {
      console.error("WhatsApp save error:", err);
      alert("Erro de conexão ao salvar WhatsApp");
    } finally {
      setWhatsappSaving(false);
    }
  }

  async function handleAprovar(id: number) {
    setActionLoading(id);
    try {
      const res = await apiFetch(`/api/moradores/${id}/aprovar`, { method: "PUT" });
      const data = await res.json();
      if (res.ok) {
        setPendentes((prev) => prev.filter((p) => p.id !== id));
        setSuccessMsg(data.message || "Aprovado!");
        setTimeout(() => setSuccessMsg(""), 3000);
      } else {
        alert(data.error || "Erro ao aprovar.");
      }
    } catch (err) {
      alert("Erro de conexão.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRejeitar(id: number, nome: string) {
    if (!confirm(`Rejeitar o cadastro de "${nome}"? Isso removerá o registro permanentemente.`)) return;
    setActionLoading(id);
    try {
      const res = await apiFetch(`/api/moradores/${id}/rejeitar`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setPendentes((prev) => prev.filter((p) => p.id !== id));
        setSuccessMsg(data.message || "Rejeitado.");
        setTimeout(() => setSuccessMsg(""), 3000);
      } else {
        alert(data.error || "Erro ao rejeitar.");
      }
    } catch (err) {
      alert("Erro de conexão.");
    } finally {
      setActionLoading(null);
    }
  }

  const filtered = pendentes.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase()) ||
      (p.block && p.block.toLowerCase().includes(search.toLowerCase())) ||
      (p.unit && p.unit.toLowerCase().includes(search.toLowerCase()))
  );

  const perfilLabel = (p: string | null) => {
    const map: Record<string, string> = {
      proprietario: "Proprietário",
      inquilino: "Inquilino",
      familiar: "Familiar",
      dependente: "Dependente",
    };
    return map[p || ""] || p || "—";
  };

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: p.pageBg }}>
      {/* Header */}
      <header className="sticky top-0 z-40" style={{ background: p.headerBg, borderBottom: p.headerBorder, boxShadow: p.headerShadow, color: p.text }}>
        <div style={{ height: "4.5rem", display: "flex", alignItems: "center", gap: 12, paddingLeft: "16px", paddingRight: "24px" }}>
          <button onClick={() => navigate(-1)} style={{ width: 40, height: 40, borderRadius: 12, background: p.btnBg, border: p.btnBorder, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: p.text }}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <ShieldCheck className="w-5 h-5" />
          <span style={{ fontWeight: 700, fontSize: 16 }}>Liberação de Cadastros</span>
          <div className="flex-1" />
          {pendentes.length > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
              {pendentes.length}
            </span>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto" style={{ padding: "24px 28px", paddingBottom: "3rem" }}>
        {/* Toggle auto-cadastro com aprovação */}
        <div
          className="rounded-xl border bg-card p-5"
          style={{ borderColor: autoCadastroEnabled ? "#0ea5e9" : "var(--border)", marginBottom: "20px" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-base font-semibold" style={{ color: "#003580" }}>Aprovação de Auto-Cadastro</p>
              <p className="text-sm mt-0.5" style={{ color: "#64748b" }}>
                {autoCadastroEnabled
                  ? "Moradores precisam de aprovação após se cadastrarem"
                  : "Moradores têm acesso imediato após auto-cadastro"}
              </p>
            </div>
            <button
              onClick={() => { console.log("Toggle clicked, current:", autoCadastroEnabled); toggleAutoCadastro(); }}
              disabled={configLoading}
              className="p-2 rounded-lg transition-colors shrink-0 hover:bg-foreground/10 active:bg-foreground/20"
              style={{ minWidth: "56px", minHeight: "44px", cursor: configLoading ? "wait" : "pointer" }}
            >
              {configLoading ? (
                <Loader2 className="w-10 h-10 animate-spin" style={{ color: "#64748b" }} />
              ) : autoCadastroEnabled ? (
                <ToggleRight className="w-12 h-12 text-sky-500" />
              ) : (
                <ToggleLeft className="w-12 h-12" style={{ color: "#64748b" }} />
              )}
            </button>
          </div>
          <div className="mt-2 pt-2 border-t border-border">
            <p className="text-sm font-medium" style={{ color: autoCadastroEnabled ? "#0ea5e9" : "#ef4444" }}>
              {autoCadastroEnabled ? "✔ Aprovação ativada — novos cadastros precisam de liberação" : "✖ Aprovação desativada — cadastros são aprovados automaticamente"}
            </p>
          </div>
        </div>

        {/* Email Notification */}
        <div
          className="rounded-xl border bg-card p-5"
          style={{ borderColor: emailEnabled ? "#0ea5e9" : "var(--border)", marginBottom: "20px" }}
        >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-sky-500" />
                  <p className="text-base font-semibold" style={{ color: "#003580" }}>Notificação por E-mail</p>
                </div>
                <p className="text-sm mt-0.5" style={{ color: "#64748b" }}>
                  Receba um e-mail quando houver um cadastro aguardando liberação
                </p>
              </div>
              <button
                onClick={() => saveEmailNotification(!emailEnabled)}
                disabled={emailSaving}
                className="p-2 rounded-lg transition-colors shrink-0 hover:bg-foreground/10 active:bg-foreground/20"
                style={{ minWidth: "56px", minHeight: "44px", cursor: emailSaving ? "wait" : "pointer" }}
              >
                {emailSaving ? (
                  <Loader2 className="w-10 h-10 animate-spin" style={{ color: "#64748b" }} />
                ) : emailEnabled ? (
                  <ToggleRight className="w-12 h-12 text-sky-500" />
                ) : (
                  <ToggleLeft className="w-12 h-12" style={{ color: "#64748b" }} />
                )}
              </button>
            </div>
            {emailEnabled && (
              <div className="mt-3 pt-3 border-t border-border">
                <label className="text-sm font-medium mb-1.5 block" style={{ color: "#003580" }}>E-mail para notificação</label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="sindico@exemplo.com"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    className="flex-1 h-10 rounded-lg border border-input bg-white dark:bg-secondary/50 px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary"
                    style={{ color: "#003580" }}
                  />
                  <button
                    onClick={() => saveEmailNotification()}
                    disabled={emailSaving || !emailAddress.trim()}
                    className="h-10 px-4 rounded-lg bg-[#003580] text-white text-sm font-medium flex items-center gap-1.5 hover:bg-[#002a66] disabled:opacity-50 transition-colors"
                  >
                    {emailSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Salvar
                  </button>
                </div>
              </div>
            )}
          </div>

        {/* WhatsApp Notification */}
        <div
          className="rounded-xl border bg-card p-5"
          style={{ borderColor: whatsappEnabled ? "#25D366" : "var(--border)", marginBottom: "20px" }}
        >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-green-500" />
                  <p className="text-base font-semibold" style={{ color: "#003580" }}>Notificação por WhatsApp</p>
                </div>
                <p className="text-sm mt-0.5" style={{ color: "#64748b" }}>
                  Ao finalizar o cadastro, o morador poderá solicitar liberação via WhatsApp
                </p>
              </div>
              <button
                onClick={() => saveWhatsappNotification(!whatsappEnabled)}
                disabled={whatsappSaving}
                className="p-2 rounded-lg transition-colors shrink-0 hover:bg-foreground/10 active:bg-foreground/20"
                style={{ minWidth: "56px", minHeight: "44px", cursor: whatsappSaving ? "wait" : "pointer" }}
              >
                {whatsappSaving ? (
                  <Loader2 className="w-10 h-10 animate-spin" style={{ color: "#64748b" }} />
                ) : whatsappEnabled ? (
                  <ToggleRight className="w-12 h-12 text-green-500" />
                ) : (
                  <ToggleLeft className="w-12 h-12" style={{ color: "#64748b" }} />
                )}
              </button>
            </div>
            {whatsappEnabled && (
              <div className="mt-3 pt-3 border-t border-border">
                <label className="text-sm font-medium mb-1.5 block" style={{ color: "#003580" }}>Telefone WhatsApp do síndico/administradora</label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    placeholder="(11) 99999-9999"
                    value={whatsappPhone}
                    onChange={(e) => setWhatsappPhone(e.target.value)}
                    className="flex-1 h-10 rounded-lg border border-input bg-white dark:bg-secondary/50 px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary"
                    style={{ color: "#003580" }}
                  />
                  <button
                    onClick={() => saveWhatsappNotification()}
                    disabled={whatsappSaving || !whatsappPhone.trim()}
                    className="h-10 px-4 rounded-lg text-white text-sm font-medium flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50 transition-colors"
                    style={{ backgroundColor: "#25D366" }}
                  >
                    {whatsappSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Salvar
                  </button>
                </div>
                <p className="text-xs mt-2" style={{ color: "#64748b" }}>
                  O morador verá a opção de enviar solicitação pelo WhatsApp após concluir o cadastro
                </p>
              </div>
            )}
          </div>

        {/* Success message */}
        {successMsg && (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-4 py-2 flex items-center gap-2" style={{ marginBottom: "20px" }}>
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="text-sm text-emerald-600 dark:text-emerald-400">{successMsg}</span>
          </div>
        )}

        {/* Search */}
        <div className="flex items-center gap-2 h-11 rounded-lg border border-border bg-card" style={{ paddingLeft: "24px", paddingRight: "12px", marginBottom: "20px" }}>
          <Search className="w-4 h-4 shrink-0" style={{ color: "#64748b" }} />
          <input
            type="text"
            placeholder="Buscar por nome, e-mail, bloco, unidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
            style={{ color: "#003580" }}
          />
        </div>

        {/* Pending count label */}
        <div className="flex items-center gap-2" style={{ marginBottom: "18px" }}>
          <Clock className="w-4 h-4 text-amber-500" />
          <span className="text-base font-medium" style={{ color: "#003580" }}>
            {pendentes.length} cadastro{pendentes.length !== 1 ? "s" : ""} aguardando liberação
          </span>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-sky-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3 opacity-50" />
            <p className="text-base" style={{ color: "#64748b" }}>
              {pendentes.length === 0 ? "Nenhum cadastro pendente de aprovação." : "Nenhum resultado encontrado."}
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {filtered.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-amber-500/30 bg-card overflow-hidden"
              >
                <div className="p-5">
                  {/* Name & creation date */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)" }}>
                        <Clock className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-base font-semibold" style={{ color: "#003580" }}>{p.name}</p>
                        <p className="text-xs" style={{ color: "#64748b" }}>
                          Solicitado em {new Date(p.created_at).toLocaleDateString("pt-BR")} às{" "}
                          {new Date(p.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                      Pendente
                    </span>
                  </div>

                  {/* Details grid */}
                  <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                    <div className="flex items-center gap-1.5" style={{ color: "#64748b" }}>
                      <Mail className="w-3 h-3 shrink-0" />
                      <span className="truncate">{p.email}</span>
                    </div>
                    {p.phone && (
                      <div className="flex items-center gap-1.5" style={{ color: "#64748b" }}>
                        <Phone className="w-3 h-3 shrink-0" />
                        <span>{p.phone}</span>
                      </div>
                    )}
                    {p.block && (
                      <div className="flex items-center gap-1.5" style={{ color: "#64748b" }}>
                        <Building2 className="w-3 h-3 shrink-0" />
                        <span>Bloco {p.block}</span>
                      </div>
                    )}
                    {p.unit && (
                      <div className="flex items-center gap-1.5" style={{ color: "#64748b" }}>
                        <Home className="w-3 h-3 shrink-0" />
                        <span>Unidade {p.unit}</span>
                      </div>
                    )}
                    {p.perfil && (
                      <div className="flex items-center gap-1.5" style={{ color: "#64748b" }}>
                        <UserCheck className="w-3 h-3 shrink-0" />
                        <span>{perfilLabel(p.perfil)}</span>
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleAprovar(p.id)}
                      disabled={actionLoading === p.id}
                      className="flex-1 h-10 rounded-lg bg-emerald-500 text-white text-sm font-medium flex items-center justify-center gap-1.5 hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                    >
                      {actionLoading === p.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <UserCheck className="w-3.5 h-3.5" />
                      )}
                      Aprovar
                    </button>
                    <button
                      onClick={() => handleRejeitar(p.id, p.name)}
                      disabled={actionLoading === p.id}
                      className="flex-1 h-10 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                      style={{ border: "2px solid #ef4444", color: "#ef4444" }}
                    >
                      {actionLoading === p.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5" />
                      )}
                      Rejeitar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
