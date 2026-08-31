import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
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
  SkipForward,
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
    tip: "Se o condomínio não tem funcionários, pule este passo — dá para cadastrar depois.",
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
  const { user } = useAuth();
  const condominioId = user?.condominioId;

  const [status, setStatus] = useState<StepStatus>({
    blocos: false,
    moradores: false,
    funcionarios: false,
    interfone: false,
  });
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [skipping, setSkipping] = useState(false);
  const [skipError, setSkipError] = useState("");

  const allComplete = status.blocos && status.moradores && status.funcionarios && status.interfone;

  // ── Fetch real data from API to check step completion ──
  const checkStatus = useCallback(async () => {
    setLoading(true);
    try {
      const [blocosRes, moradoresRes, funcsRes, tokensRes, configRes] = await Promise.all([
        apiFetch(`${API}/blocos`).then(r => r.ok ? r.json() : []),
        apiFetch(`${API}/moradores`).then(r => r.ok ? r.json() : []),
        apiFetch(`${API}/funcionarios`).then(r => r.ok ? r.json() : []),
        apiFetch(`${API}/interfone/tokens`).then(r => r.ok ? r.json() : []),
        apiFetch(`${API}/condominio-config`).then(r => (r.ok ? r.json() : {})) as Promise<Record<string, string>>,
      ]);

      const newStatus: StepStatus = {
        blocos: Array.isArray(blocosRes) && blocosRes.length > 0,
        moradores: Array.isArray(moradoresRes) && moradoresRes.length > 0,
        funcionarios:
          (Array.isArray(funcsRes) && funcsRes.length > 0) ||
          configRes?.setup_skip_funcionarios === "true",
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

  const pularFuncionarios = async () => {
    setSkipping(true);
    setSkipError("");
    try {
      const qs = condominioId ? `?condominio_id=${condominioId}` : "";
      const res = await apiFetch(`${API}/condominio-config${qs}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setup_skip_funcionarios: "true" }),
      });
      if (!res.ok) throw new Error();
      await checkStatus();
    } catch {
      setSkipError("Não foi possível pular agora. Tente de novo.");
    } finally {
      setSkipping(false);
    }
  };

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

  // ── ALL COMPLETE — show full summary with 7 steps to test communication ──
  if (allComplete) {
    const summarySteps = [
      { n: 1, title: "Cadastre o condomínio", desc: "Já feito no seu primeiro acesso.", done: true },
      { n: 2, title: "Cadastre os blocos", desc: "Torres ou prédios do condomínio.", done: true },
      { n: 3, title: "Cadastre os moradores", desc: "Para receberem chamadas no celular.", done: true },
      { n: 4, title: "Cadastre os funcionários", desc: "Porteiros e equipe operacional.", done: true },
      { n: 5, title: "Gere o QR Code do interfone", desc: "Imprima e fixe na portaria.", done: true },
      { n: 6, title: "Escaneie o QR Code com o app do morador ou da portaria", desc: "Para se comunicar — morador com a portaria.", done: false },
      { n: 7, title: "Escaneie o QR Code de visitante", desc: "Visitante chama o morador diretamente pelo celular.", done: false },
    ];
    return (
      <div style={{
        borderRadius: 20, overflow: "hidden",
        background: "#0f172a", border: "1px solid rgba(16,185,129,0.25)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
      }}>
        {/* Header verde */}
        <div style={{
          background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
          padding: "18px 22px", display: "flex", alignItems: "center", gap: 14,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: "rgba(255,255,255,0.2)", display: "flex",
            alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <CheckCircle2 style={{ width: 24, height: 24, color: "#fff" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>
              Sistema Configurado!
            </p>
            <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, lineHeight: 1.4 }}>
              Resumo dos passos para testar a comunicação completa.
            </p>
          </div>
        </div>

        {/* Lista de 7 passos */}
        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
          {summarySteps.map((s) => (
            <div key={s.n} style={{
              display: "flex", gap: 12, alignItems: "flex-start",
              padding: "12px 14px", borderRadius: 12,
              background: s.done ? "rgba(16,185,129,0.06)" : "rgba(99,102,241,0.06)",
              border: s.done ? "1px solid rgba(16,185,129,0.18)" : "1px solid rgba(99,102,241,0.22)",
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: s.done ? "rgba(16,185,129,0.2)" : "rgba(99,102,241,0.2)",
                color: s.done ? "#34d399" : "#a5b4fc",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 800, flexShrink: 0,
              }}>
                {s.done ? "✓" : s.n}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 700, lineHeight: 1.35 }}>
                  {s.title}
                </p>
                <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 2, lineHeight: 1.4 }}>
                  {s.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Ação: novo QR Code */}
        <div style={{ padding: "0 18px 18px", display: "flex", gap: 10 }}>
          <button
            onClick={() => navigate("/sindico/interfone-config")}
            style={{
              flex: 1, padding: "12px 14px", borderRadius: 12,
              border: "none", background: "#10b981", color: "#0f172a",
              fontWeight: 700, fontSize: 14, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            <QrCode style={{ width: 16, height: 16 }} />
            Abrir QR Code do Interfone
          </button>
        </div>
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
      {/* ── Header com progress ── */}
      <div style={{
        background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
        padding: "14px 18px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <Rocket style={{ width: 18, height: 18, color: "#fff", flexShrink: 0 }} />
          <p style={{ color: "#fff", fontWeight: 700, fontSize: 14, flex: 1 }}>
            Configuração Inicial
          </p>
          <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>
            {completedCount}/{STEPS.length}
          </span>
          <button
            onClick={checkStatus}
            title="Atualizar"
            style={{
              width: 26, height: 26, borderRadius: "50%", border: "none",
              background: "rgba(255,255,255,0.18)", color: "#fff",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <RefreshCw style={{ width: 12, height: 12 }} />
          </button>
        </div>
        <div style={{ height: 5, background: "rgba(255,255,255,0.2)", borderRadius: 99 }}>
          <div style={{
            height: "100%", width: `${progressPct}%`, borderRadius: 99,
            background: "#fff", transition: "width 0.5s ease",
          }} />
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

      {/* ── Step content (enxuto) ── */}
      <div style={{ padding: "16px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: stepDone ? `${step.color}22` : step.colorBg,
            border: `1px solid ${step.color}33`,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            {stepDone ? (
              <CheckCircle2 style={{ width: 20, height: 20, color: step.color }} />
            ) : (
              <StepIcon style={{ width: 20, height: 20, color: step.color }} />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: step.color, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Passo {currentStep + 1} de {STEPS.length}{stepDone && " ✓"}
            </p>
            <p style={{ color: "#f1f5f9", fontSize: 15, fontWeight: 800 }}>
              {step.title}
            </p>
            <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 2, lineHeight: 1.4 }}>
              {step.subtitle}
            </p>
          </div>
        </div>

        {/* Botões */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => { if (currentStep > 0) setCurrentStep(currentStep - 1); }}
            disabled={currentStep === 0}
            style={{
              width: 40, height: 40, borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.1)",
              background: currentStep === 0 ? "transparent" : "rgba(255,255,255,0.06)",
              color: currentStep === 0 ? "#1e293b" : "#94a3b8",
              cursor: currentStep === 0 ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >
            <ChevronLeft style={{ width: 18, height: 18 }} />
          </button>

          {stepDone ? (
            <button
              onClick={() => {
                const nextIncomplete = STEPS.findIndex((s, i) => i > currentStep && !status[s.key]);
                if (nextIncomplete >= 0) setCurrentStep(nextIncomplete);
                else {
                  const anyIncomplete = STEPS.findIndex(s => !status[s.key]);
                  if (anyIncomplete >= 0) setCurrentStep(anyIncomplete);
                }
              }}
              style={{
                flex: 1, padding: "12px", borderRadius: 10,
                border: "none", background: "#34d399", color: "#0f172a",
                fontWeight: 700, fontSize: 14, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              <Sparkles style={{ width: 14, height: 14 }} />
              Próximo
              <ChevronRight style={{ width: 16, height: 16 }} />
            </button>
          ) : (
            <button
              onClick={() => navigate(step.route)}
              style={{
                flex: 1, padding: "12px", borderRadius: 10,
                border: "none", background: step.color, color: "#0f172a",
                fontWeight: 700, fontSize: 14, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              {step.actionLabel}
              <ArrowRight style={{ width: 16, height: 16 }} />
            </button>
          )}

          <button
            onClick={() => { if (currentStep < STEPS.length - 1) setCurrentStep(currentStep + 1); }}
            disabled={currentStep >= STEPS.length - 1}
            style={{
              width: 40, height: 40, borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.1)",
              background: currentStep >= STEPS.length - 1 ? "transparent" : "rgba(255,255,255,0.06)",
              color: currentStep >= STEPS.length - 1 ? "#1e293b" : "#94a3b8",
              cursor: currentStep >= STEPS.length - 1 ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >
            <ChevronRight style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {step.key === "funcionarios" && !stepDone && (
          <div style={{ marginTop: 10 }}>
            <button
              onClick={pularFuncionarios}
              disabled={skipping}
              style={{
                width: "100%", padding: "10px", borderRadius: 10,
                border: "1px dashed rgba(255,255,255,0.18)",
                background: "transparent", color: "#94a3b8",
                fontWeight: 600, fontSize: 13,
                cursor: skipping ? "wait" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              {skipping ? (
                <Loader2 className="animate-spin" style={{ width: 14, height: 14 }} />
              ) : (
                <SkipForward style={{ width: 14, height: 14 }} />
              )}
              Não tenho funcionários — pular este passo
            </button>
            {skipError && (
              <p style={{ color: "#f87171", fontSize: 11, marginTop: 6, textAlign: "center" }}>{skipError}</p>
            )}
          </div>
        )}
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
