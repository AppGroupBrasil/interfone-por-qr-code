import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Search,
  ArrowRight,
  Loader2,
  AlertCircle,
  Building2,
  CheckCircle2,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { DOC_LABEL, DOC_PLACEHOLDER, formatDocTipo, isDocCompleto, onlyDigits, type DocTipo } from "@/lib/documento";

interface CondominioResult {
  id: number;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  blocks: string[];
}

export default function SearchCondominio() {
  const navigate = useNavigate();

  const [docTipo, setDocTipo] = useState<DocTipo>("cnpj");
  const [cnpj, setCnpj] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");
  const [condominio, setCondominio] = useState<CondominioResult | null>(null);

  const trocarDocTipo = (tipo: DocTipo) => {
    if (tipo === docTipo) return;
    setDocTipo(tipo);
    setCnpj("");
    setCondominio(null);
    setError("");
  };

  const handleSearch = async () => {
    setError("");
    setCondominio(null);

    const clean = onlyDigits(cnpj);
    if (!isDocCompleto(clean, docTipo)) {
      setError(docTipo === "cpf" ? "CPF deve ter 11 dígitos." : "CNPJ deve ter 14 dígitos.");
      return;
    }

    setIsSearching(true);
    try {
      const res = await apiFetch(`/api/auth/condominio/search?cnpj=${clean}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Condomínio não encontrado.");
      }
      const data = await res.json();
      setCondominio(data.condominio);
    } catch (err: any) {
      setError(err.message || "Erro ao buscar condomínio.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleContinue = () => {
    if (!condominio) return;
    navigate("/register/morador", {
      state: {
        condominioId: condominio.id,
        condominioName: condominio.name,
        blocks: condominio.blocks,
      },
    });
  };

  const buildAddress = () => {
    if (!condominio) return "";
    const parts = [condominio.address, condominio.city, condominio.state].filter(Boolean);
    return parts.join(", ");
  };

  return (
    <div className="min-h-dvh bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -right-32 w-64 h-64 rounded-full bg-primary/8 blur-3xl animate-pulse" />
        <div className="absolute -bottom-32 -left-32 w-72 h-72 rounded-full bg-primary/5 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(oklch(0.95 0.01 260) 1px, transparent 1px), linear-gradient(90deg, oklch(0.95 0.01 260) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      <div className="w-full max-w-sm relative z-10 animate-slide-up">
        {/* Header */}
        <div className="text-center" style={{ marginBottom: "32px" }}>
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl" style={{ background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)", marginBottom: "19px" }}>
            <Search className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight" style={{ marginBottom: "19px" }}>
            Buscar Condomínio
          </h1>
          <p className="text-sm text-muted-foreground">
            Informe o CPF ou CNPJ do seu condomínio para continuar
          </p>
        </div>

        {/* Search Card */}
        <div className="glass rounded-2xl p-8 shadow-2xl shadow-black/20">
          <div style={{ display: "flex", flexDirection: "column", gap: "19px" }}>
            {/* CPF/CNPJ Input */}
            <div className="space-y-2">
              <Label htmlFor="documento">{DOC_LABEL[docTipo]} do Condomínio *</Label>
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-muted/40 border border-border">
                {(["cnpj", "cpf"] as DocTipo[]).map((tipo) => (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => trocarDocTipo(tipo)}
                    aria-pressed={docTipo === tipo}
                    className={`h-9 rounded-lg text-xs font-semibold uppercase tracking-wide transition-colors ${
                      docTipo === tipo
                        ? "bg-primary text-primary-foreground shadow"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {DOC_LABEL[tipo]}
                  </button>
                ))}
              </div>
              <Input
                id="documento"
                inputMode="numeric"
                placeholder={DOC_PLACEHOLDER[docTipo]}
                value={cnpj}
                onChange={(e) => {
                  const tipo = onlyDigits(e.target.value).length > 11 ? "cnpj" : docTipo;
                  if (tipo !== docTipo) setDocTipo(tipo);
                  setCnpj(formatDocTipo(e.target.value, tipo));
                  setCondominio(null);
                  setError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
              />
            </div>

            {/* Search Button */}
            {!condominio && (
              <Button
                type="button"
                onClick={handleSearch}
                disabled={isSearching}
                className="w-full"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Buscar condomínio
                  </>
                )}
              </Button>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm animate-fade-in">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Condomínio Found */}
            {condominio && (
              <div className="animate-fade-in space-y-4">
                <div className="p-4 rounded-lg bg-emerald-500/10 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-sm font-medium">Condomínio encontrado!</span>
                  </div>
                  <div className="space-y-1 mt-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <p className="text-sm font-semibold text-foreground">{condominio.name}</p>
                    </div>
                    {buildAddress() && (
                      <p className="text-xs text-muted-foreground ml-6">{buildAddress()}</p>
                    )}
                    {condominio.blocks.length > 0 && (
                      <div className="mt-2 ml-6">
                        <p className="text-xs text-muted-foreground mb-1">Blocos cadastrados:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {condominio.blocks.map((b) => (
                            <span
                              key={b}
                              className="px-2 py-0.5 text-xs rounded-md bg-secondary/80 text-foreground"
                            >
                              {b}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={handleContinue}
                  className="w-full"
                >
                  Continuar cadastro
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Back to login */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          Já tem conta?{" "}
          <Link to="/login" className="text-primary font-medium hover:text-primary/80 transition-colors">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
