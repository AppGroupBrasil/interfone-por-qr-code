import { useAuth, getRoleLabel, hasMinRole } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { EXTRAS_ENABLED } from "@/lib/config";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import {
  UserPlus,
  ClipboardList,
  Home,
  Search,
  Menu,
  LogOut,
  Settings,
  Shield,
  Building2,
  Users,
  Layers,
  Briefcase,
  Users2,
  BarChart3,
  FileText,
  Wrench,
  Bell,
  ChevronRight,
  Upload,
  DoorOpen,
  BookOpen,
  Briefcase as BriefcaseIcon,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import FuncoesIndex from "@/components/FuncoesIndex";
import ThemePicker from "@/components/ThemePicker";

const API = "/api";

interface Stats {
  totals: {
    condominios: number;
    users: number;
    blocos: number;
    funcionarios: number;
    moradores: number;
  };
  usersByRole: { role: string; count: number }[];
  recentCondominios: any[];
  recentUsers: any[];
}

/* ── Circular Gauge SVG ── */
function CircleGauge({ value, max, label, color, size = 110 }: { value: number; max: number; label: string; color: string; size?: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const colorMap: Record<string, string> = {
    blue: "#2d3354",
    emerald: "#10b981",
    cyan: "#06b6d4",
    teal: "#14b8a6",
  };
  const c = colorMap[color] || "#2d3354";
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Outer decorative ring */}
        <svg width={size} height={size} className="absolute inset-0">
          <circle cx={size/2} cy={size/2} r={r + 4} fill="none" stroke="currentColor" strokeWidth="2" className="text-white/6" />
          <circle cx={size/2} cy={size/2} r={r + 7} fill="none" stroke="currentColor" strokeWidth="1" className="text-white/3" />
        </svg>
        {/* Track */}
        <svg width={size} height={size} className="absolute inset-0 -rotate-90">
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-white/6" strokeLinecap="round" />
        </svg>
        {/* Progress */}
        <svg width={size} height={size} className="absolute inset-0 -rotate-90">
          <circle
            cx={size/2} cy={size/2} r={r}
            fill="none"
            stroke={`url(#grad-${color})`}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1.2s ease-out" }}
          />
          <defs>
            <linearGradient id={`grad-${color}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={c} />
              <stop offset="100%" stopColor={c} stopOpacity="0.4" />
            </linearGradient>
          </defs>
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-foreground">{value}</span>
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
    </div>
  );
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme, isDark, p } = useTheme();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [activeModule, setActiveModule] = useState(0);

  const isMaster = user?.role === "master";

  useEffect(() => {
    if (isMaster) {
      setLoadingStats(true);
      apiFetch(`${API}/master/stats`)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((data) => setStats(data))
        .catch(console.error)
        .finally(() => setLoadingStats(false));
    }
  }, [isMaster]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const roleLabels: Record<string, string> = {
    master: "Masters",
    administradora: "Administradoras",
    sindico: "Síndicos",
    funcionario: "Funcionários",
    morador: "Moradores",
  };

  const masterMenuItems = [
    { icon: BarChart3, label: "Dashboard", route: "/dashboard", active: true },
    { icon: Building2, label: "Condomínios", route: "/master/condominios" },
    { icon: Shield, label: "Painel", route: "/master/painel" },
    { icon: Users, label: "Usuários", route: "/master/usuarios" },
    { icon: Wrench, label: "Config", route: "/master/config" },
    { icon: FileText, label: "Logs", route: "/master/logs" },
  ];

  const totalAll = stats ? Object.values(stats.totals).reduce((a, b) => a + b, 0) : 0;

  // Module chips
  const moduleChips = [
    { label: "Cadastro", active: false },
    { label: "Usuários", active: true },
    { label: "Blocos", active: false },
    { label: "Moradores", active: false },
    { label: "Config", active: false },
    { label: "Relatórios", active: false },
  ];

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {/* ═══════════ Header ═══════════ */}
      <header className="sticky top-0 z-40 premium-header text-white" style={{ marginBottom: "3rem" }}>
        <div className="flex items-center justify-between" style={{ padding: "1rem 2rem", height: "4.5rem" }}>
          <div className="flex items-center gap-4">
            <button className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all">
              <Menu className="w-7 h-7" />
            </button>
            <div>
              <span className="font-bold text-xl tracking-tight truncate block">
                {user?.condominio_nome || "Meu Condomínio"}
              </span>
              <span className="text-sm text-white/60 flex items-center gap-1.5">
                <Shield className="w-4 h-4" />
                {getRoleLabel(user?.role || "morador")}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemePicker />
            <button className="p-3 rounded-xl bg-white/8 hover:bg-white/15 transition-all relative">
              <Bell className="w-6 h-6" />
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-emerald-400 rounded-full" />
            </button>
            <button className="p-3 rounded-xl bg-white/8 hover:bg-white/15 transition-all" onClick={handleLogout}>
              <LogOut className="w-6 h-6" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-x-hidden" style={{ display: "flex", flexDirection: "column", gap: "2rem", paddingBottom: "10rem", paddingLeft: "1rem", paddingRight: "1rem", paddingTop: "2rem" }}>

        <FuncoesIndex userRole={user?.role || "master"} />

        {isMaster && (
          <>
            {/* ═══════════ ROW 4: Color Bars + Sidebar Nav ═══════════ */}
            {loadingStats ? (
              <div className="flex justify-center py-10">
                <div className="premium-spinner w-7 h-7" />
              </div>
            ) : stats ? (
              <div className="animate-fade-in grid grid-cols-1 sm:grid-cols-2" style={{ animationDelay: "0.14s", gap: "1rem" }}>
                {/* Distribuição */}
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <p className="text-[20px] font-semibold text-foreground uppercase tracking-wider mb-3">Distribuição</p>
                  <div className="ui-card rounded-3xl overflow-hidden" style={{ border: "1.5px solid transparent", backgroundImage: "linear-gradient(var(--background), var(--background)), linear-gradient(135deg, #2d3354, #10b981, #8b5cf6)", backgroundOrigin: "border-box", backgroundClip: "padding-box, border-box", flex: 1, padding: "1.5rem 0.75rem" }}>
                    {(() => {
                      const barData = [
                        { label: "Condomínios", value: stats.totals.condominios, icon: Building2, gradient: "from-[#003580] to-[#003580]", color: "text-white" },
                        { label: "Usuários", value: stats.totals.users, icon: Users, gradient: "from-[#003580] to-[#003580]", color: "text-white" },
                        { label: "Blocos", value: stats.totals.blocos, icon: Layers, gradient: "from-[#003580] to-[#003580]", color: "text-white" },
                        { label: "Funcionários", value: stats.totals.funcionarios, icon: Wrench, gradient: "from-[#003580] to-[#003580]", color: "text-white" },
                        { label: "Moradores", value: stats.totals.moradores, icon: Users2, gradient: "from-[#003580] to-[#003580]", color: "text-white" },
                      ];
                      const maxVal = Math.max(...barData.map(b => b.value), 1);
                      return barData.map((bar, index) => {
                        const BarIcon = bar.icon;
                        const pct = Math.max((bar.value / maxVal) * 100, 6);
                        return (
                          <div
                            key={bar.label}
                            className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/2 ${
                              index < barData.length - 1 ? "border-b border-white/4" : ""
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-xl bg-linear-to-br ${bar.gradient} flex items-center justify-center shadow-md shrink-0`}>
                              <BarIcon className="w-3.5 h-3.5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[20px] font-medium text-foreground">{bar.label}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <div className="flex-1 h-1.5 bg-foreground/8 rounded-full overflow-hidden">
                                  <div className={`h-full bg-linear-to-r ${bar.gradient} rounded-full transition-all duration-1000`} style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            </div>
                            <span className={`text-2xl font-bold ${bar.color}`}>{bar.value}</span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Usuários por Perfil */}
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[22px] font-semibold text-foreground tracking-tight">Usuários por Perfil</p>
                    <span className="text-[18px] font-semibold text-foreground">{stats.usersByRole.reduce((a, b) => a + b.count, 0)} total</span>
                  </div>
                  <div className="ui-card rounded-3xl overflow-hidden" style={{ border: "1.5px solid transparent", backgroundImage: "linear-gradient(var(--background), var(--background)), linear-gradient(135deg, #2d3354, #10b981, #8b5cf6)", backgroundOrigin: "border-box", backgroundClip: "padding-box, border-box", flex: 1, padding: "0.75rem" }}>
                    {stats.usersByRole.map((item, index) => {
                      const cfgs: Record<string, { icon: LucideIcon; gradient: string; color: string }> = {
                        master: { icon: Shield, gradient: "from-[#003580] to-[#003580]", color: "text-white" },
                        administradora: { icon: Building2, gradient: "from-[#003580] to-[#003580]", color: "text-white" },
                        sindico: { icon: Briefcase, gradient: "from-[#003580] to-[#003580]", color: "text-white" },
                        funcionario: { icon: Wrench, gradient: "from-[#003580] to-[#003580]", color: "text-white" },
                        morador: { icon: Users2, gradient: "from-[#003580] to-[#003580]", color: "text-white" },
                      };
                      const cfg = cfgs[item.role] || { icon: Users, gradient: "from-gray-500 to-gray-600", color: "text-gray-400" };
                      const RoleIcon = cfg.icon;
                      const total = stats.usersByRole.reduce((a, b) => a + b.count, 0);
                      const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
                      return (
                        <div
                          key={item.role}
                          className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/2 ${
                            index < stats.usersByRole.length - 1 ? "border-b border-white/4" : ""
                          } ${index === activeModule ? "sidebar-item-active-light" : ""}`}
                          onClick={() => setActiveModule(index)}
                        >
                          <div className={`w-8 h-8 rounded-xl bg-linear-to-br ${cfg.gradient} flex items-center justify-center shadow-md shrink-0`}>
                            <RoleIcon className="w-3.5 h-3.5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[20px] font-medium text-foreground">{roleLabels[item.role] || item.role}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 h-1.5 bg-foreground/8 rounded-full overflow-hidden">
                                <div className={`h-full bg-linear-to-r ${cfg.gradient} rounded-full transition-all duration-700`} style={{ width: `${Math.max(pct, 5)}%` }} />
                              </div>
                            </div>
                          </div>
                          <span className={`text-2xl font-bold ${cfg.color}`}>{item.count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}

            {/* ═══════════ ROW 6: Stat numbers row ═══════════ */}
            {stats && (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 animate-fade-in" style={{ animationDelay: "0.22s" }}>
                {[
                  { label: "Condomínios", value: stats.totals.condominios, color: "stat-num-blue", route: "/master/condominios" },
                  { label: "Usuários", value: stats.totals.users, color: "stat-num-emerald", route: "/master/usuarios" },
                  { label: "Blocos", value: stats.totals.blocos, color: "stat-num-cyan", route: "/master/condominios" },
                  { label: "Funcionários", value: stats.totals.funcionarios, color: "stat-num-teal", route: "/master/usuarios" },
                  { label: "Moradores", value: stats.totals.moradores, color: "stat-num-green", route: "/master/usuarios" },
                ].map((s) => (
                  <div key={s.label} onClick={() => navigate(s.route)} className="ui-card-mini rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-transform" style={{ padding: "0.75rem 0.5rem", minWidth: 0, border: "1.5px solid transparent", backgroundImage: "linear-gradient(var(--background), var(--background)), linear-gradient(135deg, #2d3354, #10b981, #8b5cf6)", backgroundOrigin: "border-box", backgroundClip: "padding-box, border-box" }}>
                    <span className="text-2xl sm:text-3xl font-extrabold" style={{ color: "#2563eb" }}>{s.value}</span>
                    <span className="font-medium uppercase tracking-wider text-center" style={{ fontSize: "11px", marginTop: "0.35rem", lineHeight: 1.2, wordBreak: "break-word", color: p.isDarkBase ? "rgba(255,255,255,0.7)" : "#374151" }}>{s.label}</span>
                  </div>
                ))}
              </div>
            )}

            {/* ═══════════ ROW 7: Feature Cards ═══════════ */}
            <div className="animate-fade-in" style={{ animationDelay: "0.30s" }}>
              <p className="text-[20px] font-semibold text-foreground uppercase tracking-wider mb-3">Funções</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }} className="sindico-features-grid">
                {[
                  { icon: Building2, label: "Administradoras", description: "Gerenciar empresas administradoras", route: "/cadastros/administradoras" },
                  { icon: FileText, label: "Logs", description: "Histórico de atividades do sistema", route: "/master/logs" },
                  { icon: UserPlus, label: "Cadastro", description: "Gerenciar cadastros gerais", route: "/cadastros" },
                  { icon: BookOpen, label: "Guia Instalação", description: "Tutorial de instalação do sistema", route: "/master/guia-instalacao" },
                  ...(EXTRAS_ENABLED ? [{ icon: MessageCircle, label: "WhatsApp", description: "Controlar WhatsApp por condomínio", route: "/master/whatsapp" }] : []),
                ].map((item) => (
                  <div key={item.label} onClick={() => navigate(item.route)} className="ui-card-mini rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-transform" style={{ padding: "1.25rem 0.75rem", minHeight: "120px", border: "1.5px solid transparent", backgroundImage: "linear-gradient(var(--background), var(--background)), linear-gradient(135deg, #2d3354, #10b981, #8b5cf6)", backgroundOrigin: "border-box", backgroundClip: "padding-box, border-box", textAlign: "center" }}>
                    <item.icon className="w-7 h-7 mb-2" style={{ color: p.isDarkBase ? "#ffffff" : "#000000" }} />
                    <p className="font-bold text-sm" style={{ color: p.isDarkBase ? "#ffffff" : "#000000" }}>{item.label}</p>
                    <p className="text-[11px] mt-1" style={{ color: p.isDarkBase ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)" }}>{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ═══════════ Non-master welcome ═══════════ */}
        {!isMaster && (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
            <div className="w-20 h-20 rounded-3xl bg-linear-to-br from-[#003580] to-[#003580] shadow-xl shadow-[#003580]/20 flex items-center justify-center mb-6">
              <Home className="w-9 h-9 text-white" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2 tracking-tight">Bem-vindo, {user?.name?.split(" ")[0]}!</h2>
            <p className="text-sm text-muted-foreground/60">Use a barra inferior para navegar</p>
          </div>
        )}
      </main>

      {/* ═══════════ Bottom Nav ═══════════ */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 premium-bottom-nav safe-area-bottom">
        <div className={`flex justify-around h-24 overflow-x-auto`}>
          {(isMaster
            ? [
                { icon: Home, label: "Home", route: "/dashboard", active: true },
                { icon: Building2, label: "Condos", route: "/master/condominios", active: false },
                { icon: BarChart3, label: "Painel", route: "/master/painel", active: false },
                { icon: UserPlus, label: "Cadastro", route: "/cadastros", active: false },
                { icon: Users, label: "Usuários", route: "/master/usuarios", active: false },
                { icon: BookOpen, label: "Instalar", route: "/master/guia-instalacao", active: false },
                { icon: Settings, label: "Config", route: "/master/config", active: false },
              ]
            : [
                { icon: Home, label: "Home", route: "/dashboard", active: true },
                { icon: UserPlus, label: "Cadastro", route: "/cadastros", active: false },
              ]
          ).map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(item.route)}
              className="flex flex-col items-center justify-center gap-2 text-[11px] font-medium transition-all duration-200 active:scale-90 cursor-pointer shrink-0"
              style={{ minWidth: 52, padding: "0 4px" }}
            >
              <div className="p-2 rounded-xl transition-all duration-200">
                <item.icon className="w-5 h-5" style={{ color: p.isDarkBase ? "#ffffff" : "#000000" }} />
              </div>
              <span style={{ color: p.isDarkBase ? "#ffffff" : "#000000" }}>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
