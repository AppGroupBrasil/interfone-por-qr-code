import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import {
  ChevronRight,
  ChevronLeft,
  Layers,
  Users2,
  Wrench,
  QrCode,
  Phone,
  CheckCircle2,
  Loader2,
  ArrowRight,
  RefreshCw,
  Lock,
  Sparkles,
  Rocket,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   Setup Wizard — Mandatory onboarding for síndico
   - Always visible until all steps are completed
   - Checks real API data for step completion
   - Gates dashboard features behind interfone setup
   ═══════════════════════════════════════════════════════════ */

const API = "/api";

interface StepStatus {
  blocos: boolean;
  moradores: boolean;
  funcionarios: boolean;
  interfone: boolean;
}

interface WizardStep {
  key: keyof StepStatus;
  icon: React.ElementType;
  title: string;
  subtitle: string;
  color: string;
  colorBg: string;
  instructions: string[];
  tip: string;
  route: string;
  actionLabel: string;
}

const STEPS: WizardStep[] = [
  {
    key: "blocos",
    icon: Layers,
    title: "Cadastrar Blocos",
    subtitle: "Crie os blocos/torres do condomínio",
    color: "#60a5fa",
    colorBg: "rgba(96,165,250,0.15)",
    instructions: [
      "Acesse a tela de Blocos",
      "Clique em \"Novo Bloco\"",
      "Informe o nome (ex: Bloco A, Torre 1)",
      "Repita para cada bloco do condomínio",
    ],
    tip: "Os blocos organizam moradores por torre/prédio. Cadastre pelo menos 1.",
    route: "/cadastros/blocos",
    actionLabel: "Cadastrar Blocos",
  },
  {
    key: "moradores",
    icon: Users2,
    title: "Cadastrar Moradores",
    subtitle: "Adicione moradores em cada bloco",
    color: "#a78bfa",
    colorBg: "rgba(167,139,250,0.15)",
    instructions: [
      "Acesse a tela de Moradores",
      "Clique em \"Novo Morador\"",
      "Preencha nome, e-mail, bloco e apartamento",
      "Defina uma senha de 6 dígitos",
    ],
    tip: "Moradores poderão receber chamadas de visitantes pelo app.",
    route: "/cadastros/moradores",
    actionLabel: "Cadastrar Moradores",
  },
  {
    key: "funcionarios",
    icon: Wrench,
    title: "Cadastrar Funcionários",
    subtitle: "Adicione porteiros e funcionários",
    color: "#34d399",
    colorBg: "rgba(52,211,153,0.15)",
    instructions: [
      "Acesse a tela de Funcionários",
      "Clique em \"Novo Funcionário\"",
      "Informe nome, e-mail e cargo",
      "O porteiro terá acesso ao scanner de QR Code",
    ],
    tip: "O porteiro é essencial para validar visitantes e operar o interfone.",
    route: "/cadastros/funcionarios",
    actionLabel: "Cadastrar Funcionários",
  },
  {
    key: "interfone",
    icon: Phone,
    title: "Gerar QR Code do Interfone",
    subtitle: "Ative o interfone digital e gere o QR Code",
    color: "#f472b6",
    colorBg: "rgba(244,114,182,0.15)",
    instructions: [
      "Acesse a configuração do Interfone",
      "Escolha: QR único (condomínio) ou por bloco",
      "Clique em \"Gerar QR Code\"",
      "Imprima e fixe na portaria do condomínio",
      "Visitantes escaneiam → selecionam apto → chamam morador",
    ],
    tip: "Este é o último passo! Após gerar o QR Code, o sistema estará pronto.",
    route: "/sindico/interfone-config",
    actionLabel: "Configurar Interfone",
  },
];

interface WelcomeWizardProps {
  readonly userRole: string;
  readonly condominioName?: string;
  /** Called when setup completion status changes */
  readonly onSetupComplete?: (complete: boolean) => void;
}

export default function WelcomeWizard({ userRole, onSetupComplete }: WelcomeWizardProps) {
  const navigate = useNavigate();

  const [status, setStatus] = useState<StepStatus>({
    blocos: false,
    moradores: false,
    funcionarios: false,
    interfone: false,
  });
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);

  const allComplete = status.blocos && status.moradores && status.funcionarios && status.interfone;

  // ── Fetch real data from API to check step completion ──
  const checkStatus = useCallback(async () => {
    setLoading(true);
    try {
      const [blocosRes, moradoresRes, funcsRes, tokensRes] = await Promise.all([
        apiFetch(`${API}/blocos`).then(r => r.ok ? r.json() : []),
        apiFetch(`${API}/moradores`).then(r => r.ok ? r.json() : []),
        apiFetch(`${API}/funcionarios`).then(r => r.ok ? r.json() : []),
        apiFetch(`${API}/interfone/tokens`).then(r => r.ok ? r.json() : []),
      ]);

      const newStatus: StepStatus = {
        blocos: Array.isArray(blocosRes) && blocosRes.length > 0,
        moradores: Array.isArray(moradoresRes) && moradoresRes.length > 0,
        funcionarios: Array.isArray(funcsRes) && funcsRes.length > 0,
        interfone: Array.isArray(tokensRes) && tokensRes.length > 0,
      };
      setStatus(newStatus);

      // Auto-advance to first incomplete step
      const firstIncomplete = STEPS.findIndex(s => !newStatus[s.key]);
      if (firstIncomplete >= 0) {
        setCurrentStep(firstIncomplete);
      }
    } catch {
      // Keep defaults (all false)
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!["sindico", "administradora", "master"].includes(userRole)) {
      setLoading(false);
      return;
    }
    checkStatus();
  }, [userRole, checkStatus]);

  // Notify parent about completion status
  useEffect(() => {
    onSetupComplete?.(allComplete);
  }, [allComplete, onSetupComplete]);

  // Re-check when window regains focus (user returned from a setup page)
  useEffect(() => {
    const handleFocus = () => {
      if (!["sindico", "administradora", "master"].includes(userRole)) return;
      checkStatus();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [userRole, checkStatus]);

  // Don't show for non-sindico roles
  if (!["sindico", "administradora", "master"].includes(userRole)) return null;

  // Loading state
  if (loading) {
    return (
      <div style={{
        display: "flex", justifyContent: "center", alignItems: "center",
        padding: 40, gap: 10, color: "#94a3b8",
      }}>
        <Loader2 className="animate-spin" style={{ width: 20, height: 20 }} />
        <span style={{ fontSize: 13, fontWeight: 500 }}>Verificando configuração...</span>
      </div>
    );
  }

  // ── ALL COMPLETE — show success badge with "new interfone" button ──
  if (allComplete) {
    return (
      <div style={{
        borderRadius: 20, overflow: "hidden",
        background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
        boxShadow: "0 4px 20px rgba(16,185,129,0.25)",
        padding: "18px 22px",
        display: "flex", alignItems: "center", gap: 14,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14,
          background: "rgba(255,255,255,0.2)", display: "flex",
          alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <CheckCircle2 style={{ width: 24, height: 24, color: "#fff" }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>
            Sistema Configurado!
          </p>
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, lineHeight: 1.4 }}>
            Interfone digital ativo. Para criar outro QR Code, use o botão ao lado.
          </p>
        </div>
        <button
          onClick={() => navigate("/sindico/interfone-config")}
          style={{
            padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.3)",
            background: "rgba(255,255,255,0.15)", color: "#fff",
            fontWeight: 600, fontSize: 12, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
          }}
        >
          <QrCode style={{ width: 14, height: 14 }} />
          Novo Interfone
        </button>
      </div>
    );
  }

  // ── SETUP INCOMPLETE — show mandatory wizard ──
  const completedCount = STEPS.filter(s => status[s.key]).length;
  const progressPct = (completedCount / STEPS.length) * 100;
  const step = STEPS[currentStep];
  const StepIcon = step.icon;
  const stepDone = status[step.key];

  return (
    <div style={{
      borderRadius: 24, overflow: "hidden",
      background: "#0f172a",
      border: "1px solid rgba(255,255,255,0.08)",
      boxShadow: "0 8px 40px rgba(0,0,0,0.3)",
    }}>
      {/* ── Header with progress ── */}
      <div style={{
        background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%)",
        padding: "20px 22px 16px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: "rgba(255,255,255,0.2)", display: "flex",
            alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Rocket style={{ width: 24, height: 24, color: "#fff" }} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>
              Configuração Inicial
            </p>
            <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 12 }}>
              Complete os {STEPS.length} passos para ativar o interfone
            </p>
          </div>
          <button
            onClick={checkStatus}
            title="Atualizar status"
            style={{
              width: 34, height: 34, borderRadius: "50%", border: "none",
              background: "rgba(255,255,255,0.15)", color: "#fff",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <RefreshCw style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Progress bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.2)", borderRadius: 99 }}>
            <div style={{
              height: "100%", width: `${progressPct}%`, borderRadius: 99,
              background: "#fff", transition: "width 0.5s ease",
            }} />
          </div>
          <span style={{ color: "#fff", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
            {completedCount}/{STEPS.length}
          </span>
        </div>
      </div>

      {/* ── Step tabs ── */}
      <div style={{
        display: "flex", gap: 2, padding: "12px 16px 0",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        {STEPS.map((s, i) => {
          const SIcon = s.icon;
          const done = status[s.key];
          const active = i === currentStep;
          return (
            <button
              key={s.key}
              onClick={() => setCurrentStep(i)}
              style={{
                flex: 1, padding: "10px 4px 12px", borderRadius: "12px 12px 0 0",
                border: "none", cursor: "pointer",
                background: active ? "rgba(255,255,255,0.06)" : "transparent",
                borderBottom: active ? `2px solid ${s.color}` : "2px solid transparent",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                transition: "all 0.2s",
              }}
            >
              <div style={{
                width: 30, height: 30, borderRadius: 10,
                background: done ? `${s.color}22` : active ? `${s.color}15` : "rgba(255,255,255,0.04)",
                border: done ? `1px solid ${s.color}44` : active ? `1px solid ${s.color}33` : "1px solid rgba(255,255,255,0.06)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {done ? (
                  <CheckCircle2 style={{ width: 15, height: 15, color: s.color }} />
                ) : (
                  <SIcon style={{ width: 14, height: 14, color: active ? s.color : "#4b5563" }} />
                )}
              </div>
              <span style={{
                fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: done ? s.color : active ? "#e2e8f0" : "#4b5563",
              }}>
                {s.title.split(" ")[0]}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Step content ── */}
      <div style={{ padding: "20px 22px" }}>
        {/* Step header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 14,
            background: stepDone ? `${step.color}22` : step.colorBg,
            border: `1px solid ${step.color}33`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {stepDone ? (
              <CheckCircle2 style={{ width: 22, height: 22, color: step.color }} />
            ) : (
              <StepIcon style={{ width: 22, height: 22, color: step.color }} />
            )}
          </div>
          <div>
            <p style={{ color: step.color, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Passo {currentStep + 1} de {STEPS.length}
              {stepDone && " — Concluído ✓"}
            </p>
            <p style={{ color: "#f1f5f9", fontSize: 17, fontWeight: 800 }}>
              {step.title}
            </p>
          </div>
        </div>

        <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 14, lineHeight: 1.5 }}>
          {step.subtitle}
        </p>

        {/* Instructions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {step.instructions.map((text, i) => (
            <div
              key={`${step.key}-${i}`}
              style={{
                display: "flex", gap: 10, alignItems: "flex-start",
                padding: "10px 12px", borderRadius: 12,
                background: stepDone ? "rgba(16,185,129,0.06)" : "rgba(255,255,255,0.03)",
                border: stepDone ? "1px solid rgba(16,185,129,0.15)" : "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <span style={{
                width: 22, height: 22, borderRadius: "50%",
                background: stepDone ? "rgba(16,185,129,0.2)" : step.colorBg,
                color: stepDone ? "#34d399" : step.color,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 800, flexShrink: 0, marginTop: 1,
              }}>
                {stepDone ? "✓" : i + 1}
              </span>
              <p style={{
                color: stepDone ? "#64748b" : "#cbd5e1", fontSize: 13, fontWeight: 500,
                lineHeight: 1.5, textDecoration: stepDone ? "line-through" : "none",
              }}>
                {text}
              </p>
            </div>
          ))}
        </div>

        {/* Tip */}
        <div style={{
          padding: "11px 14px", borderRadius: 12, marginBottom: 18,
          background: stepDone ? "rgba(16,185,129,0.08)" : `${step.color}0A`,
          border: stepDone ? "1px solid rgba(16,185,129,0.15)" : `1px solid ${step.color}18`,
        }}>
          <p style={{ color: stepDone ? "#34d399" : step.color, fontSize: 12, fontWeight: 700, marginBottom: 3 }}>
            {stepDone ? "✅ Passo concluído!" : "💡 Dica"}
          </p>
          <p style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.5 }}>
            {stepDone
              ? "Este passo já foi configurado. Prossiga para o próximo."
              : step.tip}
          </p>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => {
              if (currentStep > 0) setCurrentStep(currentStep - 1);
            }}
            disabled={currentStep === 0}
            style={{
              width: 44, height: 44, borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.1)",
              background: currentStep === 0 ? "transparent" : "rgba(255,255,255,0.06)",
              color: currentStep === 0 ? "#1e293b" : "#94a3b8",
              cursor: currentStep === 0 ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <ChevronLeft style={{ width: 20, height: 20 }} />
          </button>

          {/* Main CTA */}
          {stepDone ? (
            <button
              onClick={() => {
                const nextIncomplete = STEPS.findIndex((s, i) => i > currentStep && !status[s.key]);
                if (nextIncomplete >= 0) {
                  setCurrentStep(nextIncomplete);
                } else {
                  const anyIncomplete = STEPS.findIndex(s => !status[s.key]);
                  if (anyIncomplete >= 0) setCurrentStep(anyIncomplete);
                }
              }}
              style={{
                flex: 1, padding: "13px", borderRadius: 12,
                border: "none", background: "#34d399", color: "#0f172a",
                fontWeight: 700, fontSize: 14, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              <Sparkles style={{ width: 16, height: 16 }} />
              Próximo Passo
              <ChevronRight style={{ width: 18, height: 18 }} />
            </button>
          ) : (
            <button
              onClick={() => navigate(step.route)}
              style={{
                flex: 1, padding: "13px", borderRadius: 12,
                border: "none", background: step.color, color: "#0f172a",
                fontWeight: 700, fontSize: 14, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              {step.actionLabel}
              <ArrowRight style={{ width: 18, height: 18 }} />
            </button>
          )}

          <button
            onClick={() => {
              if (currentStep < STEPS.length - 1) setCurrentStep(currentStep + 1);
            }}
            disabled={currentStep >= STEPS.length - 1}
            style={{
              width: 44, height: 44, borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.1)",
              background: currentStep >= STEPS.length - 1 ? "transparent" : "rgba(255,255,255,0.06)",
              color: currentStep >= STEPS.length - 1 ? "#1e293b" : "#94a3b8",
              cursor: currentStep >= STEPS.length - 1 ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <ChevronRight style={{ width: 20, height: 20 }} />
          </button>
        </div>
      </div>

      {/* ── Lock notice ── */}
      <div style={{
        padding: "14px 22px 18px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <Lock style={{ width: 14, height: 14, color: "#f59e0b", flexShrink: 0 }} />
        <p style={{ color: "#94a3b8", fontSize: 11, lineHeight: 1.4 }}>
          Complete todos os passos para desbloquear o painel completo do condomínio.
        </p>
      </div>
    </div>
  );
}
