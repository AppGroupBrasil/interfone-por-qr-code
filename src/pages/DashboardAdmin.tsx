import { useAuth, getRoleLabel } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import FuncoesIndex from "@/components/FuncoesIndex";
import ThemePicker from "@/components/ThemePicker";
import {
  Home,
  Menu,
  LogOut,
  Settings,
  Shield,
  Building2,
  Users,
  Layers,
  Briefcase,
  Users2,
  Wrench,
  Bell,
  UserPlus,
  ClipboardList,
  FileText,
  UserCircle,
  BarChart3,
  DoorOpen,
  ShieldCheck,
  FileText as FileTextIcon,
  type LucideIcon,
} from "lucide-react";

/* ═══ Mock data for Administradora ═══ */
const mockStats = {
  condominios: 8,
  sindicos: 8,
  blocos: 24,
  funcionarios: 32,
  moradores: 480,
};

const mockByCondominio = [
  { nome: "Residencial Aurora", moradores: 120, blocos: 4 },
  { nome: "Edifício Solar", moradores: 85, blocos: 2 },
  { nome: "Condomínio Verde", moradores: 64, blocos: 3 },
  { nome: "Torre Azul", moradores: 92, blocos: 4 },
  { nome: "Parque das Flores", moradores: 55, blocos: 3 },
  { nome: "Vila Serena", moradores: 42, blocos: 2 },
  { nome: "Residencial Horizonte", moradores: 72, blocos: 4 },
  { nome: "Jardins do Vale", moradores: 50, blocos: 2 },
];

const gradientBorder = {
  border: "1.5px solid transparent",
  backgroundImage: "linear-gradient(#003580, #003580), linear-gradient(135deg, #2d3354, #10b981, #8b5cf6)",
  backgroundOrigin: "border-box",
  backgroundClip: "padding-box, border-box",
};

