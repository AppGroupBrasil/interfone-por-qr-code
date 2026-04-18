import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { AppLogo } from "@/components/AppLogo";
import {
  MessageCircle, Building2, Search, Loader2, Phone,
  AlertCircle, ChevronRight, ArrowLeft, Shield,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

const API = "/api";

interface Morador { id: number; name: string; }
interface Apartamento { unit: string; moradores: Morador[]; }
interface BlocoInfo { id: number; nome: string; apartamentos: Apartamento[]; }

interface BlockTokenData {
  tipo: "bloco"; condominio: string; condominio_id: number;
  bloco: string; apartamentos: Apartamento[];
  security_level: string; has_portaria: boolean; portaria_phone: string | null;
}
interface CondoTokenData {
  tipo: "condominio"; condominio: string; condominio_id: number;
  blocos: BlocoInfo[];
  security_level: string; has_portaria: boolean; portaria_phone: string | null;
}
type TokenData = BlockTokenData | CondoTokenData;

interface LookupResult {
  found: boolean;
  moradores?: { name: string; phone: string }[];
  message?: string;
  portaria_phone?: string | null;
}

async function readJsonOrThrow<T>(response: Response): Promise<T> {
  const payload = await response.json();

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "Erro ao processar a solicitação.";
    throw new Error(message);
  }

  return payload as T;
}

