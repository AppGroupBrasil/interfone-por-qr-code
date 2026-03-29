import { useAuth, getRoleLabel } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import ThemePicker from "@/components/ThemePicker";
import {
  Home,
  LogOut,
  Shield,
  Bell,
  UserCircle,
  Loader2,
  Phone,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import FuncoesIndex from "@/components/FuncoesIndex";

// ─── Feature key mapping ─────────────────────────────────
interface FeatureButton {
  key: string;          // condominio_config key
  label: string;
  description: string;
  route: string;
  icon: typeof Phone;
  gradient: string;
  delay: string;
}

const ALL_FEATURES: FeatureButton[] = [
  {
    key: "feature_interfone",
    label: "Interfone Digital",
    description: "Receba chamadas de visitantes com vídeo",
    route: "/morador/interfone-config",
    icon: Phone,
    gradient: "#003580",
    delay: "0.15s",
  },
];




export default function DashboardMorador() {
  const { user, logout } = useAuth();
  const { toggleTheme, p } = useTheme();
  const navigate = useNavigate();

  const [config, setConfig] = useState<Record<string, string>>({});
  const [configLoaded, setConfigLoaded] = useState(false);

  // Fetch condominio feature config
  useEffect(() => {
    apiFetch("/api/condominio-config")
      .then((res) => res.ok ? res.json() : {})
      .then((data) => {
        setConfig(data);
        setConfigLoaded(true);
      })
      .catch(() => setConfigLoaded(true));
  }, []);

  const isFeatureEnabled = (key: string): boolean => {
    // Default: all features enabled if not configured
    return config[key] !== "false";
  };

  const enabledFeatures = ALL_FEATURES.filter((f) => isFeatureEnabled(f.key));

  // Bottom nav: only Home and Minha Conta
  const filteredBottomNav = [
    { icon: Home, label: "Home", route: "/dashboard" },
    { icon: UserCircle, label: "Minha Conta", route: "/minha-conta" },
  ];

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
              <Home style={{ width: 22, height: 22, color: p.text }} />
            </div>
            <div>
              <span className="block" style={{ fontWeight: 800, fontSize: 20, letterSpacing: "-0.01em", color: p.isDarkBase ? "#ffffff" : "#1e293b" }}>
                {user?.name?.split(" ")[0] || "Morador"}
              </span>
              <span className="flex items-center" style={{ fontSize: 13, color: p.isDarkBase ? "#ffffff" : "#334155", gap: 6 }}>
                <Shield style={{ width: 14, height: 14 }} />
                {getRoleLabel(user?.role || "morador")}
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
        <p style={{ fontSize: 14, color: p.isDarkBase ? "#ffffff" : "#003580", fontWeight: 500 }}>Bem-vindo(a) ao</p>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: p.isDarkBase ? "#ffffff" : "#1e293b", marginTop: 4 }}>Painel do Morador</h1>
        <p style={{ fontSize: 14, color: p.isDarkBase ? "#ffffff" : "#334155", marginTop: 6 }}>Selecione uma função abaixo</p>
      </div>

      <main className="flex-1 overflow-x-hidden" style={{ paddingBottom: "10rem", paddingLeft: 16, paddingRight: 16, paddingTop: 20 }}>

        <FuncoesIndex userRole={user?.role || "morador"} />

        {!configLoaded ? (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: "4rem" }}>
            <div className="flex items-center justify-center" style={{ width: 64, height: 64, borderRadius: 20, background: p.btnBg, border: p.iconBoxBorder }}>
              <Loader2 className="animate-spin" style={{ width: 28, height: 28, color: p.text }} />
            </div>
          </div>
        ) : enabledFeatures.length === 0 ? (
          <div style={{ textAlign: "center", paddingTop: "4rem" }}>
            <p style={{ fontSize: 15, color: p.isDarkBase ? "#ffffff" : "#003580" }}>
              Nenhuma função habilitada pelo síndico.
            </p>
          </div>
        ) : (
          <div className="morador-features-grid">
            {enabledFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.key} className="animate-fade-in" style={{ animationDelay: feature.delay }}>
                  <button
                    onClick={() => navigate(feature.route)}
                    className="w-full flex flex-col items-center cursor-pointer"
                    style={{
                      padding: "20px 12px",
                      height: "100%",
                      minHeight: 130,
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
                    onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.96)"; }}
                    onMouseUp={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }}
                  >
                    <div className="flex items-center justify-center shrink-0" style={{ width: 48, height: 48, borderRadius: 14, background: p.featureIconBoxBg, border: p.featureIconBoxBorder }}>
                      <Icon style={{ width: 22, height: 22, color: p.textAccent, stroke: p.textAccent }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 2, lineHeight: 1.2 }}>{feature.label}</p>
                      <p style={{ color: p.isDarkBase ? "rgba(255,255,255,0.7)" : "#475569", fontSize: 11, lineHeight: 1.3 }}>{feature.description}</p>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ═══════════ Bottom Nav ═══════════ */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 premium-bottom-nav safe-area-bottom">
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${filteredBottomNav.length}, 1fr)`, height: "6rem" }}>
          {filteredBottomNav.map((item) => (
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
