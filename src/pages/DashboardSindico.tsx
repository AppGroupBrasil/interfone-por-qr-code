import { useAuth, getRoleLabel } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import FuncoesIndex from "@/components/FuncoesIndex";
import ThemePicker from "@/components/ThemePicker";
import {
  Home,
  LogOut,
  Shield,
  Building2,
  Layers,
  Users2,
  Wrench,
  Bell,
  UserPlus,
  UserCircle,
  Phone,
} from "lucide-react";

/* ═══ Mock data for Síndico ═══ */
const mockStats = {
  blocos: 4,
  funcionarios: 6,
  moradores: 120,
};

const mockBlocos = [
  { nome: "Bloco A", moradores: 32, andares: 8 },
  { nome: "Bloco B", moradores: 28, andares: 8 },
  { nome: "Bloco C", moradores: 35, andares: 10 },
  { nome: "Bloco D", moradores: 25, andares: 6 },
];

export default function DashboardSindico() {
  const { user, logout } = useAuth();
  const { toggleTheme, p } = useTheme();
  const navigate = useNavigate();
  const [activeModule, setActiveModule] = useState(0);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };



  return (
    <div className="min-h-dvh flex flex-col" style={{ background: p.pageBg }}>
      {/* ═══════════ Header ═══════════ */}
      <header className="sticky top-0 z-40" style={{ background: p.headerBg, borderBottom: p.headerBorder, boxShadow: p.headerShadow, marginBottom: 0 }}>
        <div className="flex items-center justify-between" style={{ padding: "20px 28px", height: "5rem" }}>
          <div className="flex items-center" style={{ gap: 14 }}>
            <div className="flex items-center justify-center" style={{ width: 48, height: 48, borderRadius: 16, background: p.iconBoxBg, border: p.iconBoxBorder }}>
              <Building2 style={{ width: 22, height: 22, color: p.text }} />
            </div>
            <div>
              <span className="block text-white" style={{ fontWeight: 800, fontSize: 20, letterSpacing: "-0.01em" }}>
                {user?.condominio_nome || "Meu Condomínio"}
              </span>
              <span className="flex items-center" style={{ fontSize: 13, color: p.textDim, gap: 6 }}>
                <Shield style={{ width: 14, height: 14 }} />
                {getRoleLabel(user?.role || "sindico")}
              </span>
            </div>
          </div>
          <div className="flex items-center" style={{ gap: 10 }}>
            <ThemePicker />
            <button
              className="flex items-center justify-center relative"
              style={{ width: 44, height: 44, borderRadius: 14, background: p.btnBg, border: p.btnBorder, cursor: "pointer", transition: "all 0.15s" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.15)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
            >
              <Bell style={{ width: 20, height: 20, color: p.text }} />
              <span className="absolute" style={{ top: 8, right: 8, width: 8, height: 8, background: "#34d399", borderRadius: "50%", boxShadow: "0 0 6px rgba(52,211,153,0.6)" }} />
            </button>
            <button
              className="flex items-center justify-center"
              onClick={handleLogout}
              style={{ width: 44, height: 44, borderRadius: 14, background: p.btnBg, border: p.btnBorder, cursor: "pointer", transition: "all 0.15s" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.2)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
            >
              <LogOut style={{ width: 20, height: 20, color: p.text }} />
            </button>
          </div>
        </div>
      </header>

{/* ═══════════ Welcome Banner ═══════════ */}
      <div style={{ padding: "28px 28px 8px" }}>
        <p style={{ fontSize: 14, color: p.accentBright, fontWeight: 500 }}>Bem-vindo(a) ao</p>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: p.text, marginTop: 4 }}>Painel do Síndico</h1>
        <p style={{ fontSize: 14, color: p.textDim, marginTop: 6 }}>Gerencie seu condomínio</p>
      </div>

      <main className="flex-1 overflow-x-hidden" style={{ display: "flex", flexDirection: "column", gap: 20, paddingBottom: "10rem", paddingLeft: 16, paddingRight: 16, paddingTop: 20 }}>

        <FuncoesIndex userRole={user?.role || "sindico"} />

        {/* ═══════════ ROW 1: Stat Cards ═══════════ */}
        <div className="animate-fade-in grid grid-cols-2 sm:grid-cols-4" style={{ animationDelay: "0.1s", gap: 12 }}>
          {[
            { label: "Blocos", value: mockStats.blocos, icon: Layers, route: "/cadastros/blocos" },
            { label: "Funcionários", value: mockStats.funcionarios, icon: Wrench, route: "/cadastros/funcionarios" },
            { label: "Moradores", value: mockStats.moradores, icon: Users2, route: "/cadastros/moradores" },
          ].map((s) => (
            <button
              key={s.label}
              onClick={() => navigate(s.route)}
              className="flex flex-col items-center justify-center cursor-pointer"
              style={{
                padding: "18px 8px",
                borderRadius: 20,
                background: p.surfaceBg,
                border: p.featureBorder,
                transition: "all 0.2s ease",
                boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              <div className="flex items-center justify-center" style={{ width: 40, height: 40, borderRadius: 12, background: p.iconBoxBg, border: p.btnBorder, marginBottom: 8 }}>
                <s.icon style={{ width: 18, height: 18, color: p.text }} />
              </div>
              <span style={{ fontSize: 28, fontWeight: 800, color: p.text }}>{s.value}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: p.textDim, marginTop: 2, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</span>
            </button>
          ))}

        </div>

        {/* ═══════════ ROW 2: Distribuição + Blocos ═══════════ */}
        <div className="animate-fade-in grid grid-cols-1 sm:grid-cols-2" style={{ animationDelay: "0.2s", gap: 16 }}>
          {/* Distribuição */}
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: p.accentBright, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>Distribuição</p>
            <div style={{ borderRadius: 20, background: p.surfaceBg, border: p.featureBorder, overflow: "hidden" }}>
              {(() => {
                const barData = [
                  { label: "Blocos", value: mockStats.blocos, icon: Layers, color: "#60a5fa" },
                  { label: "Funcionários", value: mockStats.funcionarios, icon: Wrench, color: "#34d399" },
                  { label: "Moradores", value: mockStats.moradores, icon: Users2, color: "#a78bfa" },
                ];
                const maxVal = Math.max(...barData.map(b => b.value), 1);
                return barData.map((bar, index) => {
                  const BarIcon = bar.icon;
                  const pct = Math.max((bar.value / maxVal) * 100, 6);
                  return (
                    <div
                      key={bar.label}
                      className="flex items-center"
                      style={{
                        padding: "14px 18px",
                        gap: 12,
                        borderBottom: index < barData.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <div className="flex items-center justify-center shrink-0" style={{ width: 34, height: 34, borderRadius: 10, background: p.iconBoxBg, border: p.iconBoxBorder }}>
                        <BarIcon style={{ width: 16, height: 16, color: bar.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p style={{ fontSize: 14, fontWeight: 600, color: p.text, marginBottom: 4 }}>{bar.label}</p>
                        <div style={{ height: 5, background: p.divider, borderRadius: 99, overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: bar.color, borderRadius: 99, transition: "width 1s ease" }} />
                        </div>
                      </div>
                      <span style={{ fontSize: 20, fontWeight: 800, color: bar.color, minWidth: 32, textAlign: "right" }}>{bar.value}</span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Blocos */}
          <div>
            <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: p.accentBright, textTransform: "uppercase", letterSpacing: "0.08em" }}>Blocos</p>
              <span style={{ fontSize: 13, color: p.textDim }}>{mockBlocos.length} total</span>
            </div>
            <div style={{ borderRadius: 20, background: p.surfaceBg, border: p.featureBorder, overflow: "hidden" }}>
              {mockBlocos.map((bloco, index) => (
                <div
                  key={bloco.nome}
                  className="flex items-center"
                  style={{
                    padding: "14px 18px",
                    gap: 12,
                    cursor: "pointer",
                    borderBottom: index < mockBlocos.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                    transition: "background 0.15s",
                    background: index === activeModule ? "rgba(255,255,255,0.08)" : "transparent",
                  }}
                  onClick={() => setActiveModule(index)}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = index === activeModule ? "rgba(255,255,255,0.08)" : "transparent"; }}
                >
                  <div className="flex items-center justify-center shrink-0" style={{ width: 34, height: 34, borderRadius: 10, background: p.iconBoxBg, border: p.iconBoxBorder }}>
                    <Layers style={{ width: 16, height: 16, color: "#60a5fa" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 14, fontWeight: 600, color: p.text }}>{bloco.nome}</p>
                    <p style={{ fontSize: 11, color: p.textDim }}>{bloco.andares} andares · {bloco.moradores} moradores</p>
                  </div>
                  <span style={{ fontSize: 18, fontWeight: 800, color: "#34d399" }}>{bloco.moradores}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ═══════════ ROW 3: Feature Cards  ═══════════ */}
        <div className="animate-fade-in" style={{ animationDelay: "0.4s" }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: p.accentBright, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.08em" }}>Funções</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }} className="sindico-features-grid">
            {[
              { icon: UserPlus, label: "Cadastro", description: "Gerenciar moradores e funcionários", route: "/cadastros", delay: "0.15s" },
              { icon: Phone, label: "Interfone", description: "Configurar interfone digital", route: "/sindico/interfone-config", delay: "0.25s" },
            ].map((item) => (
              <div key={item.label} className="animate-fade-in" style={{ animationDelay: item.delay }}>
                <button
                  onClick={() => navigate(item.route)}
                  className="w-full flex flex-col items-center justify-center cursor-pointer"
                  style={{
                    padding: "20px 12px",
                    height: "auto",
                    minHeight: "120px",
                    background: p.surfaceBg,
                    border: p.featureBorder,
                    borderRadius: 20,
                    color: p.text,
                    gap: 10,
                    transition: "all 0.2s ease",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                    textAlign: "center",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.15)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.08)"; e.currentTarget.style.transform = "translateY(0)"; }}
                  onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.98)"; }}
                  onMouseUp={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }}
                >
                  <div className="flex items-center justify-center shrink-0" style={{ width: 52, height: 52, borderRadius: 16, background: p.iconBoxBg, border: p.iconBoxBorder }}>
                    <item.icon style={{ width: 26, height: 26 }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{item.label}</p>
                    <p style={{ color: p.textDim, fontSize: 11, lineHeight: 1.3 }}>{item.description}</p>
                  </div>
                </button>
              </div>
            ))}
          </div>
        </div>

      </main>

      {/* ═══════════ Bottom Nav ═══════════ */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 premium-bottom-nav safe-area-bottom">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", height: "6rem" }}>
          {[
            { icon: Home, label: "Home", route: "/dashboard" },
            { icon: UserCircle, label: "Minha Conta", route: "/minha-conta" },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(item.route)}
              className="flex flex-col items-center justify-center cursor-pointer"
              style={{ gap: 6, fontSize: 12, fontWeight: 600, background: "none", border: "none", color: p.isDarkBase ? "#ffffff" : "#000000", transition: "all 0.2s" }}
            >
              <div className="flex items-center justify-center" style={{ width: 40, height: 40, borderRadius: 12, transition: "all 0.2s" }}>
                <item.icon style={{ width: 22, height: 22 }} />
              </div>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
