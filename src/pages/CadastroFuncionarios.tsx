import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  Info,
  Trash2,
  Pencil,
  HardHat,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useTheme } from "@/hooks/useTheme";

const cargos = [
  "Gerente",
  "Supervisão",
  "Porteiro",
  "Zelador",
  "Manutenção",
  "Outro",
];

// Remove acentos e caracteres especiais
function sanitizeLogin(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^a-z0-9]/g, ""); // só letras minúsculas e números
}

// Gera login a partir de nome + sobrenome
function generateLogin(nome: string, sobrenome: string): string {
  const raw = (nome + sobrenome).toLowerCase();
  return sanitizeLogin(raw);
}

interface Funcionario {
  id: number;
  nome: string;
  sobrenome: string;
  cargo: string;
  login: string;
  created_at: string;
}

export default function CadastroFuncionarios() {
  const { isDark, p } = useTheme();
  const navigate = useNavigate();

  const [nome, setNome] = useState("");
  const [sobrenome, setSobrenome] = useState("");
  const [cargo, setCargo] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [lista, setLista] = useState<Funcionario[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [modalData, setModalData] = useState<{ nome: string; cargo: string; login: string } | null>(null);

  const fetchLista = () => {
    apiFetch("/api/funcionarios")
      .then((res) => { console.log("[fetchLista] status:", res.status); return res.json(); })
      .then((data) => { console.log("[fetchLista] data:", data); if (Array.isArray(data)) setLista(data); })
      .catch((e) => { console.error("[fetchLista] error:", e); });
  };

  useEffect(() => { fetchLista(); }, []);

  const resetForm = () => {
    setNome(""); setSobrenome(""); setCargo(""); setLogin(""); setPassword(""); setConfirmPassword("");
    setEditingId(null); setError(""); setSuccess("");
  };

  const startEdit = (f: Funcionario) => {
    setEditingId(f.id);
    setNome(f.nome); setSobrenome(f.sobrenome); setCargo(f.cargo); setLogin(f.login);
    setPassword(""); setConfirmPassword("");
    setShowForm(true); setError(""); setSuccess("");
  };

  // Atualiza login automaticamente ao digitar nome/sobrenome
  const handleNomeChange = (value: string) => {
    setNome(value);
    setLogin(generateLogin(value, sobrenome));
  };

  const handleSobrenomeChange = (value: string) => {
    setSobrenome(value);
    setLogin(generateLogin(nome, value));
  };

  // Permite edição manual do login (mas força regras)
  const handleLoginChange = (value: string) => {
    setLogin(sanitizeLogin(value.toLowerCase()));
  };

  const validate = () => {
    if (!nome.trim()) return "Informe o nome.";
    if (!sobrenome.trim()) return "Informe o sobrenome.";
    if (!cargo) return "Selecione o cargo.";
    if (!login) return "Login é obrigatório.";
    if (login.length < 3) return "Login deve ter pelo menos 3 caracteres.";
    if (!editingId) {
      if (!/^\d{6}$/.test(password)) return "Senha deve ter exatamente 6 dígitos numéricos.";
      if (password !== confirmPassword) return "As senhas não coincidem.";
    } else if (password) {
      if (!/^\d{6}$/.test(password)) return "Senha deve ter exatamente 6 dígitos numéricos.";
      if (password !== confirmPassword) return "As senhas não coincidem.";
    }
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
      const url = editingId ? `/api/funcionarios/${editingId}` : "/api/funcionarios";
      const method = editingId ? "PUT" : "POST";

      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(),
          sobrenome: sobrenome.trim(),
          cargo,
          login,
          password: password || undefined,
        }),
      });

      const data = await res.json();
      console.log("[handleSubmit] status:", res.status, "data:", data);
      if (!res.ok) throw new Error(data.error || "Erro ao salvar.");

      if (!editingId) {
        const savedData = { nome: nome.trim() + " " + sobrenome.trim(), cargo, login };
        resetForm();
        setShowForm(false);
        setModalData(savedData);
      } else {
        setSuccess("Funcionário atualizado!");
        resetForm();
        setShowForm(false);
      }
      fetchLista();
    } catch (err: any) {
      setError(err.message || "Erro ao salvar funcionário.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Excluir funcionário "${name}"?`)) return;
    try {
      const res = await apiFetch(`/api/funcionarios/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      fetchLista();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: p.pageBg }}>
      {/* Header */}
      <header className="sticky top-0 z-40" style={{ background: p.headerBg, borderBottom: p.headerBorder, boxShadow: p.headerShadow, color: p.text }}>
        <div style={{ height: "4.5rem", display: "flex", alignItems: "center", gap: 12, paddingLeft: "1rem", paddingRight: "1rem" }}>
          <button onClick={() => navigate("/cadastros")} style={{ width: 40, height: 40, borderRadius: 12, background: p.btnBg, border: p.btnBorder, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: p.text }}>
            <ChevronLeft className="w-6 h-6" />
          </button>
          <span style={{ fontWeight: 700, fontSize: 18 }}>Cadastro de Funcionários</span>
          <div style={{ marginLeft: "auto" }}>
            <TutorialButton title="Cadastro de Funcionários">
              <TSection icon={<span>📋</span>} title="O QUE É ESTA FUNÇÃO?">
                <p>Cadastra <strong>porteiros, zeladores, gerentes e demais funcionários</strong> do condomínio. Cada funcionário recebe um login e senha próprios para acessar o sistema com as funções do seu cargo (registrar visitantes, entregas, correspondências, rondas, controle de portões, etc.).</p>
              </TSection>
              <TSection icon={<span>🏗️</span>} title="COMO CADASTRAR">
                <TStep n={1}>Clique no botão <strong>"+"</strong> para abrir o formulário</TStep>
                <TStep n={2}>Preencha <strong>nome completo</strong> e <strong>sobrenome</strong></TStep>
                <TStep n={3}>Selecione o <strong>cargo</strong>: Gerente, Supervisão, Porteiro, Zelador, Manutenção, etc.</TStep>
                <TStep n={4}>Defina um <strong>login</strong> (nome de usuário) e uma <strong>senha de 6 dígitos</strong></TStep>
                <TStep n={5}>Clique em <strong>"Cadastrar"</strong> para salvar</TStep>
                <p style={{ marginTop: "8px", fontSize: "13px", color: "#2d3354" }}>👉 O funcionário já pode acessar o sistema imediatamente usando login + senha definidos.</p>
              </TSection>
              <TSection icon={<span>🔧</span>} title="GERENCIANDO FUNCIONÁRIOS">
                <TBullet><strong>Editar</strong> — Altere nome, cargo ou redefina a senha do funcionário</TBullet>
                <TBullet><strong>Excluir</strong> — Remova funcionários que não trabalham mais (o acesso é cortado imediatamente)</TBullet>
                <TBullet><strong>Buscar</strong> — Encontre funcionários por nome ou cargo</TBullet>
                <TBullet><strong>Lista</strong> — Todos os funcionários cadastrados aparecem com nome e cargo</TBullet>
              </TSection>
              <TSection icon={<span>📱</span>} title="O QUE O FUNCIONÁRIO ACESSA">
                <TBullet><strong>Porteiro</strong> — Cadastrar visitantes, registrar entregas, correspondências, livro de protocolo, controle de portões</TBullet>
                <TBullet><strong>Zelador</strong> — Registro de rondas, ocorrências e manutenção</TBullet>
                <TBullet><strong>Gerente/Supervisão</strong> — Visão geral de todas as operações da portaria</TBullet>
                <TBullet><strong>Interfone</strong> — Todos os funcionários podem atender chamadas do interfone digital</TBullet>
              </TSection>
              <TSection icon={<span>⭐</span>} title="DICAS IMPORTANTES">
                <TBullet>A <strong>senha tem 6 dígitos</strong> — fácil de memorizar mas segura</TBullet>
                <TBullet>Se o funcionário esquecer a senha, você pode <strong>redefinir</strong> editando o cadastro</TBullet>
                <TBullet>Funcionários demitidos devem ser <strong>excluídos imediatamente</strong> para revogar o acesso</TBullet>
                <TBullet>O login deve ser <strong>único</strong> — não pode haver dois funcionários com o mesmo login</TBullet>
              </TSection>
            </TutorialButton>
          </div>
        </div>
      </header>

      {/* Form */}
      <main className="flex-1" style={{ paddingLeft: "1.5rem", paddingRight: "1.5rem", paddingTop: "1.5rem", paddingBottom: "3.5rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
          {/* Toggle Form */}
          {!showForm ? (
            <div style={{ paddingTop: "1rem", paddingBottom: "1rem" }}>
              <Button onClick={() => { resetForm(); setShowForm(true); }} className="w-full h-12 font-semibold" style={isDark ? { border: "2px solid #ffffff" } : undefined}>
                + Novo Funcionário
              </Button>
            </div>
          ) : (
          <div className="rounded-2xl p-8 animate-fade-in">
            <form onSubmit={handleSubmit}>
              {/* Cargo */}
              <div style={{ marginBottom: "19px" }}>
                <Label htmlFor="cargo" style={{ display: "block", marginBottom: "4px", color: isDark ? "#ffffff" : undefined }}>Cargo *</Label>
                <select
                  id="cargo"
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  className="w-full h-10 rounded-md border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  style={isDark ? { paddingLeft: "24px", background: "#ffffff", color: "#000000" } : { paddingLeft: "24px" }}
                >
                  <option value="" style={{ color: "#000000" }}>Selecione o cargo</option>
                  {cargos.map((c) => (
                    <option key={c} value={c} style={{ color: "#000000" }}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Nome + Sobrenome */}
              <div style={{ display: "flex", gap: "12px", marginBottom: "19px" }}>
                <div style={{ flex: 1 }}>
                  <Label htmlFor="nome" style={{ display: "block", marginBottom: "4px", color: isDark ? "#ffffff" : undefined }}>Nome *</Label>
                  <Input
                    id="nome"
                    placeholder=""
                    value={nome}
                    onChange={(e) => handleNomeChange(e.target.value)}
                    style={{ paddingLeft: "24px" }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <Label htmlFor="sobrenome" style={{ display: "block", marginBottom: "4px", color: isDark ? "#ffffff" : undefined }}>Sobrenome *</Label>
                  <Input
                    id="sobrenome"
                    placeholder=""
                    value={sobrenome}
                    onChange={(e) => handleSobrenomeChange(e.target.value)}
                    style={{ paddingLeft: "24px" }}
                  />
                </div>
              </div>
              {(!nome || !sobrenome) && <p style={{ color: "#facc15", fontSize: "13px", marginTop: "-15px", marginBottom: "19px" }}>Atenção: O nome + o sobrenome será igual ao login do funcionário.</p>}

              {/* Login (auto-gerado) */}
              <div style={{ marginBottom: "19px" }}>
                <Label htmlFor="login" style={{ display: "block", marginBottom: "4px", color: isDark ? "#ffffff" : undefined }}>Login *</Label>
                <Input
                  id="login"
                  placeholder=""
                  value={login}
                  onChange={(e) => handleLoginChange(e.target.value)}
                  style={{ paddingLeft: "24px" }}
                />
                {!login && <p style={{ color: "#facc15", fontSize: "13px", marginTop: "4px" }}>Atenção: Para acessar o sistema utilize esse login e senha abaixo.</p>}
              </div>

              {/* Senha + Confirmar Senha */}
              {editingId && (
                <p className="text-[11px] text-muted-foreground" style={{ marginBottom: "4px" }}>Deixe em branco para manter a senha atual.</p>
              )}
              <div style={{ display: "flex", gap: "12px", marginBottom: "19px" }}>
                <div style={{ flex: 1 }}>
                  <Label htmlFor="password" style={{ display: "block", marginBottom: "4px", color: isDark ? "#ffffff" : undefined }}>Senha (6 dígitos){editingId ? '' : ' *'}</Label>
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
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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

              {/* Success */}
              {success && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm animate-fade-in">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {success}
                </div>
              )}

              {/* Submit */}
              <div className="flex gap-4" style={{ marginTop: "2.4rem" }}>
                <Button type="button" variant="outline" className="flex-1 h-12" onClick={() => { setShowForm(false); resetForm(); }} style={isDark ? { border: "2px solid #ffffff" } : undefined}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1 h-12 font-semibold" disabled={isLoading} style={isDark ? { backgroundColor: "#ffffff", color: "#003580", border: "2px solid #ffffff" } : undefined}>
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  ) : editingId ? "Salvar" : "Cadastrar"}
                </Button>
              </div>
            </form>
          </div>
          )}

          {/* Lista */}
          {lista.length > 0 && (
            <div className="space-y-6">
              <h3 className="text-sm font-medium uppercase tracking-wider" style={{ color: isDark ? "#ffffff" : "#003580", marginBottom: "19px" }}>
                Funcionários cadastrados ({lista.length})
              </h3>
              {lista.map((f) => (
                <div key={f.id} className="flex items-center gap-4 rounded-xl" style={{ backgroundColor: "#ffffff", padding: "24px 20px", marginBottom: "19px" }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)" }}>
                    <HardHat className="w-5 h-5 text-white" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-medium truncate" style={{ color: "#003580" }}>{f.nome} {f.sobrenome}</p>
                    <p className="text-sm truncate" style={{ color: "#64748b" }}>{f.cargo} · @{f.login}</p>
                  </div>
                  <button onClick={() => startEdit(f)} className="p-2.5 transition-colors" style={{ color: "#eab308" }}>
                    <Pencil className="w-5 h-5" />
                  </button>
                  <button onClick={() => handleDelete(f.id, `${f.nome} ${f.sobrenome}`)} className="p-2.5 transition-colors" style={{ color: "#ef4444" }}>
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {lista.length === 0 && !showForm && (
            <p className="text-sm text-center py-8" style={{ color: "#64748b" }}>
              Nenhum funcionário cadastrado.
            </p>
          )}
        </div>
      </main>

      {/* Modal Premium de Confirmação */}
      {modalData && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
          onClick={() => setModalData(null)}
        >
          <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }} />
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-fade-in"
            style={{
              position: "relative", width: "100%", maxWidth: 420, borderRadius: 20,
              background: "linear-gradient(180deg, #001d4a 0%, #00275e 50%, #003580 100%)",
              border: "1px solid rgba(255,255,255,0.15)",
              boxShadow: "0 25px 60px rgba(0,0,0,0.5), 0 0 40px rgba(0,53,128,0.3)",
              padding: "2.5rem 2rem 2rem", textAlign: "center",
            }}
          >
            <button onClick={() => setModalData(null)} style={{ position: "absolute", top: 14, right: 14, color: "rgba(255,255,255,0.5)", cursor: "pointer", background: "none", border: "none" }}>
              <X className="w-5 h-5" />
            </button>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem", boxShadow: "0 8px 24px rgba(16,185,129,0.35)" }}>
              <HardHat className="w-9 h-9 text-white" strokeWidth={2} />
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#ffffff", marginBottom: 6 }}>Funcionário Cadastrado!</h2>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", marginBottom: 24 }}>Informe o login abaixo ao funcionário.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
              {[
                { label: "Nome", value: modalData.nome },
                { label: "Cargo", value: modalData.cargo },
                { label: "Login", value: modalData.login },
              ].map((row) => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderRadius: 10, backgroundColor: "rgba(255,255,255,0.07)" }}>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>{row.label}</span>
                  <span style={{ fontSize: 14, color: "#ffffff", fontWeight: 600, textAlign: "right", maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.value}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setModalData(null)} style={{ flex: 1, height: 46, borderRadius: 12, border: "2px solid rgba(255,255,255,0.2)", background: "transparent", color: "#ffffff", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                Cadastrar outro
              </button>
              <button onClick={() => { setModalData(null); navigate("/cadastros"); }} style={{ flex: 1, height: 46, borderRadius: 12, border: "none", background: "#ffffff", color: "#003580", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                Ver lista
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