export default function InterfoneWhatsApp() {
  const { token } = useParams<{ token: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<TokenData | null>(null);

  // Navigation state
  const [selectedBloco, setSelectedBloco] = useState<BlocoInfo | null>(null);
  const [selectedApt, setSelectedApt] = useState<Apartamento | null>(null);
  const [searchUnit, setSearchUnit] = useState("");

  // Lookup state (moderado)
  const [nomeMorador, setNomeMorador] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [lookupError, setLookupError] = useState("");

  // Fetch token data
  useEffect(() => {
    if (!token) return;
    setLoading(true);
    apiFetch(`${API}/interfone/whatsapp/public/${token}`)
      .then((response) => readJsonOrThrow<TokenData>(response))
      .then((payload) => { setData(payload); setLoading(false); })
      .catch((err) => {
        setError(err.message || "QR Code inválido.");
        setLoading(false);
      });
  }, [token]);

  // Build wa.me link
  const waLink = (phone: string, condoName: string, apt: string, bloco?: string) => {
    const msg = encodeURIComponent(
      `Olá! Sou visitante do ${condoName}${bloco ? ` - Bloco ${bloco}` : ""}, Apartamento ${apt}. Poderia me atender?`
    );
    return `https://wa.me/${phone}?text=${msg}`;
  };

  const handleSelectApartment = async (apt: Apartamento) => {
    if (!data) return;
    setSelectedApt(apt);
    setLookupResult(null);
    setLookupError("");
    setNomeMorador("");

    // Baixo security: auto-lookup
    if (data.security_level === "baixo") {
      setLookupLoading(true);
      try {
        const bloco = data.tipo === "bloco" ? data.bloco : selectedBloco?.nome;
        const response = await apiFetch(`${API}/interfone/whatsapp/lookup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            condominio_id: data.condominio_id,
            bloco,
            apartamento: apt.unit,
          }),
        });
        const result = await readJsonOrThrow<LookupResult>(response);
        setLookupResult(result);
      } catch (err: any) {
        setLookupError(err.message || "Erro ao buscar morador.");
      } finally {
        setLookupLoading(false);
      }
    }
  };

  const handleLookupModerado = async () => {
    if (!data || !selectedApt) return;
    if (!nomeMorador.trim() || nomeMorador.trim().length < 2) {
      setLookupError("Digite pelo menos 2 letras do nome do morador.");
      return;
    }
    setLookupLoading(true);
    setLookupResult(null);
    setLookupError("");
    try {
      const bloco = data.tipo === "bloco" ? data.bloco : selectedBloco?.nome;
      const response = await apiFetch(`${API}/interfone/whatsapp/lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          condominio_id: data.condominio_id,
          bloco,
          apartamento: selectedApt.unit,
          nome_morador: nomeMorador.trim(),
        }),
      });
      const result = await readJsonOrThrow<LookupResult>(response);
      setLookupResult(result);
    } catch (err: any) {
      setLookupError(err.message || "Erro ao buscar morador.");
    } finally {
      setLookupLoading(false);
    }
  };

  // Get apartments list
  const getApartamentos = (): Apartamento[] => {
    if (!data) return [];
    if (data.tipo === "bloco") return data.apartamentos;
    if (selectedBloco) return selectedBloco.apartamentos;
    return [];
  };

  const filteredApts = getApartamentos().filter(
    (a) => !searchUnit || a.unit.toLowerCase().includes(searchUnit.toLowerCase())
  );

  // ═══ COLORS ═══
  const bg = "#0f172a";
  const cardBg = "#1e293b";
  const accent = "#25D366"; // WhatsApp green
  const accentDark = "#128C7E";
  const textPrimary = "#f1f5f9";
  const textSecondary = "#94a3b8";
  const borderColor = "rgba(37,211,102,0.2)";

  // ═══ LOADING ═══
  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <Loader2 style={{ width: 40, height: 40, color: accent, animation: "spin 1s linear infinite" }} />
          <p style={{ color: textSecondary, marginTop: 16, fontSize: 14 }}>Carregando...</p>
        </div>
      </div>
    );
  }

  // ═══ ERROR ═══
  if (error || !data) {
    return (
      <div style={{ minHeight: "100dvh", background: bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          <AlertCircle style={{ width: 48, height: 48, color: "#ef4444", margin: "0 auto 16px" }} />
          <h2 style={{ color: textPrimary, fontSize: 18, fontWeight: 700, marginBottom: 8 }}>QR Code Inválido</h2>
          <p style={{ color: textSecondary, fontSize: 14 }}>{error || "Este QR Code não existe ou foi desativado."}</p>
        </div>
      </div>
    );
  }

  // ═══ RESULT VIEW (after apt selected) ═══
  const renderResult = () => {
    if (!selectedApt) return null;
    const bloco = data.tipo === "bloco" ? data.bloco : selectedBloco?.nome;

    return (
      <div style={{ padding: 20, maxWidth: 420, margin: "0 auto", width: "100%" }}>
        {/* Back button */}
        <button
          onClick={() => { setSelectedApt(null); setLookupResult(null); setLookupError(""); setNomeMorador(""); }}
          style={{ display: "flex", alignItems: "center", gap: 6, color: textSecondary, fontSize: 14, background: "none", border: "none", cursor: "pointer", marginBottom: 20 }}
        >
          <ArrowLeft style={{ width: 16, height: 16 }} /> Voltar
        </button>

        {/* Apartment info */}
        <div style={{ background: cardBg, borderRadius: 16, padding: 24, border: `1px solid ${borderColor}`, marginBottom: 20 }}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(37,211,102,0.15)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
              <MessageCircle style={{ width: 28, height: 28, color: accent }} />
            </div>
            <h2 style={{ color: textPrimary, fontSize: 18, fontWeight: 700 }}>
              {bloco ? `Bloco ${bloco} — ` : ""}Apt {selectedApt.unit}
            </h2>
            <p style={{ color: textSecondary, fontSize: 13, marginTop: 4 }}>{data.condominio}</p>
          </div>

          {/* Moderado: name input */}
          {data.security_level === "moderado" && !lookupResult?.found && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <Shield style={{ width: 14, height: 14, color: "#f59e0b" }} />
                <span style={{ color: "#f59e0b", fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>Verificação de Segurança</span>
              </div>
              <p style={{ color: textSecondary, fontSize: 13, marginBottom: 12 }}>
                Digite o nome de um morador deste apartamento para liberar o contato.
              </p>
              <input
                type="text"
                placeholder="Nome do morador..."
                value={nomeMorador}
                onChange={(e) => setNomeMorador(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleLookupModerado(); }}
                style={{
                  width: "100%", padding: "12px 16px", borderRadius: 10,
                  border: `1px solid ${borderColor}`, background: "rgba(255,255,255,0.05)",
                  color: textPrimary, fontSize: 15, outline: "none", boxSizing: "border-box",
                }}
              />
              <button
                onClick={handleLookupModerado}
                disabled={lookupLoading || nomeMorador.trim().length < 2}
                style={{
                  width: "100%", padding: 14, borderRadius: 10, marginTop: 10,
                  border: "none", background: accent, color: "#fff",
                  fontWeight: 700, fontSize: 15, cursor: "pointer",
                  opacity: lookupLoading || nomeMorador.trim().length < 2 ? 0.5 : 1,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                {lookupLoading ? <Loader2 style={{ width: 18, height: 18, animation: "spin 1s linear infinite" }} /> : <Search style={{ width: 18, height: 18 }} />}
                {lookupLoading ? "Verificando..." : "Verificar"}
              </button>
            </div>
          )}

          {/* Loading lookup */}
          {lookupLoading && data.security_level === "baixo" && (
            <div style={{ textAlign: "center", padding: 20 }}>
              <Loader2 style={{ width: 24, height: 24, color: accent, animation: "spin 1s linear infinite", margin: "0 auto" }} />
              <p style={{ color: textSecondary, fontSize: 13, marginTop: 8 }}>Buscando contato...</p>
            </div>
          )}

          {/* Lookup error */}
          {lookupError && (
            <div style={{ padding: 12, borderRadius: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", marginBottom: 12 }}>
              <p style={{ color: "#ef4444", fontSize: 13 }}>{lookupError}</p>
            </div>
          )}

          {/* Result: found moradores */}
          {lookupResult?.found && lookupResult.moradores && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ color: accent, fontSize: 13, fontWeight: 600, textAlign: "center", marginBottom: 4 }}>
                Morador localizado! Toque para falar via WhatsApp:
              </p>
              {lookupResult.moradores.map((m, i) => (
                <a
                  key={i}
                  href={waLink(m.phone, data.condominio, selectedApt.unit, bloco)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "14px 16px", borderRadius: 12,
                    background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)",
                    color: "#fff", textDecoration: "none",
                    fontWeight: 700, fontSize: 15,
                    boxShadow: "0 4px 16px rgba(37,211,102,0.3)",
                  }}
                >
                  <MessageCircle style={{ width: 22, height: 22 }} />
                  <span style={{ flex: 1 }}>Falar com {m.name}</span>
                  <ChevronRight style={{ width: 18, height: 18, opacity: 0.7 }} />
                </a>
              ))}
            </div>
          )}

          {/* Result: not found */}
          {lookupResult && !lookupResult.found && (
            <div style={{ textAlign: "center" }}>
              <div style={{ padding: 16, borderRadius: 12, background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", marginBottom: 12 }}>
                <AlertCircle style={{ width: 24, height: 24, color: "#f59e0b", margin: "0 auto 8px" }} />
                <p style={{ color: "#fbbf24", fontSize: 14, fontWeight: 600 }}>{lookupResult.message}</p>
              </div>

              {lookupResult.portaria_phone && (
                <a
                  href={`https://wa.me/${lookupResult.portaria_phone}?text=${encodeURIComponent(`Olá! Sou visitante do ${data.condominio}. Não consegui contato com o morador do apt ${selectedApt.unit}.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "12px 16px", borderRadius: 10,
                    background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)",
                    color: "#818cf8", textDecoration: "none",
                    fontWeight: 600, fontSize: 14, justifyContent: "center",
                  }}
                >
                  <Phone style={{ width: 18, height: 18 }} />
                  Falar com a Portaria
                </a>
              )}

              {data.security_level === "moderado" && (
                <button
                  onClick={() => { setLookupResult(null); setNomeMorador(""); }}
                  style={{
                    marginTop: 12, padding: "10px 20px", borderRadius: 8,
                    border: `1px solid ${borderColor}`, background: "transparent",
                    color: textSecondary, fontSize: 13, cursor: "pointer",
                  }}
                >
                  Tentar outro nome
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ═══ MAIN RENDER ═══
  return (
    <div style={{ minHeight: "100dvh", background: bg }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${accentDark} 0%, #075E54 100%)`,
        padding: "24px 20px 28px", textAlign: "center",
        borderRadius: "0 0 24px 24px",
        boxShadow: "0 8px 32px rgba(18,140,126,0.3)",
      }}>
        <AppLogo size={52} rounded={14} style={{ margin: "0 auto 12px" }} />
        <h1 style={{ color: "#fff", fontSize: 20, fontWeight: 800, margin: 0 }}>
          Interfone WhatsApp
        </h1>
        <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, marginTop: 4 }}>
          {data.condominio}
        </p>
        {data.security_level === "moderado" && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 8, padding: "4px 10px", borderRadius: 20, background: "rgba(255,255,255,0.15)", color: "#fbbf24", fontSize: 11, fontWeight: 600 }}>
            <Shield style={{ width: 12, height: 12 }} /> Segurança moderada
          </div>
        )}
      </div>

      {/* If showing result */}
      {selectedApt ? renderResult() : (
        <div style={{ padding: 20, maxWidth: 420, margin: "0 auto", width: "100%" }}>

          {/* Back to blocks (if condominio-wide and viewing a block) */}
          {data.tipo === "condominio" && selectedBloco && (
            <button
              onClick={() => { setSelectedBloco(null); setSearchUnit(""); }}
              style={{ display: "flex", alignItems: "center", gap: 6, color: textSecondary, fontSize: 14, background: "none", border: "none", cursor: "pointer", marginBottom: 16 }}
            >
              <ArrowLeft style={{ width: 16, height: 16 }} /> Todos os Blocos
            </button>
          )}

          {/* Condominio-wide: Block selection */}
          {data.tipo === "condominio" && !selectedBloco && (
            <>
              <h2 style={{ color: textPrimary, fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
                <Building2 style={{ width: 18, height: 18, display: "inline", verticalAlign: "middle", marginRight: 6 }} />
                Selecione o Bloco
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 10 }}>
                {data.blocos.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBloco(b)}
                    style={{
                      padding: "18px 12px", borderRadius: 14,
                      background: cardBg, border: `1px solid ${borderColor}`,
                      color: textPrimary, cursor: "pointer",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                      transition: "transform 0.15s, box-shadow 0.15s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 6px 20px rgba(37,211,102,0.2)`; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
                  >
                    <Building2 style={{ width: 20, height: 20, color: accent }} />
                    <span style={{ fontSize: 14, fontWeight: 700 }}>Bloco {b.nome}</span>
                    <span style={{ fontSize: 11, color: textSecondary }}>{b.apartamentos.length} apt{b.apartamentos.length !== 1 ? "s" : ""}</span>
                  </button>
                ))}
              </div>
              {data.blocos.length === 0 && (
                <div style={{ textAlign: "center", padding: 40 }}>
                  <Building2 style={{ width: 40, height: 40, color: textSecondary, margin: "0 auto 12px" }} />
                  <p style={{ color: textSecondary, fontSize: 14 }}>Nenhum bloco com moradores cadastrados.</p>
                </div>
              )}
            </>
          )}

          {/* Apartment list (block selected or block-specific token) */}
          {(data.tipo === "bloco" || selectedBloco) && (
            <>
              <h2 style={{ color: textPrimary, fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
                {data.tipo === "bloco" ? `Bloco ${data.bloco}` : `Bloco ${selectedBloco!.nome}`}
              </h2>
              <p style={{ color: textSecondary, fontSize: 13, marginBottom: 16 }}>
                {data.security_level === "baixo"
                  ? "Toque no apartamento para falar via WhatsApp"
                  : "Selecione o apartamento e informe o nome do morador"}
              </p>

              {/* Search */}
              <div style={{ position: "relative", marginBottom: 16 }}>
                <Search style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: textSecondary }} />
                <input
                  type="text"
                  placeholder="Buscar apartamento..."
                  value={searchUnit}
                  onChange={(e) => setSearchUnit(e.target.value)}
                  inputMode="numeric"
                  style={{
                    width: "100%", padding: "12px 16px 12px 40px", borderRadius: 12,
                    border: `1px solid ${borderColor}`, background: cardBg,
                    color: textPrimary, fontSize: 15, outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Apartment grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 8 }}>
                {filteredApts.map((apt) => (
                  <button
                    key={apt.unit}
                    onClick={() => handleSelectApartment(apt)}
                    style={{
                      padding: "16px 8px", borderRadius: 12,
                      background: cardBg, border: `1px solid ${borderColor}`,
                      color: textPrimary, cursor: "pointer",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                      transition: "transform 0.15s, background 0.15s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.background = "rgba(37,211,102,0.1)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.background = cardBg; }}
                  >
                    <span style={{ fontSize: 18, fontWeight: 800, color: accent }}>{apt.unit}</span>
                    <span style={{ fontSize: 10, color: textSecondary }}>{apt.moradores.length} morador{apt.moradores.length !== 1 ? "es" : ""}</span>
                  </button>
                ))}
              </div>

              {filteredApts.length === 0 && (
                <div style={{ textAlign: "center", padding: 30 }}>
                  <p style={{ color: textSecondary, fontSize: 14 }}>
                    {searchUnit ? "Nenhum apartamento encontrado." : "Nenhum morador com WhatsApp cadastrado."}
                  </p>
                </div>
              )}
            </>
          )}

          {/* Portaria contact (always available if configured) */}
          {data.has_portaria && data.portaria_phone && (
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <a
                href={`https://wa.me/${data.portaria_phone}?text=${encodeURIComponent(`Olá! Sou visitante do ${data.condominio}. Preciso de ajuda.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "12px 16px", borderRadius: 12,
                  background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)",
                  color: "#a5b4fc", textDecoration: "none",
                  fontWeight: 600, fontSize: 14, justifyContent: "center",
                }}
              >
                <Phone style={{ width: 16, height: 16 }} />
                Falar com a Portaria
              </a>
            </div>
          )}
        </div>
      )}

      {/* CSS animation */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
