import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Grip,
  ChevronUp,
  ChevronDown,
  ArrowRightLeft,
  Save,
  CheckCircle2,
  Phone,
  Palette,
  EyeOff,
  Eye,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

/* ──────────────────────────────────────────────────
   All available function items for the porteiro
   ────────────────────────────────────────────────── */
export interface DashboardItem {
  id: string;
  icon: string;        // lucide icon name (used as key)
  label: string;
  shortLabel: string;  // for bottom bar (shorter)
  route: string;
}

export const ALL_ITEMS: DashboardItem[] = [
  { id: "interfone",        icon: "Phone",           label: "Interfone Digital",    shortLabel: "Interfone",       route: "/portaria/interfone" },
];

/* ── Icon map ── */
const ICON_MAP: Record<string, any> = {
  Phone,
};

export function getIconComponent(iconName: string) {
  return ICON_MAP[iconName] || Grip;
}

/* ── Default config ── */
export const DEFAULT_DASHBOARD_IDS = [
  "interfone",
];

export const DEFAULT_BOTTOMBAR_IDS = [
  "interfone",
];

/* ── Local Storage helpers ── */
const STORAGE_KEY = "portaria-dashboard-layout";

export interface LayoutConfig {
  dashboard: string[];
  bottomBar: string[];
  hidden: string[];
}

export function loadLayout(): LayoutConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.dashboard && parsed.bottomBar) {
        return { dashboard: parsed.dashboard, bottomBar: parsed.bottomBar, hidden: parsed.hidden || [] };
      }
    }
  } catch {}
  return { dashboard: DEFAULT_DASHBOARD_IDS, bottomBar: DEFAULT_BOTTOMBAR_IDS, hidden: [] };
}

