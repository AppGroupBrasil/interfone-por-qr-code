import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import TutorialButton, { TSection, TStep, TBullet } from "@/components/TutorialButton";
import {
  UserPlus,
  Link2,
  QrCode,
  FileSpreadsheet,
  ChevronLeft,
  Trash2,
  Pencil,
  Users,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  X,
  type LucideIcon,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useTheme } from "@/hooks/useTheme";

interface MetodoItem {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  route: string;
}

const metodos: MetodoItem[] = [
  {
    id: "manual",
    label: "Cadastro Manual",
    description: "Cadastre moradores um a um preenchendo os dados",
    icon: UserPlus,
    route: "/cadastros/moradores/manual",
  },
  {
    id: "link",
    label: "Via Link",
    description: "Gere um link curto para moradores se cadastrarem",
    icon: Link2,
    route: "/cadastros/moradores/link",
  },
  {
    id: "qrcode",
    label: "Via QR Code",
    description: "Gere um PDF com QR Code para imprimir",
    icon: QrCode,
    route: "/cadastros/moradores/qrcode",
  },
  {
    id: "planilha",
    label: "Cadastro em Lote",
    description: "Importe moradores via planilha Excel",
    icon: FileSpreadsheet,
    route: "/cadastros/moradores/planilha",
  },
];

const perfis = [
  "Proprietário",
  "Locatário",
  "Dependente",
  "Funcionário",
  "Locatário Temporário AirBnB",
];

interface Morador {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  perfil: string | null;
  unit: string | null;
  block: string | null;
  created_at: string;
}

interface Bloco {
  id: number;
  name: string;
}

