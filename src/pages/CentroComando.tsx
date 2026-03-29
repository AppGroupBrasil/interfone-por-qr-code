import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import {
  ArrowLeft,
  RefreshCw,
  Users,
  Package,
  Mail,
  Car,
  ShieldCheck,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  Building2,
  UserPlus,
  Truck,
  Eye,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import ComoFunciona from "@/components/ComoFunciona";

/* ═══════════════════════════════════════════════════════════
   Centro de Comando do Porteiro
   Dashboard unificado mostrando TODAS as pendências
   ═══════════════════════════════════════════════════════════ */

interface Visitor {
  id: number;
  nome: string;
  apartamento?: string;
  bloco?: string;
  status: string;
  created_at: string;
  tipo_acesso?: string;
}

interface Correspondence {
  id: number;
  destinatario_nome: string;
  bloco?: string;
  apartamento?: string;
  status: string;
  tipo: string;
  protocolo: string;
  created_at: string;
}

interface Delivery {
  id: number;
  plataforma: string;
  bloco?: string;
  apartamento?: string;
  status: string;
  morador_name?: string;
  created_at: string;
}

interface Vehicle {
  id: number;
  placa: string;
  modelo?: string;
  motorista_nome?: string;
  bloco?: string;
  status: string;
  morador_name?: string;
  created_at: string;
}

interface PreAuth {
  id: number;
  visitante_nome: string;
  bloco?: string;
  apartamento?: string;
  status: string;
  data_inicio?: string;
  data_fim?: string;
  morador_name?: string;
  created_at: string;
}

interface SummaryData {
  visitors: { pending: Visitor[]; inside: Visitor[]; total: number };
  correspondences: { pending: Correspondence[]; total: number };
  deliveries: { pending: Delivery[]; total: number };
  vehicles: { pending: Vehicle[]; total: number };
  preAuths: { active: PreAuth[]; total: number };
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default function CentroComando() {
  const { isDark, p } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<SummaryData | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const [visitorsRes, corrRes, delivRes, vehRes, preAuthRes] = await Promise.all([
        apiFetch("/api/visitors?status=todos").then(r => r.ok ? r.json() : []),
        apiFetch("/api/correspondencias?status=todas").then(r => r.ok ? r.json() : []),
        apiFetch("/api/delivery-authorizations?status=todas").then(r => r.ok ? r.json() : []),
        apiFetch("/api/vehicle-authorizations?status=todas").then(r => r.ok ? r.json() : []),
        apiFetch("/api/pre-authorizations?status=todas").then(r => r.ok ? r.json() : []),
      ]);

      const visitors = Array.isArray(visitorsRes) ? visitorsRes : [];
      const correspondences = Array.isArray(corrRes) ? corrRes : [];
      const deliveries = Array.isArray(delivRes) ? delivRes : [];
      const vehicles = Array.isArray(vehRes) ? vehRes : [];
      const preAuths = Array.isArray(preAuthRes) ? preAuthRes : [];

      setData({
        visitors: {
          pending: visitors.filter((v: Visitor) => v.status === "pendente"),
          insite: visitors.filter((v: Visitor) => v.status === "dentro"),
          total: visitors.length,
        } as any,
        correspondences: {
          pending: correspondences.filter((c: Correspondence) => c.status === "recebida" || c.status === "pendente"),
          total: correspondences.length,
        },
        deliveries: {
          pending: deliveries.filter((d: Delivery) => d.status === "aguardando_morador" || d.status === "pendente"),
          total: deliveries.length,
        },
        vehicles: {
          pending: vehicles.filter((v: Vehicle) => v.status === "pendente"),
          total: vehicles.length,
        },
        preAuths: {
          active: preAuths.filter((p: PreAuth) => p.status === "ativa"),
          total: preAuths.length,
        },
      });

      setLastUpdate(new Date());
    } catch (err) {
      console.error("CentroComando fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(() => fetchAll(true), 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [fetchAll]);

  const totalPending =
    (data?.visitors.pending.length || 0) +
    (data?.correspondences.pending.length || 0) +
    (data?.deliveries.pending.length || 0) +
    (data?.vehicles.pending.length || 0);

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: p.pageBg }}>
      {/* ═══════════ Header ═══════════ */}
      <header className="sticky top-0 z-40" style={{ background: p.headerBg, borderBottom: p.headerBorder, boxShadow: p.headerShadow, color: p.text }}>
        <div className="flex items-center justify-between" style={{ padding: "1rem 1.25rem", height: "4.5rem" }}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/dashboard")}
              style={{ width: 40, height: 40, borderRadius: 12, background: p.btnBg, border: p.btnBorder, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: p.text }}
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 style={{ fontWeight: 700, fontSize: 18 }}>Centro de Comando</h1>
              <span style={{ fontSize: 12, color: isDark ? "rgba(255,255,255,0.6)" : "#64748b" }}>
                Atualizado {lastUpdate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>
          <button
            onClick={() => fetchAll(true)}
            disabled={refreshing}
            style={{ width: 44, height: 44, borderRadius: 12, background: p.btnBg, border: p.btnBorder, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: p.text }}
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">Carregando centro de comando...</p>
          </div>
        </div>
      ) : (
        <main className="flex-1 overflow-auto" style={{ padding: "2.5rem 2rem 8rem" }}>
          <div style={{ marginBottom: 16 }}>
            <ComoFunciona steps={[
              "📊 Painel centralizado com visão geral das operações",
              "👁️ Acompanhe visitantes, entregas, rondas e câmeras",
              "🔔 Alertas e notificações em tempo real",
              "📋 Acesso rápido a todas as funções da portaria",
            ]} />
          </div>
          {/* ═══════════ Alert Banner ═══════════ */}
          {totalPending > 0 && (
            <div
              className="rounded-2xl flex items-center gap-6"
              style={{
                padding: "24px 28px",
                marginBottom: "40px",
                background: "transparent",
                border: isDark ? "2px solid rgba(255,255,255,0.5)" : "2px solid #cbd5e1",
              }}
            >
              <AlertTriangle className="w-7 h-7 text-amber-400" />
              <div className="flex-1">
                <p className="font-bold text-lg" style={{ color: p.text }}>
                  {totalPending} pendência{totalPending !== 1 ? "s" : ""}
                </p>
                <p className="text-sm" style={{ color: isDark ? "rgba(255,255,255,0.7)" : "#475569" }}>Ações aguardando sua atenção</p>
              </div>
            </div>
          )}

          {/* ═══════════ Quick Stats ═══════════ */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", marginBottom: "24px" }}>
            <StatCard
              icon={Users}
              value={data?.visitors.pending.length || 0}
              label="Visitantes"
              sublabel="pendentes"
              color="#0ea5e9"
              onClick={() => navigate("/portaria/acesso-pedestres")}
            />
            <StatCard
              icon={Mail}
              value={data?.correspondences.pending.length || 0}
              label="Corresp."
              sublabel="não retiradas"
              color="#8b5cf6"
              onClick={() => navigate("/portaria/correspondencias")}
            />
            <StatCard
              icon={Truck}
              value={data?.deliveries.pending.length || 0}
              label="Entregas e Delivery"
              sublabel="aguardando"
              color="#f59e0b"
              onClick={() => navigate("/portaria/delivery")}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", marginBottom: "48px" }}>
            <StatCard
              icon={Car}
              value={data?.vehicles.pending.length || 0}
              label="Veículos"
              sublabel="pendentes"
              color="#ef4444"
              onClick={() => navigate("/portaria/acesso-veiculos")}
            />
            <StatCard
              icon={ShieldCheck}
              value={data?.preAuths.active.length || 0}
              label="Pré-Autorizações"
              sublabel="ativas"
              color="#10b981"
              onClick={() => navigate("/portaria/acesso-pedestres")}
            />
          </div>

          {/* ═══════════ Sections ═══════════ */}

          {/* Visitantes Pendentes */}
          {(data?.visitors.pending.length || 0) > 0 && (
            <PendingSection
              title="Visitantes Aguardando"
              icon={UserPlus}
              color="#0ea5e9"
              count={data!.visitors.pending.length}
              onViewAll={() => navigate("/portaria/acesso-pedestres")}
            >
              {data!.visitors.pending.slice(0, 5).map((v) => (
                <PendingItem
                  key={v.id}
                  title={v.nome}
                  subtitle={`${v.bloco || ""}${v.apartamento ? ` • Apto ${v.apartamento}` : ""}`}
                  time={timeAgo(v.created_at)}
                  status="pendente"
                  onClick={() => navigate("/portaria/acesso-pedestres")}
                />
              ))}
            </PendingSection>
          )}

          {/* Correspondências Pendentes */}
          {(data?.correspondences.pending.length || 0) > 0 && (
            <PendingSection
              title="Correspondências Não Retiradas"
              icon={Mail}
              color="#8b5cf6"
              count={data!.correspondences.pending.length}
              onViewAll={() => navigate("/portaria/correspondencias")}
            >
              {data!.correspondences.pending.slice(0, 5).map((c) => (
                <PendingItem
                  key={c.id}
                  title={c.destinatario_nome}
                  subtitle={`${c.tipo} • ${c.bloco || ""}${c.apartamento ? ` Apto ${c.apartamento}` : ""}`}
                  time={timeAgo(c.created_at)}
                  status="pendente"
                  badge={c.protocolo}
                  onClick={() => navigate("/portaria/correspondencias")}
                />
              ))}
            </PendingSection>
          )}

          {/* Deliveries Aguardando */}
          {(data?.deliveries.pending.length || 0) > 0 && (
            <PendingSection
              title="Deliveries Aguardando"
              icon={Truck}
              color="#f59e0b"
              count={data!.deliveries.pending.length}
              onViewAll={() => navigate("/portaria/delivery")}
            >
              {data!.deliveries.pending.slice(0, 5).map((d) => (
                <PendingItem
                  key={d.id}
                  title={d.plataforma}
                  subtitle={`${d.morador_name || ""} • ${d.bloco || ""}${d.apartamento ? ` Apto ${d.apartamento}` : ""}`}
                  time={timeAgo(d.created_at)}
                  status="aguardando"
                  onClick={() => navigate("/portaria/delivery")}
                />
              ))}
            </PendingSection>
          )}

          {/* Veículos Pendentes */}
          {(data?.vehicles.pending.length || 0) > 0 && (
            <PendingSection
              title="Veículos Pendentes"
              icon={Car}
              color="#ef4444"
              count={data!.vehicles.pending.length}
              onViewAll={() => navigate("/portaria/acesso-veiculos")}
            >
              {data!.vehicles.pending.slice(0, 5).map((v) => (
                <PendingItem
                  key={v.id}
                  title={v.placa}
                  subtitle={`${v.modelo || ""} • ${v.motorista_nome || v.morador_name || ""}`}
                  time={timeAgo(v.created_at)}
                  status="pendente"
                  onClick={() => navigate("/portaria/acesso-veiculos")}
                />
              ))}
            </PendingSection>
          )}

          {/* Pré-Autorizações Ativas */}
          {(data?.preAuths.active.length || 0) > 0 && (
            <PendingSection
              title="Pré-Autorizações Ativas"
              icon={ShieldCheck}
              color="#10b981"
              count={data!.preAuths.active.length}
              onViewAll={() => navigate("/portaria/acesso-pedestres")}
            >
              {data!.preAuths.active.slice(0, 5).map((p) => (
                <PendingItem
                  key={p.id}
                  title={p.visitante_nome}
                  subtitle={`${p.morador_name || ""} • ${p.bloco || ""}${p.apartamento ? ` Apto ${p.apartamento}` : ""}`}
                  time={p.data_fim ? `até ${new Date(p.data_fim).toLocaleDateString("pt-BR")}` : ""}
                  status="ativa"
                  onClick={() => navigate("/portaria/acesso-pedestres")}
                />
              ))}
            </PendingSection>
          )}

          {/* All clear */}
          {totalPending === 0 && (
            <div className="text-center py-16 space-y-4">
              <div
                className="inline-flex items-center justify-center w-20 h-20 rounded-full mx-auto"
                style={{ background: "rgba(16,185,129,0.15)" }}
              >
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Tudo em dia!</h3>
              <p className="text-sm text-muted-foreground">
                Nenhuma pendência no momento.<br />O centro de comando atualiza automaticamente.
              </p>
            </div>
          )}
        </main>
      )}
    </div>
  );
}

