import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppLogo } from "@/components/AppLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  UserCheck,
  Copy,
  Check,
} from "lucide-react";

export default function RegisterCondominio() {
  const navigate = useNavigate();
  const { registerCondominio } = useAuth();

  const [step, setStep] = useState(1);

  // Step 1 - Dados do condomínio
  const [condominioName, setCondominioName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  // Step 2 - Dados do responsável
  const [adminName, setAdminName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjFound, setCnpjFound] = useState(false);
  const [cnpjNotFound, setCnpjNotFound] = useState(false);

  // Sample accounts modal
  const [showSampleModal, setShowSampleModal] = useState(false);
  const [sampleMorador, setSampleMorador] = useState<{
    email: string; name: string; block: string; unit: string; phone: string | null; message: string;
  } | null>(null);
  const [samplePorteiro, setSamplePorteiro] = useState<{
    email: string; name: string; cargo: string; phone: string | null; message: string;
  } | null>(null);
  const [copied, setCopied] = useState("");

  // Formatações
  const formatCnpj = (value: string) => {
    const n = value.replace(/\D/g, "");
    if (n.length <= 2) return n;
    if (n.length <= 5) return `${n.slice(0, 2)}.${n.slice(2)}`;
    if (n.length <= 8) return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5)}`;
    if (n.length <= 12) return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8)}`;
    return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8, 12)}-${n.slice(12, 14)}`;
  };

  // Buscar dados do CNPJ na BrasilAPI
  const lookupCnpj = async (rawCnpj: string) => {
    const digits = rawCnpj.replace(/\D/g, "");
    if (digits.length !== 14) return;

    setCnpjLoading(true);
    setCnpjFound(false);
    setCnpjNotFound(false);
    setError("");

    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!res.ok) throw new Error("CNPJ não encontrado.");
      const data = await res.json();

      // Preencher campos automaticamente
      if (data.razao_social) setCondominioName(data.razao_social);

      // Montar endereço
      const parts = [data.logradouro, data.numero].filter(Boolean);
      if (data.complemento) parts.push(data.complemento);
      if (parts.length > 0) setAddress(parts.join(", "));

      if (data.municipio) setCity(data.municipio);
      if (data.uf) setState(data.uf);
      setCnpjFound(true);
    } catch {
      // Não bloqueia — usuário pode preencher manualmente
      setCnpjNotFound(true);
    } finally {
      setCnpjLoading(false);
    }
  };

  const formatPhone = (value: string) => {
    const n = value.replace(/\D/g, "");
    if (n.length <= 2) return n;
    if (n.length <= 7) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
    if (n.length <= 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
    return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7, 11)}`;
  };

  const validateStep1 = () => {
    if (!condominioName.trim()) return "Informe o nome do condomínio.";
    return null;
  };

  const validateStep2 = () => {
    if (!adminName.trim()) return "Informe o nome do responsável.";
    if (!email) return "Informe o e-mail.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "E-mail inválido.";
    if (!/^\d{6}$/.test(password)) return "Senha deve ter exatamente 6 dígitos numéricos.";
    if (password !== confirmPassword) return "As senhas não coincidem.";
    return null;
  };

  const handleNext = () => {
    setError("");
    const err = validateStep1();
    if (err) return setError(err);
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const err = validateStep2();
    if (err) return setError(err);

    setIsLoading(true);
    try {
      const result = await registerCondominio({
        condominioName: condominioName.trim(),
        cnpj: cnpj || undefined,
        address: address || undefined,
        city: city || undefined,
        state: state || undefined,
        adminName: adminName.trim(),
        email,
        phone: phone || undefined,
        password,
      });
      // Show sample accounts modal before navigating
      if (result?.sampleMorador || result?.samplePorteiro) {
        setSampleMorador(result.sampleMorador || null);
        setSamplePorteiro(result.samplePorteiro || null);
        setShowSampleModal(true);
      } else {
        navigate("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Erro ao criar conta.");
    } finally {
      setIsLoading(false);
    }
  };

  const estados = [
    "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
    "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
  ];

  const handleCopySample = (which: "morador" | "porteiro") => {
    let text = "";
    if (which === "morador" && sampleMorador) {
      text = `🏠 Acesso Morador de Exemplo\n\nE-mail: ${sampleMorador.email}\nSenha: ${password}\nBloco: ${sampleMorador.block}\nApto: ${sampleMorador.unit}\n\nUse estes dados para testar como o morador vê o app!`;
    } else if (which === "porteiro" && samplePorteiro) {
      text = `🛡️ Acesso Porteiro de Exemplo\n\nE-mail: ${samplePorteiro.email}\nSenha: ${password}\n\nUse estes dados para testar a experiência da portaria!`;
    }
    navigator.clipboard.writeText(text).then(() => {
      setCopied(which);
      setTimeout(() => setCopied(""), 2000);
    });
  };

  return (
    <div className="min-h-dvh bg-background flex items-center justify-center p-4 relative overflow-hidden">

      {/* ── SAMPLE ACCOUNTS SUCCESS MODAL ──────────────── */}
      {showSampleModal && (sampleMorador || samplePorteiro) && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "#1e293b", borderRadius: "20px", maxWidth: "420px", width: "100%",
              boxShadow: "0 25px 50px rgba(0,0,0,0.5)", overflow: "hidden",
              animation: "slideUp 0.3s ease-out", maxHeight: "90vh", overflowY: "auto",
            }}
          >
            {/* Header */}
            <div style={{
              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              padding: "24px", textAlign: "center", color: "white",
            }}>
              <div style={{
                width: "56px", height: "56px", borderRadius: "50%",
                background: "rgba(255,255,255,0.2)", display: "inline-flex",
                alignItems: "center", justifyContent: "center", marginBottom: "12px",
              }}>
                <UserCheck style={{ width: "28px", height: "28px" }} />
              </div>
              <h2 style={{ fontSize: "20px", fontWeight: 800, marginBottom: "4px" }}>
                Condomínio Criado com Sucesso!
              </h2>
              <p style={{ fontSize: "13px", opacity: 0.9 }}>
                Criamos acessos de exemplo para você testar
              </p>
            </div>

            {/* Body */}
            <div style={{ padding: "20px" }}>

              {/* ── PORTEIRO CARD ─── */}
              {samplePorteiro && (
                <div style={{
                  background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)",
                  borderRadius: "12px", padding: "16px", marginBottom: "12px",
                }}>
                  <p style={{ fontSize: "12px", color: "#818cf8", fontWeight: 700, marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    🛡️ Acesso Porteiro (Exemplo)
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
                      <span style={{ color: "#94a3b8" }}>E-mail:</span>
                      <span style={{ color: "#f1f5f9", fontWeight: 600, fontSize: "12px" }}>{samplePorteiro.email}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
                      <span style={{ color: "#94a3b8" }}>Senha:</span>
                      <span style={{ color: "#f1f5f9", fontWeight: 600 }}>{password}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
                      <span style={{ color: "#94a3b8" }}>Cargo:</span>
                      <span style={{ color: "#f1f5f9", fontWeight: 600 }}>{samplePorteiro.cargo}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCopySample("porteiro")}
                    style={{
                      width: "100%", padding: "10px", borderRadius: "8px", marginTop: "12px",
                      border: "1px solid rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.15)",
                      color: "#818cf8", fontWeight: 600, fontSize: "13px",
                      cursor: "pointer", display: "flex", alignItems: "center",
                      justifyContent: "center", gap: "6px",
                    }}
                  >
                    {copied === "porteiro" ? <Check style={{ width: "14px", height: "14px" }} /> : <Copy style={{ width: "14px", height: "14px" }} />}
                    {copied === "porteiro" ? "Copiado!" : "Copiar dados do porteiro"}
                  </button>
                </div>
              )}

              {/* ── MORADOR CARD ─── */}
              {sampleMorador && (
                <div style={{
                  background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)",
                  borderRadius: "12px", padding: "16px", marginBottom: "12px",
                }}>
                  <p style={{ fontSize: "12px", color: "#10b981", fontWeight: 700, marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    🏠 Acesso Morador (Exemplo)
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
                      <span style={{ color: "#94a3b8" }}>E-mail:</span>
                      <span style={{ color: "#f1f5f9", fontWeight: 600, fontSize: "12px" }}>{sampleMorador.email}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
                      <span style={{ color: "#94a3b8" }}>Senha:</span>
                      <span style={{ color: "#f1f5f9", fontWeight: 600 }}>{password}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
                      <span style={{ color: "#94a3b8" }}>Bloco:</span>
                      <span style={{ color: "#f1f5f9", fontWeight: 600 }}>{sampleMorador.block}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
                      <span style={{ color: "#94a3b8" }}>Apartamento:</span>
                      <span style={{ color: "#f1f5f9", fontWeight: 600 }}>{sampleMorador.unit}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCopySample("morador")}
                    style={{
                      width: "100%", padding: "10px", borderRadius: "8px", marginTop: "12px",
                      border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.15)",
                      color: "#10b981", fontWeight: 600, fontSize: "13px",
                      cursor: "pointer", display: "flex", alignItems: "center",
                      justifyContent: "center", gap: "6px",
                    }}
                  >
                    {copied === "morador" ? <Check style={{ width: "14px", height: "14px" }} /> : <Copy style={{ width: "14px", height: "14px" }} />}
                    {copied === "morador" ? "Copiado!" : "Copiar dados do morador"}
                  </button>
                </div>
              )}

              <p style={{ fontSize: "13px", color: "#94a3b8", textAlign: "center", marginBottom: "16px", lineHeight: "1.5" }}>
                Faça logout e entre com estes dados para ver como o <strong style={{ color: "#818cf8" }}>porteiro</strong> e o <strong style={{ color: "#10b981" }}>morador</strong> vêem o app. A senha é a mesma que você cadastrou.
              </p>

              {/* Continue button */}
              <button
                onClick={() => navigate("/dashboard")}
                style={{
                  width: "100%", padding: "14px", borderRadius: "10px",
                  border: "none", background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  color: "white", fontWeight: 700, fontSize: "15px",
                  cursor: "pointer", display: "flex", alignItems: "center",
                  justifyContent: "center", gap: "8px",
                }}
              >
                Entrar no Painel
                <ArrowRight style={{ width: "16px", height: "16px" }} />
              </button>
            </div>
          </div>
        </div>
      )}

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
        <div className="text-center mb-10">
          <AppLogo
            size={56}
            rounded={16}
            background="linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)"
            style={{ margin: "0 auto 16px" }}
          />
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Cadastro Condomínio
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {step === 1 ? "Dados do condomínio" : "Dados do responsável"}
          </p>
          {/* Progress */}
          <div className="flex items-center gap-2 justify-center mt-4" style={{ marginBottom: "10px" }}>
            <div className={`h-1.5 w-12 rounded-full transition-colors ${step >= 1 ? "bg-primary" : "bg-muted"}`} />
            <div className={`h-1.5 w-12 rounded-full transition-colors ${step >= 2 ? "bg-primary" : "bg-muted"}`} />
          </div>
        </div>

        {/* Form Card */}
        <div className="glass rounded-2xl shadow-2xl shadow-black/20" style={{ padding: "2.5rem 2rem 3.5rem" }}>
          <form onSubmit={handleSubmit} className="space-y-5">
            {step === 1 && (
              <>
                {/* CNPJ - primeiro campo */}
                <div className="space-y-1.5">
                  <Label htmlFor="cnpj" className="text-xs font-semibold uppercase tracking-wide text-foreground/70">CNPJ</Label>
                  <div className="relative">
                    <Input
                      id="cnpj"
                      placeholder="00.000.000/0000-00"
                      value={cnpj}
                      onChange={(e) => {
                        const formatted = formatCnpj(e.target.value);
                        setCnpj(formatted);
                        setCnpjFound(false);
                        setCnpjNotFound(false);
                        const digits = formatted.replace(/\D/g, "");
                        if (digits.length === 14) lookupCnpj(formatted);
                      }}
                    />
                    {cnpjLoading && (
                      <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
                    )}
                    {cnpjFound && !cnpjLoading && (
                      <CheckCircle2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                    )}
                  </div>
                  {cnpjLoading && (
                    <p className="text-xs text-muted-foreground animate-pulse">Buscando dados do CNPJ...</p>
                  )}
                  {cnpjFound && (
                    <p className="text-xs text-emerald-400">Dados preenchidos automaticamente!</p>
                  )}
                  {cnpjNotFound && (
                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <p className="text-xs text-amber-400">CNPJ não encontrado na base pública. Isso é comum em condomínios novos.</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Preencha os dados manualmente abaixo.</p>
                    </div>
                  )}
                </div>

                {/* Nome do Condomínio */}
                <div className="space-y-1.5">
                  <Label htmlFor="condominioName" className="text-xs font-semibold uppercase tracking-wide text-foreground/70">Nome do condomínio *</Label>
                  <Input
                    id="condominioName"
                    placeholder="Residencial Exemplo"
                    value={condominioName}
                    onChange={(e) => setCondominioName(e.target.value)}
                  />
                </div>

                {/* Endereço */}
                <div className="space-y-1.5">
                  <Label htmlFor="address" className="text-xs font-semibold uppercase tracking-wide text-foreground/70">Endereço</Label>
                  <Input
                    id="address"
                    placeholder="Rua, número"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>

                {/* Cidade / Estado */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5 col-span-2">
                    <Label htmlFor="city" className="text-xs font-semibold uppercase tracking-wide text-foreground/70">Cidade</Label>
                    <Input
                      id="city"
                      placeholder="São Paulo"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="state" className="text-xs font-semibold uppercase tracking-wide text-foreground/70">UF</Label>
                    <select
                      id="state"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="flex h-11 w-full rounded-lg border border-input bg-white dark:bg-secondary/50 pl-10 pr-3 text-sm text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary"
                    >
                      <option value="">--</option>
                      {estados.map((uf) => (
                        <option key={uf} value={uf}>{uf}</option>
                      ))}
                    </select>
                  </div>
                </div>

              </>
            )}

            {step === 2 && (
              <>
                {/* Resumo condomínio */}
                <div className="p-3 rounded-lg bg-secondary/50 space-y-1">
                  <p className="text-xs text-muted-foreground">Condomínio:</p>
                  <p className="text-sm font-medium">{condominioName}</p>
                  {address && <p className="text-xs text-muted-foreground">{address}{city ? `, ${city}` : ""}{state ? ` - ${state}` : ""}</p>}
                </div>

                {/* Nome do responsável */}
                <div className="space-y-2">
                  <Label htmlFor="adminName">Nome do responsável *</Label>
                  <Input
                    id="adminName"
                    placeholder="Síndico ou administrador"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    autoComplete="name"
                  />
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@condominio.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>

                {/* WhatsApp */}
                <div className="space-y-2">
                  <Label htmlFor="phone">WhatsApp</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(11) 99999-9999"
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    autoComplete="tel"
                  />
                </div>

                {/* Senha 6 dígitos */}
                <div className="space-y-2">
                  <Label htmlFor="password">Senha (6 dígitos) *</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="pr-10"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirmar Senha */}
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar senha *</Label>
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    autoComplete="new-password"
                  />
                </div>
              </>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm animate-fade-in">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3" style={{ marginTop: "20px" }}>
              {step === 2 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setStep(1); setError(""); }}
                  className="flex-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar
                </Button>
              )}
              {step === 1 ? (
                <Button type="button" onClick={handleNext} className="w-full">
                  Continuar
                  <ArrowRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button type="submit" disabled={isLoading} className="flex-1">
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    <>
                      Cadastrar
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </form>
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
