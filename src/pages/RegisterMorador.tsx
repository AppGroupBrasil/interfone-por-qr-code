import { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
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
  Building2,
  MessageCircle,
  CheckCircle2,
} from "lucide-react";

import { apiFetch } from "@/lib/api";

interface LocationState {
  condominioId: number;
  condominioName: string;
  blocks: string[];
}

export default function RegisterMorador() {
  const navigate = useNavigate();
  const location = useLocation();
  const { registerMorador } = useAuth();

  const state = location.state as LocationState | null;

  // Redirect if no condominio data
  if (!state?.condominioId) {
    navigate("/register/morador/search", { replace: true });
    return null;
  }

  const { condominioId, condominioName, blocks: condoBlocks } = state;

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [perfil, setPerfil] = useState("");
  const [unit, setUnit] = useState("");
  const [block, setBlock] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // WhatsApp prompt state
  const [showWhatsappPrompt, setShowWhatsappPrompt] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);

  // Fetch WhatsApp config on mount
  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await apiFetch(`/api/condominio-config/public?condominio_id=${condominioId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.notify_whatsapp_enabled === "true" && data.notify_whatsapp_phone) {
            setWhatsappEnabled(true);
            setWhatsappPhone(data.notify_whatsapp_phone);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar config WhatsApp:", err);
      }
    }
    loadConfig();
  }, [condominioId]);

  // Formatações
  const formatPhone = (value: string) => {
    const n = value.replace(/\D/g, "");
    if (n.length <= 2) return n;
    if (n.length <= 7) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
    if (n.length <= 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
    return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7, 11)}`;
  };

  const validateStep1 = () => {
    if (!name.trim()) return "Informe seu nome.";
    if (phone && phone.replace(/\D/g, "").length < 10) return "WhatsApp inválido.";
    return null;
  };

  const validateStep2 = () => {
    if (!email) return "Informe seu e-mail.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "E-mail inválido.";
    if (email !== confirmEmail) return "Os e-mails não coincidem.";
    if (!/^\d{6}$/.test(password)) return "A senha deve ter exatamente 6 números.";
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
      await registerMorador({
        name: name.trim(),
        email,
        phone: phone || undefined,
        perfil: perfil || undefined,
        password,
        unit: unit || undefined,
        block: block || undefined,
        condominioId,
      });
      navigate("/dashboard");
    } catch (err: any) {
      if (err.message === "__PENDING_APPROVAL__") {
        setError("");
        if (whatsappEnabled && whatsappPhone) {
          // Show WhatsApp prompt
          setShowWhatsappPrompt(true);
        } else {
          alert("Cadastro realizado com sucesso! Aguarde a aprovação do síndico ou administradora para acessar o sistema.");
          navigate("/login");
        }
        return;
      }
      setError(err.message || "Erro ao criar conta.");
    } finally {
      setIsLoading(false);
    }
  };

  // Build WhatsApp message and open link
  const handleWhatsappSolicitacao = () => {
    // Clean phone to digits only
    const cleanPhone = whatsappPhone.replace(/\D/g, "");
    // Build country code if needed (Brazil default)
    const phoneWithCountry = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    
    const message = `Olá! Sou *${name.trim()}*${block ? `, Bloco ${block}` : ""}${unit ? `, Unidade ${unit}` : ""} do condomínio *${condominioName}*.\n\nAcabei de realizar meu cadastro no sistema e gostaria de solicitar a *liberação do meu acesso*.\n\nE-mail cadastrado: ${email}\n\nAguardo a aprovação. Obrigado!`;
    
    const encodedMsg = encodeURIComponent(message);
    window.open(`https://wa.me/${phoneWithCountry}?text=${encodedMsg}`, "_blank");
    
    // Navigate to login after opening WhatsApp
    setTimeout(() => navigate("/login"), 1000);
  };

  // WhatsApp prompt screen
  if (showWhatsappPrompt) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -right-32 w-64 h-64 rounded-full bg-primary/8 blur-3xl animate-pulse" />
          <div className="absolute -bottom-32 -left-32 w-72 h-72 rounded-full bg-primary/5 blur-3xl" />
        </div>

        <div className="w-full max-w-sm relative z-10 animate-slide-up">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/20 mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              Cadastro Realizado!
            </h1>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              Seu cadastro foi enviado com sucesso. Aguarde a aprovação do síndico ou administradora para acessar o sistema.
            </p>
          </div>

          <div className="glass rounded-2xl p-6 shadow-2xl shadow-black/20">
            <div className="text-center mb-5">
              <MessageCircle className="w-10 h-10 mx-auto mb-3" style={{ color: "#25D366" }} />
              <p className="text-lg font-bold text-foreground">
                Gostaria de solicitar a liberação do seu cadastro?
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Envie uma mensagem direta via WhatsApp para o síndico/administradora solicitando a liberação mais rápida do seu acesso.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleWhatsappSolicitacao}
                className="w-full h-12 rounded-xl text-white text-base font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-[0.98]"
                style={{ backgroundColor: "#25D366" }}
              >
                <MessageCircle className="w-5 h-5" />
                Solicitar via WhatsApp
              </button>
              <button
                onClick={() => navigate("/login")}
                className="w-full h-10 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Não, vou aguardar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
          <AppLogo
            size={56}
            rounded={16}
            background="linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)"
            style={{ margin: "0 auto 19px" }}
          />
          <h1 className="text-2xl font-bold text-foreground tracking-tight" style={{ marginBottom: "19px" }}>
            Cadastro Morador
          </h1>
          <p className="text-sm text-muted-foreground">
            {step === 1 ? "Dados pessoais" : "E-mail e senha de acesso"}
          </p>
          {/* Condomínio Badge */}
          <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full bg-secondary/60">
            <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{condominioName}</span>
          </div>
          {/* Progress */}
          <div className="flex items-center gap-2 justify-center mt-4">
            <div className={`h-1.5 w-12 rounded-full transition-colors ${step >= 1 ? "bg-primary" : "bg-muted"}`} />
            <div className={`h-1.5 w-12 rounded-full transition-colors ${step >= 2 ? "bg-primary" : "bg-muted"}`} />
          </div>
        </div>

        {/* Form Card */}
        <div className="glass rounded-2xl p-6 shadow-2xl shadow-black/20">
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "19px" }}>
            {step === 1 && (
              <>
                {/* Nome */}
                <div className="space-y-2">
                  <Label htmlFor="name">Nome completo *</Label>
                  <Input
                    id="name"
                    placeholder="Seu nome completo"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                  />
                </div>

                {/* Bloco / Unidade */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="block">Bloco / Torre</Label>
                    {condoBlocks.length > 0 ? (
                      <select
                        id="block"
                        value={block}
                        onChange={(e) => setBlock(e.target.value)}
                        className="flex h-11 w-full rounded-lg border border-input bg-white dark:bg-secondary/50 px-3 text-sm text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary"
                      >
                        <option value="">Selecione</option>
                        {condoBlocks.map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        id="block"
                        placeholder="Ex: A"
                        value={block}
                        onChange={(e) => setBlock(e.target.value)}
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unit">Unidade / Apto</Label>
                    <Input
                      id="unit"
                      placeholder="Ex: 101"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                    />
                  </div>
                </div>

                {/* Perfil */}
                <div className="space-y-2">
                  <Label htmlFor="perfil">Perfil</Label>
                  <select
                    id="perfil"
                    value={perfil}
                    onChange={(e) => setPerfil(e.target.value)}
                    className="flex h-11 w-full rounded-lg border border-input bg-white dark:bg-secondary/50 px-3 text-sm text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary"
                  >
                    <option value="">Selecione seu perfil</option>
                    <option value="proprietario">Proprietário</option>
                    <option value="locatario">Locatário</option>
                    <option value="dependente">Dependente</option>
                    <option value="funcionario">Funcionário</option>
                    <option value="locatario_temporario">Locatário Temporário (AirBnB)</option>
                  </select>
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
              </>
            )}

            {step === 2 && (
              <>
                {/* Resumo */}
                <div className="p-3 rounded-lg bg-secondary/50 space-y-1">
                  <p className="text-xs text-muted-foreground">Cadastrando como:</p>
                  <p className="text-sm font-medium">{name}</p>
                  {block && <p className="text-xs text-muted-foreground">{block}{unit ? ` • Apto ${unit}` : ""}</p>}
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>

                {/* Confirmar Email */}
                <div className="space-y-2">
                  <Label htmlFor="confirmEmail">Confirmar e-mail *</Label>
                  <Input
                    id="confirmEmail"
                    type="email"
                    placeholder="Repita seu e-mail"
                    value={confirmEmail}
                    onChange={(e) => setConfirmEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>

                {/* Senha */}
                <div className="space-y-2">
                  <Label htmlFor="password">Senha (6 dígitos) *</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="000000"
                      value={password}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                        setPassword(v);
                      }}
                      inputMode="numeric"
                      maxLength={6}
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
                    placeholder="Repita os 6 dígitos"
                    value={confirmPassword}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                      setConfirmPassword(v);
                    }}
                    inputMode="numeric"
                    maxLength={6}
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
            <div className="flex gap-3 pt-1">
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
                      Criar conta
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
