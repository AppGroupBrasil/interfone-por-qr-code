import { useAuth, getRoleLabel } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import CameraWidget from "@/components/CameraWidget";
import ThemePicker from "@/components/ThemePicker";
import FuncoesIndex from "@/components/FuncoesIndex";
import { loadLayout, getItemById, getIconComponent } from "@/pages/PersonalizarDashboard";
import {
  LogOut,
  Settings,
  Shield,
  Bell,
  ShieldCheck,
  UserCircle,
  EyeOff,
} from "lucide-react";



export default function DashboardFuncionario() {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme, p } = useTheme();
  const navigate = useNavigate();

  // Load layout from localStorage
  const [layout, setLayout] = useState(() => loadLayout());

  // Re-read layout when navigating back to this page
  useEffect(() => {
    const onFocus = () => setLayout(loadLayout());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  // Also re-read on visibility change (for tab/app switching)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") setLayout(loadLayout());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const dashboardItems = layout.dashboard.map(getItemById).filter(Boolean);
  const bottomBarItems = layout.bottomBar.map(getItemById).filter(Boolean);
  const hasHidden = (layout.hidden?.length || 0) > 0;

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
              <ShieldCheck style={{ width: 22, height: 22, color: p.text }} />
            </div>
            <div>
              <span className="block text-white" style={{ fontWeight: 800, fontSize: 20, letterSpacing: "-0.01em" }}>
                {user?.condominio_nome || "Meu Condomínio"}
              </span>
              <span className="flex items-center" style={{ fontSize: 13, color: p.textDim, gap: 6 }}>
                <Shield style={{ width: 14, height: 14 }} />
                {getRoleLabel(user?.role || "funcionario")}
                {hasHidden && (
                  <button
                    onClick={() => navigate("/portaria/personalizar-dashboard")}
                    className="flex items-center"
                    style={{
                      marginLeft: 8,
                      gap: 6,
                      padding: "4px 10px",
                      borderRadius: 8,
                      background: "rgba(245,158,11,0.2)",
                      border: "1px solid rgba(245,158,11,0.4)",
                      cursor: "pointer",
                      animation: "pulse 2s ease-in-out infinite",
                    }}
                    title="Existem funções ocultas — clique para gerenciar"
                  >
                    <EyeOff style={{ width: 14, height: 14, color: "#fbbf24" }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#fbbf24" }}>
                      {layout.hidden?.length || 0} oculto{(layout.hidden?.length || 0) !== 1 ? "s" : ""}
                    </span>
                  </button>
                )}
              </span>
            </div>
          </div>
          <div className="flex items-center" style={{ gap: 10 }}>
            <button
              className="flex items-center justify-center"
              onClick={() => navigate("/portaria/configuracoes")}
              style={{ width: 44, height: 44, borderRadius: 14, background: p.btnBg, border: p.btnBorder, cursor: "pointer", transition: "all 0.15s" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.15)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
            >
              <Settings style={{ width: 20, height: 20, color: p.text }} />
            </button>
            <button
              className="flex items-center justify-center"
              onClick={() => navigate("/minha-conta")}
              style={{ width: 44, height: 44, borderRadius: 14, background: p.btnBg, border: p.btnBorder, cursor: "pointer", transition: "all 0.15s" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.15)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
            >
              <UserCircle style={{ width: 20, height: 20, color: p.text }} />
            </button>
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
        <p style={{ fontSize: 14, color: "#7dd3fc", fontWeight: 500 }}>Bem-vindo(a) ao</p>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: p.text, marginTop: 4 }}>Painel da Portaria</h1>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", marginTop: 6 }}>Selecione uma função abaixo</p>
      </div>

      <main className="flex-1 overflow-x-hidden" style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: "10rem", paddingLeft: 16, paddingRight: 16, paddingTop: 20 }}>

        <FuncoesIndex userRole={user?.role || "funcionario"} />

        {/* ═══════════ Funções da Portaria — Grid de Cards ═══════════ */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5" style={{ gap: 12 }}>
          {dashboardItems.map((item, idx) => {
            if (!item) return null;
            const Icon = getIconComponent(item.icon);
            return (
              <div key={item.id} className="animate-fade-in" style={{ animationDelay: `${0.05 + idx * 0.04}s` }}>
                <button
                  onClick={() => navigate(item.route)}
                  className="w-full flex flex-col items-center justify-center cursor-pointer"
                  style={{
                    padding: "20px 10px",
                    aspectRatio: "1",
                    background: p.surfaceBg,
                    border: p.featureBorder,
                    borderRadius: 20,
                    color: p.text,
                    gap: 10,
                    transition: "all 0.2s ease",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.15)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.08)"; e.currentTarget.style.transform = "translateY(0)"; }}
                  onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.96)"; }}
                  onMouseUp={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }}
                >
                  <div className="flex items-center justify-center" style={{ width: 52, height: 52, borderRadius: 16, background: p.iconBoxBg, border: p.iconBoxBorder }}>
                    <Icon style={{ width: 26, height: 26 }} />
                  </div>
                  <p className="text-center" style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.2 }}>{item.label}</p>
                  <p className="text-center" style={{ color: p.textDim, fontSize: 11 }}>{item.shortLabel}</p>
                </button>
              </div>
            );
          })}
        </div>

      </main>

      {/* ═══════════ Bottom Nav ═══════════ */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 premium-bottom-nav safe-area-bottom">
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${bottomBarItems.length}, 1fr)`, height: "6rem" }}>
          {bottomBarItems.map((item) => {
            if (!item) return null;
            const Icon = getIconComponent(item.icon);
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.route)}
                className="flex flex-col items-center justify-center cursor-pointer"
                style={{ gap: 6, fontSize: 12, fontWeight: 600, background: "none", border: "none", color: p.isDarkBase ? "#ffffff" : "#000000", transition: "all 0.2s" }}
              >
                <div className="flex items-center justify-center" style={{ width: 40, height: 40, borderRadius: 12, transition: "all 0.2s" }}>
                  <Icon style={{ width: 22, height: 22 }} />
                </div>
                <span>{item.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Floating Camera Widget */}
      <CameraWidget />
    </div>
  );
}
