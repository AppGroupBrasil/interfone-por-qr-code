import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import TutorialButton, { TSection, TStep, TBullet } from "@/components/TutorialButton";
import { checkPin } from "@/lib/passwordPolicy";
import {
  ChevronLeft,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Trash2,
  Pencil,
  UserPlus,
  ChevronDown,
  ChevronUp,
  Users,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useTheme } from "@/hooks/useTheme";

interface Administradora {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  parent_administradora_id: number | null;
  created_at: string;
}

export default function CadastroAdministradoras() {
  const { isDark, p } = useTheme();
  const navigate = useNavigate();

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [lista, setLista] = useState<Administradora[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [subUserParentId, setSubUserParentId] = useState<number | null>(null);
  const [expandedAdmin, setExpandedAdmin] = useState<number | null>(null);

  const fetchLista = () => {
    apiFetch("/api/users/administradoras")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setLista(data);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchLista();
  }, []);

  const formatPhone = (value: string) => {
    const n = value.replace(/\D/g, "");
    if (n.length <= 2) return n;
    if (n.length <= 7) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
    if (n.length <= 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
    return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7, 11)}`;
  };

  const resetForm = () => {
    setNome("");
    setEmail("");
    setWhatsapp("");
    setPassword("");
    setConfirmPassword("");
    setEditingId(null);
    setSubUserParentId(null);
    setError("");
    setSuccess("");
  };

  const startEdit = (adm: Administradora) => {
    setEditingId(adm.id);
    setNome(adm.name);
    setEmail(adm.email);
    setWhatsapp(adm.phone ? formatPhone(adm.phone) : "");
    setPassword("");
    setConfirmPassword("");
    setShowForm(true);
    setError("");
    setSuccess("");
  };

  const validate = () => {
    if (!nome.trim()) return "Informe o nome.";
    if (!email.trim()) return "Informe o e-mail.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "E-mail inválido.";
    if (!editingId) {
      { const r = checkPin(password); if (!r.ok) return r.error!; }
      if (password !== confirmPassword) return "As senhas não coincidem.";
    } else if (password) {
      { const r = checkPin(password); if (!r.ok) return r.error!; }
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
      let url: string;
      let method: string;

      if (editingId) {
        url = `/api/users/administradora/${editingId}`;
        method = "PUT";
      } else if (subUserParentId) {
        url = `/api/users/administradora/${subUserParentId}/sub-usuario`;
        method = "POST";
      } else {
        url = "/api/users/administradora";
        method = "POST";
      }

      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(),
          email: email.trim().toLowerCase(),
          phone: whatsapp || undefined,
          password: password || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar.");

      if (editingId) {
        setSuccess("Administradora atualizada!");
      } else if (subUserParentId) {
        setSuccess("Sub-usuário criado com sucesso!");
      } else {
        setSuccess("Administradora cadastrada com sucesso!");
      }
      resetForm();
      setShowForm(false);
      fetchLista();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Excluir administradora "${name}"?`)) return;
    try {
      const res = await apiFetch(`/api/users/administradora/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      fetchLista();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col" style={{ backgroundColor: "#ffffff" }}>
      <header className="sticky top-0 z-40" style={{ background: p.headerBg, borderBottom: p.headerBorder, boxShadow: p.headerShadow, color: p.text }}>
        <div className="h-16 flex items-center gap-3" style={{ paddingLeft: "2rem", paddingRight: "2rem" }}>
          <button onClick={() => navigate("/cadastros")} className="p-2">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <span className="font-semibold text-lg">Administradoras</span>
          <div style={{ marginLeft: "auto" }}>
            <TutorialButton title="Administradoras">
              <TSection icon={<span>📋</span>} title="O QUE É ESTA FUNÇÃO?">
                <p>Gerencia as <strong>empresas administradoras</strong> vinculadas ao sistema. A administradora é a empresa responsável pela gestão de um ou mais condomínios. Cada administradora recebe login próprio para acessar o sistema e gerenciar os condomínios sob sua responsabilidade (cadastrar síndicos, blocos, moradores, funcionários, etc.).</p>
              </TSection>
              <TSection icon={<span>🏗️</span>} title="COMO CADASTRAR">
                <TStep n={1}>Clique em <strong>"+"</strong> ou <strong>"Nova Administradora"</strong></TStep>
                <TStep n={2}>Preencha o <strong>nome da empresa</strong> administradora</TStep>
                <TStep n={3}>Informe o <strong>e-mail</strong> (será o login de acesso ao sistema)</TStep>
                <TStep n={4}>Defina uma <strong>senha de 6 dígitos</strong></TStep>
                <TStep n={5}>Clique em <strong>"Cadastrar"</strong> para salvar</TStep>
                <p style={{ marginTop: "8px", fontSize: "13px", color: "#2d3354" }}>👉 A administradora já pode acessar o sistema usando e-mail + senha definidos.</p>
              </TSection>
              <TSection icon={<span>🔧</span>} title="GERENCIANDO ADMINISTRADORAS">
                <TBullet><strong>Vincular condomínios</strong> — Associe um ou mais condomínios à administradora para ela gerenciar</TBullet>
                <TBullet><strong>Editar</strong> — Altere nome, e-mail ou redefina a senha</TBullet>
                <TBullet><strong>Excluir</strong> — Remove a administradora e desvincula os condomínios associados</TBullet>
                <TBullet><strong>Buscar</strong> — Encontre administradoras por nome na lista</TBullet>
              </TSection>
              <TSection icon={<span>📱</span>} title="O QUE A ADMINISTRADORA ACESSA">
                <TBullet>Gerenciar <strong>condomínios</strong> vinculados (cadastrar blocos, moradores, funcionários)</TBullet>
                <TBullet>Cadastrar e gerenciar <strong>síndicos</strong> para cada condomínio</TBullet>
                <TBullet>Visualizar <strong>painel de gestão</strong> com dados de todos os condomínios</TBullet>
                <TBullet>Acessar <strong>relatórios</strong> e histórico de operações</TBullet>
              </TSection>
              <TSection icon={<span>⭐</span>} title="DICAS IMPORTANTES">
                <TBullet>A hierarquia é: <strong>Master → Administradora → Síndico → Funcionário → Morador</strong></TBullet>
                <TBullet>Uma administradora pode gerenciar <strong>vários condomínios</strong> simultaneamente</TBullet>
                <TBullet>Se a administradora for trocada, <strong>exclua e cadastre</strong> a nova — o acesso antigo é revogado</TBullet>
                <TBullet>O e-mail deve ser <strong>único</strong> — não pode haver duas administradoras com o mesmo e-mail</TBullet>
              </TSection>
            </TutorialButton>
          </div>
        </div>
      </header>

      <main className="flex-1" style={{ paddingLeft: "1.5rem", paddingRight: "1.5rem", paddingTop: "1.5rem", paddingBottom: "3.5rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
          {/* Info */}
          <div className="rounded-xl p-5">
            <div className="flex gap-3">
              <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                Somente o <strong className="text-foreground">Admin Master</strong> pode cadastrar e gerenciar administradoras.
              </p>
            </div>
          </div>

          {/* Toggle Form */}
          {!showForm ? (
            <div style={{ paddingTop: "1rem", paddingBottom: "1rem" }}>
              <Button onClick={() => { resetForm(); setShowForm(true); }} className="w-full h-12 font-semibold">
                + Nova Administradora
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl p-8 animate-fade-in">
              <form onSubmit={handleSubmit} className="space-y-3">
                {subUserParentId && (
                  <div className="flex items-center gap-2 p-3 rounded-lg border border-purple-400/30 mb-2" style={{ backgroundColor: isDark ? "rgba(168,85,247,0.1)" : "#f5f0ff" }}>
                    <Users className="w-4 h-4 text-purple-400" />
                    <span className="text-sm" style={{ color: "#003580" }}>
                      Criando sub-usuário para: <strong>{lista.find(a => a.id === subUserParentId)?.name}</strong>
                    </span>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="nome">{subUserParentId ? "Nome do Usuário *" : "Nome da Administradora *"}</Label>
                  <Input id="nome" placeholder={subUserParentId ? "Ex: João Silva" : "Ex: Admin ABC"} value={nome} onChange={(e) => setNome(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail *</Label>
                  <Input id="email" type="email" placeholder="admin@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp">WhatsApp</Label>
                  <Input id="whatsapp" type="tel" placeholder="(11) 99999-9999" value={whatsapp} onChange={(e) => setWhatsapp(formatPhone(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha (6 dígitos){editingId ? '' : ' *'}</Label>
                  {editingId && (
                    <p className="text-[11px] text-muted-foreground">Deixe em branco para manter a senha atual.</p>
                  )}
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
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
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
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm animate-fade-in">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                  </div>
                )}
                {success && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm animate-fade-in">
                    <CheckCircle2 className="w-4 h-4 shrink-0" /> {success}
                  </div>
                )}

                <div className="flex gap-4" style={{ marginTop: "2.4rem" }}>
                  <Button type="button" variant="outline" className="flex-1 h-12" onClick={() => { setShowForm(false); resetForm(); }}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1 h-12 font-semibold" disabled={isLoading}>
                    {isLoading ? <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : editingId ? "Salvar" : subUserParentId ? "Criar Sub-Usuário" : "Cadastrar"}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Lista */}
          {lista.length > 0 && (() => {
            const mainAdmins = lista.filter(a => !a.parent_administradora_id);
            const subUsers = lista.filter(a => a.parent_administradora_id);
            return (
              <div className="space-y-6">
                <h3 className="text-sm font-medium uppercase tracking-wider mb-4" style={{ color: "#003580" }}>
                  Administradoras cadastradas ({mainAdmins.length})
                </h3>
                {mainAdmins.map((adm) => {
                  const subs = subUsers.filter(s => s.parent_administradora_id === adm.id);
                  const isExpanded = expandedAdmin === adm.id;
                  return (
                    <div key={adm.id} className="rounded-xl overflow-hidden" style={{ border: p.btnBorder }}>
                      {/* Main admin row */}
                      <div className="flex items-center gap-4 p-5">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)" }}>
                          <ShieldCheck className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-base font-medium truncate" style={{ color: "#003580" }}>{adm.name}</p>
                          <p className="text-sm truncate" style={{ color: "#64748b" }}>{adm.email}</p>
                          {subs.length > 0 && (
                            <p className="text-xs mt-0.5" style={{ color: "#8b5cf6" }}>
                              {subs.length} sub-usuário{subs.length > 1 ? "s" : ""}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            setSubUserParentId(adm.id);
                            resetForm();
                            setSubUserParentId(adm.id);
                            setShowForm(true);
                          }}
                          className="p-2.5 hover:text-purple-400 transition-colors"
                          style={{ color: "#94a3b8" }}
                          title="Adicionar sub-usuário"
                        >
                          <UserPlus className="w-5 h-5" />
                        </button>
                        {subs.length > 0 && (
                          <button
                            onClick={() => setExpandedAdmin(isExpanded ? null : adm.id)}
                            className="p-2.5 hover:text-sky-400 transition-colors"
                            style={{ color: "#94a3b8" }}
                          >
                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </button>
                        )}
                        <button onClick={() => startEdit(adm)} className="p-2.5 hover:text-sky-400 transition-colors" style={{ color: "#94a3b8" }}>
                          <Pencil className="w-5 h-5" />
                        </button>
                        <button onClick={() => handleDelete(adm.id, adm.name)} className="p-2.5 hover:text-destructive transition-colors" style={{ color: "#94a3b8" }}>
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Sub-users */}
                      {isExpanded && subs.length > 0 && (
                        <div style={{ borderTop: p.headerBorder }}>
                          {subs.map((sub) => (
                            <div key={sub.id} className="flex items-center gap-4 py-3" style={{ paddingLeft: "3.5rem", paddingRight: "1.25rem", backgroundColor: isDark ? "rgba(0,0,0,0.15)" : "#f8fafc" }}>
                              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: isDark ? "rgba(139,92,246,0.2)" : "#ede9fe" }}>
                                <Users className="w-4 h-4 text-purple-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate" style={{ color: "#003580" }}>{sub.name}</p>
                                <p className="text-xs truncate" style={{ color: "#64748b" }}>{sub.email}</p>
                              </div>
                              <button onClick={() => startEdit(sub)} className="p-2 hover:text-sky-400 transition-colors" style={{ color: "#94a3b8" }}>
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDelete(sub.id, sub.name)} className="p-2 hover:text-destructive transition-colors" style={{ color: "#94a3b8" }}>
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {lista.length === 0 && !showForm && (
            <p className="text-sm text-center py-8" style={{ color: "#64748b" }}>
              Nenhuma administradora cadastrada.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
