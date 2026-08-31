import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import { formatDoc, docLabelOf } from "@/lib/documento";
import TutorialButton, { TSection, TStep, TBullet } from "@/components/TutorialButton";
import {
  ArrowLeft,
  Building2,
  Search,
  Users,
  Shield,
  ShieldOff,
  DollarSign,
  Clock,
  Activity,
  Ban,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Lock,
  Unlock,
  ArrowUpDown,
  Filter,
  BarChart3,
  Eye,
  Calendar,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

const API = "/api/master";

interface CondoRow {
  id: number;
  name: string;
  cnpj: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  units_count: number;
  created_at: string;
  status_pagamento: string;
  bloqueado: number;
  bloqueado_at: string | null;
  bloqueado_motivo: string | null;
  last_access_at: string | null;
  access_count: number;
  total_users: number;
  total_moradores: number;
  total_sindicos: number;
  total_funcionarios: number;
  total_blocos: number;
  admin_name: string | null;
  admin_email: string | null;
  dias_cadastro: number;
}

interface Summary {
  total: number;
  adimplentes: number;
  inadimplentes: number;
  bloqueados: number;
  ativos30d: number;
  semAcesso: number;
}

export default function MasterPainelCondominios() {
  const { isDark, p } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [condominios, setCondominios] = useState<CondoRow[]>([]);
  const [summary, setSummary] = useState<Summary>({ total: 0, adimplentes: 0, inadimplentes: 0, bloqueados: 0, ativos30d: 0, semAcesso: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterPagamento, setFilterPagamento] = useState("todos");
  const [filterBloqueado, setFilterBloqueado] = useState("todos");
  const [sortField, setSortField] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [blockMotivo, setBlockMotivo] = useState("");
  const [showBlockModal, setShowBlockModal] = useState<number | null>(null);

  useEffect(() => {
    if (user?.role !== "master" && user?.role !== "administradora") {
      navigate("/dashboard");
      return;
    }
    fetchDashboard();
  }, []);

  async function fetchDashboard() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterPagamento !== "todos") params.set("status_pagamento", filterPagamento);
      if (filterBloqueado !== "todos") params.set("bloqueado", filterBloqueado);
      params.set("sort", sortField);
      params.set("order", sortOrder);

      const res = await apiFetch(`${API}/condominios-dashboard?${params}`);
      const data = await res.json();
      setCondominios(data.condominios);
      setSummary(data.summary);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => fetchDashboard(), 300);
    return () => clearTimeout(timeout);
  }, [search, filterPagamento, filterBloqueado, sortField, sortOrder]);

  async function handleTogglePagamento(condo: CondoRow) {
    setActionLoading(condo.id);
    try {
      const novo = condo.status_pagamento === "adimplente" ? "inadimplente" : "adimplente";
      const res = await apiFetch(`${API}/condominios/${condo.id}/status-pagamento`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status_pagamento: novo }),
      });
      if (res.ok) {
        setCondominios(prev => prev.map(c =>
          c.id === condo.id ? { ...c, status_pagamento: novo } : c
        ));
        setSummary(prev => ({
          ...prev,
          adimplentes: prev.adimplentes + (novo === "adimplente" ? 1 : -1),
          inadimplentes: prev.inadimplentes + (novo === "inadimplente" ? 1 : -1),
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleBlock(condoId: number) {
    setActionLoading(condoId);
    try {
      const res = await apiFetch(`${API}/condominios/${condoId}/bloquear`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bloqueado: true, motivo: blockMotivo || "Inadimplência" }),
      });
      if (res.ok) {
        setCondominios(prev => prev.map(c =>
          c.id === condoId ? { ...c, bloqueado: 1, bloqueado_motivo: blockMotivo || "Inadimplência", bloqueado_at: new Date().toISOString() } : c
        ));
        setSummary(prev => ({ ...prev, bloqueados: prev.bloqueados + 1 }));
        setShowBlockModal(null);
        setBlockMotivo("");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUnblock(condoId: number) {
    setActionLoading(condoId);
    try {
      const res = await apiFetch(`${API}/condominios/${condoId}/bloquear`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bloqueado: false }),
      });
      if (res.ok) {
        setCondominios(prev => prev.map(c =>
          c.id === condoId ? { ...c, bloqueado: 0, bloqueado_motivo: null, bloqueado_at: null } : c
        ));
        setSummary(prev => ({ ...prev, bloqueados: prev.bloqueados - 1 }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  }

  function handleSort(field: string) {
    if (sortField === field) {
      setSortOrder(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  }

  function formatDate(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function formatDateTime(d: string | null) {
    if (!d) return "Nunca";
    return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function tempoRelativo(dias: number) {
    if (dias === 0) return "Hoje";
    if (dias === 1) return "1 dia";
    if (dias < 30) return `${dias} dias`;
    if (dias < 365) return `${Math.floor(dias / 30)} meses`;
    return `${Math.floor(dias / 365)}a ${Math.floor((dias % 365) / 30)}m`;
  }

  function ultimoAcessoLabel(d: string | null) {
    if (!d) return { text: "Nunca", color: "#94a3b8" };
    const diffMs = Date.now() - new Date(d).getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return { text: "Hoje", color: "#22c55e" };
    if (diffDays === 1) return { text: "Ontem", color: "#22c55e" };
    if (diffDays <= 7) return { text: `${diffDays}d atrás`, color: "#f59e0b" };
    if (diffDays <= 30) return { text: `${diffDays}d atrás`, color: "#f97316" };
    return { text: `${diffDays}d atrás`, color: "#ef4444" };
  }

  // Stats cards data
  const statsCards = useMemo(() => [
    { label: "Total", value: summary.total, icon: Building2, bg: "#e0f2fe", color: "#0284c7" },
    { label: "Adimplentes", value: summary.adimplentes, icon: CheckCircle2, bg: "#dcfce7", color: "#16a34a" },
    { label: "Inadimplentes", value: summary.inadimplentes, icon: AlertTriangle, bg: "#fef3c7", color: "#d97706" },
    { label: "Bloqueados", value: summary.bloqueados, icon: Ban, bg: "#fee2e2", color: "#dc2626" },
    { label: "Ativos 30d", value: summary.ativos30d, icon: Activity, bg: "#f0fdf4", color: "#15803d" },
    { label: "Sem Acesso", value: summary.semAcesso, icon: XCircle, bg: "#f1f5f9", color: "#64748b" },
  ], [summary]);

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {/* Header */}
      <header
        className="sticky top-0 z-40"
        style={{ background: p.headerBg, borderBottom: p.headerBorder, boxShadow: p.headerShadow, padding: "1rem 1.5rem", color: p.text }}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="p-2 rounded-xl bg-white/15 hover:bg-white/25 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 flex-1">
            <BarChart3 className="w-6 h-6" />
            <div>
              <h1 className="font-bold text-lg">Painel de Condomínios</h1>
              <p className="text-white/60 text-xs">Gestão, métricas e controle financeiro</p>
            </div>
          </div>
          <button
            onClick={() => fetchDashboard()}
            className="p-2 rounded-xl bg-white/15 hover:bg-white/25 transition-all"
            title="Atualizar"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <TutorialButton title="Painel de Condomínios">
            <TSection icon={<span>📊</span>} title="O QUE É ESTE PAINEL?">
              <p>Dashboard administrativo para acompanhar todos os condomínios do sistema com métricas de uso, status financeiro e controle de acesso.</p>
            </TSection>
            <TSection icon={<span>💰</span>} title="STATUS FINANCEIRO">
              <TBullet><strong>Adimplente</strong> — Condomínio em dia com pagamentos</TBullet>
              <TBullet><strong>Inadimplente</strong> — Condomínio com pendências financeiras</TBullet>
              <TBullet>O status é definido manualmente pelo administrador master</TBullet>
            </TSection>
            <TSection icon={<span>🔒</span>} title="BLOQUEIO DE ACESSO">
              <TBullet>Bloquear um condomínio <strong>impede o login de TODOS os usuários</strong> daquele condomínio</TBullet>
              <TBullet>Usuários que já estão logados são <strong>desconectados na próxima requisição</strong></TBullet>
              <TBullet>O bloqueio pode ser revertido a qualquer momento</TBullet>
            </TSection>
            <TSection icon={<span>📈</span>} title="MÉTRICAS DE USO">
              <TBullet><strong>Último acesso</strong> — Data/hora do último login de qualquer usuário do condomínio</TBullet>
              <TBullet><strong>Total de acessos</strong> — Quantidade de logins realizados (indica engajamento)</TBullet>
              <TBullet><strong>Dias de cadastro</strong> — Tempo desde que o condomínio foi registrado</TBullet>
            </TSection>
          </TutorialButton>
        </div>
      </header>

      <main style={{ flex: 1, display: "flex", flexDirection: "column", gap: "16px", padding: "16px", paddingBottom: "100px" }}>

        {/* ═══ Stats Cards ═══ */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px" }}>
          {statsCards.map(card => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                style={{
                  background: isDark ? "#ffffff" : "var(--color-card, #fff)", borderRadius: "14px",
                  padding: "14px 12px", display: "flex", flexDirection: "column",
                  alignItems: "center", gap: "6px", border: isDark ? "none" : p.btnBorder,
                }}
              >
                <div style={{
                  width: "32px", height: "32px", borderRadius: "8px",
                  background: isDark ? "#e0f2fe" : card.bg, display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon style={{ width: "16px", height: "16px", color: isDark ? "#003580" : card.color }} />
                </div>
                <span style={{ fontSize: "22px", fontWeight: 800, color: isDark ? "#003580" : card.color }}>{card.value}</span>
                <span style={{ fontSize: "10px", fontWeight: 600, color: isDark ? "#1e293b" : "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>{card.label}</span>
              </div>
            );
          })}
        </div>

        {/* ═══ Search + Filters ═══ */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              background: isDark ? "#ffffff" : "var(--color-card, #fff)", borderRadius: "12px",
              padding: "0 14px", height: "44px", border: isDark ? "none" : p.btnBorder,
            }}
          >
            <Search style={{ width: "16px", height: "16px", color: isDark ? "#64748b" : "#94a3b8" }} />
            <input
              type="text"
              placeholder="Buscar por nome, CPF/CNPJ ou cidade..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                flex: 1, border: "none", background: "transparent", outline: "none",
                fontSize: "14px", color: isDark ? "#1e293b" : "var(--color-foreground, #0f172a)",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <div style={{ flex: 1, position: "relative" }}>
              <select
                value={filterPagamento}
                onChange={e => setFilterPagamento(e.target.value)}
                style={{
                  width: "100%", height: "38px", borderRadius: "10px", padding: "0 12px",
                  border: isDark ? "none" : p.btnBorder, fontSize: "12px", fontWeight: 600,
                  background: isDark ? "#ffffff" : "var(--color-card, #fff)", color: isDark ? "#1e293b" : "var(--color-foreground, #0f172a)",
                  appearance: "none", cursor: "pointer",
                }}
              >
                <option value="todos">💰 Todos</option>
                <option value="adimplente">✅ Adimplentes</option>
                <option value="inadimplente">⚠️ Inadimplentes</option>
              </select>
              <Filter style={{ position: "absolute", right: "10px", top: "11px", width: "14px", height: "14px", color: "#94a3b8", pointerEvents: "none" }} />
            </div>
            <div style={{ flex: 1, position: "relative" }}>
              <select
                value={filterBloqueado}
                onChange={e => setFilterBloqueado(e.target.value)}
                style={{
                  width: "100%", height: "38px", borderRadius: "10px", padding: "0 12px",
                  border: isDark ? "none" : p.btnBorder, fontSize: "12px", fontWeight: 600,
                  background: isDark ? "#ffffff" : "var(--color-card, #fff)", color: isDark ? "#1e293b" : "var(--color-foreground, #0f172a)",
                  appearance: "none", cursor: "pointer",
                }}
              >
                <option value="todos">🏢 Todos</option>
                <option value="false">🟢 Ativos</option>
                <option value="true">🔴 Bloqueados</option>
              </select>
              <Filter style={{ position: "absolute", right: "10px", top: "11px", width: "14px", height: "14px", color: "#94a3b8", pointerEvents: "none" }} />
            </div>
          </div>

          {/* Sort buttons */}
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {[
              { field: "created_at", label: "Cadastro" },
              { field: "last_access_at", label: "Últ. Acesso" },
              { field: "access_count", label: "Acessos" },
              { field: "name", label: "Nome" },
              { field: "total_users", label: "Usuários" },
            ].map(s => (
              <button
                key={s.field}
                onClick={() => handleSort(s.field)}
                style={{
                  display: "flex", alignItems: "center", gap: "4px",
                  padding: "6px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: 600,
                  border: isDark ? "none" : (sortField === s.field ? "2px solid #2d3354" : p.btnBorder),
                  background: isDark ? "#ffffff" : (sortField === s.field ? "rgba(45,51,84,0.08)" : "var(--color-card, #fff)"),
                  color: isDark ? (sortField === s.field ? "#003580" : "#475569") : (sortField === s.field ? "#2d3354" : "#64748b"),
                  cursor: "pointer",
                }}
              >
                {s.label}
                {sortField === s.field && (
                  sortOrder === "desc"
                    ? <ChevronDown style={{ width: "12px", height: "12px" }} />
                    : <ChevronUp style={{ width: "12px", height: "12px" }} />
                )}
                {sortField !== s.field && <ArrowUpDown style={{ width: "10px", height: "10px", opacity: 0.4 }} />}
              </button>
            ))}
          </div>
        </div>

        {/* ═══ Condominios List ═══ */}
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "48px" }}>
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#64748b" }} />
          </div>
        ) : condominios.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px", color: "#94a3b8", fontSize: "14px" }}>
            Nenhum condomínio encontrado.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {condominios.map(condo => {
              const isExpanded = expandedId === condo.id;
              const acesso = ultimoAcessoLabel(condo.last_access_at);
              const isLoading = actionLoading === condo.id;

              return (
                <div
                  key={condo.id}
                  style={{
                    background: isDark ? "#ffffff" : "var(--color-card, #fff)", borderRadius: "16px",
                    border: condo.bloqueado
                      ? "2px solid #ef4444"
                      : condo.status_pagamento === "inadimplente"
                        ? "2px solid #f59e0b"
                        : isDark ? "none" : p.btnBorder,
                    overflow: "hidden",
                    opacity: condo.bloqueado ? 0.85 : 1,
                  }}
                >
                  {/* Main row */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : condo.id)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: "12px",
                      padding: "14px 16px", border: "none", background: "none", cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    {/* Status indicator */}
                    <div style={{
                      width: "44px", height: "44px", borderRadius: "12px",
                      background: isDark
                        ? "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)"
                        : (condo.bloqueado ? "#fee2e2" : condo.status_pagamento === "inadimplente" ? "#fef3c7" : "#dcfce7"),
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                      {condo.bloqueado
                        ? <Ban style={{ width: "20px", height: "20px", color: isDark ? "#ffffff" : "#dc2626" }} />
                        : condo.status_pagamento === "inadimplente"
                          ? <AlertTriangle style={{ width: "20px", height: "20px", color: isDark ? "#ffffff" : "#d97706" }} />
                          : <Building2 style={{ width: "20px", height: "20px", color: isDark ? "#ffffff" : "#16a34a" }} />
                      }
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <p style={{ fontWeight: 700, fontSize: "14px", color: isDark ? "#1e293b" : "var(--color-foreground, #0f172a)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {condo.name}
                        </p>
                        {condo.bloqueado === 1 && (
                          <span style={{
                            fontSize: "9px", fontWeight: 700, padding: "2px 6px", borderRadius: "6px",
                            background: "#dc2626", color: p.text, textTransform: "uppercase", flexShrink: 0,
                          }}>Bloqueado</span>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "11px", color: isDark ? "#475569" : "#64748b" }}>
                          <Users style={{ width: "10px", height: "10px", display: "inline", marginRight: "2px" }} />
                          {condo.total_users}
                        </span>
                        <span style={{ fontSize: "11px", color: acesso.color, fontWeight: 600 }}>
                          {acesso.text}
                        </span>
                        <span style={{ fontSize: "11px", color: isDark ? "#475569" : "#94a3b8" }}>
                          {tempoRelativo(condo.dias_cadastro)}
                        </span>
                      </div>
                    </div>

                    {/* Access count badge */}
                    <div style={{
                      display: "flex", flexDirection: "column", alignItems: "center",
                      padding: "6px 10px", borderRadius: "10px",
                      background: isDark ? "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)" : "#f1f5f9",
                      flexShrink: 0,
                    }}>
                      <span style={{ fontSize: "16px", fontWeight: 800, color: isDark ? "#ffffff" : "#0f172a" }}>{condo.access_count || 0}</span>
                      <span style={{ fontSize: "8px", fontWeight: 600, color: isDark ? "#ffffff" : "#64748b", textTransform: "uppercase" }}>acessos</span>
                    </div>

                    {isExpanded
                      ? <ChevronUp style={{ width: "16px", height: "16px", color: "#94a3b8", flexShrink: 0 }} />
                      : <ChevronDown style={{ width: "16px", height: "16px", color: "#94a3b8", flexShrink: 0 }} />
                    }
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                      {/* Divider */}
                      <div style={{ height: "1px", background: "rgba(0,0,0,0.06)" }} />

                      {/* Detail grid */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                        <DetailItem icon={Calendar} label="Cadastro" value={formatDate(condo.created_at)} />
                        <DetailItem icon={Clock} label="Último Acesso" value={formatDateTime(condo.last_access_at)} />
                        <DetailItem icon={Activity} label="Total Acessos" value={String(condo.access_count || 0)} />
                        <DetailItem icon={Clock} label="Dias de Cadastro" value={`${condo.dias_cadastro} dias`} />
                        <DetailItem icon={Users} label="Moradores" value={String(condo.total_moradores)} />
                        <DetailItem icon={Shield} label="Síndicos" value={String(condo.total_sindicos)} />
                        <DetailItem icon={Users} label="Funcionários" value={String(condo.total_funcionarios)} />
                        <DetailItem icon={Building2} label="Blocos" value={String(condo.total_blocos)} />
                      </div>

                      {/* Admin info */}
                      {condo.admin_name && (
                        <div style={{
                          padding: "10px 14px", borderRadius: "10px", background: "#f1f5f9",
                          fontSize: "12px",
                        }}>
                          <span style={{ fontWeight: 600, color: "#475569" }}>Síndico: </span>
                          <span style={{ color: "#0f172a" }}>{condo.admin_name}</span>
                          {condo.admin_email && <span style={{ color: "#64748b" }}> ({condo.admin_email})</span>}
                        </div>
                      )}

                      {/* CNPJ / Location */}
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", fontSize: "11px", color: "#64748b" }}>
                        {condo.cnpj && <span>{docLabelOf(condo.cnpj)}: {formatDoc(condo.cnpj)}</span>}
                        {condo.city && <span>📍 {condo.city}{condo.state ? ` - ${condo.state}` : ""}</span>}
                      </div>

                      {/* Block reason */}
                      {condo.bloqueado === 1 && condo.bloqueado_motivo && (
                        <div style={{
                          padding: "10px 14px", borderRadius: "10px", background: "#fef2f2",
                          fontSize: "12px", color: "#991b1b", display: "flex", alignItems: "center", gap: "8px",
                        }}>
                          <Ban style={{ width: "14px", height: "14px", flexShrink: 0 }} />
                          <div>
                            <span style={{ fontWeight: 600 }}>Motivo do bloqueio: </span>
                            {condo.bloqueado_motivo}
                            {condo.bloqueado_at && (
                              <span style={{ color: "#b91c1c", marginLeft: "6px" }}>
                                ({formatDate(condo.bloqueado_at)})
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div style={{ display: "flex", gap: "8px" }}>
                        {/* Status Pagamento toggle */}
                        <button
                          onClick={() => handleTogglePagamento(condo)}
                          disabled={isLoading}
                          style={{
                            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                            padding: "10px", borderRadius: "12px", border: "none", cursor: "pointer",
                            fontWeight: 700, fontSize: "12px",
                            background: condo.status_pagamento === "adimplente"
                              ? "linear-gradient(135deg, #f59e0b, #d97706)"
                              : "linear-gradient(135deg, #22c55e, #16a34a)",
                            color: "#fff",
                            opacity: isLoading ? 0.7 : 1,
                          }}
                        >
                          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign style={{ width: "14px", height: "14px" }} />}
                          {condo.status_pagamento === "adimplente" ? "Marcar Inadimplente" : "Marcar Adimplente"}
                        </button>

                        {/* Block/Unblock button */}
                        {condo.bloqueado === 1 ? (
                          <button
                            onClick={() => handleUnblock(condo.id)}
                            disabled={isLoading}
                            style={{
                              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                              padding: "10px", borderRadius: "12px", border: "none", cursor: "pointer",
                              fontWeight: 700, fontSize: "12px",
                              background: "linear-gradient(135deg, #22c55e, #16a34a)",
                              color: "#fff",
                              opacity: isLoading ? 0.7 : 1,
                            }}
                          >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock style={{ width: "14px", height: "14px" }} />}
                            Desbloquear
                          </button>
                        ) : (
                          <button
                            onClick={() => { setShowBlockModal(condo.id); setBlockMotivo(""); }}
                            disabled={isLoading}
                            style={{
                              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                              padding: "10px", borderRadius: "12px", border: "none", cursor: "pointer",
                              fontWeight: 700, fontSize: "12px",
                              background: "linear-gradient(135deg, #ef4444, #dc2626)",
                              color: "#fff",
                              opacity: isLoading ? 0.7 : 1,
                            }}
                          >
                            <Lock style={{ width: "14px", height: "14px" }} />
                            Bloquear
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Block Modal */}
      {showBlockModal !== null && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 100,
            background: "rgba(0,0,0,0.5)", display: "flex",
            alignItems: "center", justifyContent: "center", padding: "24px",
          }}
          onClick={() => setShowBlockModal(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "var(--color-card, #fff)", borderRadius: "20px",
              padding: "24px", width: "100%", maxWidth: "400px",
              display: "flex", flexDirection: "column", gap: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{
                width: "44px", height: "44px", borderRadius: "12px",
                background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Ban style={{ width: "22px", height: "22px", color: "#dc2626" }} />
              </div>
              <div>
                <h3 style={{ fontWeight: 700, fontSize: "16px", color: "var(--color-foreground, #0f172a)" }}>Bloquear Condomínio</h3>
                <p style={{ fontSize: "12px", color: "#64748b" }}>
                  Todos os usuários perderão acesso imediatamente.
                </p>
              </div>
            </div>

            <div>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "6px", display: "block" }}>
                Motivo do bloqueio
              </label>
              <input
                type="text"
                placeholder="Ex: Inadimplência, Contrato encerrado..."
                value={blockMotivo}
                onChange={e => setBlockMotivo(e.target.value)}
                style={{
                  width: "100%", height: "44px", borderRadius: "12px", padding: "0 16px",
                  border: "2px solid #e2e8f0", fontSize: "14px", outline: "none",
                  background: "var(--color-background, #f8fafc)", color: "var(--color-foreground, #0f172a)",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => setShowBlockModal(null)}
                style={{
                  flex: 1, padding: "12px", borderRadius: "12px",
                  border: "2px solid #e2e8f0", background: "var(--color-card, #fff)",
                  fontWeight: 700, fontSize: "14px", cursor: "pointer",
                  color: "var(--color-foreground, #0f172a)",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleBlock(showBlockModal)}
                disabled={actionLoading === showBlockModal}
                style={{
                  flex: 1, padding: "12px", borderRadius: "12px", border: "none",
                  background: "linear-gradient(135deg, #ef4444, #dc2626)",
                  fontWeight: 700, fontSize: "14px", cursor: "pointer", color: "#fff",
                  opacity: actionLoading === showBlockModal ? 0.7 : 1,
                }}
              >
                {actionLoading === showBlockModal ? "Bloqueando..." : "Confirmar Bloqueio"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══ Detail Item Component ═══ */
function DetailItem({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "8px",
      padding: "8px 10px", borderRadius: "10px", background: "#f8fafc",
    }}>
      <Icon style={{ width: "14px", height: "14px", color: "#94a3b8", flexShrink: 0 }} />
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: "9px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>{label}</p>
        <p style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</p>
      </div>
    </div>
  );
}
