import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import TutorialButton, { TSection, TStep, TBullet } from "@/components/TutorialButton";
import {
  ArrowLeft,
  ShieldCheck,
  Truck,
  Car,
  QrCode,
  Mail,
  Check,
  Loader2,
  Settings,
  Building2,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { AppLogo } from "@/components/AppLogo";

// ─── Feature definitions ─────────────────────────────────
interface FeatureDef {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
  gradient: string;
}

const FEATURES: FeatureDef[] = [
  {
    key: "feature_autorizacoes",
    label: "Autorizar Visitante",
    description: "Morador pode criar autorizações prévias de entrada para visitantes",
    icon: ShieldCheck,
    gradient: "#003580",
  },
  {
    key: "feature_delivery",
    label: "Entregas e Delivery",
    description: "Morador pode autorizar recebimento de pedidos na portaria",
    icon: Truck,
    gradient: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
  },
  {
    key: "feature_veiculos",
    label: "Autorizar Veículo",
    description: "Morador pode autorizar acesso de veículos ao condomínio",
    icon: Car,
    gradient: "#003580",
  },
  {
    key: "feature_qr_visitante",
    label: "QR Code de Visitante",
    description: "Morador pode gerar QR Code de autorização para visitantes",
    icon: QrCode,
    gradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
  },
  {
    key: "feature_correspondencias",
    label: "Correspondências",
    description: "Morador pode visualizar avisos de correspondência na portaria",
    icon: Mail,
    gradient: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
  },
];

interface Condominio {
  id: number;
  name: string;
}

export default function AdminFeaturesConfig() {
  const { user } = useAuth();
  const { isDark, p } = useTheme();
  const navigate = useNavigate();

  const [condominios, setCondominios] = useState<Condominio[]>([]);
  const [selectedCondoId, setSelectedCondoId] = useState<number | null>(null);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);

  // Fetch condominios
  useEffect(() => {
    apiFetch("/api/condominios")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Condominio[]) => {
        setCondominios(data);
        if (data.length > 0) {
          setSelectedCondoId(data[0].id);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Fetch config whenever selected condo changes
  useEffect(() => {
    if (!selectedCondoId) return;
    setLoadingConfig(true);
    apiFetch(`/api/condominio-config?condominio_id=${selectedCondoId}`)
      .then((res) => (res.ok ? res.json() : {}))
      .then((data) => {
        setConfig(data);
        setLoadingConfig(false);
      })
      .catch(() => setLoadingConfig(false));
  }, [selectedCondoId]);

  const isFeatureEnabled = (key: string): boolean => {
    return config[key] !== "false";
  };

  const toggleFeature = async (key: string) => {
    if (!selectedCondoId) return;
    const newValue = isFeatureEnabled(key) ? "false" : "true";
    const newConfig = { ...config, [key]: newValue };
    setConfig(newConfig);

    setSaving(true);
    setSaved(false);
    try {
      const res = await apiFetch(`/api/condominio-config?condominio_id=${selectedCondoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: newValue }),
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {}
    setSaving(false);
  };

  const enabledCount = FEATURES.filter((f) => isFeatureEnabled(f.key)).length;
  const selectedCondo = condominios.find((c) => c.id === selectedCondoId);

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: p.pageBg }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: p.textAccent }} />
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: p.pageBg }}>
      {/* ═════════ Header ═════════ */}
      <header
        className="sticky top-0 z-40"
        style={{ background: p.headerBg, borderBottom: p.headerBorder, boxShadow: p.headerShadow, color: p.text }}
      >
        <div className="flex items-center justify-between" style={{ padding: "1rem 1.5rem", height: "4.5rem" }}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: p.btnBg,
                border: p.btnBorder,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: p.text,
              }}
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <span style={{ fontWeight: 700, fontSize: 18 }} className="block">
                Configurações
              </span>
              <span style={{ fontSize: 12, color: p.textSecondary }}>
                Funções dos condomínios
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin text-white/60" />
            ) : saved ? (
              <div className="flex items-center gap-1 text-emerald-300 text-sm font-medium">
                <Check className="w-4 h-4" /> Salvo
              </div>
            ) : null}
            <TutorialButton title="Configurações do Condomínio">
              <TSection icon={<span>📋</span>} title="O QUE É ESTA FUNÇÃO?">
                <p>
                  Painel de <strong>configuração de funções</strong> dos condomínios gerenciados pela
                  administradora. Aqui você habilita ou desabilita os recursos disponíveis para os moradores de
                  cada condomínio individualmente.
                </p>
              </TSection>
              <TSection icon={<span>🔧</span>} title="COMO USAR">
                <TStep n={1}>
                  Selecione o <strong>condomínio</strong> na barra de seleção
                </TStep>
                <TStep n={2}>
                  Toque no <strong>toggle</strong> de cada função para ativar ou desativar
                </TStep>
                <TStep n={3}>
                  As alterações são <strong>salvas automaticamente</strong>
                </TStep>
              </TSection>
              <TSection icon={<span>⚠️</span>} title="IMPORTANTE">
                <TBullet>
                  Cada condomínio tem sua <strong>configuração independente</strong>
                </TBullet>
                <TBullet>
                  Funções desabilitadas ficam <strong>invisíveis</strong> para os moradores
                </TBullet>
                <TBullet>
                  As alterações entram em vigor <strong>imediatamente</strong>
                </TBullet>
              </TSection>
            </TutorialButton>
          </div>
        </div>
      </header>

      <main style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.2rem", paddingBottom: "8rem" }}>
        {/* ═══ Condominium Selector ═══ */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setSelectorOpen(!selectorOpen)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "14px 18px",
              borderRadius: "16px",
              background: p.cardBg,
              border: p.featureBorder,
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: p.accent,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <AppLogo size={20} rounded={4} objectFit="cover" />
            </div>
            <div style={{ flex: 1, textAlign: "left" }}>
              <p style={{ fontSize: "11px", color: p.textMuted, marginBottom: "2px" }}>
                Condomínio selecionado
              </p>
              <p style={{ fontSize: "15px", fontWeight: 600, color: p.textAccent }}>
                {selectedCondo?.name || "Selecione..."}
              </p>
            </div>
            <ChevronDown
              className="w-5 h-5"
              style={{
                color: p.textMuted,
                transition: "transform 0.2s",
                transform: selectorOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}
            />
          </button>

          {/* Dropdown */}
          {selectorOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                left: 0,
                right: 0,
                zIndex: 50,
                borderRadius: "16px",
                background: p.cardBg,
                border: p.cardBorder,
                boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
                maxHeight: "300px",
                overflow: "auto",
              }}
            >
              {condominios.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedCondoId(c.id);
                    setSelectorOpen(false);
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "14px 18px",
                    cursor: "pointer",
                    background: c.id === selectedCondoId ? p.accentLight : "transparent",
                    borderBottom: "1px solid " + p.divider,
                    transition: "background 0.15s",
                    border: "none",
                  }}
                >
                  <Building2 className="w-4 h-4" style={{ color: c.id === selectedCondoId ? p.accent : p.textMuted }} />
                  <span
                    style={{
                      fontSize: "14px",
                      fontWeight: c.id === selectedCondoId ? 600 : 400,
                      color: c.id === selectedCondoId ? p.textAccent : p.textSecondary,
                    }}
                  >
                    {c.name}
                  </span>
                  {c.id === selectedCondoId && (
                    <Check className="w-4 h-4 ml-auto" style={{ color: p.accent }} />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info card */}
        <div
          style={{
            background: "transparent",
            borderRadius: "16px",
            padding: "16px 18px",
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
            border: "none",
          }}
        >
          <Settings className="w-5 h-5 shrink-0" style={{ color: "#6366f1", marginTop: "2px" }} />
          <div>
            <p style={{ fontSize: "13px", fontWeight: 600, color: p.textAccent, marginBottom: "4px" }}>
              Configuração de Funções
            </p>
            <p style={{ fontSize: "12px", color: "#dc2626", lineHeight: 1.5 }}>
              Habilite ou desabilite as funções que aparecem para os moradores do condomínio selecionado.
              Funções desabilitadas ficam invisíveis no painel do morador.
            </p>
          </div>
        </div>

        {/* Summary */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 4px" }}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: p.textHeading }}>
            Funções Disponíveis
          </span>
          <span style={{ fontSize: "12px", color: p.textSecondary }}>
            {enabledCount} de {FEATURES.length} ativas
          </span>
        </div>

        {/* Feature toggles */}
        {loadingConfig ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: p.textAccent }} />
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
            {FEATURES.map((feature) => {
              const enabled = isFeatureEnabled(feature.key);
              const Icon = feature.icon;
              return (
                <div
                  key={feature.key}
                  onClick={() => toggleFeature(feature.key)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    padding: "16px 18px",
                    borderRadius: "16px",
                    cursor: "pointer",
                    background: "transparent",
                    border: "none",
                    opacity: enabled ? 1 : 0.6,
                    transition: "all 0.2s ease",
                    boxShadow: "none",
                  }}
                >
                  {/* Icon */}
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "12px",
                      background: enabled ? feature.gradient : p.surfaceBg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      transition: "all 0.2s ease",
                    }}
                  >
                    <Icon className="w-5 h-5" style={{ color: enabled ? "#fff" : p.textMuted }} />
                  </div>

                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        color: p.textHeading,
                        marginBottom: "2px",
                      }}
                    >
                      {feature.label}
                    </p>
                    <p
                      style={{
                        fontSize: "11px",
                        color: p.textSecondary,
                        lineHeight: 1.4,
                      }}
                    >
                      {feature.description}
                    </p>
                  </div>

                  {/* Toggle */}
                  <div
                    style={{
                      width: "48px",
                      height: "28px",
                      borderRadius: "14px",
                      background: enabled ? p.accent : p.btnBg,
                      padding: "3px",
                      transition: "all 0.2s ease",
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        width: "22px",
                        height: "22px",
                        borderRadius: "50%",
                        background: "#fff",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                        transition: "all 0.2s ease",
                        transform: enabled ? "translateX(20px)" : "translateX(0)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
