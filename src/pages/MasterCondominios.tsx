import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import TutorialButton, { TSection, TStep, TBullet } from "@/components/TutorialButton";
import { AppLogo } from "@/components/AppLogo";
import {
  Building2,
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Users,
  Layers,
  Briefcase,
  Search,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useTheme } from "@/hooks/useTheme";

const API = "/api";

interface Condominio {
  id: number;
  name: string;
  cnpj: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  units_count: number;
  created_at: string;
  stats?: { moradores: number; blocos: number; funcionarios: number };
}

export default function MasterCondominios() {
  const { isDark, p } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [condominios, setCondominios] = useState<Condominio[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", cnpj: "", address: "", city: "", state: "", unitsCount: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedStats, setExpandedStats] = useState<any>(null);

  useEffect(() => {
    if (user?.role !== "master" && user?.role !== "administradora") {
      navigate("/dashboard");
      return;
    }
    fetchCondominios();
  }, []);

  async function fetchCondominios() {
    setLoading(true);
    try {
      const res = await apiFetch(`${API}/condominios`);
      const data = await res.json();
      setCondominios(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchStats(id: number) {
    try {
      const res = await apiFetch(`${API}/condominios/${id}`);
      const data = await res.json();
      setExpandedStats(data.stats);
    } catch (err) {
      console.error(err);
    }
  }

  function handleExpand(id: number) {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedStats(null);
    } else {
      setExpandedId(id);
      setExpandedStats(null);
      fetchStats(id);
    }
  }

  function handleEdit(c: Condominio) {
    setEditingId(c.id);
    setForm({
      name: c.name,
      cnpj: c.cnpj || "",
      address: c.address || "",
      city: c.city || "",
      state: c.state || "",
      unitsCount: String(c.units_count || ""),
    });
    setShowForm(true);
    setError("");
  }

  function handleNew() {
    setEditingId(null);
    setForm({ name: "", cnpj: "", address: "", city: "", state: "", unitsCount: "" });
    setShowForm(true);
    setError("");
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError("Nome é obrigatório.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editingId) {
        const res = await apiFetch(`${API}/condominios/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
      }
      // Note: create condominio goes through register flow, not direct API
      setShowForm(false);
      fetchCondominios();
    } catch (err: any) {
      setError(err.message || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c: Condominio) {
    if (!confirm(`Excluir "${c.name}" e TODOS os dados relacionados?`)) return;
    try {
      const res = await apiFetch(`${API}/condominios/${c.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      fetchCondominios();
    } catch (err: any) {
      alert(err.message || "Erro ao excluir.");
    }
  }

  const filtered = condominios.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.cnpj && c.cnpj.includes(search))
  );

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40" style={{ background: p.headerBg, borderBottom: p.headerBorder, boxShadow: p.headerShadow, color: p.text }}>
        <div className="px-4 h-14 flex items-center gap-3">
          <button onClick={() => navigate("/dashboard")} className="p-1">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <AppLogo size={24} rounded={6} objectFit="cover" />
          <span className="font-semibold text-sm">Gestão de Condomínios</span>
          <TutorialButton title="Gestão de Condomínios">
            <TSection icon={<span>📋</span>} title="O QUE É ESTA FUNÇÃO?">
              <p><strong>Painel Master</strong> para criar, editar e gerenciar todos os condomínios do sistema. Aqui você cadastra cada condomínio com seus dados (nome, CNPJ, endereço), vincula administradoras e síndicos, e acompanha a quantidade de moradores, blocos e unidades de cada um.</p>
            </TSection>
            <TSection icon={<span>🏗️</span>} title="COMO CADASTRAR UM CONDOMÍNIO">
              <TStep n={1}>Clique no botão <strong>"+"</strong> para abrir o formulário de novo condomínio</TStep>
              <TStep n={2}>Preencha o <strong>nome</strong> do condomínio (ex: "Residencial Flores")</TStep>
              <TStep n={3}>Informe o <strong>CNPJ</strong> do condomínio (se houver)</TStep>
              <TStep n={4}>Preencha o <strong>endereço completo</strong> (rua, número, bairro, cidade, estado)</TStep>
              <TStep n={5}>Informe o <strong>número de unidades</strong> (total de apartamentos/casas)</TStep>
              <TStep n={6}>Vincule uma <strong>administradora</strong> (opcional — pode vincular depois)</TStep>
              <TStep n={7}>Clique em <strong>"Cadastrar"</strong> para salvar</TStep>
              <p style={{ marginTop: "8px", fontSize: "13px", color: p.textSecondary }}>👉 Após cadastrar, vincule um síndico para que ele configure o condomínio (blocos, moradores, funcionários).</p>
            </TSection>
            <TSection icon={<span>🔧</span>} title="GERENCIANDO CONDOMÍNIOS">
              <TBullet><strong>Editar</strong> — Altere nome, endereço, CNPJ ou número de unidades</TBullet>
              <TBullet><strong>Excluir</strong> — Remove o condomínio e todos os dados associados (moradores, funcionários, etc.)</TBullet>
              <TBullet><strong>Buscar</strong> — Encontre condomínios por nome ou CNPJ</TBullet>
              <TBullet><strong>Contadores</strong> — Veja quantos moradores, blocos e unidades cada condomínio tem</TBullet>
              <TBullet><strong>Vínculos</strong> — Veja qual administradora e síndico estão associados</TBullet>
            </TSection>
            <TSection icon={<span>⭐</span>} title="DICAS IMPORTANTES">
              <TBullet>A ordem de configuração ideal: <strong>Condomínio → Administradora → Síndico → Blocos → Moradores → Funcionários</strong></TBullet>
              <TBullet>Excluir um condomínio <strong>apaga TODOS os dados</strong> (moradores, funcionários, visitantes, etc.) — use com cuidado</TBullet>
              <TBullet>Se um condomínio trocar de administradora, <strong>edite o vínculo</strong> em vez de excluir e recadastrar</TBullet>
              <TBullet>O CNPJ é opcional mas recomendado para identificação formal</TBullet>
            </TSection>
          </TutorialButton>
          <div className="flex-1" />
          <button
            onClick={handleNew}
            className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Search */}
      <div style={{ padding: "12px 24px", marginBottom: "8px" }}>
        <div className="flex items-center gap-2 h-10 rounded-lg border" style={{ paddingLeft: "24px", paddingRight: "12px", background: p.cardBg, borderColor: p.divider }}>
          <Search className="w-4 h-4 shrink-0" style={{ color: p.textMuted }} />
          <input
            type="text"
            placeholder="Buscar por nome ou CNPJ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm focus:outline-none"
            style={{ color: p.text }}
          />
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="pb-4" style={{ paddingLeft: "24px", paddingRight: "24px" }}>
          <div className="rounded-xl border border-sky-500/30 bg-card p-4" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                {editingId ? "Editar Condomínio" : "Novo Condomínio"}
              </h3>
              <button onClick={() => setShowForm(false)}>
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <input
              placeholder="Nome *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            />
            <input
              placeholder="CNPJ"
              value={form.cnpj}
              onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            />
            <input
              placeholder="Endereço"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                placeholder="Cidade"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              />
              <input
                placeholder="Estado"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                className="h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              />
            </div>
            <input
              placeholder="Qtd. Unidades"
              type="number"
              value={form.unitsCount}
              onChange={(e) => setForm({ ...form, unitsCount: e.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full h-10 rounded-lg text-white text-sm font-medium disabled:opacity-50 transition-colors"
              style={{ background: p.accent }}
            >
              {saving ? "Salvando..." : editingId ? "Salvar Alterações" : "Criar Condomínio"}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <main className="flex-1 pb-6 space-y-3" style={{ paddingLeft: "24px", paddingRight: "24px" }}>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm py-8" style={{ color: p.textMuted }}>Nenhum condomínio encontrado.</p>
        ) : (
          filtered.map((c) => (
            <div key={c.id} className="rounded-xl overflow-hidden" style={{ background: p.cardBg, border: p.cardBorder }}>
              <div
                onClick={() => handleExpand(c.id)}
                className="w-full flex items-center text-left cursor-pointer"
                style={{ paddingLeft: "16px", paddingRight: "12px", paddingTop: "24px", paddingBottom: "24px", gap: "16px" }}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: p.btnGrad }}>
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: p.textAccent }}>{c.name}</p>
                  <p className="text-[10px]" style={{ color: p.textSecondary }}>
                    {c.cnpj || "Sem CNPJ"} • {c.units_count || 0} unidades
                  </p>
                </div>
                <div className="flex gap-3 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleEdit(c); }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ border: "2px solid #0ea5e9" }}
                  >
                    <Pencil className="w-3.5 h-3.5" style={{ color: "#0ea5e9" }} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(c); }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ border: "2px solid #ef4444" }}
                  >
                    <Trash2 className="w-3.5 h-3.5" style={{ color: "#ef4444" }} />
                  </button>
                </div>
              </div>

              {/* Expanded stats */}
              {expandedId === c.id && (
                <div className="px-4 pb-3">
                  {expandedStats ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3">
                      <div className="flex flex-col items-center">
                        <Users className="w-4 h-4 text-emerald-400 mb-1" />
                        <span className="text-sm font-bold" style={{ color: p.textAccent }}>{expandedStats.moradores}</span>
                        <span className="text-[9px]" style={{ color: p.textMuted }}>Moradores</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <Layers className="w-4 h-4 text-amber-400 mb-1" />
                        <span className="text-sm font-bold" style={{ color: p.textAccent }}>{expandedStats.blocos}</span>
                        <span className="text-[9px]" style={{ color: p.textMuted }}>Blocos</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <Briefcase className="w-4 h-4 text-purple-400 mb-1" />
                        <span className="text-sm font-bold" style={{ color: p.textAccent }}>{expandedStats.funcionarios}</span>
                        <span className="text-[9px]" style={{ color: p.textMuted }}>Funcionários</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-center py-3">
                      <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  <p className="text-[10px] mt-2 text-center" style={{ color: p.textSecondary }}>
                    {c.address && `${c.address}, `}{c.city && `${c.city}`}{c.state && ` - ${c.state}`}
                  </p>
                  <p className="text-[10px] text-center" style={{ color: p.textSecondary }}>
                    Criado em {new Date(c.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              )}
            </div>
          ))
        )}
      </main>
    </div>
  );
}
