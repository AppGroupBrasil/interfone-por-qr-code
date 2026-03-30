import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  Building2,
  UserPlus,
  Info,
  Shield,
} from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isBlocked, setIsBlocked] = useState(false);

  // Show blocked message if user was redirected here after being blocked
  useState(() => {
    const blockedMsg = localStorage.getItem("blocked_message");
    if (blockedMsg) {
      setError(blockedMsg);
      setIsBlocked(true);
      localStorage.removeItem("blocked_message");
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email) return setError("Informe seu e-mail ou login.");
    if (!password) return setError("Informe sua senha.");
    if (!/^\d{6}$/.test(password))
      return setError("Senha deve ter 6 dígitos numéricos.");

    setIsLoading(true);
    setIsBlocked(false);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err: any) {
      const msg = err.message || "Erro ao fazer login.";
      setError(msg);
      if (msg.toLowerCase().includes("bloqueado")) setIsBlocked(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-dvh flex items-center justify-center px-6 py-4"
      style={{ background: "linear-gradient(180deg, #001028 0%, #001d4a 25%, #003580 55%, #004aad 100%)" }}
    >
      {/* Decorative glow */}
      <div style={{
        position: "fixed", top: "-30%", right: "-10%", width: "500px", height: "500px",
        borderRadius: "50%", background: "radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "fixed", bottom: "-20%", left: "-10%", width: "400px", height: "400px",
        borderRadius: "50%", background: "radial-gradient(circle, rgba(37,211,102,0.05) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div className="w-full" style={{ maxWidth: "420px", position: "relative", zIndex: 1 }}>
        {/* Card */}
        <div
          className="rounded-3xl overflow-hidden"
          style={{
            padding: "40px 36px 32px",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div style={{
              width: "100px", height: "100px", marginBottom: "28px",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <img src="/logo.png" alt="App Interfone" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight uppercase" style={{ color: "#fff" }}>
              App Interfone
            </h1>
            <p className="text-sm mt-1" style={{ color: "#fff" }}>
              Interfone Digital para Condomínios
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email ou Login */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-semibold" style={{ color: "#fff" }}>
                Email ou Login
              </Label>
              <Input
                id="email"
                type="text"
                placeholder="seu@email.com ou seulogin"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="h-12 rounded-xl pr-4"
                style={{
                  outline: "none",
                  background: "#ffffff",
                  border: "1px solid rgba(255,255,255,0.25)",
                  color: "#1e293b",
                  paddingLeft: 24,
                }}
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5" style={{ marginTop: "24px" }}>
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-semibold" style={{ color: "#fff" }}>
                  Senha
                </Label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium transition-colors"
                  style={{ color: "#fff" }}
                >
                  Esqueci a senha
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="h-12 rounded-xl pr-12"
                  style={{
                    outline: "none",
                    paddingLeft: 24,
                    background: "#ffffff",
                    border: "1px solid rgba(255,255,255,0.25)",
                    color: "#1e293b",
                  }}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: "#003580" }}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                className="flex items-start gap-3 p-4 rounded-xl text-sm"
                style={{
                  background: isBlocked ? "rgba(239,68,68,0.15)" : "rgba(239,68,68,0.1)",
                  border: isBlocked ? "2px solid rgba(239,68,68,0.4)" : "1px solid rgba(239,68,68,0.2)",
                  color: "#fca5a5",
                }}
              >
                {isBlocked ? (
                  <Shield className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#f87171" }} />
                ) : (
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#f87171" }} />
                )}
                <div>
                  {isBlocked && (
                    <p className="font-bold mb-1" style={{ color: "#f87171" }}>Acesso Bloqueado</p>
                  )}
                  <span>{error}</span>
                </div>
              </div>
            )}

            {/* Submit */}
            <div style={{ marginTop: "24px" }}>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-xl text-white font-bold text-base tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  height: "48px",
                  background: "linear-gradient(135deg, rgba(59,130,246,0.4), rgba(59,130,246,0.2))",
                  border: "1px solid rgba(255,255,255,0.25)",
                  boxShadow: "0 4px 16px rgba(59,130,246,0.15)",
                }}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Entrando...
                  </span>
                ) : (
                  "Entrar"
                )}
              </button>
            </div>
          </form>

          {/* Divider */}
          <div className="relative" style={{ marginTop: "22px", marginBottom: "12px" }}>
            <div className="absolute inset-0 flex items-center">
              <div className="w-full" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }} />
            </div>
            <div className="relative flex justify-center">
              <span className="px-4 text-sm" style={{ color: "rgba(255,255,255,0.35)", padding: "0 20px" }}>
                ou
              </span>
            </div>
          </div>

          {/* Registration buttons */}
          <div className="space-y-3" style={{ marginTop: "28px", marginBottom: "16px" }}>
            <Link to="/register/condominio" className="block">
              <button
                className="w-full rounded-xl text-white font-bold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                style={{
                  height: "46px",
                  background: "linear-gradient(135deg, rgba(59,130,246,0.3), rgba(59,130,246,0.15))",
                  border: "1px solid rgba(255,255,255,0.25)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                }}
              >
                <Building2 className="w-4.5 h-4.5" />
                Cadastrar Condomínio
              </button>
            </Link>
            <div style={{ height: "19px" }} />
            <Link to="/register/morador/search" className="block">
              <button
                className="w-full rounded-xl text-white font-bold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                style={{
                  height: "46px",
                  background: "linear-gradient(135deg, rgba(59,130,246,0.3), rgba(59,130,246,0.15))",
                  border: "1px solid rgba(255,255,255,0.25)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                }}
              >
                <UserPlus className="w-4.5 h-4.5" />
                Cadastro do Morador
              </button>
            </Link>
            <div style={{ height: "19px" }} />
            <button
              type="button"
              onClick={() => window.open("https://appinterfone.com.br", "_blank")}
              className="w-full rounded-xl font-bold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2"
              style={{
                height: "46px",
                background: "#ffffff",
                border: "1px solid rgba(255,255,255,0.25)",
                color: "#2563eb",
              }}
            >
              <Info className="w-4.5 h-4.5" />
              Conheça o Sistema
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs mt-4" style={{ color: "rgba(255,255,255,0.35)" }}>
          Ao entrar, você concorda com nossos Termos e Privacidade
        </p>
      </div>
    </div>
  );
}
