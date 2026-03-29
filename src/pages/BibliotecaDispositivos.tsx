import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  Star,
  Wifi,
  WifiOff,
  Cloud,
  Globe,
  Zap,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Info,
  Filter,
  Package,
  Cpu,
  Radio,
  Shield,
  Camera,
  Fingerprint,
  CreditCard,
  Gauge,
  Settings2,
} from "lucide-react";
import {
  BRANDS,
  DEVICES,
  CATEGORY_LABELS,
  INTEGRATION_LABELS,
  PROTOCOL_LABELS,
  type DeviceModel,
  type DeviceCategory,
  type DeviceProtocol,
  type BrandInfo,
} from "@/lib/deviceLibrary";
import { useTheme } from "@/hooks/useTheme";

/* ── Ícone de categoria ───────────────── */
function CategoryIcon({ cat, size = 16, color = "#003580" }: { cat: DeviceCategory; size?: number; color?: string }) {
  const s = { color, width: size, height: size };
  switch (cat) {
    case "relay": return <Zap style={s} />;
    case "controller": return <Settings2 style={s} />;
    case "intercom": return <Radio style={s} />;
    case "camera": return <Camera style={s} />;
    case "biometric": return <Fingerprint style={s} />;
    case "reader": return <CreditCard style={s} />;
    case "module": return <Cpu style={s} />;
    case "sensor": return <Gauge style={s} />;
    default: return <Package style={s} />;
  }
}

/* ── Ícone de integração ──────────────── */
function IntegrationBadge({ type }: { type: "cloud" | "local" | "hybrid" }) {
  const colors = { cloud: "#7c3aed", local: "#059669", hybrid: "#d97706" };
  const icons = { cloud: Cloud, local: Wifi, hybrid: Globe };
  const Icon = icons[type];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "4px",
      fontSize: "11px", fontWeight: 600, padding: "2px 8px",
      borderRadius: "20px", background: `${colors[type]}15`,
      color: colors[type], whiteSpace: "nowrap",
    }}>
      <Icon style={{ width: 12, height: 12 }} />
      {INTEGRATION_LABELS[type]}
    </span>
  );
}

/* ── Card de Marca ────────────────────── */
function BrandCard({ brand, isActive, onClick }: { brand: BrandInfo; isActive: boolean; onClick: () => void }) {
  const count = DEVICES.filter((d) => d.brand === brand.id).length;
  return (
    <button
      onClick={onClick}
      style={{
        background: isActive ? "#003580" : "#fff",
        color: isActive ? "#fff" : "#1e293b",
        border: isActive ? "2px solid #003580" : "1px solid #e2e8f0",
        borderRadius: "12px",
        padding: "10px 16px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "4px",
        minWidth: "100px",
        transition: "all 0.2s",
        boxShadow: isActive ? "0 4px 12px rgba(0,53,128,0.25)" : "0 1px 3px rgba(0,0,0,0.05)",
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: "14px", fontWeight: 700 }}>{brand.name.split("/")[0].trim()}</span>
      <span style={{ fontSize: "11px", opacity: 0.7 }}>{count} dispositivo{count !== 1 ? "s" : ""}</span>
    </button>
  );
}

