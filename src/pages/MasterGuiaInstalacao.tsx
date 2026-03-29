import { useTheme } from "@/hooks/useTheme";
import { useNavigate } from "react-router-dom";
import { useState, useRef } from "react";
import {
  ArrowLeft,
  Printer,
  Link2,
  Copy,
  CheckCircle2,
  Shield,
  Zap,
  Wifi,
  Smartphone,
  Settings,
  DoorOpen,
  Cable,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Info,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   Guia de Instalação — Portaria Virtual IoT
   Acesso exclusivo do Master. Permite gerar link e imprimir.
   ═══════════════════════════════════════════════════════════ */

interface Step {
  number: number;
  title: string;
  icon: any;
  description: string;
  details: string[];
  tip?: string;
  warning?: string;
  image?: string;
}

const STEPS: Step[] = [
  {
    number: 1,
    title: "O que você vai precisar",
    icon: Info,
    description: "Antes de começar, separe os materiais necessários para a instalação.",
    details: [
      "1 módulo SONOFF 4CH (controla até 4 entradas diferentes)",
      "1 cabo de energia (para ligar o módulo na tomada ou no quadro elétrico)",
      "Fios para conectar o módulo às fechaduras elétricas das entradas",
      "Acesso à rede Wi-Fi do condomínio (nome e senha)",
      "Celular com o aplicativo eWeLink instalado (disponível na App Store e Google Play)",
      "Chave de fenda pequena (para apertar os bornes do módulo)",
    ],
    tip: "O módulo SONOFF 4CH tem 4 saídas independentes. Isso significa que com apenas 1 módulo você pode controlar até 4 entradas do condomínio (ex: portão de veículos, portão de pedestres, entrada do bloco e academia).",
  },
  {
    number: 2,
    title: "Instale o aplicativo eWeLink no celular",
    icon: Smartphone,
    description: "O eWeLink é o aplicativo que conecta o módulo à internet. É gratuito.",
    details: [
      "Abra a loja de aplicativos do seu celular (App Store no iPhone ou Google Play no Android)",
      "Pesquise por \"eWeLink\"",
      "Baixe e instale o aplicativo (ícone verde com uma casinha branca)",
      "Abra o aplicativo e crie uma conta com seu e-mail",
      "Guarde o e-mail e senha — serão usados depois para conectar ao sistema App Interfone",
    ],
    tip: "Use o e-mail do responsável técnico ou do síndico. Essa conta será vinculada ao sistema.",
  },
  {
    number: 3,
    title: "Adicione o módulo SONOFF no eWeLink",
    icon: Wifi,
    description: "Agora vamos parear o módulo com o aplicativo eWeLink pelo Wi-Fi.",
    details: [
      "Ligue o módulo SONOFF na energia (tomada ou quadro elétrico)",
      "Aguarde a luz do módulo piscar rapidamente (modo de pareamento)",
      "Se a luz não piscar, segure o botão do módulo por 5 segundos até começar a piscar",
      "No aplicativo eWeLink, toque no \"+\" (canto inferior direito) para adicionar dispositivo",
      "Selecione \"Pareamento Rápido\" (Quick Pairing)",
      "Digite o nome e senha da rede Wi-Fi do condomínio",
      "Aguarde o pareamento completar (leva cerca de 1 minuto)",
      "Dê um nome ao dispositivo, por exemplo: \"Portaria Virtual\"",
    ],
    warning: "O Wi-Fi precisa ser 2.4 GHz (a maioria dos roteadores já tem). Se o módulo não conectar, verifique se não está usando rede 5 GHz.",
  },
  {
    number: 4,
    title: "Teste o módulo pelo eWeLink",
    icon: Zap,
    description: "Antes de instalar nas entradas, teste se o módulo está respondendo.",
    details: [
      "No aplicativo eWeLink, abra o dispositivo que acabou de adicionar",
      "Você vai ver 4 botões (Canal 1, Canal 2, Canal 3, Canal 4)",
      "Toque no Canal 1 — você vai ouvir um \"clique\" no módulo",
      "Toque novamente para desligar — outro \"clique\"",
      "Se ouviu os cliques, o módulo está funcionando perfeitamente!",
      "Repita o teste nos outros canais que for usar",
    ],
    tip: "Cada \"clique\" é o relé interno ligando/desligando. É esse relé que vai acionar a fechadura da entrada.",
  },
  {
    number: 5,
    title: "Conecte o módulo às entradas do condomínio",
    icon: Cable,
    description: "Agora vamos ligar os fios do módulo à botoeira do motor do portão.",
    details: [
      "⚠️ DESLIGUE A ENERGIA antes de fazer qualquer ligação elétrica!",
      "",
      "🔴 REGRA CRÍTICA DE SEGURANÇA:",
      "O módulo SONOFF deve ser ligado na BOTOEIRA do motor (contato seco),",
      "NUNCA diretamente na alimentação do motor!",
      "Isso simula o apertar de um botão — é seguro e reversível.",
      "",
      "O módulo SONOFF 4CH tem 4 saídas: L-out1, L-out2, L-out3, L-out4",
      "Cada saída controla uma entrada diferente do condomínio",
      "Exemplo de ligação:",
      "  → Saída 1 (L-out1): Botoeira do Portão de Veículos",
      "  → Saída 2 (L-out2): Botoeira do Portão de Pedestres",
      "  → Saída 3 (L-out3): Botoeira da Entrada do Bloco",
      "  → Saída 4 (L-out4): Botoeira da Academia/Piscina",
      "",
      "🌐 WI-FI OBRIGATÓRIO:",
      "O módulo precisa de Wi-Fi 2.4 GHz dedicado e estável.",
      "Sinal fraco causa desconexões e possíveis acionamentos indevidos.",
      "Posicione o roteador próximo ao módulo ou use um repetidor.",
      "",
      "Conecte o neutro (fio azul) no borne N do módulo",
      "Conecte a fase (fio marrom) no borne L-in do módulo",
      "Religue a energia",
    ],
    warning: "NUNCA ligue o módulo direto na alimentação do motor! Sempre na botoeira (contato seco). Se não tem experiência com eletricidade, peça para um eletricista fazer esta etapa.",
  },
  {
    number: 6,
    title: "Vincule a conta eWeLink ao sistema App Interfone",
    icon: Shield,
    description: "Agora vamos conectar o eWeLink ao sistema do condomínio.",
    details: [
      "Acesse o sistema App Interfone pelo navegador (computador ou celular)",
      "Faça login com a conta Master",
      "Vá no menu \"Portão\" (barra inferior)",
      "Na aba \"Credenciais\", clique em \"Autorizar com eWeLink\"",
      "Você será redirecionado para o site do eWeLink",
      "Faça login com a mesma conta que usou no passo 2",
      "Autorize o acesso — o sistema vai conectar automaticamente",
      "Volte ao App Interfone — a aba \"Dispositivos\" agora vai mostrar o módulo SONOFF",
    ],
    tip: "Essa vinculação só precisa ser feita uma vez. Depois disso, o sistema já tem acesso ao módulo.",
  },
  {
    number: 7,
    title: "Atribua o módulo ao condomínio",
    icon: Settings,
    description: "Diga ao sistema qual módulo pertence a qual condomínio.",
    details: [
      "No sistema App Interfone (conta Master), vá em \"Portão\" → aba \"Dispositivos\"",
      "Localize o dispositivo \"Portaria Virtual\" (ou o nome que você deu)",
      "Clique em \"Atribuir\" e selecione o condomínio desejado",
      "O dispositivo agora pertence àquele condomínio",
    ],
  },
  {
    number: 8,
    title: "Configure as entradas (Síndico faz esta parte)",
    icon: DoorOpen,
    description: "O síndico configura qual saída do módulo controla qual entrada.",
    details: [
      "O síndico acessa o App Interfone com a conta dele",
      "Vai em \"Acessos\" no menu de Funções",
      "Para cada entrada (Portão Veicular, Portão Pedestres, etc.):",
      "  → Seleciona o dispositivo (Portaria Virtual)",
      "  → Escolhe o Canal correspondente à saída onde foi conectado",
      "  → Saída 1 = Canal 1, Saída 2 = Canal 2, e assim por diante",
      "  → Habilita a entrada (liga o botão)",
      "Pronto! As entradas aparecem na tela \"Portaria Virtual\" para os moradores",
    ],
    tip: "Tabela de referência:\n• Saída 1 (L-out1) = Canal 1\n• Saída 2 (L-out2) = Canal 2\n• Saída 3 (L-out3) = Canal 3\n• Saída 4 (L-out4) = Canal 4",
  },
  {
    number: 9,
    title: "Teste final",
    icon: CheckCircle2,
    description: "Hora de testar se tudo funciona de ponta a ponta!",
    details: [
      "No sistema, vá em \"Portaria Virtual\" (qualquer usuário pode testar)",
      "Clique no botão da entrada que configurou (ex: Portão Veicular)",
      "Confirme a ação no pop-up de confirmação",
      "A fechadura correspondente deve ser acionada!",
      "Teste todas as entradas que foram configuradas",
      "Se alguma não funcionar, verifique se o canal correto foi selecionado",
    ],
    warning: "Se o comando funciona no eWeLink mas não no App Interfone, é provável que o canal selecionado esteja errado. Confira a tabela de canais no passo 8.",
  },
];

export default function MasterGuiaInstalacao() {
  const { isDark, p } = useTheme();
  const navigate = useNavigate();
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const guideUrl = `${window.location.origin}/master/guia-instalacao`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(guideUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback
      const input = document.createElement("input");
      input.value = guideUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const bg = isDark
    ? "linear-gradient(180deg, #001533 0%, #002254 25%, #003580 55%, #004aad 100%)"
    : "#f0f4f8";

  return (
    <div style={{ minHeight: "100dvh", background: bg, display: "flex", flexDirection: "column" }}>
      {/* Header — hidden on print */}
      <header
        className="no-print"
        style={{
          position: "sticky", top: 0, zIndex: 40,
          background: isDark ? "linear-gradient(135deg, #001533 0%, #002a66 50%, #004aad 100%)" : "#ffffff",
          borderBottom: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e2e8f0",
          boxShadow: isDark ? "0 4px 20px rgba(0,0,0,0.3)" : "0 2px 8px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 2rem", height: "4.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <button onClick={() => navigate(-1)} style={{ padding: "0.625rem", borderRadius: 14, background: isDark ? "rgba(255,255,255,0.08)" : "#f8fafc", border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid #cbd5e1", color: isDark ? "#fff" : "#1e293b", cursor: "pointer" }}>
              <ArrowLeft style={{ width: 24, height: 24 }} />
            </button>
            <div>
              <span style={{ fontWeight: 800, fontSize: "1.125rem", color: isDark ? "#fff" : "#1e293b", display: "block" }}>Como Instalar</span>
              <span style={{ fontSize: "0.875rem", color: isDark ? "#93c5fd" : "#475569", display: "block" }}>Guia completo de instalação</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Shield style={{ width: 20, height: 20, color: isDark ? "rgba(255,255,255,0.4)" : "#94a3b8" }} />
            <span style={{ fontSize: "0.75rem", color: isDark ? "rgba(255,255,255,0.4)" : "#94a3b8", fontWeight: 700, letterSpacing: "0.05em" }}>APP INTERFONE</span>
          </div>
        </div>
      </header>

      <main ref={printRef} style={{ flex: 1, overflow: "auto", paddingTop: "1.5rem", paddingLeft: "calc(1.5rem + 0.5cm)", paddingRight: "calc(1.5rem + 0.5cm)", paddingBottom: "6rem", maxWidth: 800, margin: "0 auto", width: "100%" }}>

        {/* ═══ Print Header (only visible on print) ═══ */}
        <div className="print-only" style={{ display: "none", textAlign: "center", marginBottom: "2rem" }}>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>App Interfone — Guia de Instalação</h1>
          <p style={{ fontSize: 14, color: "#666", marginTop: 4 }}>Portaria Virtual IoT — Passo a Passo Completo</p>
        </div>

        {/* ═══ Share & Print Bar ═══ */}
        <div
          className="no-print"
          style={{
            display: "flex", gap: 12, marginBottom: "1.5rem", flexWrap: "wrap",
          }}
        >
          {/* Copy link */}
          <button
            onClick={copyLink}
            style={{
              flex: 1, minWidth: 160, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "0.75rem 1rem", borderRadius: 14, fontWeight: 700, fontSize: 14,
              background: copied ? "linear-gradient(135deg, #059669, #10b981)" : (isDark ? "rgba(255,255,255,0.08)" : "#f8fafc"),
              border: copied ? "2px solid #34d399" : (isDark ? "1px solid rgba(255,255,255,0.15)" : "1px solid #cbd5e1"),
              color: copied ? "#fff" : (isDark ? "#fff" : "#1e293b"),
              cursor: "pointer", transition: "all 0.2s",
            }}
          >
            {copied ? (
              <>
                <CheckCircle2 style={{ width: 18, height: 18 }} />
                Link copiado!
              </>
            ) : (
              <>
                <Copy style={{ width: 18, height: 18 }} />
                Copiar link do guia
              </>
            )}
          </button>

          {/* Print */}
          <button
            onClick={handlePrint}
            style={{
              flex: 1, minWidth: 160, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "0.75rem 1rem", borderRadius: 14, fontWeight: 700, fontSize: 14,
              background: isDark ? "rgba(255,255,255,0.08)" : "#f8fafc",
              border: isDark ? "1px solid rgba(255,255,255,0.15)" : "1px solid #cbd5e1",
              color: isDark ? "#fff" : "#1e293b",
              cursor: "pointer", transition: "all 0.2s",
            }}
          >
            <Printer style={{ width: 18, height: 18 }} />
            Imprimir guia
          </button>
        </div>

        {/* ═══ Link display ═══ */}
        <div
          className="no-print"
          style={{
            display: "flex", alignItems: "center", gap: 10, padding: "0.75rem 1rem",
            borderRadius: 14, marginBottom: "1.5rem",
            background: isDark ? "rgba(59,130,246,0.1)" : "#eff6ff",
            border: isDark ? "1px solid rgba(59,130,246,0.2)" : "1px solid #bfdbfe",
          }}
        >
          <Link2 style={{ width: 18, height: 18, color: isDark ? "#93c5fd" : "#3b82f6", flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: isDark ? "#93c5fd" : "#1e40af", wordBreak: "break-all", fontFamily: "monospace" }}>
            {guideUrl}
          </span>
        </div>

        {/* ═══ Title ═══ */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{
            width: 72, height: 72, borderRadius: 22,
            background: "linear-gradient(135deg, #003580, #004aad)",
            border: "2px solid rgba(255,255,255,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 1rem", boxShadow: "0 8px 32px rgba(0,53,128,0.3)",
          }}>
            <Zap style={{ width: 36, height: 36, color: "#fff" }} />
          </div>
          <h1 style={{ fontWeight: 800, fontSize: 22, color: isDark ? "#fff" : "#1e293b", marginBottom: 6 }}>
            Guia de Instalação — Portaria Virtual
          </h1>
          <p style={{ fontSize: 14, color: isDark ? "#93c5fd" : "#475569", lineHeight: 1.5 }}>
            Siga os passos abaixo para instalar o sistema de abertura remota de entradas no condomínio.
            <br />
            Tempo estimado: 30 a 60 minutos.
          </p>
        </div>

        {/* ═══ Steps ═══ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {STEPS.map((step) => {
            const isExpanded = expandedStep === step.number;
            const StepIcon = step.icon;
            return (
              <div
                key={step.number}
                className="print-expand"
                style={{
                  borderRadius: 18,
                  background: isDark ? "rgba(255,255,255,0.04)" : "#ffffff",
                  border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e2e8f0",
                  overflow: "hidden",
                  boxShadow: isDark ? "0 2px 12px rgba(0,0,0,0.15)" : "0 2px 8px rgba(0,0,0,0.04)",
                }}
              >
                {/* Step header */}
                <button
                  className="no-print-button"
                  onClick={() => setExpandedStep(isExpanded ? null : step.number)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 14,
                    padding: "1.25rem 1.5rem", cursor: "pointer",
                    background: "transparent", border: "none",
                    color: isDark ? "#fff" : "#1e293b", textAlign: "left",
                  }}
                >
                  <div style={{
                    width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                    background: "linear-gradient(135deg, #003580, #004aad)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontWeight: 800, fontSize: 16,
                  }}>
                    {step.number}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{step.title}</p>
                    <p style={{ fontSize: 13, color: isDark ? "#93c5fd" : "#475569", lineHeight: 1.4 }}>
                      {step.description}
                    </p>
                  </div>
                  <span className="no-print">
                    {isExpanded
                      ? <ChevronUp style={{ width: 20, height: 20, color: isDark ? "#93c5fd" : "#94a3b8" }} />
                      : <ChevronDown style={{ width: 20, height: 20, color: isDark ? "#93c5fd" : "#94a3b8" }} />
                    }
                  </span>
                </button>

                {/* Step details */}
                <div
                  className="print-show"
                  style={{
                    maxHeight: isExpanded ? 2000 : 0,
                    overflow: "hidden",
                    transition: "max-height 0.3s ease",
                  }}
                >
                  <div style={{ padding: "0 1.5rem 1.25rem", borderTop: isDark ? "1px solid rgba(255,255,255,0.06)" : "1px solid #f1f5f9" }}>
                    <ul style={{ listStyle: "none", padding: 0, margin: "1rem 0 0 0" }}>
                      {step.details.map((detail, i) => (
                        <li key={i} style={{
                          fontSize: 14, lineHeight: 1.7,
                          color: isDark ? "rgba(255,255,255,0.85)" : "#334155",
                          padding: detail.startsWith("  →") ? "2px 0 2px 1.5rem" : "4px 0",
                          fontWeight: detail.startsWith("  →") ? 600 : 400,
                        }}>
                          {!detail.startsWith("  →") && !detail.startsWith("  •") && <span style={{ color: "#3b82f6", marginRight: 8 }}>•</span>}
                          {detail}
                        </li>
                      ))}
                    </ul>

                    {step.tip && (
                      <div style={{
                        marginTop: "1rem", padding: "0.875rem 1rem", borderRadius: 12,
                        background: isDark ? "rgba(59,130,246,0.1)" : "#eff6ff",
                        border: isDark ? "1px solid rgba(59,130,246,0.2)" : "1px solid #bfdbfe",
                        display: "flex", gap: 10, alignItems: "flex-start",
                      }}>
                        <Info style={{ width: 18, height: 18, color: "#3b82f6", flexShrink: 0, marginTop: 2 }} />
                        <p style={{ fontSize: 13, color: isDark ? "#93c5fd" : "#1e40af", lineHeight: 1.6, whiteSpace: "pre-line" }}>
                          {step.tip}
                        </p>
                      </div>
                    )}

                    {step.warning && (
                      <div style={{
                        marginTop: "1rem", padding: "0.875rem 1rem", borderRadius: 12,
                        background: isDark ? "rgba(245,158,11,0.1)" : "#fffbeb",
                        border: isDark ? "1px solid rgba(245,158,11,0.2)" : "1px solid #fde68a",
                        display: "flex", gap: 10, alignItems: "flex-start",
                      }}>
                        <AlertTriangle style={{ width: 18, height: 18, color: "#f59e0b", flexShrink: 0, marginTop: 2 }} />
                        <p style={{ fontSize: 13, color: isDark ? "#fcd34d" : "#92400e", lineHeight: 1.6 }}>
                          {step.warning}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ═══ Footer info ═══ */}
        <div style={{
          marginTop: "2rem", padding: "1.5rem", borderRadius: 18, textAlign: "center",
          background: isDark ? "rgba(255,255,255,0.04)" : "#f8fafc",
          border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e2e8f0",
        }}>
          <p style={{ fontWeight: 700, fontSize: 15, color: isDark ? "#fff" : "#1e293b", marginBottom: 6 }}>
            Precisa de ajuda?
          </p>
          <p style={{ fontSize: 13, color: isDark ? "#93c5fd" : "#475569", lineHeight: 1.6 }}>
            Se tiver dúvidas durante a instalação, entre em contato com o suporte técnico App Interfone.
            <br />
            Nosso time pode auxiliar remotamente em todos os passos.
          </p>
        </div>
      </main>

      {/* ═══ Print Styles ═══ */}
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .print-show { max-height: none !important; overflow: visible !important; }
          .print-expand { break-inside: avoid; }
          .no-print-button { cursor: default !important; }
          * { color: #000 !important; background: white !important; border-color: #ccc !important; box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}