export function saveLayout(config: LayoutConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function getItemById(id: string): DashboardItem | undefined {
  return ALL_ITEMS.find((i) => i.id === id);
}

/* ══════════════════════════════════════════════════
   Page Component
   ══════════════════════════════════════════════════ */
export default function PersonalizarDashboard() {
  const { isDark, p } = useTheme();
  const navigate = useNavigate();
  const [dashboardIds, setDashboardIds] = useState<string[]>([]);
  const [bottomBarIds, setBottomBarIds] = useState<string[]>([]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const layout = loadLayout();
    setDashboardIds(layout.dashboard);
    setBottomBarIds(layout.bottomBar);
    setHiddenIds(layout.hidden);
  }, []);

  const move = useCallback((list: string[], setList: (v: string[]) => void, index: number, dir: -1 | 1) => {
    const newList = [...list];
    const target = index + dir;
    if (target < 0 || target >= newList.length) return;
    [newList[index], newList[target]] = [newList[target], newList[index]];
    setList(newList);
  }, []);

  const transferToBottomBar = useCallback((id: string) => {
    if (bottomBarIds.length >= 5) return; // max 5 on bottom bar
    setDashboardIds((prev) => prev.filter((i) => i !== id));
    setBottomBarIds((prev) => [...prev, id]);
  }, [bottomBarIds]);

  const transferToDashboard = useCallback((id: string) => {
    setBottomBarIds((prev) => prev.filter((i) => i !== id));
    setHiddenIds((prev) => prev.filter((i) => i !== id));
    setDashboardIds((prev) => [...prev, id]);
  }, []);

  const hideItem = useCallback((id: string) => {
    setDashboardIds((prev) => prev.filter((i) => i !== id));
    setBottomBarIds((prev) => prev.filter((i) => i !== id));
    setHiddenIds((prev) => [...prev, id]);
  }, []);

  const showItem = useCallback((id: string) => {
    setHiddenIds((prev) => prev.filter((i) => i !== id));
    setDashboardIds((prev) => [...prev, id]);
  }, []);

  const handleSave = () => {
    saveLayout({ dashboard: dashboardIds, bottomBar: bottomBarIds, hidden: hiddenIds });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const renderItem = (
    id: string,
    index: number,
    list: string[],
    setList: (v: string[]) => void,
    zone: "dashboard" | "bottomBar" | "hidden"
  ) => {
    const item = getItemById(id);
    if (!item) return null;
    const IconComp = getIconComponent(item.icon);
    const isHidden = zone === "hidden";

    return (
      <div
        key={id}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "14px",
          padding: "14px 16px",
          borderRadius: "14px",
          border: isHidden ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(0,0,0,0.08)",
          background: "var(--color-card, #fff)",
          opacity: isHidden ? 0.6 : 1,
        }}
      >
        <div
          style={{
            width: "40px", height: "40px", borderRadius: "10px",
            border: `2px solid ${isHidden ? "#94a3b8" : "#003580"}`, display: "flex",
            alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}
        >
          <IconComp className="w-5 h-5" style={{ color: isHidden ? "#94a3b8" : "#003580" }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 600, fontSize: "14px", color: isHidden ? "#94a3b8" : "var(--color-foreground, #0f172a)" }}>
            {item.label}
          </p>
          <p style={{ fontSize: "11px", color: "#64748b" }}>
            {zone === "dashboard" ? "No dashboard" : zone === "bottomBar" ? "Na barra inferior" : "Oculto"}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          {!isHidden && (
            <>
              <button
                onClick={() => move(list, setList, index, -1)}
                disabled={index === 0}
                style={{
                  width: "32px", height: "32px", borderRadius: "8px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: "1px solid rgba(0,0,0,0.1)", background: index === 0 ? "rgba(0,0,0,0.03)" : "#fff",
                  cursor: index === 0 ? "default" : "pointer", opacity: index === 0 ? 0.3 : 1,
                }}
              >
                <ChevronUp className="w-4 h-4" style={{ color: "#64748b" }} />
              </button>
              <button
                onClick={() => move(list, setList, index, 1)}
                disabled={index === list.length - 1}
                style={{
                  width: "32px", height: "32px", borderRadius: "8px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: "1px solid rgba(0,0,0,0.1)", background: index === list.length - 1 ? "rgba(0,0,0,0.03)" : "#fff",
                  cursor: index === list.length - 1 ? "default" : "pointer", opacity: index === list.length - 1 ? 0.3 : 1,
                }}
              >
                <ChevronDown className="w-4 h-4" style={{ color: "#64748b" }} />
              </button>
              <button
                onClick={() => zone === "dashboard" ? transferToBottomBar(id) : transferToDashboard(id)}
                disabled={zone === "dashboard" && bottomBarIds.length >= 5}
                title={zone === "dashboard" ? "Mover p/ barra inferior" : "Mover p/ dashboard"}
                style={{
                  width: "32px", height: "32px", borderRadius: "8px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: "1px solid #003580", background: "rgba(0,53,128,0.08)",
                  cursor: zone === "dashboard" && bottomBarIds.length >= 5 ? "default" : "pointer",
                  opacity: zone === "dashboard" && bottomBarIds.length >= 5 ? 0.3 : 1,
                }}
              >
                <ArrowRightLeft className="w-4 h-4" style={{ color: "#003580" }} />
              </button>
            </>
          )}
          {/* Hide / Show button */}
          <button
            onClick={() => isHidden ? showItem(id) : hideItem(id)}
            title={isHidden ? "Mostrar" : "Ocultar"}
            style={{
              width: "32px", height: "32px", borderRadius: "8px",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: isHidden ? "1px solid #10b981" : "1px solid #ef4444",
              background: isHidden ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
              cursor: "pointer",
            }}
          >
            {isHidden ? <Eye className="w-4 h-4" style={{ color: "#10b981" }} /> : <EyeOff className="w-4 h-4" style={{ color: "#ef4444" }} />}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: p.pageBg }}>
      {/* Header */}
      <header
        className="sticky top-0 z-40"
        style={{ background: p.headerBg, padding: "1rem 1.5rem", borderBottom: p.headerBorder, boxShadow: p.headerShadow, color: p.text }}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            style={{ width: 40, height: 40, borderRadius: 12, background: p.btnBg, border: p.btnBorder, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: p.text }}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <Palette className="w-6 h-6" />
            <div>
              <h1 style={{ fontWeight: 700, fontSize: 18 }}>Personalizar Dashboard</h1>
              <p style={{ color: isDark ? "rgba(255,255,255,0.6)" : "#64748b", fontSize: 12 }}>Reorganize seus ícones de atalho</p>
            </div>
          </div>
        </div>
      </header>

      <main style={{ flex: 1, display: "flex", flexDirection: "column", gap: "32px", padding: "24px", paddingBottom: "120px" }}>

        {/* Info */}
        <div style={{
          padding: "14px 18px", borderRadius: "14px",
          border: "2px solid #003580", background: "transparent",
          fontSize: "13px", color: "var(--color-foreground, #0f172a)", lineHeight: 1.5,
        }}>
          Use as <strong>setas ↑↓</strong> para reordenar, o botão <strong>⇄</strong> para mover entre dashboard e barra, e o <strong>olho</strong> para ocultar/mostrar.
          <br />
          <span style={{ color: "#64748b", fontSize: "12px" }}>Máximo de 5 itens na barra inferior.</span>
        </div>

        {/* ═══ Dashboard Section ═══ */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
            <Grip className="w-5 h-5" style={{ color: "#003580" }} />
            <h2 style={{ fontWeight: 700, fontSize: "16px", color: "var(--color-foreground, #0f172a)" }}>
              Dashboard Principal
            </h2>
            <span style={{
              fontSize: "12px", fontWeight: 700, padding: "2px 10px",
              borderRadius: "999px", background: "rgba(0,53,128,0.1)", color: "#003580",
            }}>
              {dashboardIds.length}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {dashboardIds.map((id, i) => renderItem(id, i, dashboardIds, setDashboardIds, "dashboard"))}
          </div>
        </div>

        {/* ═══ Bottom Bar Section ═══ */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
            <Grip className="w-5 h-5" style={{ color: "#003580" }} />
            <h2 style={{ fontWeight: 700, fontSize: "16px", color: "var(--color-foreground, #0f172a)" }}>
              Barra Inferior
            </h2>
            <span style={{
              fontSize: "12px", fontWeight: 700, padding: "2px 10px",
              borderRadius: "999px", background: bottomBarIds.length >= 5 ? "rgba(239,68,68,0.15)" : "rgba(0,53,128,0.1)",
              color: bottomBarIds.length >= 5 ? "#ef4444" : "#003580",
            }}>
              {bottomBarIds.length}/5
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {bottomBarIds.map((id, i) => renderItem(id, i, bottomBarIds, setBottomBarIds, "bottomBar"))}
          </div>
        </div>

        {/* ═══ Hidden Section ═══ */}
        {hiddenIds.length > 0 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
              <EyeOff className="w-5 h-5" style={{ color: "#94a3b8" }} />
              <h2 style={{ fontWeight: 700, fontSize: "16px", color: "var(--color-foreground, #0f172a)" }}>
                Ocultos
              </h2>
              <span style={{
                fontSize: "12px", fontWeight: 700, padding: "2px 10px",
                borderRadius: "999px", background: "rgba(148,163,184,0.15)", color: "#94a3b8",
              }}>
                {hiddenIds.length}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {hiddenIds.map((id, i) => renderItem(id, i, hiddenIds, setHiddenIds, "hidden"))}
            </div>
          </div>
        )}
      </main>

      {/* Save Button */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
        padding: "16px 24px", paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
        background: "var(--color-background, #fff)",
        borderTop: "1px solid rgba(0,0,0,0.08)",
      }}>
        <button
          onClick={handleSave}
          style={{
            width: "100%", padding: "14px", borderRadius: "14px",
            background: saved ? "#10b981" : "linear-gradient(135deg, #0062d1 0%, #003580 100%)",
            color: "#fff", fontWeight: 700, fontSize: "15px",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            cursor: "pointer", border: "none", transition: "all 0.3s",
          }}
        >
          {saved ? (
            <>
              <CheckCircle2 className="w-5 h-5" />
              Salvo com sucesso!
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Salvar Layout
            </>
          )}
        </button>
      </div>
    </div>
  );
}
