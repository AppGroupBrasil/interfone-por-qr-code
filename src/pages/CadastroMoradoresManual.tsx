import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLogo } from "@/components/AppLogo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import TutorialButton, { TSection, TStep, TBullet } from "@/components/TutorialButton";
import {
  ChevronLeft,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";

const perfis = [
  "Proprietário",
  "Locatário",
  "Dependente",
  "Funcionário",
  "Locatário Temporário AirBnB",
];

interface Bloco {
  id: number;
  name: string;
}

interface Condominio {
  id: number;
  name: string;
}

export default function CadastroMoradoresManual() {
  const { isDark, p } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [nome, setNome] = useState("");
  const [bloco, setBloco] = useState("");
  const [unidade, setUnidade] = useState("");
  const [perfil, setPerfil] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [blocos, setBlocos] = useState<Bloco[]>([]);
  const [condominios, setCondominios] = useState<Condominio[]>([]);
  const [formCondominioId, setFormCondominioId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [modalData, setModalData] = useState<{ nome: string; bloco: string; unidade: string; perfil: string; email: string } | null>(null);

  // Carregar blocos cadastrados
  useEffect(() => {
    apiFetch("/api/blocos")
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data)) setBlocos(data); })
      .catch(() => {});
    // Carregar condomínios para administradora/master
    if (user?.role === "administradora" || user?.role === "master") {
      apiFetch("/api/condominios")
        .then((res) => res.json())
        .then((data) => { if (Array.isArray(data)) setCondominios(data); })
        .catch(() => {});
    }
  }, []);

  const formatPhone = (value: string) => {
    const n = value.replace(/\D/g, "");
    if (n.length <= 2) return n;
    if (n.length <= 7) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
    if (n.length <= 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
    return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7, 11)}`;
  };

  const validate = () => {
    if (!nome.trim()) return "Informe o nome completo.";
    if (!bloco) return "Selecione o bloco.";
    if (!unidade.trim()) return "Informe a unidade/apto.";
    if (!perfil) return "Selecione o perfil.";
    if (!email.trim()) return "Informe o e-mail.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "E-mail inválido.";
    if (email.toLowerCase() !== confirmEmail.toLowerCase()) return "Os e-mails não coincidem.";
    if (!/^\d{6}$/.test(password)) return "Senha deve ter exatamente 6 dígitos numéricos.";
    if (password !== confirmPassword) return "As senhas não coincidem.";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const err = validate();
    if (err) return setError(err);

    setIsLoading(true);
    try {
      const res = await apiFetch("/api/moradores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(),
          bloco,
          unidade: unidade.trim(),
          perfil,
          whatsapp: whatsapp || undefined,
          email: email.trim().toLowerCase(),
          password,
          condominioId: formCondominioId ? parseInt(formCondominioId) : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao cadastrar.");

      setModalData({ nome: nome.trim(), bloco, unidade: unidade.trim(), perfil, email: email.trim().toLowerCase() });
      setSuccess("ok");
      setNome("");
      setBloco("");
      setUnidade("");
      setPerfil("");
      setWhatsapp("");
      setEmail("");
      setConfirmEmail("");
      setPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setError(err.message || "Erro ao cadastrar morador.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: p.pageBg }}>
      {/* Header */}
      <header className="sticky top-0 z-40" style={{ background: p.headerBg, borderBottom: p.headerBorder, boxShadow: p.headerShadow, color: p.text }}>
        <div style={{ height: "4.5rem", display: "flex", alignItems: "center", gap: 12, paddingLeft: "1rem", paddingRight: "1rem" }}>
          <button onClick={() => navigate("/cadastros/moradores")} style={{ width: 40, height: 40, borderRadius: 12, background: p.btnBg, border: p.btnBorder, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: p.text }}>
            <ChevronLeft className="w-6 h-6" />
          </button>
          <span style={{ fontWeight: 700, fontSize: 18 }}>Cadastro Manual</span>
          <div style={{ marginLeft: "auto" }}>
            <TutorialButton title="Cadastro Manual de Moradores">
              <TSection icon={<span>📋</span>} title="O QUE É ESTA FUNÇÃO?">
                <p>Cadastre moradores <strong>um por um</strong> preenchendo o formulário completo. Ideal quando você precisa cadastrar poucos moradores ou quer conferir cada dado pessoalmente. É o método mais detalhado e com controle total.</p>
              </TSection>
              <TSection icon={<span>🏗️</span>} title="PASSO A PASSO">
                <TStep n={1}>Preencha o <strong>nome completo</strong> do morador (nome + sobrenome)</TStep>
                <TStep n={2}>Selecione o <strong>bloco</strong> na lista (os blocos precisam estar cadastrados antes)</TStep>
                <TStep n={3}>Informe a <strong>unidade/apartamento</strong> (ex: 101, 202, Casa 3)</TStep>
                <TStep n={4}>Selecione o <strong>perfil</strong>: Proprietário, Locatário, Familiar ou Morador</TStep>
                <TStep n={5}>Informe o <strong>WhatsApp</strong> com DDD (ex: 11999998888) — usado para notificações automáticas</TStep>
                <TStep n={6}>Informe o <strong>e-mail</strong> — será o login do morador no app</TStep>
                <TStep n={7}>Defina uma <strong>senha de 6 dígitos</strong> — o morador usará para entrar no app</TStep>
                <TStep n={8}>Clique em <strong>"Cadastrar"</strong> para finalizar</TStep>
                <p style={{ marginTop: "8px", fontSize: "13px", color: "#2d3354" }}>👉 Após o cadastro, o morador já pode acessar o app com e-mail + senha.</p>
              </TSection>
              <TSection icon={<span>📱</span>} title="CAMPOS DO FORMULÁRIO">
                <TBullet><strong>Nome completo *</strong> — Nome e sobrenome do morador</TBullet>
                <TBullet><strong>Bloco *</strong> — Selecione da lista (cadastre blocos antes caso não apareçam)</TBullet>
                <TBullet><strong>Unidade *</strong> — Número do apartamento ou casa</TBullet>
                <TBullet><strong>Perfil *</strong> — Proprietário, Locatário, Familiar ou Morador</TBullet>
                <TBullet><strong>WhatsApp *</strong> — Número com DDD para notificações de delivery, correspondência, visitante</TBullet>
                <TBullet><strong>E-mail *</strong> — Login do morador no app (deve ser único)</TBullet>
                <TBullet><strong>Senha *</strong> — 6 dígitos numéricos</TBullet>
              </TSection>
              <TSection icon={<span>⭐</span>} title="DICAS IMPORTANTES">
                <TBullet>Campos com <strong>*</strong> são obrigatórios — não é possível cadastrar sem preenchê-los</TBullet>
                <TBullet>O <strong>e-mail</strong> deve ser único — cada morador precisa ter um e-mail diferente</TBullet>
                <TBullet>O <strong>WhatsApp</strong> é essencial — é por ele que o morador recebe avisos de encomendas, visitantes e entregas</TBullet>
                <TBullet>Se errou algum dado, não se preocupe — você pode <strong>editar depois</strong> na lista de moradores</TBullet>
                <TBullet>Para cadastrar <strong>muitos moradores</strong> de uma vez, use o método "Planilha" que é mais rápido</TBullet>
              </TSection>
            </TutorialButton>
          </div>
        </div>
      </header>

      {/* Form */}
      <main className="flex-1" style={{ paddingLeft: "1rem", paddingRight: "1rem", paddingTop: "1.5rem", paddingBottom: "3.5rem" }}>
        <div>
          <div className="rounded-2xl">
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {/* Condomínio (administradora/master) */}
              {(user?.role === "administradora" || user?.role === "master") && condominios.length > 0 && (
                <div style={{ marginBottom: "19px" }}>
                  <Label style={{ display: "block", marginBottom: "4px", color: isDark ? "#ffffff" : undefined }}>Condomínio *</Label>
                  <select
                    value={formCondominioId}
                    onChange={(e) => setFormCondominioId(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    style={{ backgroundColor: "#ffffff", color: "#000000" }}
                  >
                    <option value="">Selecione o condomínio</option>
                    {condominios.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Nome */}
              <div style={{ marginBottom: "19px" }}>
                <Label htmlFor="nome" style={{ display: "block", marginBottom: "4px", color: isDark ? "#ffffff" : undefined }}>Nome completo *</Label>
                <Input
                  id="nome"
                  placeholder="Ex: João da Silva"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  style={{ paddingLeft: "24px" }}
                />
              </div>

              {/* Bloco + Unidade */}
              <div style={{ display: "flex", gap: "12px", marginBottom: "19px" }}>
                <div style={{ flex: 1 }}>
                  <Label htmlFor="bloco" style={{ display: "block", marginBottom: "4px", color: isDark ? "#ffffff" : undefined }}>Bloco / Torre *</Label>
                  {blocos.length > 0 ? (
                    <select
                      id="bloco"
                      value={bloco}
                      onChange={(e) => setBloco(e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      style={{ backgroundColor: "#ffffff", color: "#000000" }}
                    >
                      <option value="">Selecione o bloco</option>
                      {blocos.map((b) => (
                        <option key={b.id} value={b.name}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div>
                      <Input
                        id="bloco"
                        placeholder="Ex: Bloco A, Torre 1..."
                        value={bloco}
                        onChange={(e) => setBloco(e.target.value)}
                        style={{ paddingLeft: "24px" }}
                      />
                      <p className="text-[11px] text-amber-400" style={{ marginTop: "4px" }}>
                        Nenhum bloco cadastrado.
                      </p>
                    </div>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <Label htmlFor="unidade" style={{ display: "block", marginBottom: "4px", color: isDark ? "#ffffff" : undefined }}>Unidade / Apto *</Label>
                  <Input
                    id="unidade"
                    placeholder="Ex: 101, Casa 5..."
                    value={unidade}
                    onChange={(e) => setUnidade(e.target.value)}
                    style={{ paddingLeft: "24px" }}
                  />
                </div>
              </div>

              {/* Perfil + WhatsApp */}
              <div style={{ display: "flex", gap: "12px", marginBottom: "19px" }}>
                <div style={{ flex: 1 }}>
                  <Label htmlFor="perfil" style={{ display: "block", marginBottom: "4px", color: isDark ? "#ffffff" : undefined }}>Perfil *</Label>
                  <select
                    id="perfil"
                    value={perfil}
                    onChange={(e) => setPerfil(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    style={{ backgroundColor: "#ffffff", color: "#000000" }}
                  >
                    <option value="">Selecione o perfil</option>
                    {perfis.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <Label htmlFor="whatsapp" style={{ display: "block", marginBottom: "4px", color: isDark ? "#ffffff" : undefined }}>WhatsApp</Label>
                  <Input
                    id="whatsapp"
                    type="tel"
                    placeholder="(11) 99999-9999"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(formatPhone(e.target.value))}
                    style={{ paddingLeft: "24px" }}
                  />
                </div>
              </div>

              {/* E-mail + Confirmar E-mail */}
              <div style={{ display: "flex", gap: "12px", marginBottom: "19px" }}>
                <div style={{ flex: 1 }}>
                  <Label htmlFor="email" style={{ display: "block", marginBottom: "4px", color: isDark ? "#ffffff" : undefined }}>E-mail *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="morador@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{ paddingLeft: "24px" }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <Label htmlFor="confirmEmail" style={{ display: "block", marginBottom: "4px", color: isDark ? "#ffffff" : undefined }}>Confirmar e-mail *</Label>
                  <Input
                    id="confirmEmail"
                    type="email"
                    placeholder="Repita o e-mail"
                    value={confirmEmail}
                    onChange={(e) => setConfirmEmail(e.target.value)}
                    style={{ paddingLeft: "24px" }}
                  />
                </div>
              </div>

              {/* Senha + Confirmar Senha */}
              <div style={{ display: "flex", gap: "12px", marginBottom: "19px" }}>
                <div style={{ flex: 1 }}>
                  <Label htmlFor="password" style={{ display: "block", marginBottom: "4px", color: isDark ? "#ffffff" : undefined }}>Senha (6 dígitos) *</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="••••••"
                      value={password}
                      onChange={(e) =>
                        setPassword(e.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      className="pr-10"
                      style={{ paddingLeft: "24px" }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors hover:[color:#003580]"
                      style={{ color: "#64748b" }}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <Label htmlFor="confirmPassword" style={{ display: "block", marginBottom: "4px", color: isDark ? "#ffffff" : undefined }}>Confirmar senha *</Label>
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="••••••"
                    value={confirmPassword}
                    onChange={(e) =>
                      setConfirmPassword(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    style={{ paddingLeft: "24px" }}
                  />
                </div>
              </div>

              {/* Error Modal */}
              {error && (
                <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }} onClick={() => setError("")}>
                  <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }} />
                  <div onClick={(e) => e.stopPropagation()} className="animate-fade-in" style={{ position: "relative", width: "100%", maxWidth: 380, borderRadius: 20, background: "linear-gradient(180deg, #001d4a 0%, #00275e 50%, #003580 100%)", border: "1px solid rgba(255,255,255,0.15)", boxShadow: "0 25px 60px rgba(0,0,0,0.5), 0 0 40px rgba(0,53,128,0.3)", padding: "2.5rem 2rem 2rem", textAlign: "center" }}>
                    <button onClick={() => setError("")} style={{ position: "absolute", top: 14, right: 14, color: "rgba(255,255,255,0.5)", cursor: "pointer", background: "none", border: "none" }}><X className="w-5 h-5" /></button>
                    <div style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem", boxShadow: "0 8px 24px rgba(239,68,68,0.35)" }}>
                      <AlertCircle className="w-9 h-9 text-white" strokeWidth={2} />
                    </div>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: "#ffffff", marginBottom: 8 }}>Atenção</h2>
                    <p style={{ fontSize: 15, color: "rgba(255,255,255,0.8)", marginBottom: 28, lineHeight: 1.5 }}>{error}</p>
                    <button onClick={() => setError("")} style={{ width: "100%", height: 46, borderRadius: 12, border: "none", background: "#ffffff", color: "#003580", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Entendi</button>
                  </div>
                </div>
              )}



              {/* Submit */}
              <Button
                type="submit"
                className="w-full h-12 font-semibold"
                disabled={isLoading}
                style={isDark ? { marginTop: "1rem", backgroundColor: "#ffffff", color: "#003580", border: "2px solid #ffffff" } : { marginTop: "1rem" }}
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                ) : (
                  "Cadastrar Morador"
                )}
              </Button>
            </form>
          </div>
        </div>
      </main>

      {/* Modal de Confirmação Premium */}
      {modalData && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
          onClick={() => setModalData(null)}
        >
          {/* Backdrop */}
          <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }} />

          {/* Card */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-fade-in"
            style={{
              position: "relative",
              width: "100%",
              maxWidth: 420,
              borderRadius: 20,
              background: "linear-gradient(180deg, #001d4a 0%, #00275e 50%, #003580 100%)",
              border: "1px solid rgba(255,255,255,0.15)",
              boxShadow: "0 25px 60px rgba(0,0,0,0.5), 0 0 40px rgba(0,53,128,0.3)",
              padding: "2.5rem 2rem 2rem",
              textAlign: "center",
            }}
          >
            {/* Close button */}
            <button
              onClick={() => setModalData(null)}
              style={{ position: "absolute", top: 14, right: 14, color: "rgba(255,255,255,0.5)", cursor: "pointer", background: "none", border: "none" }}
            >
              <X className="w-5 h-5" />
            </button>

            {/* Icon */}
            <AppLogo
              size={72}
              rounded={999}
              background="linear-gradient(135deg, #10b981 0%, #059669 100%)"
              style={{ margin: "0 auto 1.25rem", boxShadow: "0 8px 24px rgba(16,185,129,0.35)" }}
            />

            {/* Title */}
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#ffffff", marginBottom: 6 }}>Morador Cadastrado!</h2>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", marginBottom: 24 }}>O morador já pode acessar o app.</p>

            {/* Info rows */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
              {[
                { label: "Nome", value: modalData.nome },
                { label: "Bloco", value: modalData.bloco },
                { label: "Unidade", value: modalData.unidade },
                { label: "Perfil", value: modalData.perfil },
                { label: "E-mail", value: modalData.email },
              ].map((row) => (
                <div key={row.label} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 16px", borderRadius: 10,
                  backgroundColor: "rgba(255,255,255,0.07)",
                }}>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>{row.label}</span>
                  <span style={{ fontSize: 14, color: "#ffffff", fontWeight: 600, textAlign: "right", maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.value}</span>
                </div>
              ))}
            </div>

            {/* Buttons */}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setModalData(null)}
                style={{
                  flex: 1, height: 46, borderRadius: 12,
                  border: "2px solid rgba(255,255,255,0.2)", background: "transparent",
                  color: "#ffffff", fontWeight: 600, fontSize: 14, cursor: "pointer",
                }}
              >
                Cadastrar outro
              </button>
              <button
                onClick={() => { setModalData(null); navigate("/cadastros/moradores"); }}
                style={{
                  flex: 1, height: 46, borderRadius: 12,
                  border: "none", background: "#ffffff",
                  color: "#003580", fontWeight: 600, fontSize: 14, cursor: "pointer",
                }}
              >
                Ver lista
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