export default function CadastroMoradores() {
  const { isDark, p } = useTheme();
  const navigate = useNavigate();

  const [lista, setLista] = useState<Morador[]>([]);
  const [blocos, setBlocos] = useState<Bloco[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editWhatsapp, setEditWhatsapp] = useState("");
  const [editPerfil, setEditPerfil] = useState("");
  const [editBloco, setEditBloco] = useState("");
  const [editUnidade, setEditUnidade] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editConfirmPassword, setEditConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [busca, setBusca] = useState("");

  const fetchLista = () => {
    apiFetch("/api/moradores")
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data)) setLista(data); })
      .catch(() => {});
  };

  const fetchBlocos = () => {
    apiFetch("/api/blocos")
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data)) setBlocos(data); })
      .catch(() => {});
  };

  useEffect(() => { fetchLista(); fetchBlocos(); }, []);

  const formatPhone = (value: string) => {
    const n = value.replace(/\D/g, "");
    if (n.length <= 2) return n;
    if (n.length <= 7) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
    if (n.length <= 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
    return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7, 11)}`;
  };

  const startEdit = (m: Morador) => {
    setEditingId(m.id);
    setEditNome(m.name);
    setEditEmail(m.email);
    setEditWhatsapp(m.phone ? formatPhone(m.phone) : "");
    setEditPerfil(m.perfil || "");
    setEditBloco(m.block || "");
    setEditUnidade(m.unit || "");
    setEditPassword("");
    setEditConfirmPassword("");
    setError(""); setSuccess("");
  };

  const cancelEdit = () => {
    setEditingId(null); setError(""); setSuccess("");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess("");

    if (!editNome.trim() || !editEmail.trim() || !editBloco || !editUnidade.trim() || !editPerfil) {
      return setError("Preencha todos os campos obrigatórios.");
    }
    if (editPassword) {
      if (!/^\d{6}$/.test(editPassword)) return setError("Senha deve ter 6 dígitos.");
      if (editPassword !== editConfirmPassword) return setError("As senhas não coincidem.");
    }

    setIsLoading(true);
    try {
      const res = await apiFetch(`/api/moradores/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: editNome.trim(),
          email: editEmail.trim().toLowerCase(),
          whatsapp: editWhatsapp || undefined,
          perfil: editPerfil,
          bloco: editBloco,
          unidade: editUnidade.trim(),
          password: editPassword || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess("Morador atualizado!");
      setEditingId(null);
      fetchLista();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Excluir morador "${name}"?`)) return;
    try {
      const res = await apiFetch(`/api/moradores/${id}`, { method: "DELETE" });
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
          <span style={{ fontWeight: 700, fontSize: 18 }}>Cadastro de Moradores</span>
          <div style={{ marginLeft: "auto" }}>
            <TutorialButton title="Cadastro de Moradores">
              <TSection icon={<span>📋</span>} title="O QUE É ESTA FUNÇÃO?">
                <p>Central de cadastro de moradores do condomínio. Aqui você gerencia <strong>todos os moradores</strong> — cadastra novos, edita dados e remove quem saiu. O morador cadastrado recebe acesso completo ao app (visitantes, delivery, veículos, correspondências, interfone, etc.).</p>
              </TSection>
              <TSection icon={<span>🏗️</span>} title="4 MÉTODOS DE CADASTRO">
                <TStep n={1}><strong>Manual</strong> — Você preenche o formulário com nome, bloco, unidade, WhatsApp, e-mail e senha do morador. Ideal para cadastrar poucos moradores.</TStep>
                <TStep n={2}><strong>Via Link</strong> — Gere um link exclusivo e envie ao morador por WhatsApp. Ele clica, preenche os próprios dados e já está cadastrado. Ideal para moradores que preferem se cadastrar sozinhos.</TStep>
                <TStep n={3}><strong>Via QR Code</strong> — Gere um QR Code que pode ser impresso e colado no mural, elevador ou recepção. O morador escaneia com o celular e se cadastra automaticamente.</TStep>
                <TStep n={4}><strong>Planilha (Lote)</strong> — Baixe o modelo Excel, preencha com os dados de todos os moradores e faça upload. Ideal para condomínios grandes com muitos moradores.</TStep>
                <p style={{ marginTop: "8px", fontSize: "13px", color: "#2d3354" }}>👉 Clique no método desejado na tela para acessar a página específica com instruções detalhadas.</p>
              </TSection>
              <TSection icon={<span>🔧</span>} title="GERENCIANDO MORADORES">
                <TBullet><strong>Lista completa</strong> — Todos os moradores aparecem organizados por bloco e unidade</TBullet>
                <TBullet><strong>Buscar</strong> — Use a barra de busca para encontrar por nome, bloco ou unidade</TBullet>
                <TBullet><strong>Editar</strong> — Toque no morador para alterar dados (nome, bloco, unidade, telefone, e-mail)</TBullet>
                <TBullet><strong>Excluir</strong> — Remova moradores que mudaram do condomínio (o acesso ao app é cortado imediatamente)</TBullet>
                <TBullet><strong>Perfis</strong> — Proprietário, Locatário, Familiar, etc. Define o tipo de vínculo com o imóvel</TBullet>
              </TSection>
              <TSection icon={<span>⭐</span>} title="DICAS IMPORTANTES">
                <TBullet>O morador usa <strong>e-mail + senha</strong> (6 dígitos) para logar no app</TBullet>
                <TBullet>O <strong>WhatsApp</strong> é usado para enviar notificações automáticas (delivery, correspondência, visitantes)</TBullet>
                <TBullet>Antes de cadastrar moradores, <strong>cadastre os blocos</strong> primeiro (menu Blocos)</TBullet>
                <TBullet>Moradores cadastrados já podem usar <strong>todas as funções do app</strong> imediatamente</TBullet>
                <TBullet>Se o morador esquecer a senha, você pode <strong>redefinir</strong> editando o cadastro</TBullet>
              </TSection>
            </TutorialButton>
          </div>
        </div>
      </header>

      {/* Grid de métodos + lista */}
      <main className="flex-1" style={{ paddingLeft: "1.5rem", paddingRight: "1.5rem", paddingTop: "1.5rem", paddingBottom: "3.5rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
          <p className="text-base" style={{ color: isDark ? "#ffffff" : undefined }}>
            Escolha a forma de cadastro dos moradores:
          </p>
          <div className="flex items-start justify-between" style={{ gap: "2.5rem" }}>
            {metodos.map((item, index) => (
              <button
                key={item.id}
                onClick={() => navigate(item.route)}
                className="flex flex-col items-center gap-3 hover:opacity-80 active:scale-[0.95] transition-all duration-150 animate-fade-in"
                style={{ animationDelay: `${index * 0.04}s` }}
              >
                <div className="w-16 h-16 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)", border: "2px solid #ffffff" }}>
                  <item.icon className="w-8 h-8 text-white" strokeWidth={1.5} />
                </div>
                <span className="text-sm font-medium text-foreground/90 text-center leading-tight">
                  {item.label}
                </span>
              </button>
            ))}
          </div>


          {/* Inline Edit Form */}
          {editingId && (
            <div className="rounded-2xl p-8 animate-fade-in" style={{ marginTop: "1rem", backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "#ffffff", border: isDark ? "1px solid rgba(255,255,255,0.08)" : undefined }}>
              <h3 className="text-sm font-semibold mb-6" style={{ color: isDark ? "#ffffff" : "#003580" }}>Editar Morador</h3>
              <form onSubmit={handleSaveEdit}>
                <div style={{ marginBottom: 19 }}>
                  <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: isDark ? "#ffffff" : "#003580", marginBottom: 4 }}>Nome completo *</label>
                  <Input value={editNome} onChange={(e) => setEditNome(e.target.value)} style={{ paddingLeft: 24 }} />
                </div>
                <div style={{ display: "flex", gap: 12, marginBottom: 19 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: isDark ? "#ffffff" : "#003580", marginBottom: 4 }}>Bloco / Torre *</label>
                    {blocos.length > 0 ? (
                      <select value={editBloco} onChange={(e) => setEditBloco(e.target.value)}
                        className="w-full h-10 rounded-md border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        style={{ paddingLeft: 24, backgroundColor: "#ffffff", color: "#000000", borderColor: isDark ? "rgba(255,255,255,0.2)" : undefined }}>
                        <option value="">Selecione</option>
                        {blocos.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
                      </select>
                    ) : (
                      <Input value={editBloco} onChange={(e) => setEditBloco(e.target.value)} placeholder="Ex: Bloco A" style={{ paddingLeft: 24 }} />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: isDark ? "#ffffff" : "#003580", marginBottom: 4 }}>Unidade / Apto *</label>
                    <Input value={editUnidade} onChange={(e) => setEditUnidade(e.target.value)} style={{ paddingLeft: 24 }} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12, marginBottom: 19 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: isDark ? "#ffffff" : "#003580", marginBottom: 4 }}>Perfil *</label>
                    <select value={editPerfil} onChange={(e) => setEditPerfil(e.target.value)}
                      className="w-full h-10 rounded-md border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      style={{ paddingLeft: 24, backgroundColor: "#ffffff", color: "#000000", borderColor: isDark ? "rgba(255,255,255,0.2)" : undefined }}>
                      <option value="">Selecione</option>
                      {perfis.map((pf) => <option key={pf} value={pf}>{pf}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: isDark ? "#ffffff" : "#003580", marginBottom: 4 }}>WhatsApp</label>
                    <Input type="tel" value={editWhatsapp} onChange={(e) => setEditWhatsapp(formatPhone(e.target.value))} style={{ paddingLeft: 24 }} />
                  </div>
                </div>
                <div style={{ marginBottom: 19 }}>
                  <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: isDark ? "#ffffff" : "#003580", marginBottom: 4 }}>E-mail *</label>
                  <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} style={{ paddingLeft: 24 }} />
                </div>
                <div style={{ marginBottom: 19 }}>
                  <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: isDark ? "#ffffff" : "#003580", marginBottom: 4 }}>Nova senha (6 dígitos)</label>
                  <p style={{ fontSize: 11, color: isDark ? "rgba(255,255,255,0.5)" : "#64748b", marginBottom: 4 }}>Deixe em branco para manter a senha atual.</p>
                  <div className="relative">
                    <Input type={showPassword ? "text" : "password"} inputMode="numeric" maxLength={6} placeholder="••••••"
                      value={editPassword} onChange={(e) => setEditPassword(e.target.value.replace(/\D/g, "").slice(0, 6))} className="pr-10" style={{ paddingLeft: 24 }} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                      style={{ color: isDark ? "rgba(255,255,255,0.5)" : "#64748b" }}>
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {editPassword && (
                  <div style={{ marginBottom: 19 }}>
                    <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: isDark ? "#ffffff" : "#003580", marginBottom: 4 }}>Confirmar senha</label>
                    <Input type={showPassword ? "text" : "password"} inputMode="numeric" maxLength={6} placeholder="••••••"
                      value={editConfirmPassword} onChange={(e) => setEditConfirmPassword(e.target.value.replace(/\D/g, "").slice(0, 6))} style={{ paddingLeft: 24 }} />
                  </div>
                )}
                <div style={{ display: "flex", gap: 16, marginTop: 32 }}>
                  <button type="button" onClick={cancelEdit}
                    style={{ flex: 1, height: 48, borderRadius: 12, border: isDark ? "2px solid #ffffff" : "2px solid #003580", backgroundColor: "transparent", color: isDark ? "#ffffff" : "#003580", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                    Cancelar
                  </button>
                  <button type="submit" disabled={isLoading}
                    style={{ flex: 1, height: 48, borderRadius: 12, backgroundColor: "#ffffff", color: "#003580", fontWeight: 700, fontSize: 15, border: "none", cursor: isLoading ? "not-allowed" : "pointer", opacity: isLoading ? 0.7 : 1 }}>
                    {isLoading ? <div className="w-5 h-5 border-2 border-[#003580] border-t-transparent rounded-full animate-spin" style={{ margin: "0 auto" }} /> : "Salvar"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Lista de moradores */}
          {lista.length > 0 && (() => {
            const listaFiltrada = busca.trim()
              ? lista.filter((m) => {
                  const term = busca.toLowerCase();
                  return (
                    m.name.toLowerCase().includes(term) ||
                    m.email.toLowerCase().includes(term) ||
                    (m.block || "").toLowerCase().includes(term) ||
                    (m.unit || "").toLowerCase().includes(term) ||
                    (m.perfil || "").toLowerCase().includes(term)
                  );
                })
              : lista;
            return (
            <div style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>

              {/* Campo de busca */}
              <div>
                <Input
                  type="text"
                  placeholder="Buscar por nome, e-mail, bloco, unidade ou perfil..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="h-11"
                  style={{ paddingLeft: "24px" }}
                />
              </div>

              <h3 className="text-sm font-medium uppercase tracking-wider" style={{ color: isDark ? "#ffffff" : "#003580", marginBottom: "8px" }}>
                Moradores cadastrados ({listaFiltrada.length})
              </h3>

              {listaFiltrada.length === 0 ? (
                <p className="text-center text-sm py-6" style={{ color: "#64748b" }}>
                  Nenhum morador encontrado para "{busca}".
                </p>
              ) : (
              listaFiltrada.map((m) => (
                <div key={m.id} className="flex items-center gap-4 rounded-xl" style={{ backgroundColor: "#ffffff", padding: "24px 20px", marginBottom: "19px" }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)" }}>
                    <Users className="w-5 h-5 text-white" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-medium truncate" style={{ color: "#003580" }}>{m.name}</p>
                    <p className="text-sm truncate" style={{ color: "#64748b" }}>
                      {m.block} · {m.unit} · {m.perfil || "Sem perfil"} · {m.email}
                    </p>
                  </div>
                  <button onClick={() => startEdit(m)} className="p-2.5 transition-colors" style={{ color: "#eab308" }}>
                    <Pencil className="w-5 h-5" />
                  </button>
                  <button onClick={() => handleDelete(m.id, m.name)} className="p-2.5 transition-colors" style={{ color: "#ef4444" }}>
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))
              )}
            </div>
            );
          })()}
        </div>
      </main>

      {/* Premium error modal */}
      {error && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}>
          <div style={{ width: "92%", maxWidth: 370, borderRadius: 20, background: "linear-gradient(180deg, #001d4a 0%, #00275e 50%, #003580 100%)", border: "1px solid rgba(255,255,255,0.15)", padding: "32px 24px", textAlign: "center" }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg, #ef4444, #dc2626)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <AlertCircle style={{ width: 36, height: 36, color: "#ffffff" }} />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: "#ffffff", marginBottom: 8 }}>Atenção</h3>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", marginBottom: 24, lineHeight: 1.5 }}>{error}</p>
            <button
              onClick={() => setError("")}
              style={{ width: "100%", height: 48, borderRadius: 12, backgroundColor: "#ffffff", color: "#003580", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer" }}
            >
              Entendi
            </button>
          </div>
        </div>
      )}

      {/* Premium success modal */}
      {success && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}>
          <div style={{ width: "92%", maxWidth: 370, borderRadius: 20, background: "linear-gradient(180deg, #001d4a 0%, #00275e 50%, #003580 100%)", border: "1px solid rgba(255,255,255,0.15)", padding: "32px 24px", textAlign: "center" }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg, #10b981, #059669)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <CheckCircle2 style={{ width: 36, height: 36, color: "#ffffff" }} />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: "#ffffff", marginBottom: 8 }}>Sucesso!</h3>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", marginBottom: 24, lineHeight: 1.5 }}>{success}</p>
            <button
              onClick={() => setSuccess("")}
              style={{ width: "100%", height: 48, borderRadius: 12, backgroundColor: "#ffffff", color: "#003580", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer" }}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
