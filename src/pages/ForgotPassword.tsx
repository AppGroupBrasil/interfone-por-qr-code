import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AppLogo } from "@/components/AppLogo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Mail,
  Phone,
  ArrowLeft,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  MessageCircle,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { apiFetch } from "@/lib/api";

type Step = "request" | "verify" | "reset" | "success";
type ResetType = "email" | "phone";

export default function ForgotPassword() {
  const { p } = useTheme();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("request");
  const [type, setType] = useState<ResetType>("email");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const whatsappNumber = "5511930701054";
  const whatsappMsg = encodeURIComponent("Olá! Preciso de ajuda para recuperar minha senha no App Interfone.");

  /* ── Helpers ── */
  const formatPhone = (v: string) => {
    const n = v.replace(/\D/g, "");
    if (n.length <= 2) return n;
    if (n.length <= 7) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
    if (n.length <= 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
    return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7, 11)}`;
  };

  /* ── API calls ── */
  const requestCode = async () => {
    const clean = type === "phone" ? identifier.replace(/\D/g, "") : identifier.trim();
    const res = await apiFetch("/api/auth/password-reset/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: clean }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Erro ao solicitar recuperação.");
    }
  };

  const verifyCode = async (inputCode: string) => {
    const clean = type === "phone" ? identifier.replace(/\D/g, "") : identifier.trim();
    const res = await apiFetch("/api/auth/password-reset/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: clean, code: inputCode }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Código inválido.");
    }
  };

  const resetPassword = async () => {
    const clean = type === "phone" ? identifier.replace(/\D/g, "") : identifier.trim();
    const res = await apiFetch("/api/auth/password-reset/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: clean, code, newPassword }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Erro ao redefinir senha.");
    }
  };

  /* ── Handlers ── */
  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const clean = type === "phone" ? identifier.replace(/\D/g, "") : identifier.trim();
    if (!clean) return setError(`Informe seu ${type === "email" ? "e-mail" : "telefone"}.`);
    if (type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return setError("E-mail inválido.");
    if (type === "phone" && clean.length < 10) return setError("Telefone inválido.");

    setIsLoading(true);
    try {
      await requestCode();
      setStep("verify");
    } catch (err: any) {
      setError(err.message || "Erro ao solicitar recuperação.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (code.length !== 6) return setError("O código deve ter 6 dígitos.");

    setIsLoading(true);
    try {
      await verifyCode(code);
      setStep("reset");
    } catch (err: any) {
      setError(err.message || "Código inválido.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(newPassword)) return setError("A senha deve ter 6 dígitos numéricos.");
    if (newPassword !== confirmPassword) return setError("As senhas não coincidem.");

    setIsLoading(true);
    try {
      await resetPassword();
      setStep("success");
    } catch (err: any) {
      setError(err.message || "Erro ao redefinir senha.");
    } finally {
      setIsLoading(false);
    }
  };

  /* ── Shared styles ── */
  const cardStyle: React.CSSProperties = {
    background: "#ffffff",
    borderRadius: "24px",
    boxShadow: "0 20px 60px rgba(0,53,128,0.12)",
    padding: "40px 36px 32px",
    width: "100%",
    maxWidth: "420px",
  };
  const btnPrimary: React.CSSProperties = {
    width: "100%",
    height: "48px",
    borderRadius: "14px",
    border: "none",
    background: "linear-gradient(135deg, #003580 0%, #0056d2 100%)",
    color: "#fff",
    fontWeight: 700,
    fontSize: "15px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    transition: "opacity 0.2s",
  };
  const btnOutline: React.CSSProperties = {
    ...btnPrimary,
    background: "transparent",
    border: "2px solid #003580",
    color: "#003580",
  };
  const errorBox: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px 14px",
    background: "rgba(239,68,68,0.08)",
    border: "1px solid rgba(239,68,68,0.2)",
    borderRadius: "12px",
    color: "#dc2626",
    fontSize: "13px",
    marginTop: "12px",
  };
  const tabBtn = (active: boolean): React.CSSProperties => ({
    flex: 1,
    height: "42px",
    borderRadius: "12px",
    border: "none",
    background: active ? "#003580" : "rgba(0,53,128,0.06)",
    color: active ? "#fff" : "#003580",
    fontWeight: 600,
    fontSize: "14px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    transition: "all 0.2s",
  });
  const inputWrap: React.CSSProperties = { position: "relative", marginTop: "16px" };
  const iconLeft: React.CSSProperties = {
    position: "absolute",
    left: "14px",
    top: "50%",
    transform: "translateY(-50%)",
    color: "#94a3b8",
    width: "18px",
    height: "18px",
    pointerEvents: "none",
  };

  const stepIndicator = (
    <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginBottom: "28px" }}>
      {(["request", "verify", "reset", "success"] as Step[]).map((s, i) => (
        <div
          key={s}
          style={{
            width: step === s ? "28px" : "10px",
            height: "10px",
            borderRadius: "5px",
            background:
              (["request", "verify", "reset", "success"] as Step[]).indexOf(step) >= i
                ? "#003580"
                : "rgba(0,53,128,0.15)",
            transition: "all 0.3s",
          }}
        />
      ))}
    </div>
  );

  return (
    <div
      className="min-h-dvh flex items-center justify-center px-6 py-4"
      style={{ background: "linear-gradient(135deg, #e3f2fd 0%, #e8eaf6 50%, #e3f2fd 100%)" }}
    >
      <div style={cardStyle}>
        {/* Logo */}
        <div className="text-center" style={{ marginBottom: "28px" }}>
          <AppLogo
            size={64}
            rounded={18}
            background="linear-gradient(135deg, #003580, #0056d2)"
            style={{ margin: "0 auto 16px", boxShadow: "0 8px 24px rgba(0,53,128,0.25)" }}
          />
          <h1 style={{ fontSize: "22px", fontWeight: 800, color: "#111827", marginBottom: "4px" }}>
            {step === "request" && "Recuperar Senha"}
            {step === "verify" && "Verificar Código"}
            {step === "reset" && "Nova Senha"}
            {step === "success" && "Tudo Pronto!"}
          </h1>
          <p style={{ fontSize: "14px", color: "#6b7280" }}>
            {step === "request" && "Informe seu e-mail ou telefone cadastrado"}
            {step === "verify" && "Digite o código de 6 dígitos que foi enviado"}
            {step === "reset" && "Escolha sua nova senha de 6 dígitos"}
            {step === "success" && "Sua senha foi redefinida com sucesso"}
          </p>
        </div>

        {stepIndicator}

        {/* ───── STEP 1: Request ───── */}
        {step === "request" && (
          <form onSubmit={handleRequest}>
            {/* Tabs */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
              <button type="button" style={tabBtn(type === "email")} onClick={() => { setType("email"); setIdentifier(""); setError(""); }}>
                <Mail style={{ width: "16px", height: "16px" }} /> E-mail
              </button>
              <button type="button" style={tabBtn(type === "phone")} onClick={() => { setType("phone"); setIdentifier(""); setError(""); }}>
                <Phone style={{ width: "16px", height: "16px" }} /> Telefone
              </button>
            </div>

            <div style={inputWrap}>
              {type === "email" ? (
                <>
                  <Label htmlFor="fp-email" className="text-sm font-semibold text-gray-700">E-mail</Label>
                  <div style={{ position: "relative", marginTop: "6px" }}>
                    <Mail style={iconLeft} />
                    <Input
                      id="fp-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="h-12 rounded-xl bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-[#2d3354] focus:ring-[#2d3354]"
                      style={{ paddingLeft: "42px" }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <Label htmlFor="fp-phone" className="text-sm font-semibold text-gray-700">Telefone</Label>
                  <div style={{ position: "relative", marginTop: "6px" }}>
                    <Phone style={iconLeft} />
                    <Input
                      id="fp-phone"
                      type="tel"
                      placeholder="(11) 99999-9999"
                      value={identifier}
                      onChange={(e) => setIdentifier(formatPhone(e.target.value))}
                      className="h-12 rounded-xl bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-[#2d3354] focus:ring-[#2d3354]"
                      style={{ paddingLeft: "42px" }}
                    />
                  </div>
                </>
              )}
            </div>

            {error && (
              <div style={errorBox}>
                <AlertCircle style={{ width: "16px", height: "16px", flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={isLoading} style={{ ...btnPrimary, marginTop: "20px", opacity: isLoading ? 0.7 : 1 }}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Enviar código <ArrowRight style={{ width: "16px", height: "16px" }} /></>}
            </button>
          </form>
        )}

        {/* ───── STEP 2: Verify ───── */}
        {step === "verify" && (
          <form onSubmit={handleVerify}>
            <div style={{ textAlign: "center" }}>
              <Label htmlFor="fp-code" className="text-sm font-semibold text-gray-700">Código de verificação</Label>
              <Input
                id="fp-code"
                type="text"
                inputMode="numeric"
                placeholder="000000"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="h-14 rounded-xl bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-[#2d3354] focus:ring-[#2d3354]"
                style={{ textAlign: "center", fontSize: "24px", letterSpacing: "0.3em", marginTop: "8px" }}
              />
              <p style={{ fontSize: "12px", color: "#9ca3af", marginTop: "8px" }}>
                Enviado para {type === "email" ? "seu e-mail" : "seu telefone"}
              </p>
            </div>

            {error && (
              <div style={errorBox}>
                <AlertCircle style={{ width: "16px", height: "16px", flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
              <button type="button" style={{ ...btnOutline, flex: 1 }} onClick={() => { setStep("request"); setCode(""); setError(""); }}>
                <ArrowLeft style={{ width: "16px", height: "16px" }} /> Voltar
              </button>
              <button type="submit" disabled={isLoading || code.length !== 6} style={{ ...btnPrimary, flex: 1, opacity: isLoading || code.length !== 6 ? 0.6 : 1 }}>
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Verificar <ArrowRight style={{ width: "16px", height: "16px" }} /></>}
              </button>
            </div>

            <button
              type="button"
              onClick={(e) => { setError(""); setCode(""); handleRequest(e as any); }}
              style={{ width: "100%", marginTop: "14px", background: "none", border: "none", color: "#2d3354", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
            >
              Reenviar código
            </button>
          </form>
        )}

        {/* ───── STEP 3: Reset ───── */}
        {step === "reset" && (
          <form onSubmit={handleReset}>
            <div style={{ marginBottom: "16px" }}>
              <Label htmlFor="fp-new" className="text-sm font-semibold text-gray-700">Nova senha (6 dígitos)</Label>
              <div style={{ position: "relative", marginTop: "6px" }}>
                <Lock style={iconLeft} />
                <Input
                  id="fp-new"
                  type={showPassword ? "text" : "password"}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="h-12 rounded-xl bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-[#2d3354] focus:ring-[#2d3354]"
                  style={{ paddingLeft: "42px", paddingRight: "42px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="fp-confirm" className="text-sm font-semibold text-gray-700">Confirmar senha</Label>
              <div style={{ position: "relative", marginTop: "6px" }}>
                <Lock style={iconLeft} />
                <Input
                  id="fp-confirm"
                  type={showConfirm ? "text" : "password"}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="h-12 rounded-xl bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-[#2d3354] focus:ring-[#2d3354]"
                  style={{ paddingLeft: "42px", paddingRight: "42px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}
                >
                  {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div style={errorBox}>
                <AlertCircle style={{ width: "16px", height: "16px", flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={isLoading} style={{ ...btnPrimary, marginTop: "20px", opacity: isLoading ? 0.7 : 1 }}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Redefinir senha <ArrowRight style={{ width: "16px", height: "16px" }} /></>}
            </button>
          </form>
        )}

        {/* ───── STEP 4: Success ───── */}
        {step === "success" && (
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                background: "rgba(16,185,129,0.12)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "16px",
              }}
            >
              <CheckCircle2 style={{ width: "36px", height: "36px", color: "#10b981" }} />
            </div>
            <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#111827", marginBottom: "6px" }}>
              Senha redefinida!
            </h3>
            <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "24px" }}>
              Sua senha foi alterada com sucesso. Agora você pode fazer login com sua nova senha.
            </p>
            <button style={btnPrimary} onClick={() => navigate("/login")}>
              Ir para o login <ArrowRight style={{ width: "16px", height: "16px" }} />
            </button>
          </div>
        )}

        {/* WhatsApp suporte */}
        {step !== "success" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "24px 0" }}>
              <div style={{ flex: 1, height: "1px", background: "rgba(0,53,128,0.1)" }} />
              <span style={{ fontSize: "11px", color: "#9ca3af", textTransform: "uppercase", fontWeight: 600 }}>ou</span>
              <div style={{ flex: 1, height: "1px", background: "rgba(0,53,128,0.1)" }} />
            </div>
            <a
              href={`https://wa.me/${whatsappNumber}?text=${whatsappMsg}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                width: "100%",
                height: "44px",
                borderRadius: "14px",
                background: "#16a34a",
                color: p.text,
                fontWeight: 600,
                fontSize: "14px",
                textDecoration: "none",
                transition: "opacity 0.2s",
              }}
            >
              <MessageCircle style={{ width: "18px", height: "18px" }} />
              Falar com suporte
            </a>
          </>
        )}

        {/* Voltar ao login */}
        <p style={{ textAlign: "center", fontSize: "13px", color: "#6b7280", marginTop: "20px" }}>
          Lembrou sua senha?{" "}
          <Link to="/login" style={{ color: "#003580", fontWeight: 600, textDecoration: "none" }}>
            Fazer login
          </Link>
        </p>
      </div>
    </div>
  );
}
