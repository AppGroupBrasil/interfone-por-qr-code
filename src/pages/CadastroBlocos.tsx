import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import TutorialButton, { TSection, TStep, TBullet } from "@/components/TutorialButton";
import {
  ChevronLeft,
  Info,
  AlertCircle,
  CheckCircle2,
  Plus,
  Trash2,
  Pencil,
  Building2,
  Check,
  X,
  Filter,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";

interface Bloco {
  id: number;
  name: string;
  condominio_id: number;
  created_at: string;
}

interface Condominio {
  id: number;
  name: string;
}

export default function CadastroBlocos() {
  const { isDark, p } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [quantidade, setQuantidade] = useState("");
  const [personalizar, setPersonalizar] = useState(false);
  const [nomeBloco, setNomeBloco] = useState("");
  const [formCondominioId, setFormCondominioId] = useState("");

  const [lista, setLista] = useState<Bloco[]>([]);
  const [condominios, setCondominios] = useState<Condominio[]>([]);
  const [selectedCondominioId, setSelectedCondominioId] = useState<number | "all">("all");
  const [editingBlocoId, setEditingBlocoId] = useState<number | null>(null);
  const [editingBlocoName, setEditingBlocoName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [modalData, setModalData] = useState<{ titulo: string; detalhe: string } | null>(null);

  const fetchLista = () => {
    apiFetch("/api/blocos")
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

  useEffect(() => { fetchLista(); fetchCondominios(); }, []);

  const listaFiltrada = selectedCondominioId === "all"
    ? lista
    : lista.filter((b) => b.condominio_id === selectedCondominioId);



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (personalizar) {
      const nome = nomeBloco.trim();
      if (!nome) return setError("Informe o nome do bloco.");

      setIsLoading(true);
      try {
        const res = await apiFetch("/api/blocos/personalizado", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nomes: [nome], condominioId: formCondominioId ? parseInt(formCondominioId) : undefined }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erro ao cadastrar.");
        setModalData({ titulo: `Bloco "${nome}"`, detalhe: "cadastrado com sucesso" });
        setNomeBloco("");
        fetchLista();
      } catch (err: any) {
        setError(err.message || "Erro ao cadastrar bloco.");
      } finally {
        setIsLoading(false);
      }
    } else {
      const qtd = parseInt(quantidade);
      if (!qtd || qtd < 1) return setError("Informe uma quantidade válida (mínimo 1).");
      if (qtd > 200) return setError("Quantidade máxima: 200 blocos.");

      setIsLoading(true);
      try {
        const res = await apiFetch("/api/blocos/automatico", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantidade: qtd, condominioId: formCondominioId ? parseInt(formCondominioId) : undefined }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erro ao cadastrar.");
        setModalData({ titulo: `${qtd} bloco(s)`, detalhe: `Bloco 1 a Bloco ${qtd} cadastrados` });
        setQuantidade("");
        fetchLista();
      } catch (err: any) {
        setError(err.message || "Erro ao cadastrar blocos.");
      } finally {
        setIsLoading(false);
      }
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
          <span style={{ fontWeight: 700, fontSize: 18 }}>Cadastro de Blocos</span>
          <div style={{ marginLeft: "auto" }}>
            <TutorialButton title="Cadastro de Blocos">
              <TSection icon={<span>📋</span>} title="O QUE É ESTA FUNÇÃO?">
                <p>Cadastra e organiza os <strong>blocos, torres ou prédios</strong> do condomínio. Os blocos são a base da estrutura — moradores, visitantes e veículos são vinculados a eles. <strong>Cadastre os blocos ANTES de cadastrar moradores.</strong></p>
              </TSection>
              <TSection icon={<span>🏗️</span>} title="COMO CADASTRAR UM BLOCO">
                <TStep n={1}>Digite o nome do bloco no campo de texto (ex: "Bloco A", "Torre 1", "Prédio Norte")</TStep>
                <TStep n={2}>Clique no botão <strong>"Adicionar"</strong> para salvar</TStep>
                <TStep n={3}>O bloco aparece na lista imediatamente e já pode receber moradores</TStep>
                <p style={{ marginTop: "8px", fontSize: "13px", color: "#2d3354" }}>👉 Repita o processo para cada bloco/torre do condomínio.</p>
              </TSection>
              <TSection icon={<span>🔧</span>} title="GERENCIANDO BLOCOS">
                <TBullet><strong>Editar nome</strong> — Toque no ícone de lápis (✏️) ao lado do bloco para alterar o nome</TBullet>
                <TBullet><strong>Excluir bloco</strong> — Toque no ícone de lixeira (🗑️) para remover. Só funciona se não houver moradores vinculados</TBullet>
                <TBullet><strong>Buscar</strong> — Use o filtro para encontrar blocos específicos em condomínios grandes</TBullet>
                <TBullet><strong>Ordenação</strong> — Blocos são ordenados automaticamente por nome</TBullet>
              </TSection>
              <TSection icon={<span>⭐</span>} title="DICAS IMPORTANTES">
                <TBullet>Cadastre blocos <strong>antes</strong> de cadastrar moradores — os moradores precisam selecionar o bloco no cadastro</TBullet>
                <TBullet>Blocos com moradores vinculados <strong>não podem ser excluídos</strong> (remova os moradores primeiro)</TBullet>
                <TBullet>Use nomes claros e padronizados (ex: "Bloco A" em vez de "A") para facilitar a identificação</TBullet>
                <TBullet>Para condomínios de casas, cadastre como "Casa 1", "Casa 2", etc.</TBullet>
              </TSection>
            </TutorialButton>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1" style={{ paddingLeft: "1.5rem", paddingRight: "1.5rem", paddingTop: "1.5rem", paddingBottom: "3.5rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
          {/* Texto explicativo */}
          <div className="flex items-start gap-3 p-5 rounded-xl">
            <Info className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
            <div className="text-sm text-red-500 leading-relaxed space-y-2">
              <p>
                <strong>Blocos</strong> representam as divisões físicas do seu condomínio
                (torres, blocos, prédios).
              </p>
              <p>
                Se for uma <strong>empresa</strong>, coloque apenas o número{" "}
                <strong>1</strong> — cada funcionário será equivalente a um morador.
              </p>
            </div>
          </div>

          {/* Form card */}
          <div className="rounded-2xl" style={{ paddingLeft: "0", paddingRight: "0" }}>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {/* Seletor de condomínio (para administradora/master) */}
              {(user?.role === "administradora" || user?.role === "master") && condominios.length > 0 && (
                <div style={{ marginBottom: "19px" }}>
                  <Label style={{ display: "block", marginBottom: "4px", color: isDark ? "#ffffff" : undefined }}>Condomínio *</Label>
                  <select
                    value={formCondominioId}
                    onChange={(e) => setFormCondominioId(e.target.value)}
                    className="w-full h-10 rounded-md border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    style={isDark ? { paddingLeft: "24px", background: "#ffffff", color: "#000000" } : { paddingLeft: "24px" }}
                  >
                    <option value="" style={{ color: "#000000" }}>Selecione o condomínio</option>
                    {condominios.map((c) => (
                      <option key={c.id} value={c.id} style={{ color: "#000000" }}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Toggle personalizar */}
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  className={`w-10 h-6 rounded-full relative transition-colors duration-200 ${
                    personalizar ? "bg-[#003580]" : "bg-border"
                  }`}
                  onClick={() => setPersonalizar(!personalizar)}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                      personalizar ? "translate-x-5" : "translate-x-1"
                    }`}
                  />
                </div>
                <span className="text-sm" style={{ color: isDark ? "#ffffff" : "#003580" }}>
                  Personalizar cadastro (cadastrar 1 por 1)
                </span>
              </label>

              {!personalizar ? (
                <>
                  {/* Modo automático: quantidade */}
                  <div style={{ marginBottom: "19px" }}>
                    <Label htmlFor="quantidade" style={{ display: "block", marginBottom: "4px", color: isDark ? "#ffffff" : undefined }}>Quantidade de blocos</Label>
                    <Input
                      id="quantidade"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={200}
                      placeholder="Ex: 5"
                      value={quantidade}
                      onChange={(e) => setQuantidade(e.target.value)}
                      style={{ paddingLeft: "24px" }}
                    />
                    <p style={{ color: "#facc15", fontSize: "13px", marginTop: "4px" }}>
                      O sistema criará automaticamente Bloco 1, Bloco 2, Bloco 3...
                      até a quantidade informada.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  {/* Modo personalizado: 1 bloco por vez */}
                  <div style={{ marginBottom: "19px" }}>
                    <Label style={{ display: "block", marginBottom: "4px", color: isDark ? "#ffffff" : undefined }}>Nome do bloco</Label>
                    <Input
                      placeholder="Ex: Torre A, Bloco Norte, Casa 1..."
                      value={nomeBloco}
                      onChange={(e) => setNomeBloco(e.target.value)}
                      style={{ paddingLeft: "24px" }}
                    />
                  </div>
                </>
              )}

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
                <div className="flex items-center gap-2 p-3 text-emerald-500 animate-fade-in" style={{ fontSize: "15px" }}>
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  {success}
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
                  "Cadastrar Blocos"
                )}
              </Button>
            </form>
          </div>

          {/* Lista de blocos existentes */}
          {lista.length > 0 && (
            <div style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <h3 className="text-sm font-medium uppercase tracking-wider" style={{ color: isDark ? "#ffffff" : "#003580", marginBottom: "8px" }}>
                Blocos cadastrados ({listaFiltrada.length})
              </h3>

              {/* Filtro por condomínio */}
              {condominios.length > 0 && (
                <div className="flex items-center gap-3 p-4 rounded-xl border border-border/50" style={{ marginBottom: "19px" }}>
                  <Filter className="w-5 h-5 text-sky-400 shrink-0" />
                  <select
                    value={selectedCondominioId}
                    onChange={(e) => setSelectedCondominioId(e.target.value === "all" ? "all" : Number(e.target.value))}
                    className="flex-1 h-10 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                    style={isDark ? { paddingLeft: "24px", background: "#ffffff", color: "#000000" } : { paddingLeft: "24px" }}
                  >
                    <option value="all">Todos os condomínios</option>
                    {condominios.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column" }}>
              {listaFiltrada.length === 0 ? (
                <p className="text-center text-sm py-6" style={{ color: "#64748b" }}>
                  Nenhum bloco encontrado para este condomínio.
                </p>
              ) : (
                listaFiltrada.map((b) => (
                <div key={b.id} className="flex items-center gap-4 rounded-xl" style={{ backgroundColor: "#ffffff", padding: "24px 20px", marginBottom: "19px" }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)" }}>
                    <Building2 className="w-5 h-5 text-white" strokeWidth={1.5} />
                  </div>
                  {editingBlocoId === b.id ? (
                    <>
                      <Input
                        value={editingBlocoName}
                        onChange={(e) => setEditingBlocoName(e.target.value)}
                        className="flex-1 h-8 text-sm"
                        autoFocus
                        onKeyDown={(e) => { if (e.key === "Enter") handleSaveBloco(b.id); if (e.key === "Escape") setEditingBlocoId(null); }}
                      />
                      <button onClick={() => handleSaveBloco(b.id)} className="p-2 text-emerald-400 hover:text-emerald-300 transition-colors">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditingBlocoId(null)} className="p-2 hover:text-foreground transition-colors" style={{ color: "#94a3b8" }}>
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-medium truncate" style={{ color: "#003580" }}>{b.name}</p>
                      </div>
                      <button onClick={() => { setEditingBlocoId(b.id); setEditingBlocoName(b.name); }} className="p-2.5 transition-colors" style={{ color: "#eab308" }}>
                        <Pencil className="w-5 h-5" />
                      </button>
                      <button onClick={() => handleDeleteBloco(b.id, b.name)} className="p-2.5 transition-colors" style={{ color: "#ef4444" }}>
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </div>
              ))
              )}
              </div>
            </div>
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
              <Building2 className="w-9 h-9 text-white" strokeWidth={2} />
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#ffffff", marginBottom: 6 }}>Bloco Cadastrado!</h2>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", marginBottom: 24 }}>{modalData.detalhe}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderRadius: 10, backgroundColor: "rgba(255,255,255,0.07)" }}>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>Bloco(s)</span>
                <span style={{ fontSize: 14, color: "#ffffff", fontWeight: 600, textAlign: "right", maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{modalData.titulo}</span>
              </div>
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

  async function handleSaveBloco(id: number) {
    if (!editingBlocoName.trim()) return;
    try {
      const res = await apiFetch(`/api/blocos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingBlocoName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEditingBlocoId(null);
      fetchLista();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDeleteBloco(id: number, name: string) {
    if (!confirm(`Excluir bloco "${name}"?`)) return;
    try {
      const res = await apiFetch(`/api/blocos/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      fetchLista();
    } catch (err: any) {
      setError(err.message);
    }
  }
}
