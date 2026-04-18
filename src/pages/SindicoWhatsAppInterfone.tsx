import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/hooks/useTheme";
import TutorialButton, { TSection, TStep, TBullet } from "@/components/TutorialButton";
import {
  ArrowLeft, MessageCircle, Shield, ShieldCheck, ShieldAlert,
  Save, Loader2, CheckCircle2, Phone, ToggleLeft, ToggleRight,
  Building2, QrCode, Copy, Check, Plus, AlertCircle,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function SindicoWhatsAppInterfone() {
  const navigate = useNavigate();
  const { isDark, p } = useTheme();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Config state
  const [enabled, setEnabled] = useState(false);
  const [securityLevel, setSecurityLevel] = useState<"baixo" | "moderado">("baixo");
  const [hasPortaria, setHasPortaria] = useState(false);
  const [portariaPhone, setPortariaPhone] = useState("");

  // QR Tokens
  const [tokens, setTokens] = useState<any[]>([]);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState("");

  // Morador stats
  const [moradorStats, setMoradorStats] = useState({ total: 0, withPhone: 0 });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [configRes, tokensRes, blocksRes, moradoresRes] = await Promise.all([
        apiFetch("/api/condominio-config"),
        apiFetch("/api/interfone/tokens"),
        apiFetch("/api/blocos"),
        apiFetch("/api/moradores"),
      ]);

      // Parse config
      const cfg = configRes.ok ? await configRes.json() : {};
      setEnabled(cfg.interfone_whatsapp_enabled === "true");
      setSecurityLevel(cfg.interfone_whatsapp_security_level === "moderado" ? "moderado" : "baixo");
      setHasPortaria(cfg.interfone_whatsapp_has_portaria === "true");
      setPortariaPhone(cfg.interfone_whatsapp_portaria_phone || "");

      const tokensData = tokensRes.ok ? await tokensRes.json() : [];
      setTokens(Array.isArray(tokensData) ? tokensData : []);

      const blocksData = blocksRes.ok ? await blocksRes.json() : [];
      setBlocks(Array.isArray(blocksData) ? blocksData : []);

      // Stats
      const moradores = moradoresRes.ok ? await moradoresRes.json() : [];
      const moradoresList = Array.isArray(moradores) ? moradores : [];
      setMoradorStats({
        total: moradoresList.length,
        withPhone: moradoresList.filter((m: any) => m.phone).length,
      });
    } catch (err: any) {
      setError(err.message || "Erro ao carregar configurações.");
    } finally {
      setLoading(false);
    }
  };

  const formatPhone = (value: string) => {
    const n = value.replace(/\D/g, "");
    if (n.length <= 2) return n;
    if (n.length <= 7) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
    if (n.length <= 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
    return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7, 11)}`;
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await apiFetch("/api/condominio-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interfone_whatsapp_enabled: enabled ? "true" : "false",
          interfone_whatsapp_security_level: securityLevel,
          interfone_whatsapp_has_portaria: hasPortaria ? "true" : "false",
          interfone_whatsapp_portaria_phone: portariaPhone.replace(/\D/g, "") || "",
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      setError(err.message || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const getWhatsAppUrl = (token: string) => {
    const base = globalThis.location.origin;
    return `${base}/whatsapp/${token}`;
  };

  const handleCopyUrl = (token: string) => {
    navigator.clipboard.writeText(getWhatsAppUrl(token)).then(() => {
      setCopied(token);
      setTimeout(() => setCopied(""), 2000);
    });
  };

  const handleCreateToken = async (block: any) => {
    setCreating(true);
    try {
      await apiFetch("/api/interfone/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bloco_id: block.id, bloco_nome: block.name }),
      });
      const res = await apiFetch("/api/interfone/tokens");
      const data = res.ok ? await res.json() : [];
      setTokens(Array.isArray(data) ? data : []);
    } catch {
      // Token may already exist
    } finally {
      setCreating(false);
    }
  };

  const handleCreateCondoToken = async () => {
    setCreating(true);
    try {
      await apiFetch("/api/interfone/tokens/condominio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const res = await apiFetch("/api/interfone/tokens");
      const data = res.ok ? await res.json() : [];
      setTokens(Array.isArray(data) ? data : []);
    } catch {
      // May already exist
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", background: p.pageBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 style={{ width: 32, height: 32, color: "#25D366", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  const condoToken = tokens.find((t: any) => t.tipo === "condominio");
  const blockTokens = tokens.filter((t: any) => t.tipo !== "condominio");
  const blocksWithoutToken = blocks.filter((b: any) =>
    !blockTokens.some((t: any) => t.bloco_id === b.id)
  );

  return (
    <div style={{ minHeight: "100dvh", background: p.pageBg }}>
      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 40, background: p.headerBg, borderBottom: p.headerBorder, boxShadow: p.headerShadow }}>
        <div style={{ padding: "0 16px", height: 56, display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => navigate("/dashboard")} style={{ padding: 4, background: "none", border: "none", cursor: "pointer", color: p.text }}>
            <ArrowLeft style={{ width: 20, height: 20 }} />
          </button>
          <MessageCircle style={{ width: 20, height: 20, color: "#25D366" }} />
          <span style={{ fontWeight: 600, fontSize: 14, color: p.text }}>Interfone WhatsApp</span>
          <TutorialButton title="Interfone WhatsApp">
            <TSection icon={<span>📱</span>} title="O QUE É">
              <p>Versão simplificada do interfone que permite visitantes entrarem em contato com moradores diretamente pelo <strong>WhatsApp</strong>, sem necessidade de chamada de vídeo ou áudio.</p>
            </TSection>
            <TSection icon={<span>🔒</span>} title="NÍVEIS DE SEGURANÇA">
              <TBullet><strong>Baixo</strong> — Visitante seleciona o apartamento e já pode falar com o morador</TBullet>
              <TBullet><strong>Moderado</strong> — Visitante precisa digitar o nome do morador para liberar o contato</TBullet>
            </TSection>
            <TSection icon={<span>🏢</span>} title="PORTARIA">
              <TStep n={1}>Ative a opção "Tem Portaria" se seu condomínio possui porteiro</TStep>
              <TStep n={2}>Cadastre o WhatsApp da portaria como fallback</TStep>
              <TStep n={3}>Se o morador não for localizado, o visitante será direcionado para a portaria</TStep>
            </TSection>
          </TutorialButton>
        </div>
      </header>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: 20 }}>

        {/* Error */}
        {error && (
          <div style={{ padding: 12, borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <AlertCircle style={{ width: 16, height: 16, color: "#ef4444", flexShrink: 0 }} />
            <span style={{ color: "#ef4444", fontSize: 13 }}>{error}</span>
          </div>
        )}

        {/* Stats card */}
        <div style={{ background: p.cardBg, borderRadius: 16, padding: 20, border: p.cardBorder, marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: p.text, marginBottom: 12 }}>Status dos Moradores</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ background: isDark ? "rgba(37,211,102,0.1)" : "rgba(37,211,102,0.08)", borderRadius: 10, padding: 14, textAlign: "center" }}>
              <p style={{ fontSize: 28, fontWeight: 800, color: "#25D366" }}>{moradorStats.withPhone}</p>
              <p style={{ fontSize: 11, color: p.textSecondary, marginTop: 2 }}>Com WhatsApp</p>
            </div>
            <div style={{ background: isDark ? "rgba(239,68,68,0.1)" : "rgba(239,68,68,0.08)", borderRadius: 10, padding: 14, textAlign: "center" }}>
              <p style={{ fontSize: 28, fontWeight: 800, color: "#ef4444" }}>{moradorStats.total - moradorStats.withPhone}</p>
              <p style={{ fontSize: 11, color: p.textSecondary, marginTop: 2 }}>Sem WhatsApp</p>
            </div>
          </div>
          {moradorStats.total > 0 && moradorStats.withPhone < moradorStats.total && (
            <p style={{ fontSize: 12, color: "#f59e0b", marginTop: 10 }}>
              ⚠️ {moradorStats.total - moradorStats.withPhone} morador(es) sem WhatsApp cadastrado não aparecerão para o visitante.
            </p>
          )}
        </div>

        {/* Enable toggle */}
        <div style={{ background: p.cardBg, borderRadius: 16, padding: 20, border: p.cardBorder, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: enabled ? "rgba(37,211,102,0.15)" : "rgba(148,163,184,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <MessageCircle style={{ width: 20, height: 20, color: enabled ? "#25D366" : p.textSecondary }} />
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: p.text }}>Interfone WhatsApp</p>
                <p style={{ fontSize: 12, color: p.textSecondary }}>{enabled ? "Ativo" : "Desativado"}</p>
              </div>
            </div>
            <button
              onClick={() => setEnabled(!enabled)}
              style={{ background: "none", border: "none", cursor: "pointer", color: enabled ? "#25D366" : p.textSecondary }}
            >
              {enabled ? <ToggleRight style={{ width: 36, height: 36 }} /> : <ToggleLeft style={{ width: 36, height: 36 }} />}
            </button>
          </div>
        </div>

        {enabled && (
          <>
            {/* Security Level */}
            <div style={{ background: p.cardBg, borderRadius: 16, padding: 20, border: p.cardBorder, marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: p.text, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                <Shield style={{ width: 16, height: 16, color: "#f59e0b" }} />
                Nível de Segurança
              </h3>

              {/* Baixo */}
              <button
                onClick={() => setSecurityLevel("baixo")}
                style={{
                  width: "100%", padding: 16, borderRadius: 12, marginBottom: 10,
                  border: securityLevel === "baixo" ? "2px solid #25D366" : `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
                  background: securityLevel === "baixo" ? (isDark ? "rgba(37,211,102,0.1)" : "rgba(37,211,102,0.05)") : "transparent",
                  cursor: "pointer", textAlign: "left", display: "flex", alignItems: "flex-start", gap: 12,
                }}
              >
                <ShieldCheck style={{ width: 20, height: 20, color: securityLevel === "baixo" ? "#25D366" : p.textSecondary, marginTop: 2, flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: p.text }}>Baixo</p>
                  <p style={{ fontSize: 12, color: p.textSecondary, marginTop: 4, lineHeight: 1.5 }}>
                    Visitante seleciona o apartamento e já pode falar com o morador via WhatsApp. Acesso rápido e direto.
                  </p>
                </div>
              </button>

              {/* Moderado */}
              <button
                onClick={() => setSecurityLevel("moderado")}
                style={{
                  width: "100%", padding: 16, borderRadius: 12,
                  border: securityLevel === "moderado" ? "2px solid #f59e0b" : `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
                  background: securityLevel === "moderado" ? (isDark ? "rgba(245,158,11,0.1)" : "rgba(245,158,11,0.05)") : "transparent",
                  cursor: "pointer", textAlign: "left", display: "flex", alignItems: "flex-start", gap: 12,
                }}
              >
                <ShieldAlert style={{ width: 20, height: 20, color: securityLevel === "moderado" ? "#f59e0b" : p.textSecondary, marginTop: 2, flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: p.text }}>Moderado</p>
                  <p style={{ fontSize: 12, color: p.textSecondary, marginTop: 4, lineHeight: 1.5 }}>
                    Visitante precisa digitar o nome do morador. Se o nome coincidir, libera o WhatsApp. Se não coincidir, direciona para a portaria.
                  </p>
                </div>
              </button>
            </div>

            {/* Portaria config */}
            <div style={{ background: p.cardBg, borderRadius: 16, padding: 20, border: p.cardBorder, marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: p.text, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                <Building2 style={{ width: 16, height: 16, color: "#6366f1" }} />
                Portaria
              </h3>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: hasPortaria ? 16 : 0 }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: p.text }}>Tem portaria?</p>
                  <p style={{ fontSize: 12, color: p.textSecondary }}>Se ativo, visitante pode falar com porteiro</p>
                </div>
                <button
                  onClick={() => setHasPortaria(!hasPortaria)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: hasPortaria ? "#6366f1" : p.textSecondary }}
                >
                  {hasPortaria ? <ToggleRight style={{ width: 32, height: 32 }} /> : <ToggleLeft style={{ width: 32, height: 32 }} />}
                </button>
              </div>

              {hasPortaria && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: p.textSecondary, display: "block", marginBottom: 6 }}>
                    WhatsApp da Portaria
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Phone style={{ width: 16, height: 16, color: p.textSecondary, flexShrink: 0 }} />
                    <input
                      type="tel"
                      placeholder="(11) 99999-9999"
                      value={formatPhone(portariaPhone)}
                      onChange={(e) => setPortariaPhone(e.target.value.replace(/\D/g, ""))}
                      style={{
                        flex: 1, padding: "10px 14px", borderRadius: 10,
                        border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                        background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                        color: p.text, fontSize: 14, outline: "none",
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                width: "100%", padding: 14, borderRadius: 12, marginBottom: 24,
                border: "none", cursor: "pointer",
                background: saved ? "#10b981" : "linear-gradient(135deg, #25D366 0%, #128C7E 100%)",
                color: "#fff", fontWeight: 700, fontSize: 15,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                opacity: saving ? 0.6 : 1,
                boxShadow: "0 4px 16px rgba(37,211,102,0.3)",
              }}
            >
              {saving ? <Loader2 style={{ width: 18, height: 18, animation: "spin 1s linear infinite" }} />
                : saved ? <CheckCircle2 style={{ width: 18, height: 18 }} />
                : <Save style={{ width: 18, height: 18 }} />}
              {saving ? "Salvando..." : saved ? "Salvo!" : "Salvar Configurações"}
            </button>

            {/* QR Codes section */}
            <div style={{ borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}`, paddingTop: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: p.text, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
                <QrCode style={{ width: 18, height: 18, color: "#25D366" }} />
                QR Codes — Interfone WhatsApp
              </h3>
              <p style={{ fontSize: 13, color: p.textSecondary, marginBottom: 16, lineHeight: 1.5 }}>
                Use os mesmos QR Codes do interfone. O visitante acessará a versão WhatsApp pelo link <strong>/whatsapp/TOKEN</strong>.
              </p>

              {/* Condominium-wide token */}
              <div style={{ background: isDark ? "rgba(37,211,102,0.08)" : "rgba(37,211,102,0.05)", borderRadius: 14, padding: 16, border: "1px solid rgba(37,211,102,0.2)", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <Building2 style={{ width: 16, height: 16, color: "#25D366" }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#25D366", textTransform: "uppercase" }}>QR Code Geral do Condomínio</span>
                </div>
                {condoToken ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <code style={{ flex: 1, fontSize: 11, color: p.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {getWhatsAppUrl(condoToken.token)}
                    </code>
                    <button
                      onClick={() => handleCopyUrl(condoToken.token)}
                      style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(37,211,102,0.3)", background: "rgba(37,211,102,0.1)", color: "#25D366", cursor: "pointer", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}
                    >
                      {copied === condoToken.token ? <Check style={{ width: 12, height: 12 }} /> : <Copy style={{ width: 12, height: 12 }} />}
                      {copied === condoToken.token ? "Copiado!" : "Copiar"}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleCreateCondoToken}
                    disabled={creating}
                    style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#25D366", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <Plus style={{ width: 14, height: 14 }} /> Criar QR Code Geral
                  </button>
                )}
              </div>

              {/* Block tokens */}
              {blockTokens.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: p.text }}>QR Codes por Bloco</h4>
                  {blockTokens.map((t: any) => (
                    <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)", border: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}` }}>
                      <Building2 style={{ width: 14, height: 14, color: p.textSecondary, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: p.text, minWidth: 60 }}>Bloco {t.bloco_nome}</span>
                      <code style={{ flex: 1, fontSize: 10, color: p.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        /whatsapp/{t.token}
                      </code>
                      <button
                        onClick={() => handleCopyUrl(t.token)}
                        style={{ padding: "4px 8px", borderRadius: 6, border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`, background: "transparent", color: p.textSecondary, cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 3 }}
                      >
                        {copied === t.token ? <Check style={{ width: 10, height: 10 }} /> : <Copy style={{ width: 10, height: 10 }} />}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Blocks without token */}
              {blocksWithoutToken.length > 0 && (
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: p.textSecondary, marginBottom: 10 }}>Blocos sem QR Code ({blocksWithoutToken.length})</h4>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8 }}>
                    {blocksWithoutToken.map((b: any) => (
                      <button
                        key={b.id}
                        onClick={() => handleCreateToken(b)}
                        disabled={creating}
                        style={{
                          padding: "10px 8px", borderRadius: 10,
                          border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`,
                          background: "transparent", color: p.text, cursor: "pointer",
                          display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                          fontSize: 12, fontWeight: 600,
                        }}
                      >
                        <QrCode style={{ width: 16, height: 16, color: p.textSecondary }} />
                        Bloco {b.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