/* ── Card de Dispositivo ──────────────── */
function DeviceCard({ device }: { device: DeviceModel }) {
  const [expanded, setExpanded] = useState(false);
  const brand = BRANDS.find((b) => b.id === device.brand);

  return (
    <div style={{
      background: "#fff",
      borderRadius: "16px",
      overflow: "hidden",
      border: device.recommended ? "2px solid #003580" : "1px solid #e2e8f0",
      boxShadow: device.recommended
        ? "0 4px 16px rgba(0,53,128,0.12)"
        : "0 1px 4px rgba(0,0,0,0.04)",
      transition: "all 0.2s",
    }}>
      {/* Recommended badge */}
      {device.recommended && (
        <div style={{
          background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)",
          color: "#fff",
          padding: "6px 16px",
          fontSize: "11px",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          gap: "6px",
          letterSpacing: "0.5px",
        }}>
          <Star style={{ width: 12, height: 12 }} fill="#fbbf24" color="#fbbf24" />
          RECOMENDADO APP INTERFONE
        </div>
      )}

      <div style={{ padding: "16px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span style={{
                fontSize: "10px", fontWeight: 700, color: "#64748b",
                textTransform: "uppercase", letterSpacing: "0.5px",
              }}>
                {brand?.name}
              </span>
              <IntegrationBadge type={device.integrationType} />
            </div>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: "6px 0 0" }}>
              {device.name}
            </h3>
            <p style={{ fontSize: "12px", color: "#64748b", margin: "2px 0 0" }}>
              {device.model}
            </p>
          </div>

          {/* Status badge */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: "4px",
          }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: "4px",
              fontSize: "11px", fontWeight: 600, padding: "3px 10px",
              borderRadius: "20px",
              background: device.available ? "#dcfce7" : "#fef9c3",
              color: device.available ? "#166534" : "#854d0e",
            }}>
              {device.available ? (
                <><CheckCircle2 style={{ width: 11, height: 11 }} /> Integrado</>
              ) : (
                <><Info style={{ width: 11, height: 11 }} /> Em breve</>
              )}
            </span>
            {device.priceRange && (
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#003580" }}>
                {device.priceRange}
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        <p style={{
          fontSize: "13px", color: "#334155", margin: "12px 0 0",
          lineHeight: 1.6,
        }}>
          {device.description}
        </p>

        {/* Category + Protocol */}
        <div style={{
          display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap",
        }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: "4px",
            fontSize: "11px", fontWeight: 600, padding: "3px 10px",
            borderRadius: "20px", background: "#f1f5f9", color: "#475569",
          }}>
            <CategoryIcon cat={device.category} size={12} color="#475569" />
            {CATEGORY_LABELS[device.category]}
          </span>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: "4px",
            fontSize: "11px", fontWeight: 600, padding: "3px 10px",
            borderRadius: "20px", background: "#eff6ff", color: "#1e40af",
          }}>
            <Cpu style={{ width: 12, height: 12 }} />
            {PROTOCOL_LABELS[device.protocol]}
          </span>
        </div>

        {/* Quick specs */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
          gap: "8px",
          marginTop: "12px",
          background: "#f8fafc",
          borderRadius: "10px",
          padding: "10px",
        }}>
          {device.specs.channels && (
            <Spec label="Canais" value={`${device.specs.channels}`} />
          )}
          {device.specs.voltage && (
            <Spec label="Tensão" value={device.specs.voltage} />
          )}
          <Spec label="Conexão" value={device.specs.connectivity} />
          {device.specs.power && (
            <Spec label="Potência" value={device.specs.power} />
          )}
        </div>

        {/* Expand/collapse */}
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            width: "100%",
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            marginTop: "12px",
            padding: "8px",
            fontSize: "13px",
            fontWeight: 600,
            color: "#003580",
            borderRadius: "8px",
            transition: "background 0.15s",
          }}
        >
          {expanded ? (
            <><ChevronUp style={{ width: 16, height: 16 }} /> Menos detalhes</>
          ) : (
            <><ChevronDown style={{ width: 16, height: 16 }} /> Mais detalhes</>
          )}
        </button>

        {/* Expanded details */}
        {expanded && (
          <div style={{
            borderTop: "1px solid #e2e8f0",
            paddingTop: "14px",
            marginTop: "4px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}>
            {/* Features */}
            <div>
              <h4 style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", margin: "0 0 8px", display: "flex", alignItems: "center", gap: "6px" }}>
                <CheckCircle2 style={{ width: 14, height: 14, color: "#059669" }} />
                Funcionalidades
              </h4>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {device.features.map((f) => (
                  <span key={f} style={{
                    fontSize: "12px", padding: "4px 10px",
                    borderRadius: "20px", background: "#f0fdf4",
                    color: "#166534", border: "1px solid #bbf7d0",
                  }}>
                    {f}
                  </span>
                ))}
              </div>
            </div>

            {/* Use case */}
            <div>
              <h4 style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", margin: "0 0 6px", display: "flex", alignItems: "center", gap: "6px" }}>
                <Shield style={{ width: 14, height: 14, color: "#003580" }} />
                Caso de Uso
              </h4>
              <p style={{ fontSize: "13px", color: "#334155", margin: 0, lineHeight: 1.6 }}>
                {device.useCase}
              </p>
            </div>

            {/* Install notes */}
            <div>
              <h4 style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", margin: "0 0 6px", display: "flex", alignItems: "center", gap: "6px" }}>
                <Settings2 style={{ width: 14, height: 14, color: "#d97706" }} />
                Instalação
              </h4>
              <p style={{ fontSize: "13px", color: "#334155", margin: 0, lineHeight: 1.6, background: "#fffbeb", padding: "10px 12px", borderRadius: "8px", border: "1px solid #fde68a" }}>
                {device.installNotes}
              </p>
            </div>

            {/* Protocols */}
            {device.specs.protocols && (
              <div>
                <h4 style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", margin: "0 0 6px" }}>
                  Protocolos suportados
                </h4>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {device.specs.protocols.map((p) => (
                    <span key={p} style={{
                      fontSize: "12px", padding: "4px 10px",
                      borderRadius: "20px", background: "#eff6ff",
                      color: "#1e40af", border: "1px solid #bfdbfe",
                    }}>
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Extra specs */}
            {device.specs.extras && (
              <div>
                <h4 style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", margin: "0 0 6px" }}>
                  Extras
                </h4>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {device.specs.extras.map((e) => (
                    <span key={e} style={{
                      fontSize: "12px", padding: "4px 10px",
                      borderRadius: "20px", background: "#f5f3ff",
                      color: "#6d28d9", border: "1px solid #ddd6fe",
                    }}>
                      {e}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Dimensions */}
            {device.specs.dimensions && (
              <div style={{ fontSize: "12px", color: "#64748b" }}>
                <strong>Dimensões:</strong> {device.specs.dimensions}
              </div>
            )}

            {/* Purchase link */}
            {device.purchaseUrl && (
              <a
                href={device.purchaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  padding: "12px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "14px",
                  textDecoration: "none",
                  boxShadow: "0 4px 12px rgba(0,53,128,0.3)",
                }}
              >
                <ExternalLink style={{ width: 16, height: 16 }} />
                Ver preços e comprar
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Mini spec ────────────────────────── */
function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: "10px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.3px" }}>
        {label}
      </div>
      <div style={{ fontSize: "12px", fontWeight: 600, color: "#334155", marginTop: "2px" }}>
        {value}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Página Principal
   ═══════════════════════════════════════════════════ */

type TabKey = "all" | "brand" | "category";

const CATEGORIES: DeviceCategory[] = ["relay", "controller", "intercom", "biometric", "module", "camera", "reader", "sensor"];

export default function BibliotecaDispositivos() {
  const { isDark, p } = useTheme();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TabKey>("all");
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [selectedCat, setSelectedCat] = useState<DeviceCategory | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filterIntegration, setFilterIntegration] = useState<string | null>(null);
  const [filterAvailable, setFilterAvailable] = useState<boolean | null>(null);

  const filtered = useMemo(() => {
    let list = [...DEVICES];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.brand.toLowerCase().includes(q) ||
          d.model.toLowerCase().includes(q) ||
          d.description.toLowerCase().includes(q) ||
          CATEGORY_LABELS[d.category].toLowerCase().includes(q),
      );
    }

    // Brand filter
    if (selectedBrand) list = list.filter((d) => d.brand === selectedBrand);

    // Category filter
    if (selectedCat) list = list.filter((d) => d.category === selectedCat);

    // Integration type filter
    if (filterIntegration) list = list.filter((d) => d.integrationType === filterIntegration);

    // Available filter
    if (filterAvailable !== null) list = list.filter((d) => d.available === filterAvailable);

    // Sort: recommended first, then by brand
    list.sort((a, b) => {
      if (a.recommended && !b.recommended) return -1;
      if (!a.recommended && b.recommended) return 1;
      if (a.available && !b.available) return -1;
      if (!a.available && b.available) return 1;
      return a.brand.localeCompare(b.brand);
    });

    return list;
  }, [search, selectedBrand, selectedCat, filterIntegration, filterAvailable]);

  return (
    <div style={{ minHeight: "100dvh", background: "linear-gradient(135deg, #f8fafc 0%, #e0e7ef 100%)" }}>
      {/* ── Header ─── */}
      <div style={{
        background: isDark ? "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)" : "#ffffff",
        padding: "20px 16px 24px",
        color: p.text,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: isDark ? "rgba(255,255,255,0.15)" : "#f0f4f8",
              border: "none", borderRadius: "10px", padding: "8px",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <ArrowLeft className="w-5 h-5" style={{ color: p.text }} />
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700 }}>
              Biblioteca de Dispositivos
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: "13px", opacity: 0.8 }}>
              Hardware compatível com App Interfone
            </p>
          </div>
        </div>

        {/* Search */}
        <div style={{
          marginTop: "16px",
          position: "relative",
        }}>
          <Search style={{
            position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)",
            width: 18, height: 18, color: "#94a3b8",
          }} />
          <input
            type="text"
            placeholder="Buscar dispositivo, marca ou modelo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 12px 12px 42px",
              borderRadius: "12px",
              border: "none",
              background: isDark ? "rgba(255,255,255,0.15)" : "#f0f4f8",
              color: p.text,
              fontSize: "14px",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      {/* ── Content ─── */}
      <div style={{ padding: "16px", maxWidth: "640px", margin: "0 auto" }}>
        {/* Summary stats */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: "8px",
          marginBottom: "16px",
        }}>
          <StatBox label="Dispositivos" value={DEVICES.length} icon={<Package style={{ width: 16, height: 16, color: "#003580" }} />} />
          <StatBox label="Marcas" value={BRANDS.length} icon={<Globe style={{ width: 16, height: 16, color: "#7c3aed" }} />} />
          <StatBox
            label="Integrados"
            value={DEVICES.filter((d) => d.available).length}
            icon={<CheckCircle2 style={{ width: 16, height: 16, color: "#059669" }} />}
          />
        </div>

        {/* ═══ Aviso de Segurança — Instalação ═══ */}
        <div style={{
          marginBottom: 12, padding: "12px 14px", borderRadius: 14,
          background: "#fffbeb",
          border: "1px solid #fde68a",
          display: "flex", gap: "10px", alignItems: "flex-start",
        }}>
          <Info style={{ width: 20, height: 20, color: "#f59e0b", flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: "12px", lineHeight: 1.5, color: "#92400e" }}>
            <p style={{ fontWeight: 700, marginBottom: 3 }}>⚡ Instalação Segura</p>
            <p style={{ margin: "2px 0" }}>• Conecte o módulo na <strong>botoeira do motor</strong> (contato seco), nunca direto na alimentação.</p>
            <p style={{ margin: "2px 0" }}>• Wi-Fi <strong>2.4 GHz dedicado</strong> com sinal forte no local do módulo é obrigatório.</p>
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex", gap: "6px", marginBottom: "12px",
          overflowX: "auto", WebkitOverflowScrolling: "touch",
          paddingBottom: "4px",
        }}>
          {([
            { key: "all", label: "Todos" },
            { key: "brand", label: "Por Marca" },
            { key: "category", label: "Por Categoria" },
          ] as { key: TabKey; label: string }[]).map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key);
                if (t.key === "all") { setSelectedBrand(null); setSelectedCat(null); }
              }}
              style={{
                padding: "8px 16px",
                borderRadius: "20px",
                border: "none",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: 600,
                whiteSpace: "nowrap",
                background: tab === t.key ? "#003580" : "#fff",
                color: tab === t.key ? "#fff" : "#334155",
                boxShadow: tab === t.key
                  ? "0 2px 8px rgba(0,53,128,0.3)"
                  : "0 1px 3px rgba(0,0,0,0.05)",
                transition: "all 0.2s",
              }}
            >
              {t.label}
            </button>
          ))}

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              padding: "8px 16px",
              borderRadius: "20px",
              border: "none",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
              whiteSpace: "nowrap",
              background: showFilters ? "#f1f5f9" : "#fff",
              color: "#64748b",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            <Filter style={{ width: 14, height: 14 }} />
            Filtros
          </button>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div style={{
            background: "#fff",
            borderRadius: "12px",
            padding: "14px",
            marginBottom: "12px",
            border: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "#64748b" }}>Tipo de integração</div>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {[
                { value: null, label: "Todos" },
                { value: "cloud", label: "Cloud" },
                { value: "local", label: "Local" },
                { value: "hybrid", label: "Híbrido" },
              ].map((f) => (
                <button
                  key={f.label}
                  onClick={() => setFilterIntegration(f.value)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "16px",
                    border: "1px solid #e2e8f0",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: 600,
                    background: filterIntegration === f.value ? "#003580" : "#f8fafc",
                    color: filterIntegration === f.value ? "#fff" : "#475569",
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div style={{ fontSize: "12px", fontWeight: 600, color: "#64748b" }}>Status</div>
            <div style={{ display: "flex", gap: "6px" }}>
              {[
                { value: null, label: "Todos" },
                { value: true, label: "Integrados" },
                { value: false, label: "Em breve" },
              ].map((f) => (
                <button
                  key={String(f.value)}
                  onClick={() => setFilterAvailable(f.value as boolean | null)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "16px",
                    border: "1px solid #e2e8f0",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: 600,
                    background: filterAvailable === f.value ? "#003580" : "#f8fafc",
                    color: filterAvailable === f.value ? "#fff" : "#475569",
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Brand selector */}
        {tab === "brand" && (
          <div style={{
            display: "flex",
            gap: "8px",
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
            paddingBottom: "12px",
            marginBottom: "4px",
          }}>
            <BrandCard
              brand={{ id: "", name: "Todos", country: "", website: "", description: "", protocols: [], integrationType: "hybrid", difficulty: 0 }}
              isActive={!selectedBrand}
              onClick={() => setSelectedBrand(null)}
            />
            {BRANDS.map((b) => (
              <BrandCard
                key={b.id}
                brand={b}
                isActive={selectedBrand === b.id}
                onClick={() => setSelectedBrand(selectedBrand === b.id ? null : b.id)}
              />
            ))}
          </div>
        )}

        {/* Category selector */}
        {tab === "category" && (
          <div style={{
            display: "flex",
            gap: "6px",
            flexWrap: "wrap",
            marginBottom: "12px",
          }}>
            <button
              onClick={() => setSelectedCat(null)}
              style={{
                padding: "8px 14px",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: 600,
                background: !selectedCat ? "#003580" : "#fff",
                color: !selectedCat ? "#fff" : "#475569",
              }}
            >
              Todos
            </button>
            {CATEGORIES.map((cat) => {
              const count = DEVICES.filter((d) => d.category === cat).length;
              if (count === 0) return null;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCat(selectedCat === cat ? null : cat)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    background: selectedCat === cat ? "#003580" : "#fff",
                    color: selectedCat === cat ? "#fff" : "#475569",
                  }}
                >
                  <CategoryIcon cat={cat} size={14} color={selectedCat === cat ? "#fff" : "#475569"} />
                  {CATEGORY_LABELS[cat]}
                  <span style={{
                    fontSize: "10px",
                    background: selectedCat === cat ? "rgba(255,255,255,0.2)" : "#f1f5f9",
                    padding: "2px 6px",
                    borderRadius: "10px",
                  }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Brand info card (when brand selected) */}
        {selectedBrand && (() => {
          const brand = BRANDS.find((b) => b.id === selectedBrand);
          if (!brand) return null;
          return (
            <div style={{
              background: "#fff",
              borderRadius: "14px",
              padding: "16px",
              marginBottom: "14px",
              border: "1px solid #e2e8f0",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: 0 }}>{brand.name}</h3>
                  <p style={{ fontSize: "12px", color: "#64748b", margin: "2px 0 0" }}>
                    {brand.country} · <a href={brand.website} target="_blank" rel="noopener noreferrer" style={{ color: "#003580" }}>{brand.website.replace("https://", "")}</a>
                  </p>
                </div>
                <IntegrationBadge type={brand.integrationType} />
              </div>
              <p style={{ fontSize: "13px", color: "#334155", margin: "10px 0 0", lineHeight: 1.6 }}>
                {brand.description}
              </p>
            </div>
          );
        })()}

        {/* Results count */}
        <div style={{
          fontSize: "12px", fontWeight: 600, color: "#64748b",
          marginBottom: "12px",
        }}>
          {filtered.length} dispositivo{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
        </div>

        {/* Device list */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {filtered.map((device) => (
            <DeviceCard key={device.id} device={device} />
          ))}

          {filtered.length === 0 && (
            <div style={{
              textAlign: "center", padding: "40px 20px",
              color: "#94a3b8", fontSize: "14px",
            }}>
              <Package style={{ width: 40, height: 40, marginBottom: "12px", opacity: 0.4 }} />
              <p style={{ margin: 0 }}>Nenhum dispositivo encontrado</p>
              <p style={{ margin: "4px 0 0", fontSize: "12px" }}>Tente ajustar os filtros ou a busca</p>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div style={{
          marginTop: "24px",
          padding: "16px",
          background: "#fff",
          borderRadius: "14px",
          border: "1px solid #e2e8f0",
          textAlign: "center",
        }}>
          <p style={{ fontSize: "13px", color: "#64748b", margin: 0, lineHeight: 1.6 }}>
            💡 O App Interfone está constantemente adicionando suporte a novos dispositivos.
            Hardware marcado como <strong>"Em breve"</strong> será integrado nas próximas atualizações.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Stat box ─────────────────────────── */
function StatBox({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div style={{
      background: "#fff",
      borderRadius: "12px",
      padding: "12px",
      textAlign: "center",
      border: "1px solid #e2e8f0",
    }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "4px" }}>{icon}</div>
      <div style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a" }}>{value}</div>
      <div style={{ fontSize: "11px", color: "#64748b" }}>{label}</div>
    </div>
  );
}