export default function DashboardAdmin() {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme, p } = useTheme();
  const navigate = useNavigate();
  const [activeModule, setActiveModule] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    apiFetch("/api/moradores/pendentes/count")
      .then((r) => r.ok ? r.json() : { count: 0 })
      .then((d) => setPendingCount(d.count))
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {/* ═══════════ Header ═══════════ */}
      <header className="sticky top-0 z-40 premium-header text-white" style={{ marginBottom: "3rem" }}>
        <div className="flex items-center justify-between" style={{ padding: "1rem 2rem", height: "4.5rem" }}>
          <div className="flex items-center gap-4">
            <div>
              <span className="font-bold text-xl tracking-tight truncate block">
                {user?.name || "Administradora"}
              </span>
              <span className="text-sm text-white/60 flex items-center gap-1.5">
                <Shield className="w-4 h-4" />
                {getRoleLabel(user?.role || "administradora")}
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

      <main className="flex-1 overflow-x-hidden" style={{ display: "flex", flexDirection: "column", gap: "2rem", paddingBottom: "10rem", paddingLeft: "1rem", paddingRight: "1rem" }}>

        <FuncoesIndex userRole={user?.role || "administradora"} />

        {/* ═══════════ ROW 1: Stat Cards ═══════════ */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 animate-fade-in" style={{ animationDelay: "0.14s" }}>
          {[
            { label: "Condomínios", value: mockStats.condominios, color: "stat-num-blue", route: "/master/condominios" },
            { label: "Síndicos", value: mockStats.sindicos, color: "stat-num-emerald", route: "/cadastros/sindicos" },
            { label: "Blocos", value: mockStats.blocos, color: "stat-num-cyan", route: "/cadastros/blocos" },
            { label: "Funcionários", value: mockStats.funcionarios, color: "stat-num-teal", route: "/cadastros/funcionarios" },
            { label: "Moradores", value: mockStats.moradores, color: "stat-num-green", route: "/cadastros/moradores" },
          ].map((s) => (
            <div key={s.label} onClick={() => navigate(s.route)} className="ui-card-mini rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-transform" style={{ padding: "0.75rem 0.5rem", minWidth: 0, ...gradientBorder }}>
              <span className="text-2xl sm:text-3xl font-extrabold text-white">{s.value}</span>
              <span className="font-medium uppercase tracking-wider text-center text-white" style={{ fontSize: "11px", marginTop: "0.35rem", lineHeight: 1.2, wordBreak: "break-word" }}>{s.label}</span>
            </div>
          ))}
          {/* Liberações card */}
          <div
            onClick={() => navigate("/liberacao-cadastros")}
            className={`rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-transform relative ${pendingCount > 0 ? "animate-pulse" : ""}`}
            style={{
              padding: "0.75rem 0.5rem",
              minWidth: 0,
              border: pendingCount > 0 ? "none" : "1.5px solid transparent",
              backgroundImage: pendingCount > 0
                ? "linear-gradient(135deg, #ef4444, #dc2626)"
                : "linear-gradient(#003580, #003580), linear-gradient(135deg, #2d3354, #10b981, #8b5cf6)",
              backgroundOrigin: "border-box",
              backgroundClip: pendingCount > 0 ? "border-box" : "padding-box, border-box",
              boxShadow: pendingCount > 0 ? "0 4px 16px rgba(239, 68, 68, 0.3)" : undefined,
            }}
          >
            <span className={`text-3xl font-extrabold ${pendingCount > 0 ? "text-white" : "stat-num-blue"}`}>
              {pendingCount}
            </span>
            <span
              className="font-medium uppercase tracking-wider text-white"
              style={{ fontSize: "14px", marginTop: "0.35rem" }}
            >
              Liberações
            </span>
          </div>
        </div>

        {/* ═══════════ ROW 2: Distribuição + Condomínios ═══════════ */}
        <div className="animate-fade-in grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ animationDelay: "0.22s" }}>
          {/* Distribuição */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <p className="text-[20px] font-semibold uppercase tracking-wider mb-3" style={{ color: p.textAccent }}>Distribuição</p>
            <div className="ui-card rounded-3xl overflow-hidden" style={{ ...gradientBorder, flex: 1, padding: "1.5rem 0.75rem" }}>
              {(() => {
                const barData = [
                  { label: "Condomínios", value: mockStats.condominios, icon: Building2, barColor: "from-sky-400 to-blue-500", iconGradient: "from-[#003580] to-[#003580]", color: isDark ? "text-white" : "text-sky-600" },
                  { label: "Síndicos", value: mockStats.sindicos, icon: Briefcase, barColor: "from-amber-400 to-orange-500", iconGradient: "from-[#003580] to-[#003580]", color: isDark ? "text-white" : "text-amber-600" },
                  { label: "Blocos", value: mockStats.blocos, icon: Layers, barColor: "from-emerald-400 to-green-500", iconGradient: "from-[#003580] to-[#003580]", color: isDark ? "text-white" : "text-emerald-600" },
                  { label: "Funcionários", value: mockStats.funcionarios, icon: Wrench, barColor: "from-teal-400 to-cyan-500", iconGradient: "from-[#003580] to-[#003580]", color: isDark ? "text-white" : "text-teal-600" },
                  { label: "Moradores", value: mockStats.moradores, icon: Users2, barColor: "from-green-400 to-lime-500", iconGradient: "from-[#003580] to-[#003580]", color: isDark ? "text-white" : "text-green-600" },
                  { label: "Liberações", value: pendingCount, icon: ShieldCheck, barColor: pendingCount > 0 ? "from-red-500 to-red-600" : "from-violet-400 to-purple-500", iconGradient: pendingCount > 0 ? "from-red-500 to-red-600" : "from-[#003580] to-[#003580]", color: pendingCount > 0 ? "text-red-500" : (isDark ? "text-white" : "text-violet-600") },
                ];
                const maxVal = Math.max(...barData.map(b => b.value), 1);
                return barData.map((bar) => {
                  const BarIcon = bar.icon;
                  const pct = Math.max((bar.value / maxVal) * 100, 6);
                  const isLiberacoes = bar.label === "Liberações";
                  return (
                    <div
                      key={bar.label}
                      className={`flex items-center gap-3 px-4 py-5 transition-colors hover:bg-white/[0.05] ${isLiberacoes ? "cursor-pointer" : ""}`}
                      onClick={isLiberacoes ? () => navigate("/liberacao-cadastros") : undefined}
                    >
                      <div className={`w-8 h-8 rounded-xl bg-linear-to-br ${bar.iconGradient} flex items-center justify-center shadow-md shrink-0`}>
                        <BarIcon className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[20px] font-medium ${isLiberacoes && pendingCount > 0 ? "text-red-500 font-bold" : "text-white"}`}>{bar.label}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                            <div className={`h-full bg-linear-to-r ${bar.barColor} rounded-full transition-all duration-1000`} style={{ width: `${pct}%` }} />
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

          {/* Condomínios Gerenciados */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div className="flex items-center justify-between mb-3">
            <p className="text-[20px] font-semibold tracking-tight" style={{ color: p.textAccent }}>Condomínios</p>
              <span className="text-[16px] text-muted-foreground/40">{mockByCondominio.length} total</span>
            </div>
            <div className="ui-card rounded-3xl overflow-hidden" style={{ ...gradientBorder, flex: 1, padding: "0.75rem" }}>
              {mockByCondominio.map((condo, index) => (
                <div
                  key={condo.nome}
                  className={`flex items-center gap-3 px-4 py-5 transition-colors hover:bg-white/[0.05] cursor-pointer ${index < mockByCondominio.length - 1 ? "border-b border-white/10" : ""} ${index === activeModule ? "sidebar-item-active-light" : ""}`}
                  onClick={() => setActiveModule(index)}
                >
                  <div className="w-8 h-8 rounded-xl bg-linear-to-br from-[#003580] to-[#003580] flex items-center justify-center shadow-md shrink-0">
                    <Building2 className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] sm:text-[18px] font-medium truncate" style={{ color: "#fff" }}>{condo.nome}</p>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>{condo.blocos} blocos · {condo.moradores} moradores</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ═══════════ ROW 3: Liberação Cadastros (if pending) ═══════════ */}
        {pendingCount > 0 && (
          <div
            className="animate-fade-in cursor-pointer"
            style={{ animationDelay: "0.30s" }}
            onClick={() => navigate("/liberacao-cadastros")}
          >
            <div
              className="rounded-2xl flex items-center gap-4 transition-all hover:scale-[1.01] active:scale-[0.99]"
              style={{
                background: p.cardBg,
                border: "1.5px solid " + p.accent,
                padding: "20px 16px",
              }}
            >
              <ShieldCheck className="w-7 h-7 shrink-0" style={{ color: p.text }} />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-lg" style={{ color: p.text }}>Cadastros Pendentes</p>
                <p className="text-sm" style={{ color: p.textSecondary }}>
                  {pendingCount} morador{pendingCount !== 1 ? "es" : ""} aguardando liberação
                </p>
              </div>
              <div className="shrink-0" style={{ marginRight: "16px" }}>
                <span className="font-extrabold text-xl" style={{ color: p.text }}>{pendingCount}</span>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════ ROW 4: Feature Cards ═══════════ */}
        <div className="animate-fade-in" style={{ animationDelay: "0.38s" }}>
          <p className="text-[20px] font-semibold uppercase tracking-wider mb-3" style={{ color: p.textAccent }}>Funções</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }} className="sindico-features-grid">
            {[
              { icon: FileTextIcon, label: "Logs", description: "Histórico de atividades", route: "/master/logs" },
            ].map((item) => (
              <div key={item.label} onClick={() => navigate(item.route)} className="ui-card-mini rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:scale-105 active:scale-95 transition-transform" style={{ padding: "1.25rem 0.75rem", minHeight: "120px", ...gradientBorder, textAlign: "center" }}>
                <item.icon className="w-7 h-7 mb-2" style={{ color: "#fff" }} />
                <p className="font-bold text-sm text-white">{item.label}</p>
                <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* ═══════════ Bottom Nav ═══════════ */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 premium-bottom-nav safe-area-bottom">
        <div className={`flex justify-around h-24 overflow-x-auto`}>
          {[
            { icon: Home, label: "Home", route: "/dashboard", active: true },
            { icon: Building2, label: "Condos", route: "/master/condominios", active: false },
            { icon: BarChart3, label: "Painel", route: "/master/painel", active: false },
            { icon: UserPlus, label: "Cadastro", route: "/cadastros", active: false },
            { icon: Users, label: "Usuários", route: "/master/usuarios", active: false },
            ...(user?.role === "master" ? [] : []),
            { icon: Settings, label: "Config", route: "/admin/features-config", active: false },
          ].map((item) => (
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