/* ═══════════ Sub-components ═══════════ */

function StatCard({
  icon: Icon,
  value,
  label,
  sublabel,
  color,
  onClick,
}: {
  icon: any;
  value: number;
  label: string;
  sublabel: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="bg-card rounded-2xl transition-all hover:scale-105 active:scale-95 cursor-pointer"
      style={{ border: "2px solid #003580", padding: "28px 24px 24px" }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "14px", marginBottom: "10px" }}>
        <Icon className="w-7 h-7 shrink-0" style={{ color: "#003580" }} />
        <p
          className="text-3xl font-black"
          style={{ color: value > 0 ? color : undefined }}
        >
          {value}
        </p>
      </div>
      <p className="text-sm font-semibold text-foreground leading-tight text-center">{label}</p>
      <p className="text-xs text-muted-foreground mt-0.5 text-center">{sublabel}</p>
    </button>
  );
}

function PendingSection({
  title,
  icon: Icon,
  color,
  count,
  onViewAll,
  children,
}: {
  title: string;
  icon: any;
  color: string;
  count: number;
  onViewAll: () => void;
  children: React.ReactNode;
}) {
  const { isDark, p } = useTheme();
  return (
    <div className="mb-16">
      <div className="flex items-center justify-between mb-7">
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5" style={{ color }} />
          <h2 className="font-bold text-base" style={{ color: p.text }}>{title}</h2>
          <span
            className="text-sm font-bold px-2.5 py-0.5 rounded-full"
            style={{ background: `${color}20`, color }}
          >
            {count}
          </span>
        </div>
        <button
          onClick={onViewAll}
          className="flex items-center gap-1 text-sm font-semibold transition-colors"
          style={{ color }}
        >
          Ver todos
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>{children}</div>
    </div>
  );
}

