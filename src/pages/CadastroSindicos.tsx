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
  UserCog,
  Trash2,
  Pencil,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useTheme } from "@/hooks/useTheme";

interface Sindico {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  condominio_id: number | null;
  condominio_nome: string | null;
  created_at: string;
}

interface Condominio {
  id: number;
  name: string;
}

export default function CadastroSindicos() {
  const { isDark, p } = useTheme();
  const navigate = useNavigate();

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [condominioId, setCondominioId] = useState("");

  const [condominios, setCondominios] = useState<Condominio[]>([]);
  const [lista, setLista] = useState<Sindico[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [modalData, setModalData] = useState<{ nome: string; email: string; condominio: string } | null>(null);

  const fetchLista = () => {
    apiFetch("/api/users/sindicos")
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data)) setLista(data); })
      .catch(() => {});
  };

  const fetchCondominios = () => {
    apiFetch("/api/condominios")
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data)) setCondominios(data); })
      .catch(() => {});
  };

  useEffect(() => {
    fetchLista();
    fetchCondominios();
  }, []);

  const formatPhone = (value: string) => {
    const n = value.replace(/\D/g, "");
    if (n.length <= 2) return n;
    if (n.length <= 7) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
    if (n.length <= 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
    return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7, 11)}`;
  };

  const resetForm = () => {
    setNome(""); setEmail(""); setWhatsapp(""); setPassword(""); setConfirmPassword(""); setCondominioId("");
    setEditingId(null); setError(""); setSuccess("");
  };

  const startEdit = (s: Sindico) => {
    setEditingId(s.id);
    setNome(s.name);
    setEmail(s.email);
    setWhatsapp(s.phone ? formatPhone(s.phone) : "");
    setCondominioId(s.condominio_id?.toString() || "");
    setPassword(""); setConfirmPassword("");
    setShowForm(true); setError(""); setSuccess("");
  };

  const validate = () => {
    if (!nome.trim()) return "Informe o nome.";
    if (!email.trim()) return "Informe o e-mail.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "E-mail inválido.";
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
    setError(""); setSuccess("");
    const err = validate();
    if (err) return setError(err);

    setIsLoading(true);
    try {
      const url = editingId ? `/api/users/sindico/${editingId}` : "/api/users/sindico";
      const method = editingId ? "PUT" : "POST";

      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(),
          email: email.trim().toLowerCase(),
          phone: whatsapp || undefined,
          password: password || undefined,
          condominioId: condominioId ? parseInt(condominioId) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar.");

      if (!editingId) {
        const condNome = condominios.find(c => c.id === parseInt(condominioId))?.name || "N/A";
        const savedData = { nome: nome.trim(), email: email.trim().toLowerCase(), condominio: condNome };
        resetForm();
        setShowForm(false);
        setModalData(savedData);
      } else {
        setSuccess("Síndico atualizado!");
        resetForm();
        setShowForm(false);
      }
      fetchLista();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Excluir síndico "${name}"?`)) return;
    try {
      const res = await apiFetch(`/api/users/sindico/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      fetchLista();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: p.pageBg }}>
      <header className="sticky top-0 z-40" style={{ background: p.headerBg, borderBottom: p.headerBorder, boxShadow: p.headerShadow, color: p.text }}>
        <div style={{ height: "4.5rem", display: "flex", alignItems: "center", gap: 12, paddingLeft: "1rem", paddingRight: "1rem" }}>
          <button onClick={() => navigate("/cadastros")} style={{ width: 40, height: 40, borderRadius: 12, background: p.btnBg, border: p.btnBorder, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: p.text }}>
            <ChevronLeft className="w-6 h-6" />
          </button>
          <span style={{ fontWeight: 700, fontSize: 18 }}>Síndicos</span>
          <div style={{ marginLeft: "auto" }}>
            <TutorialButton title="Cadastro de Síndicos">
              <TSection icon={<span>📋</span>} title="O QUE É ESTA FUNÇÃO?">
                <p>Cadastra e gerencia os <strong>síndicos</strong> do sistema. O síndico é o responsável direto pelo condomínio — ele tem acesso completo ao painel de gestão para cadastrar moradores, funcionários, blocos, configurar interfone, câmeras, rondas, portaria virtual e todas as funcionalidades do sistema.</p>
              </TSection>
              <TSection icon={<span>🏗️</span>} title="COMO CADASTRAR">
                <TStep n={1}>Clique em <strong>"+"</strong> ou <strong>"Novo Síndico"</strong></TStep>
                <TStep n={2}>Preencha o <strong>nome completo</strong> do síndico</TStep>
                <TStep n={3}>Informe o <strong>e-mail</strong> (será o login de acesso)</TStep>
                <TStep n={4}>Defina uma <strong>senha de 6 dígitos</strong></TStep>
                <TStep n={5}><strong>Vincule ao condomínio</strong> que ele irá administrar</TStep>
                <TStep n={6}>Clique em <strong>"Cadastrar"</strong> para finalizar</TStep>
                <p style={{ marginTop: "8px", fontSize: "13px", color: "#2d3354" }}>👉 O síndico já pode acessar o sistema e começar a configurar o condomínio.</p>
              </TSection>
              <TSection icon={<span>🔧</span>} title="GERENCIANDO SÍNDICOS">
                <TBullet><strong>Vincular ao condomínio</strong> — Associe o síndico ao condomínio que ele gerencia</TBullet>
                <TBullet><strong>Editar</strong> — Altere nome, e-mail ou redefina a senha</TBullet>
                <TBullet><strong>Excluir</strong> — Remove o síndico e desvincula do condomínio (acesso revogado)</TBullet>
                <TBullet><strong>Buscar</strong> — Encontre síndicos por nome na lista</TBullet>
              </TSection>
              <TSection icon={<span>📱</span>} title="O QUE O SÍNDICO ACESSA">
                <TBullet><strong>Cadastros</strong> — Moradores, funcionários e blocos do condomínio</TBullet>
                <TBullet><strong>Interfone Digital</strong> — Configuração e QR Codes do interfone</TBullet>
                <TBullet><strong>Câmeras</strong> — Cadastro e monitoramento de câmeras de segurança</TBullet>
                <TBullet><strong>Rondas</strong> — Checkpoints, horários obrigatórios e alertas</TBullet>
                <TBullet><strong>Portaria Virtual</strong> — Controle de portões via app</TBullet>
                <TBullet><strong>Espelho da Portaria</strong> — Visão geral de tudo que acontece na portaria</TBullet>
              </TSection>
              <TSection icon={<span>⭐</span>} title="DICAS IMPORTANTES">
                <TBullet>Cada condomínio deve ter <strong>pelo menos 1 síndico</strong> vinculado para funcionar</TBullet>
                <TBullet>O síndico é quem faz a <strong>configuração inicial</strong> do condomínio (blocos, moradores, funcionários)</TBullet>
                <TBullet>Se trocar de síndico, <strong>exclua o anterior e cadastre o novo</strong> para manter a segurança</TBullet>
                <TBullet>O e-mail do síndico deve ser <strong>único</strong> no sistema</TBullet>
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
              <UserCog className="w-5 h-5 shrink-0 mt-0.5" style={{ color: isDark ? "#ffffff" : "#38bdf8" }} />
              <p className="text-sm leading-relaxed" style={{ color: isDark ? "#ffffff" : undefined }}>
                Cadastre síndicos e vincule a um condomínio. O síndico terá acesso total ao condomínio atribuído.
              </p>
            </div>
          </div>

          {/* Toggle Form */}
          {!showForm ? (
            <div style={{ paddingTop: "1rem", paddingBottom: "1rem" }}>
              <Button
                onClick={() => { resetForm(); setShowForm(true); }}
                className="w-full h-12 font-semibold"
                style={isDark ? { border: "2px solid #ffffff" } : undefined}
              >
                + Novo Síndico
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl p-8 animate-fade-in">
              <form onSubmit={handleSubmit}>
                {/* Nome completo */}
                <div style={{ marginBottom: "19px" }}>
                  <Label htmlFor="nome" style={{ display: "block", marginBottom: "4px", color: isDark ? "#ffffff" : undefined }}>Nome completo *</Label>
                  <Input id="nome" placeholder="Ex: Carlos Silva" value={nome} onChange={(e) => setNome(e.target.value)} style={{ paddingLeft: "24px" }} />
                </div>

                {/* E-mail */}
                <div style={{ marginBottom: "19px" }}>
                  <Label htmlFor="email" style={{ display: "block", marginBottom: "4px", color: isDark ? "#ffffff" : undefined }}>E-mail *</Label>
                  <Input id="email" type="email" placeholder="sindico@email.com" value={email} onChange={(e) => setEmail(e.target.value)} style={{ paddingLeft: "24px" }} />
                </div>

                {/* WhatsApp */}
                <div style={{ marginBottom: "19px" }}>
                  <Label htmlFor="whatsapp" style={{ display: "block", marginBottom: "4px", color: isDark ? "#ffffff" : undefined }}>WhatsApp</Label>
                  <Input id="whatsapp" type="tel" placeholder="(11) 99999-9999" value={whatsapp} onChange={(e) => setWhatsapp(formatPhone(e.target.value))} style={{ paddingLeft: "24px" }} />
                </div>

                {/* Condomínio */}
                <div style={{ marginBottom: "19px" }}>
                  <Label htmlFor="condominio" style={{ display: "block", marginBottom: "4px", color: isDark ? "#ffffff" : undefined }}>Condomínio</Label>
                  {condominios.length > 0 ? (
                    <select
                      id="condominio"
                      value={condominioId}
                      onChange={(e) => setCondominioId(e.target.value)}
                      className="w-full h-10 rounded-md border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      style={isDark ? { paddingLeft: "24px", background: "#ffffff", color: "#000000" } : { paddingLeft: "24px" }}
                    >
                      <option value="" style={{ color: "#000000" }}>Selecionar condomínio (opcional)</option>
                      {condominios.map((c) => (
                        <option key={c.id} value={c.id} style={{ color: "#000000" }}>{c.name}</option>
                      ))}
                    </select>
                  ) : (
                    <p style={{ color: "#facc15", fontSize: "13px" }}>
                      Nenhum condomínio cadastrado ainda.
                    </p>
                  )}
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
                        onChange={(e) => setPassword(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        className="pr-10"
                        style={{ paddingLeft: "24px" }}
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                      onChange={(e) => setConfirmPassword(e.target.value.replace(/\D/g, "").slice(0, 6))}
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
                    <CheckCircle2 className="w-4 h-4 shrink-0" /> {success}
                  </div>
                )}

                {/* Submit */}
                <div className="flex gap-4" style={{ marginTop: "2.4rem" }}>
                  <Button type="button" variant="outline" className="flex-1 h-12" onClick={() => { setShowForm(false); resetForm(); }} style={isDark ? { border: "2px solid #ffffff" } : undefined}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1 h-12 font-semibold" disabled={isLoading} style={isDark ? { backgroundColor: "#ffffff", color: "#003580", border: "2px solid #ffffff" } : undefined}>
                    {isLoading ? <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : editingId ? "Salvar" : "Cadastrar"}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Lista */}
          {lista.length > 0 && (
            <div className="space-y-6">
              <h3 className="text-sm font-medium uppercase tracking-wider" style={{ color: isDark ? "#ffffff" : "#003580", marginBottom: "19px" }}>
                Síndicos cadastrados ({lista.length})
              </h3>
              {lista.map((s) => (
                <div key={s.id} className="flex items-center gap-4 rounded-xl" style={{ backgroundColor: "#ffffff", padding: "24px 20px", marginBottom: "19px" }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)" }}>
                    <UserCog className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-medium truncate" style={{ color: "#003580" }}>{s.name}</p>
                    <p className="text-sm truncate" style={{ color: "#64748b" }}>
                      {s.condominio_nome || "Sem condomínio"} · {s.email}
                    </p>
                  </div>
                  <button onClick={() => startEdit(s)} className="p-2.5 transition-colors" style={{ color: "#eab308" }}>
                    <Pencil className="w-5 h-5" />
                  </button>
                  <button onClick={() => handleDelete(s.id, s.name)} className="p-2.5 transition-colors" style={{ color: "#ef4444" }}>
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {lista.length === 0 && !showForm && (
            <p className="text-sm text-center py-8" style={{ color: "#64748b" }}>
              Nenhum síndico cadastrado.
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
              <UserCog className="w-9 h-9 text-white" strokeWidth={2} />
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#ffffff", marginBottom: 6 }}>Síndico Cadastrado!</h2>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", marginBottom: 24 }}>O síndico já pode acessar o sistema.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
              {[
                { label: "Nome", value: modalData.nome },
                { label: "E-mail", value: modalData.email },
                { label: "Condomínio", value: modalData.condominio },
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