function PendingItem({
  title,
  subtitle,
  time,
  status,
  badge,
  onClick,
}: {
  title: string;
  subtitle: string;
  time: string;
  status: string;
  badge?: string;
  onClick?: () => void;
}) {
  const { isDark, p } = useTheme();
  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    pendente: { bg: "rgba(245,158,11,0.15)", text: "#f59e0b", label: "Pendente" },
    aguardando: { bg: "rgba(245,158,11,0.15)", text: "#f59e0b", label: "Aguardando" },
    chegando: { bg: "rgba(236,72,153,0.15)", text: "#ec4899", label: "Chegando" },
    ativa: { bg: "rgba(16,185,129,0.15)", text: "#10b981", label: "Ativa" },
    dentro: { bg: "rgba(14,165,233,0.15)", text: "#0ea5e9", label: "Dentro" },
  };
  const sc = statusConfig[status] || statusConfig.pendente;

  return (
    <button
      onClick={onClick}
      className="bg-card rounded-xl flex items-center gap-6 w-full text-left transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
      style={{ border: isDark ? "1px solid rgba(255,255,255,0.05)" : "1px solid #cbd5e1", padding: "20px 24px" }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-base font-semibold text-foreground truncate">{title}</p>
        <p className="text-sm text-muted-foreground truncate mt-0.5">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2.5 shrink-0">
        {badge && (
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-secondary/60 text-muted-foreground">
            {badge}
          </span>
        )}
        <span
          className="text-xs font-bold px-2.5 py-1 rounded-lg whitespace-nowrap"
          style={{ background: sc.bg, color: sc.text }}
        >
          {sc.label}
        </span>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          {time}
        </span>
      </div>
    </button>
  );
}
