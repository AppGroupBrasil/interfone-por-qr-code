import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLogo } from "@/components/AppLogo";
import {
  Shield, BookOpen, DoorOpen, Camera,
  Users, Building2, ChevronRight, Check, Star,
  ArrowRight, Phone, MessageCircle, Zap, Lock, Eye,
  Bell, QrCode, FileText, Wifi, Sun, Moon, Code2,
  BarChart3,
  Cpu, Signal, Globe, Wrench, Play,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import LandingTutorialModal from "@/components/LandingTutorialModal";
import { BRANDS, INTEGRATION_LABELS } from "@/lib/deviceLibrary";
import { useAuth } from "@/hooks/useAuth";

/* ═══════════════════════════════════════════════
   LANDING PAGE — App Interfone
   ═══════════════════════════════════════════════ */

function getDiffColor(difficulty: number): string {
  if (difficulty <= 3) return "#10b981";
  if (difficulty <= 5) return "#f59e0b";
  if (difficulty <= 7) return "#f97316";
  return "#ef4444";
}

function getDiffLabel(difficulty: number): string {
  if (difficulty <= 3) return "Fácil";
  if (difficulty <= 5) return "Moderado";
  if (difficulty <= 7) return "Avançado";
  return "Expert";
}

function getIntegIcon(integrationType: string): LucideIcon {
  if (integrationType === "cloud") return Globe;
  if (integrationType === "local") return Wifi;
  return Signal;
}

function handleKeyActivate(e: React.KeyboardEvent, action: () => void) {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    action();
  }
}

function modeStyle<T extends string>(mode: "dark" | "light", darkVal: T, lightVal: T): T {
  return mode === "dark" ? darkVal : lightVal;
}

const WHATSAPP_NUMBER = "5511933284364";
const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Olá! Gostaria de saber mais sobre o App Interfone.")}`;

/* ─── Theme palettes ─── */
const themes = {
  dark: {
    bg1: "#003580", bg2: "#002a66",
    text1: "#e2e8f0", text2: "#f1f5f9", text3: "#94a3b8", text4: "#cbd5e1", text5: "#7da1c9",
    card: "rgba(0,40,100,0.8)", card2: "rgba(0,30,80,0.6)", card3: "rgba(0,40,100,0.6)",
    border: "rgba(255,255,255,0.08)", borderMed: "rgba(255,255,255,0.18)",
    heroGrad: "radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.08) 0%, transparent 60%), linear-gradient(180deg, #001533 0%, #002254 40%, #003d80 70%, #004aad 100%)",
    orb1: "radial-gradient(circle, rgba(255,255,255,0.04), transparent 70%)",
    orb2: "radial-gradient(circle, rgba(16,185,129,0.06), transparent 70%)",
    sectionGrad1: "linear-gradient(180deg, #003d80 0%, #002254 50%, #001533 100%)",
    sectionGrad2: "linear-gradient(180deg, #001533 0%, #002254 50%, #003d80 100%)",
    planCardBg: "rgba(0,40,100,0.6)", planBtnBg: "rgba(255,255,255,0.1)",
    faqBg: "rgba(0,30,80,0.6)",
    ctaBtnBorder: "2px solid rgba(255,255,255,0.5)", ctaBtnBg: "rgba(255,255,255,0.1)",
    priceNum: "#f1f5f9",
    footerBorder: "1px solid rgba(255,255,255,0.08)",
    loginBtnBg: "rgba(255,255,255,0.05)", loginBtnBorder: "1px solid rgba(255,255,255,0.18)",
  },
  light: {
    bg1: "#ffffff", bg2: "#f8fafc",
    text1: "#003580", text2: "#003580", text3: "#336699", text4: "#003580", text5: "#4d7faa",
    card: "#ffffff", card2: "#ffffff", card3: "#ffffff",
    border: "rgba(0,53,128,0.2)", borderMed: "rgba(0,53,128,0.3)",
    heroGrad: "radial-gradient(ellipse at 50% 0%, rgba(0,53,128,0.05) 0%, transparent 60%), #ffffff",
    orb1: "radial-gradient(circle, rgba(0,53,128,0.04), transparent 70%)",
    orb2: "radial-gradient(circle, rgba(0,53,128,0.03), transparent 70%)",
    sectionGrad1: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
    sectionGrad2: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)",
    planCardBg: "#f8fafc", planBtnBg: "rgba(0,53,128,0.08)",
    faqBg: "#f8fafc",
    ctaBtnBorder: "2px solid #003580", ctaBtnBg: "rgba(0,53,128,0.08)",
    priceNum: "#003580",
    footerBorder: "1px solid rgba(0,53,128,0.15)",
    loginBtnBg: "rgba(0,53,128,0.05)", loginBtnBorder: "1px solid rgba(0,53,128,0.2)",
  },
} as const;

/* ─── Profile badge config ─── */
const PROFILES = {
  morador:  { label: "Morador",  icon: Users,  color: "#059669", bg: "#059669", link: "/register/morador/search" },
  sindico:  { label: "Síndico",  icon: Building2, color: "#7c3aed", bg: "#7c3aed", link: "/register/condominio" },
} as const;
type ProfileKey = keyof typeof PROFILES;

/* ─── Unified feature data ─── */
const allFeatures = [
  {
    icon: Phone, title: "Interfone Digital por QR Code",
    desc: "QR Code por bloco. Visitante escaneia e liga direto pro morador com vídeo. 3 níveis de segurança configuráveis.",
    profiles: ["morador", "sindico"] as ProfileKey[],
  },
  {
    icon: QrCode, title: "QR Code Inteligente",
    desc: "Cada bloco ou unidade recebe um QR Code exclusivo. O visitante escaneia e faz a chamada instantaneamente, sem instalar nada.",
    profiles: ["morador", "sindico"] as ProfileKey[],
  },
  {
    icon: Camera, title: "Videochamada em Tempo Real",
    desc: "O morador vê e ouve o visitante pelo celular antes de autorizar a entrada. Funciona no navegador, sem app.",
    profiles: ["morador"] as ProfileKey[],
  },
  {
    icon: DoorOpen, title: "Abertura Remota (IoT)",
    desc: "Abra portões e portas dos blocos pelo app com ESP32 + relé. Multi-portão. Sem fio. Instalação simples.",
    profiles: ["morador", "sindico"] as ProfileKey[],
    badge: "R$200 instalação",
  },
  {
    icon: Bell, title: "Notificações Instantâneas",
    desc: "Receba notificação push e por WhatsApp sempre que alguém tocar seu interfone. Nunca perca uma visita.",
    profiles: ["morador"] as ProfileKey[],
  },
  {
    icon: Shield, title: "3 Níveis de Segurança",
    desc: "Configure o nível de segurança: chamada direta, chamada com aprovação, ou bloqueio total. Flexibilidade por unidade.",
    profiles: ["morador", "sindico"] as ProfileKey[],
  },
  {
    icon: Building2, title: "Gestão de Blocos e Unidades",
    desc: "Cadastre blocos, unidades e moradores. Gerencie QR Codes e configurações pelo painel do síndico.",
    profiles: ["sindico"] as ProfileKey[],
  },
  {
    icon: BarChart3, title: "Histórico de Chamadas",
    desc: "Registro completo de todas as chamadas recebidas com data, hora e status. Relatórios em PDF.",
    profiles: ["morador", "sindico"] as ProfileKey[],
  },
];

/* ─── Plans ─── */
const baseFeatures = [
  "Interfone Digital por QR Code",
  "Videochamada em Tempo Real",
  "QR Code por Bloco / Unidade",
  "3 Níveis de Segurança",
  "Notificações Push e WhatsApp",
  "Histórico de Chamadas",
  "Gestão de Blocos e Unidades",
  "App do Morador completo",
  "Integração com WhatsApp",
  "Suporte por WhatsApp",
];

const plans = [
  {
    name: "Plano",
    subtitle: "Até 24 unidades",
    price: "99",
    color: "#6366f1",
    features: baseFeatures,
    popular: false,
  },
  {
    name: "Plano",
    subtitle: "De 25 a 300 unidades",
    price: "199",
    color: "#0ea5e9",
    features: baseFeatures,
    popular: false,
  },
  {
    name: "Plano",
    subtitle: "Acima de 300 unidades",
    price: "299",
    color: "#f59e0b",
    features: baseFeatures,
    popular: false,
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { loginDemo } = useAuth();
  const [demoLoading, setDemoLoading] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activeTutorial, setActiveTutorial] = useState<string | null>(null);
  const [mode, setMode] = useState<"dark" | "light">(() => {
    try { return (localStorage.getItem("landing_theme") as "dark" | "light") || "dark"; } catch { return "dark"; }
  });
  const t = themes[mode];

  useEffect(() => {
    try { localStorage.setItem("landing_theme", mode); } catch {}
  }, [mode]);

  const faqs = [
    { q: "Preciso instalar algo no celular?", a: "Não! O sistema funciona 100% no navegador — basta acessar o link. Funciona em qualquer celular, tablet ou computador." },
    { q: "Quanto tempo leva para implantar?", a: "O cadastro leva 5 minutos. Os moradores se cadastram via link ou QR Code. Em 24h o condomínio já está operando." },
    { q: "O visitante precisa instalar algum app?", a: "Não! O visitante escaneia o QR Code e a chamada é feita direto no navegador. Zero instalação." },
    { q: "Posso cancelar quando quiser?", a: "Sim, sem fidelidade e sem multa. Cancele a qualquer momento pelo painel." },
    { q: "Preciso de uma função específica?", a: "Desenvolvemos para você sem nenhum custo adicional! Fale conosco pelo WhatsApp." },
  ];

  return (
    <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", color: t.text1, background: t.bg1, transition: "background 0.4s, color 0.4s" }}>

      {/* ═══ THEME TOGGLE BUTTON ═══ */}
      <button
        onClick={() => setMode(modeStyle(mode, "light", "dark"))}
        aria-label="Alternar tema claro/escuro"
        style={{
          position: "fixed", top: "24px", right: "24px", zIndex: 9999,
          width: "44px", height: "44px", borderRadius: "50%",
          background: modeStyle(mode, "rgba(255,255,255,0.1)", "rgba(0,53,128,0.08)"),
          border: modeStyle(mode, "1px solid rgba(255,255,255,0.15)", "1px solid rgba(0,53,128,0.2)"),
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", transition: "transform 0.2s, background 0.3s",
          backdropFilter: "blur(8px)",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.1)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
      >
        {mode === "dark"
          ? <Sun style={{ width: "20px", height: "20px", color: "#fbbf24" }} />
          : <Moon style={{ width: "20px", height: "20px", color: "#003580" }} />
        }
      </button>

      {/* ═══ FLOATING WHATSAPP BUTTON ═══ */}
      <a
        href={WHATSAPP_LINK}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Fale conosco no WhatsApp"
        style={{
          position: "fixed", bottom: "24px", right: "24px", zIndex: 9999,
          width: "60px", height: "60px", borderRadius: "50%",
          background: "#25D366", display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 20px rgba(37,211,102,0.4)",
          cursor: "pointer", transition: "transform 0.2s, box-shadow 0.2s",
          animation: "whatsappPulse 2s infinite",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.1)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
      >
        <svg viewBox="0 0 24 24" width="32" height="32" fill="white">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      </a>

      {/* CSS animations */}
      <style>{`
        @keyframes whatsappPulse {
          0%, 100% { box-shadow: 0 4px 20px rgba(37,211,102,0.4); }
          50% { box-shadow: 0 4px 30px rgba(37,211,102,0.7), 0 0 0 12px rgba(37,211,102,0.1); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .fade-up { animation: fadeInUp 0.7s ease-out both; }
        .fade-up-d1 { animation-delay: 0.1s; }
        .fade-up-d2 { animation-delay: 0.2s; }
        .fade-up-d3 { animation-delay: 0.3s; }
        .landing-section { padding: 80px 24px; max-width: 1200px; margin: 0 auto; }
        @media (max-width: 768px) { .landing-section { padding: 48px 16px; } }
        .gradient-title {
          -webkit-background-clip: text !important;
          background-clip: text !important;
          -webkit-text-fill-color: transparent !important;
          color: transparent !important;
        }
        @media print {
          * { break-inside: avoid; }
          section { break-before: avoid; break-after: avoid; page-break-before: avoid; page-break-after: avoid; page-break-inside: avoid; }
          body, html { overflow: visible !important; }
        }
      `}</style>

      {/* ═══════════════════════════════════
          HERO
      ═══════════════════════════════════ */}
      <section style={{
        minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center",
        alignItems: "center", textAlign: "center", padding: "120px 24px 80px",
        background: t.heroGrad,
        position: "relative", overflow: "hidden", transition: "background 0.4s",
      }}>
        {/* Decorative orbs */}
        <div style={{ position: "absolute", top: "-120px", left: "-80px", width: "400px", height: "400px", borderRadius: "50%", background: t.orb1, pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-120px", right: "-80px", width: "500px", height: "500px", borderRadius: "50%", background: t.orb2, pointerEvents: "none" }} />

        <AppLogo size={120} rounded={24} border="3px solid #ffffff" objectFit="cover" className="fade-up" style={{ marginBottom: "28px" }} />

        <h1 className="fade-up gradient-title" style={{
          fontSize: "clamp(2.2rem, 5vw, 4rem)", fontWeight: 900, lineHeight: 1.1,
          maxWidth: "800px", marginBottom: "24px",
          background: modeStyle(mode, "linear-gradient(135deg, #fff 0%, #c7d2fe 50%, #818cf8 100%)", "linear-gradient(135deg, #003580 0%, #0050b3 50%, #003580 100%)"),
        }}>
          App Interfone<br />Interfone Digital por QR Code
        </h1>

        <p className="fade-up fade-up-d2" style={{ fontSize: "clamp(1rem, 2vw, 1.25rem)", color: t.text3, maxWidth: "600px", lineHeight: 1.7, marginBottom: "40px" }}>
          Visitante escaneia o QR Code, liga direto pro morador com vídeo e áudio — sem instalar nada. <strong style={{ color: t.text1 }}>Funciona no celular, tablet e computador.</strong>
        </p>

        <div className="fade-up fade-up-d3" style={{ display: "flex", gap: "16px", flexWrap: "wrap", justifyContent: "center" }}>
          <button
            onClick={() => navigate("/register/condominio")}
            style={{
              padding: "16px 32px", borderRadius: "14px",
              border: "2px solid #003580", background: "#ffffff",
              color: "#003580", fontWeight: 700, fontSize: "16px", cursor: "pointer",
              display: "flex", alignItems: "center", gap: "8px",
              transition: "transform 0.2s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
          >
            Testar Grátis por 7 Dias <ArrowRight style={{ width: "18px", height: "18px", color: "#003580" }} />
          </button>
          <button
            onClick={() => navigate("/login")}
            style={{
              padding: "16px 32px", borderRadius: "14px",
              border: "2px solid #ffffff", background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)",
              color: "#ffffff", fontWeight: 700, fontSize: "16px", cursor: "pointer",
              display: "flex", alignItems: "center", gap: "8px",
              transition: "transform 0.2s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
          >
            <Lock style={{ width: "18px", height: "18px", color: "#ffffff" }} /> Acessar Plataforma
          </button>
        </div>

        {/* Highlight features */}
        <div className="fade-up" style={{ marginTop: "48px", display: "flex", gap: "16px", flexWrap: "wrap", justifyContent: "center" }}>
          {[
            { icon: QrCode, text: "QR Code por Bloco", bg: "#ffffff", border: "#003580", textColor: "#003580", iconColor: "#003580" },
            { icon: Phone, text: "Videochamada Instantânea", bg: "#003580", border: "#ffffff", textColor: "#ffffff", iconColor: "#ffffff" },
            { icon: MessageCircle, text: "Integrado ao WhatsApp", bg: "#25D366", border: "#ffffff", textColor: "#ffffff", iconColor: "#ffffff" },
          ].map((b) => (
            <div key={b.text} style={{
              display: "flex", alignItems: "center", gap: "10px",
              background: b.bg, border: `2px solid ${b.border}`,
              borderRadius: "14px", padding: "12px 28px",
              fontSize: "15px", fontWeight: 600, color: b.textColor,
              minWidth: "220px", justifyContent: "center",
            }}>
              <b.icon style={{ width: "20px", height: "20px", color: b.iconColor }} /> {b.text}
            </div>
          ))}
        </div>

        {/* Trust badges */}
        <div className="fade-up" style={{ marginTop: "32px", display: "flex", gap: "32px", flexWrap: "wrap", justifyContent: "center", opacity: 0.6 }}>
          {[
            { icon: Lock, text: "Dados criptografados" },
            { icon: Wifi, text: "100% na nuvem" },
            { icon: Eye, text: "Histórico de chamadas" },
            { icon: Bell, text: "Notificações automáticas" },
          ].map((b) => (
            <div key={b.text} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: t.text3 }}>
              <b.icon style={{ width: "16px", height: "16px" }} /> {b.text}
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════
          COMECE A USAR — FAIXA
      ═══════════════════════════════════ */}
      <section style={{ background: modeStyle(mode, "#ffffff", "#003580"), padding: "60px 24px", transition: "background 0.4s" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "40px" }}>
          {/* Left — text */}
          <div style={{ flex: "1 1 300px", minWidth: "260px", textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px", justifyContent: "center" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Zap style={{ width: "18px", height: "18px", color: "#fff" }} />
              </div>
              <h3 style={{ fontWeight: 800, fontSize: "clamp(1.2rem, 2.5vw, 1.5rem)", color: modeStyle(mode, "#003580", "#ffffff") }}>
                Comece a usar agora mesmo
              </h3>
            </div>
            <p style={{ fontSize: "15px", color: modeStyle(mode, "#475569", "rgba(255,255,255,0.8)"), lineHeight: 1.6, maxWidth: "400px", margin: "0 auto" }}>
              Acesse pelo navegador e transforme o interfone do seu condomínio.
            </p>
          </div>

          {/* Center — Google Play */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", flex: "1 1 200px" }}>
            <div style={{ width: "64px", height: "64px", borderRadius: "16px", background: "linear-gradient(135deg, #22c55e, #16a34a)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(34,197,94,0.3)" }}>
              <svg viewBox="0 0 24 24" fill="white" width="28" height="28"><path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-1.07l2.834 1.639a1 1 0 0 1 0 1.448l-2.834 1.639-2.532-2.532 2.532-2.194zM5.864 2.658L16.8 8.99l-2.302 2.302-8.635-8.635z"/></svg>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "1.5px", color: modeStyle(mode, "#64748b", "rgba(255,255,255,0.7)"), textTransform: "uppercase", marginBottom: "2px" }}>DISPONÍVEL NO</p>
              <p style={{ fontSize: "16px", fontWeight: 700, color: modeStyle(mode, "#003580", "#ffffff") }}>Google Play</p>
            </div>
          </div>

          {/* Right — Browser */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", flex: "1 1 200px" }}>
            <div style={{ width: "64px", height: "64px", borderRadius: "16px", background: "linear-gradient(135deg, #f97316, #ea580c)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(249,115,22,0.3)" }}>
              <svg viewBox="0 0 24 24" fill="white" width="28" height="28"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm-1 17.938A8.004 8.004 0 0 1 4.062 13H7.1a14.9 14.9 0 0 0 .9 4.24 10.18 10.18 0 0 0 3 2.698zm0-3.476A8.24 8.24 0 0 1 8.14 13H11v3.462zm0-5.462H8.14A8.24 8.24 0 0 1 11 7.538V11zm0-5.462A10.18 10.18 0 0 0 8 8.24 14.9 14.9 0 0 0 7.1 11H4.062A8.004 8.004 0 0 1 11 4.062zM19.938 11H16.9a14.9 14.9 0 0 0-.9-2.76A10.18 10.18 0 0 0 13 5.538V4.062A8.004 8.004 0 0 1 19.938 11zM13 7.538A8.24 8.24 0 0 1 15.86 11H13V7.538zM13 13h2.86A8.24 8.24 0 0 1 13 16.462V13zm0 6.938v-1.476a10.18 10.18 0 0 0 3-2.698A14.9 14.9 0 0 0 16.9 13h3.038A8.004 8.004 0 0 1 13 19.938z"/></svg>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "1.5px", color: modeStyle(mode, "#64748b", "rgba(255,255,255,0.7)"), textTransform: "uppercase", marginBottom: "6px" }}>ACESSE PELO NAVEGADOR</p>
              <div style={{ border: `2px dashed ${modeStyle(mode, "#003580", "#ffffff")}`, borderRadius: "10px", padding: "8px 20px" }}>
                <p style={{ fontSize: "15px", fontWeight: 700, color: modeStyle(mode, "#003580", "#ffffff") }}>www.appinterfone.com.br</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════
          NAVEGUE PELO SISTEMA
      ═══════════════════════════════════ */}
      <section style={{ background: "linear-gradient(135deg, #0a1628 0%, #0d2847 50%, #0a1628 100%)", padding: "80px 24px" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(255,255,255,0.08)", border: "1.5px solid rgba(255,255,255,0.2)", borderRadius: "999px", padding: "6px 16px", marginBottom: "16px", fontSize: "13px", color: "#ffffff" }}>
            <Play style={{ width: "14px", height: "14px" }} /> Teste Agora
          </div>
          <h2 style={{ fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)", fontWeight: 800, color: "#ffffff", marginBottom: "12px", lineHeight: 1.2 }}>
            Navegue pelo Sistema
          </h2>
          <p style={{ fontSize: "16px", color: "rgba(255,255,255,0.7)", maxWidth: "560px", margin: "0 auto 48px", lineHeight: 1.7 }}>
            Escolha um perfil e explore o sistema completo com dados fictícios. Sem cadastro, sem compromisso.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px" }}>
            {/* Síndico */}
            <button
              disabled={!!demoLoading}
              onClick={async () => {
                setDemoLoading("sindico");
                try { await loginDemo("sindico"); navigate("/dashboard"); } catch { setDemoLoading(null); }
              }}
              style={{
                background: "linear-gradient(135deg, #7c3aed, #5b21b6)", border: "2px solid rgba(255,255,255,0.2)",
                borderRadius: "20px", padding: "32px 24px", cursor: demoLoading ? "wait" : "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: "16px",
                transition: "transform 0.2s, box-shadow 0.2s", opacity: demoLoading && demoLoading !== "sindico" ? 0.5 : 1,
              }}
              onMouseEnter={e => { if (!demoLoading) { e.currentTarget.style.transform = "translateY(-6px)"; e.currentTarget.style.boxShadow = "0 16px 40px rgba(124,58,237,0.4)"; } }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
            >
              <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <AppLogo size={40} rounded={10} objectFit="cover" />
              </div>
              <span style={{ fontSize: "18px", fontWeight: 800, color: "#ffffff" }}>{demoLoading === "sindico" ? "Carregando..." : "Síndico"}</span>
              <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>Gestão de blocos, QR Codes, configurações e histórico de chamadas</span>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px", color: "#ffffff", fontWeight: 700, fontSize: "13px" }}>
                Explorar <ArrowRight style={{ width: "14px", height: "14px" }} />
              </div>
            </button>

            {/* Portaria */}
            <button
              disabled={!!demoLoading}
              onClick={async () => {
                setDemoLoading("portaria");
                try { await loginDemo("portaria"); navigate("/dashboard"); } catch { setDemoLoading(null); }
              }}
              style={{
                background: "linear-gradient(135deg, #2563eb, #1d4ed8)", border: "2px solid rgba(255,255,255,0.2)",
                borderRadius: "20px", padding: "32px 24px", cursor: demoLoading ? "wait" : "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: "16px",
                transition: "transform 0.2s, box-shadow 0.2s", opacity: demoLoading && demoLoading !== "portaria" ? 0.5 : 1,
              }}
              onMouseEnter={e => { if (!demoLoading) { e.currentTarget.style.transform = "translateY(-6px)"; e.currentTarget.style.boxShadow = "0 16px 40px rgba(37,99,235,0.4)"; } }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
            >
              <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Shield style={{ width: "32px", height: "32px", color: "#ffffff" }} />
              </div>
              <span style={{ fontSize: "18px", fontWeight: 800, color: "#ffffff" }}>{demoLoading === "portaria" ? "Carregando..." : "Portaria"}</span>
              <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>Receba chamadas dos visitantes, interfone digital e controle de acesso</span>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px", color: "#ffffff", fontWeight: 700, fontSize: "13px" }}>
                Explorar <ArrowRight style={{ width: "14px", height: "14px" }} />
              </div>
            </button>

            {/* Morador */}
            <button
              disabled={!!demoLoading}
              onClick={async () => {
                setDemoLoading("morador");
                try { await loginDemo("morador"); navigate("/dashboard"); } catch { setDemoLoading(null); }
              }}
              style={{
                background: "linear-gradient(135deg, #059669, #047857)", border: "2px solid rgba(255,255,255,0.2)",
                borderRadius: "20px", padding: "32px 24px", cursor: demoLoading ? "wait" : "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: "16px",
                transition: "transform 0.2s, box-shadow 0.2s", opacity: demoLoading && demoLoading !== "morador" ? 0.5 : 1,
              }}
              onMouseEnter={e => { if (!demoLoading) { e.currentTarget.style.transform = "translateY(-6px)"; e.currentTarget.style.boxShadow = "0 16px 40px rgba(5,150,105,0.4)"; } }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
            >
              <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Users style={{ width: "32px", height: "32px", color: "#ffffff" }} />
              </div>
              <span style={{ fontSize: "18px", fontWeight: 800, color: "#ffffff" }}>{demoLoading === "morador" ? "Carregando..." : "Morador"}</span>
              <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>Receba chamadas no celular, veja quem está na portaria e abra o portão</span>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px", color: "#ffffff", fontWeight: 700, fontSize: "13px" }}>
                Explorar <ArrowRight style={{ width: "14px", height: "14px" }} />
              </div>
            </button>
          </div>

          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", marginTop: "24px" }}>
            * Dados fictícios para demonstração. Nenhuma ação real será executada.
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════
          FUNCIONALIDADES COMPLETAS
      ═══════════════════════════════════ */}
      <section style={{ background: t.sectionGrad1, transition: "background 0.4s" }}>
        <div className="landing-section">
          <div style={{ textAlign: "center", marginBottom: "60px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: modeStyle(mode, "#003580", "#ffffff"), border: modeStyle(mode, "1.5px solid #ffffff", "1.5px solid #003580"), borderRadius: "999px", padding: "6px 16px", marginBottom: "16px", fontSize: "13px", color: modeStyle(mode, "#ffffff", "#003580") }}>
              <Zap style={{ width: "14px", height: "14px" }} /> Funcionalidades
            </div>
            <h2 style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.5rem)", fontWeight: 800, marginBottom: "12px", color: t.text2 }}>
              Tudo em Um Só Sistema
            </h2>
            <p style={{ color: t.text3, fontSize: "16px", maxWidth: "560px", margin: "0 auto", lineHeight: 1.7 }}>
              Cada funcionalidade atende morador e síndico. Veja quem usa cada recurso.
            </p>
            {/* Profile legend */}
            <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginTop: "24px", flexWrap: "wrap" }}>
              {(["morador", "sindico"] as ProfileKey[]).map((k) => {
                const pr = PROFILES[k];
                const PrIcon = pr.icon;
                return (
                  <button type="button" key={k} tabIndex={0} onClick={() => navigate(pr.link)} onKeyDown={(e) => handleKeyActivate(e, () => navigate(pr.link))} style={{ display: "flex", alignItems: "center", gap: "6px", background: pr.bg, padding: "6px 14px", borderRadius: "999px", border: "none", boxShadow: `0 2px 8px ${pr.color}40`, cursor: "pointer", transition: "transform 0.15s", fontFamily: "inherit", fontSize: "inherit", color: "inherit" }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.06)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                  >
                    <PrIcon style={{ width: "14px", height: "14px", color: "#ffffff" }} />
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#ffffff" }}>{pr.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "20px" }}>
            {allFeatures.map((f) => {
              const Icon = f.icon;
              return (
                <button
                  type="button"
                  key={f.title}
                  tabIndex={0}
                  onClick={() => {
                    if (f.title === "Abertura Remota (IoT)") { navigate("/portaria-virtual-tutorial"); }
                    else { setActiveTutorial(f.title); }
                  }}
                  onKeyDown={(e) => handleKeyActivate(e, () => {
                    if (f.title === "Abertura Remota (IoT)") { navigate("/portaria-virtual-tutorial"); }
                    else { setActiveTutorial(f.title); }
                  })}
                  style={{
                    background: t.card, borderRadius: "16px", padding: "28px",
                    border: mode === "dark" ? "2px solid rgba(255,255,255,0.6)" : `1.5px solid ${t.border}`,
                    transition: "transform 0.2s, border-color 0.2s, box-shadow 0.2s, background 0.4s",
                    position: "relative", cursor: "pointer",
                    display: "flex", flexDirection: "column",
                    fontFamily: "inherit", textAlign: "left", color: "inherit",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-4px)";
                    e.currentTarget.style.borderColor = modeStyle(mode, "rgba(255,255,255,0.9)", "rgba(0,53,128,0.6)");
                    e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,0.12)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.borderColor = modeStyle(mode, "rgba(255,255,255,0.6)", "rgba(0,53,128,0.3)");
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  {f.badge && (
                    <span style={{
                      position: "absolute", top: "12px", right: "12px",
                      background: "transparent", border: modeStyle(mode, "1.5px solid #ffffff", "1.5px solid #003580"),
                      color: modeStyle(mode, "#ffffff", "#003580"), fontSize: "11px", fontWeight: 700,
                      padding: "3px 10px", borderRadius: "999px",
                    }}>
                      {f.badge}
                    </span>
                  )}
                  <div style={{
                    width: "48px", height: "48px", borderRadius: "12px",
                    background: modeStyle(mode, "rgba(255,255,255,0.1)", "rgba(0,53,128,0.1)"),
                    display: "flex", alignItems: "center", justifyContent: "center",
                    marginBottom: "16px",
                  }}>
                    <Icon style={{ width: "24px", height: "24px", color: modeStyle(mode, "#ffffff", "#003580") }} />
                  </div>
                  <h3 style={{ fontWeight: 700, fontSize: "16px", marginBottom: "8px", color: t.text2 }}>{f.title}</h3>
                  <p style={{ fontSize: "14px", color: t.text3, lineHeight: 1.6, flex: 1 }} dangerouslySetInnerHTML={{ __html: f.desc }} />

                  {/* Profile badges */}
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "16px", paddingTop: "14px", borderTop: `1px solid ${modeStyle(mode, "rgba(255,255,255,0.08)", "rgba(0,53,128,0.08)")}` }}>
                    {f.profiles.map((pk) => {
                      const pr = PROFILES[pk];
                      const PrIcon = pr.icon;
                      return (
                        <span role="link" key={pk} tabIndex={0} onClick={(e) => { e.stopPropagation(); navigate(pr.link); }} onKeyDown={(e) => handleKeyActivate(e, () => navigate(pr.link))} style={{
                          display: "flex", alignItems: "center", gap: "5px",
                          background: pr.bg,
                          padding: "4px 10px", borderRadius: "999px",
                          border: "none",
                          boxShadow: `0 1px 6px ${pr.color}35`,
                          cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s",
                          fontFamily: "inherit", color: "inherit",
                        }}
                          onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.08)"; e.currentTarget.style.boxShadow = `0 2px 10px ${pr.color}55`; }}
                          onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = `0 1px 6px ${pr.color}35`; }}
                        >
                          <PrIcon style={{ width: "12px", height: "12px", color: "#ffffff" }} />
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "#ffffff" }}>{pr.label}</span>
                        </span>
                      );
                    })}
                  </div>

                  {/* CTA */}
                  <span
                    role="link"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (f.title === "Abertura Remota (IoT)") { navigate("/portaria-virtual-tutorial"); }
                      else { setActiveTutorial(f.title); }
                    }}
                    onKeyDown={(e) => handleKeyActivate(e, () => {
                      if (f.title === "Abertura Remota (IoT)") { navigate("/portaria-virtual-tutorial"); }
                      else { setActiveTutorial(f.title); }
                    })}
                    style={{
                      marginTop: "14px", padding: "10px 20px", borderRadius: "10px",
                      border: modeStyle(mode, "2px solid #ffffff", "2px solid #003580"),
                      background: "transparent",
                      color: modeStyle(mode, "#ffffff", "#003580"),
                      fontWeight: 700, fontSize: "13px", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: "6px",
                      transition: "background 0.2s", alignSelf: "flex-start",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = modeStyle(mode, "rgba(255,255,255,0.1)", "rgba(0,53,128,0.08)"); }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    Saiba mais <ChevronRight style={{ width: "14px", height: "14px" }} />
                  </span>
                </button>
              );
            })}
          </div>

        </div>
      </section>

      {/* ═══════════════════════════════════
          APRESENTAÇÃO COMPLETA
      ═══════════════════════════════════ */}
      <section style={{ background: modeStyle(mode, "#ffffff", "#003580"), padding: "80px 24px", transition: "background 0.4s" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto", textAlign: "center" }}>
          {/* Badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: modeStyle(mode, "#003580", "rgba(255,255,255,0.1)"), border: "1.5px solid #ffffff", borderRadius: "999px", padding: "8px 20px", marginBottom: "24px", fontSize: "14px", fontWeight: 600, color: "#ffffff" }}>
            <Zap style={{ width: "16px", height: "16px" }} /> Apresentação Completa
          </div>

          <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 900, color: modeStyle(mode, "#003580", "#ffffff"), marginBottom: "16px", lineHeight: 1.2 }}>
            Conheça o <span style={{ color: modeStyle(mode, "#003580", "#ffffff") }}>App Interfone</span>
          </h2>
          <p style={{ fontSize: "16px", color: modeStyle(mode, "#475569", "rgba(255,255,255,0.8)"), maxWidth: "550px", margin: "0 auto 48px", lineHeight: 1.7 }}>
            Baixe nossa apresentação completa ou compartilhe o link com sua equipe e parceiros.
          </p>

          {/* 3 Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px" }}>
            {/* Card 1 — Baixar Apresentação */}
            <button type="button" tabIndex={0} style={{
              background: modeStyle(mode, "#003580", "#ffffff"),
              border: modeStyle(mode, "2px solid rgba(255,255,255,0.3)", "2px solid rgba(0,53,128,0.3)"), borderRadius: "16px",
              padding: "36px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px",
              transition: "transform 0.2s, border-color 0.2s, box-shadow 0.2s",
              cursor: "pointer", boxShadow: modeStyle(mode, "0 2px 12px rgba(0,0,0,0.15)", "0 2px 12px rgba(0,0,0,0.08)"),
              fontFamily: "inherit", fontSize: "inherit", color: "inherit", textAlign: "center",
            }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.borderColor = modeStyle(mode, "rgba(255,255,255,0.6)", "rgba(0,53,128,0.6)"); }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = modeStyle(mode, "rgba(255,255,255,0.3)", "rgba(0,53,128,0.3)"); }}
              onClick={() => globalThis.open("/apresentacao", "_blank")}
              onKeyDown={(e) => handleKeyActivate(e, () => globalThis.open("/apresentacao", "_blank"))}
            >
              <div style={{ width: "56px", height: "56px", borderRadius: "14px", background: "linear-gradient(135deg, #f97316, #ea580c)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(249,115,22,0.3)" }}>
                <FileText style={{ width: "26px", height: "26px", color: "#fff" }} />
              </div>
              <h3 style={{ fontWeight: 800, fontSize: "17px", color: modeStyle(mode, "#ffffff", "#003580") }}>Baixar Apresentação</h3>
              <p style={{ fontSize: "13px", color: modeStyle(mode, "rgba(255,255,255,0.7)", "#336699"), lineHeight: 1.6 }}>
                Abra a apresentação completa e salve como PDF para enviar por e-mail.
              </p>
              <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", fontWeight: 600, color: "#f97316", marginTop: "auto" }}>
                <FileText style={{ width: "14px", height: "14px" }} /> Abrir e exportar PDF <ArrowRight style={{ width: "14px", height: "14px" }} />
              </span>
            </button>

            {/* Card 2 — Copiar Link */}
            <button type="button" tabIndex={0} style={{
              background: modeStyle(mode, "#003580", "#ffffff"),
              border: modeStyle(mode, "2px solid rgba(255,255,255,0.3)", "2px solid rgba(0,53,128,0.3)"), borderRadius: "16px",
              padding: "36px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px",
              transition: "transform 0.2s, border-color 0.2s, box-shadow 0.2s",
              cursor: "pointer", boxShadow: modeStyle(mode, "0 2px 12px rgba(0,0,0,0.15)", "0 2px 12px rgba(0,0,0,0.08)"),
              fontFamily: "inherit", fontSize: "inherit", color: "inherit", textAlign: "center",
            }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.borderColor = modeStyle(mode, "rgba(255,255,255,0.6)", "rgba(0,53,128,0.6)"); }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = modeStyle(mode, "rgba(255,255,255,0.3)", "rgba(0,53,128,0.3)"); }}
              onClick={() => { navigator.clipboard.writeText(globalThis.location.origin + "/apresentacao"); }}
              onKeyDown={(e) => handleKeyActivate(e, () => { navigator.clipboard.writeText(globalThis.location.origin + "/apresentacao"); })}
            >
              <div style={{ width: "56px", height: "56px", borderRadius: "14px", background: "linear-gradient(135deg, #6366f1, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(99,102,241,0.3)" }}>
                <QrCode style={{ width: "26px", height: "26px", color: "#fff" }} />
              </div>
              <h3 style={{ fontWeight: 800, fontSize: "17px", color: modeStyle(mode, "#ffffff", "#003580") }}>Copiar Link</h3>
              <p style={{ fontSize: "13px", color: modeStyle(mode, "rgba(255,255,255,0.7)", "#336699"), lineHeight: 1.6 }}>
                Copie o link da apresentação e envie para quem desejar.
              </p>
              <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", fontWeight: 600, color: "#818cf8", marginTop: "auto" }}>
                <ChevronRight style={{ width: "14px", height: "14px" }} /> Copiar para área de transferência <ArrowRight style={{ width: "14px", height: "14px" }} />
              </span>
            </button>

            {/* Card 3 — Enviar via WhatsApp */}
            <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
              <div style={{
                background: modeStyle(mode, "#003580", "#ffffff"),
                border: modeStyle(mode, "2px solid rgba(255,255,255,0.3)", "2px solid rgba(0,53,128,0.3)"), borderRadius: "16px",
                padding: "36px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px",
                transition: "transform 0.2s, border-color 0.2s, box-shadow 0.2s",
                cursor: "pointer", height: "100%", boxShadow: modeStyle(mode, "0 2px 12px rgba(0,0,0,0.15)", "0 2px 12px rgba(0,0,0,0.08)"),
              }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.borderColor = modeStyle(mode, "rgba(255,255,255,0.6)", "rgba(0,53,128,0.6)"); }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = modeStyle(mode, "rgba(255,255,255,0.3)", "rgba(0,53,128,0.3)"); }}
              >
                <div style={{ width: "56px", height: "56px", borderRadius: "14px", background: "linear-gradient(135deg, #25D366, #128C7E)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(37,211,102,0.3)" }}>
                  <MessageCircle style={{ width: "26px", height: "26px", color: "#fff" }} />
                </div>
                <h3 style={{ fontWeight: 800, fontSize: "17px", color: modeStyle(mode, "#ffffff", "#003580") }}>Enviar via WhatsApp</h3>
                <p style={{ fontSize: "13px", color: modeStyle(mode, "rgba(255,255,255,0.7)", "#336699"), lineHeight: 1.6 }}>
                  Compartilhe a apresentação diretamente pelo WhatsApp.
                </p>
                <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", fontWeight: 600, color: "#25D366", marginTop: "auto" }}>
                  <ArrowRight style={{ width: "14px", height: "14px" }} /> Compartilhar agora <ArrowRight style={{ width: "14px", height: "14px" }} />
                </span>
              </div>
            </a>

          </div>

          {/* Card 4 — Modelo de Contrato (centralizado) */}
          <div style={{ display: "flex", justifyContent: "center", marginTop: "20px" }}>
            <button type="button" style={{
              background: modeStyle(mode, "#003580", "#ffffff"),
              border: modeStyle(mode, "2px solid rgba(255,255,255,0.3)", "2px solid rgba(0,53,128,0.3)"), borderRadius: "16px",
              padding: "36px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px",
              transition: "transform 0.2s, border-color 0.2s, box-shadow 0.2s",
              cursor: "pointer", boxShadow: modeStyle(mode, "0 2px 12px rgba(0,0,0,0.15)", "0 2px 12px rgba(0,0,0,0.08)"),
              width: "100%", maxWidth: "320px",
              fontFamily: "inherit", fontSize: "inherit", color: "inherit", textAlign: "center",
            }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.borderColor = modeStyle(mode, "rgba(255,255,255,0.6)", "rgba(0,53,128,0.6)"); }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = modeStyle(mode, "rgba(255,255,255,0.3)", "rgba(0,53,128,0.3)"); }}
              onClick={() => navigate("/contrato")}
            >
              <div style={{ width: "56px", height: "56px", borderRadius: "14px", background: "linear-gradient(135deg, #0ea5e9, #0284c7)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(14,165,233,0.3)" }}>
                <BookOpen style={{ width: "26px", height: "26px", color: "#fff" }} />
              </div>
              <h3 style={{ fontWeight: 800, fontSize: "17px", color: modeStyle(mode, "#ffffff", "#003580") }}>Modelo de Contrato</h3>
              <p style={{ fontSize: "13px", color: modeStyle(mode, "rgba(255,255,255,0.7)", "#336699"), lineHeight: 1.6 }}>
                Veja o modelo de contrato de prestação de serviços do App Interfone.
              </p>
              <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", fontWeight: 600, color: "#0ea5e9", marginTop: "auto" }}>
                <BookOpen style={{ width: "14px", height: "14px" }} /> Ver contrato <ArrowRight style={{ width: "14px", height: "14px" }} />
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════
          INTEGRAÇÕES / DISPOSITIVOS
      ═══════════════════════════════════ */}
      <section id="integracoes" style={{ background: t.sectionGrad1, transition: "background 0.4s" }}>
        <div className="landing-section">
          <div style={{ textAlign: "center", marginBottom: "60px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: modeStyle(mode, "#003580", "#ffffff"), border: modeStyle(mode, "1.5px solid #ffffff", "1.5px solid #003580"), borderRadius: "999px", padding: "6px 16px", marginBottom: "16px", fontSize: "13px", color: modeStyle(mode, "#ffffff", "#003580") }}>
              <Cpu style={{ width: "14px", height: "14px" }} /> Integrações IoT
            </div>
            <h2 style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.5rem)", fontWeight: 800, marginBottom: "12px", color: t.text2 }}>
              Biblioteca de Integrações
            </h2>
            <p style={{
              fontSize: "clamp(1.1rem, 2.5vw, 1.5rem)", fontWeight: 800,
              color: "#25D366", marginBottom: "12px",
            }}>
              Abra o portão a distância, de onde você estiver, pelo app!
            </p>
            <p style={{ color: t.text3, fontSize: "16px", maxWidth: "600px", margin: "0 auto" }}>
              Conecte portões, fechaduras e acessos com dispositivos de diversas marcas. Veja o que cada plataforma oferece e o nível de dificuldade da integração.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
            {BRANDS.map((brand) => {
              const diffColor = getDiffColor(brand.difficulty);
              const diffLabel = getDiffLabel(brand.difficulty);
              const IntegIcon = getIntegIcon(brand.integrationType);
              return (
                <button
                  type="button"
                  key={brand.id}
                  tabIndex={0}
                  onClick={() => navigate("/login")}
                  onKeyDown={(e) => handleKeyActivate(e, () => navigate("/login"))}
                  style={{
                    background: t.card3, borderRadius: "16px", padding: "28px",
                    border: modeStyle(mode, "2px solid rgba(255,255,255,0.15)", "2px solid rgba(0,53,128,0.15)"),
                    transition: "transform 0.2s, border-color 0.3s, box-shadow 0.3s",
                    cursor: "pointer", position: "relative", overflow: "hidden",
                    fontFamily: "inherit", fontSize: "inherit", color: "inherit", textAlign: "left", width: "100%",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-6px)";
                    e.currentTarget.style.borderColor = modeStyle(mode, "rgba(255,255,255,0.5)", "rgba(0,53,128,0.5)");
                    e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,0.12)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.borderColor = modeStyle(mode, "rgba(255,255,255,0.15)", "rgba(0,53,128,0.15)");
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  {/* Header: brand name + country flag */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{
                        width: "42px", height: "42px", borderRadius: "12px",
                        background: modeStyle(mode, "rgba(255,255,255,0.08)", "rgba(0,53,128,0.08)"),
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Cpu style={{ width: "20px", height: "20px", color: modeStyle(mode, "#ffffff", "#003580") }} />
                      </div>
                      <div>
                        <h3 style={{ fontWeight: 700, fontSize: "16px", color: t.text2, margin: 0 }}>{brand.name}</h3>
                        <span style={{ fontSize: "11px", color: t.text3 }}>{brand.country}</span>
                      </div>
                    </div>
                    {/* Integration type badge */}
                    <div style={{
                      display: "flex", alignItems: "center", gap: "4px",
                      background: modeStyle(mode, "rgba(255,255,255,0.06)", "rgba(0,53,128,0.06)"),
                      padding: "4px 10px", borderRadius: "999px", fontSize: "11px",
                      color: t.text3, fontWeight: 600,
                    }}>
                      <IntegIcon style={{ width: "12px", height: "12px" }} />
                      {INTEGRATION_LABELS[brand.integrationType].split(" ")[0]}
                    </div>
                  </div>

                  {/* Description */}
                  <p style={{ fontSize: "13px", color: t.text3, lineHeight: 1.6, marginBottom: "18px", minHeight: "60px" }}>
                    {brand.description}
                  </p>

                  {/* Difficulty gauge */}
                  <div style={{ marginBottom: "14px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                      <span style={{ fontSize: "12px", fontWeight: 600, color: t.text3, display: "flex", alignItems: "center", gap: "4px" }}>
                        <Wrench style={{ width: "12px", height: "12px" }} /> Dificuldade
                      </span>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: diffColor }}>
                        {brand.difficulty}/10 — {diffLabel}
                      </span>
                    </div>
                    <div style={{
                      width: "100%", height: "6px", borderRadius: "999px",
                      background: modeStyle(mode, "rgba(255,255,255,0.1)", "rgba(0,53,128,0.1)"),
                      overflow: "hidden",
                    }}>
                      <div style={{
                        width: `${brand.difficulty * 10}%`, height: "100%",
                        borderRadius: "999px", background: diffColor,
                        transition: "width 0.6s ease",
                      }} />
                    </div>
                  </div>

                  {/* Footer CTA */}
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    paddingTop: "14px", borderTop: `1px solid ${modeStyle(mode, "rgba(255,255,255,0.08)", "rgba(0,53,128,0.08)")}`,
                  }}>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: modeStyle(mode, "#60a5fa", "#003580"), display: "flex", alignItems: "center", gap: "4px" }}>
                      Ver dispositivos <ArrowRight style={{ width: "13px", height: "13px" }} />
                    </span>
                    <span style={{
                      fontSize: "11px", fontWeight: 600, color: diffColor,
                      background: `${diffColor}18`, padding: "3px 8px", borderRadius: "6px",
                    }}>
                      {brand.protocols.length > 1 ? `${brand.protocols.length} protocolos` : INTEGRATION_LABELS[brand.integrationType]}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Bottom CTA */}
          <div style={{ textAlign: "center", marginTop: "48px" }}>
            <button
              onClick={() => navigate("/login")}
              style={{
                padding: "14px 32px", borderRadius: "12px",
                border: modeStyle(mode, "2px solid rgba(255,255,255,0.5)", "2px solid #003580"),
                background: modeStyle(mode, "rgba(255,255,255,0.08)", "rgba(0,53,128,0.06)"),
                color: modeStyle(mode, "#ffffff", "#003580"),
                fontWeight: 700, fontSize: "15px", cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: "8px",
                transition: "background 0.2s, transform 0.2s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.03)"; e.currentTarget.style.background = modeStyle(mode, "rgba(255,255,255,0.14)", "rgba(0,53,128,0.12)"); }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.background = modeStyle(mode, "rgba(255,255,255,0.08)", "rgba(0,53,128,0.06)"); }}
            >
              <Cpu style={{ width: "18px", height: "18px" }} />
              Acessar Biblioteca Completa
              <ChevronRight style={{ width: "16px", height: "16px" }} />
            </button>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════
          PRICING
      ═══════════════════════════════════ */}
      <section id="precos" style={{ background: t.bg1, transition: "background 0.4s" }}>
        <div className="landing-section">
          <div style={{ textAlign: "center", marginBottom: "60px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: modeStyle(mode, "#003580", "#ffffff"), border: modeStyle(mode, "1.5px solid #ffffff", "1.5px solid #003580"), borderRadius: "999px", padding: "6px 16px", marginBottom: "16px", fontSize: "13px", color: modeStyle(mode, "#ffffff", "#003580") }}>
              <Star style={{ width: "14px", height: "14px" }} /> Preços
            </div>
            <h2 style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.5rem)", fontWeight: 800, marginBottom: "12px", color: t.text2 }}>
              Planos Simples e Transparentes
            </h2>
            <p style={{ color: t.text3, fontSize: "16px", maxWidth: "500px", margin: "0 auto" }}>
              Teste grátis por 7 dias. Sem taxa de implantação. Sem fidelidade. Cancele quando quiser.
            </p>
          </div>

          <div style={{ display: "flex", flexWrap: "nowrap", justifyContent: "center", gap: "20px", maxWidth: "1100px", margin: "0 auto" }}>
            {plans.map((plan) => (
              <div
                key={`${plan.name}-${plan.price}`}
                style={{
                  background: "#ffffff",
                  borderRadius: "20px", padding: "32px 22px",
                  border: "2px solid #003580",
                  position: "relative", transition: "transform 0.2s, background 0.4s",
                  flex: "1 1 0", minWidth: 0,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-6px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
              >
                {plan.popular && (
                  <div style={{
                    position: "absolute", top: "-14px", left: "50%", transform: "translateX(-50%)",
                    background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)", color: "white",
                    fontSize: "12px", fontWeight: 700, padding: "5px 20px", borderRadius: "999px",
                    boxShadow: "0 4px 16px rgba(99,102,241,0.3)",
                  }}>
                    MAIS POPULAR
                  </div>
                )}

                <h3 style={{ fontWeight: 800, fontSize: "20px", color: "#003580", marginBottom: "4px" }}>{plan.name}</h3>
                <p style={{ fontSize: "13px", color: "#003580", marginBottom: "20px" }}>{plan.subtitle}</p>

                <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginBottom: "8px" }}>
                  <span style={{ fontSize: "14px", color: "#003580" }}>R$</span>
                  <span style={{ fontSize: "48px", fontWeight: 900, color: "#003580", lineHeight: 1 }}>{plan.price}</span>
                  <span style={{ fontSize: "14px", color: "#003580" }}>/mês</span>
                </div>

                <div style={{
                  display: "flex", flexDirection: "column", gap: "12px",
                  marginBottom: "28px", marginTop: "20px",
                }}>
                  {plan.features.map((feat) => (
                    <div key={feat} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "#003580" }}>
                      <Check style={{ width: "16px", height: "16px", color: "#10b981", flexShrink: 0 }} />
                      {feat}
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => navigate("/register/condominio")}
                  style={{
                    width: "100%", padding: "14px", borderRadius: "12px", border: "none",
                    background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)",
                    color: "#ffffff",
                    fontWeight: 700, fontSize: "15px", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                    transition: "transform 0.2s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.02)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                >
                  Testar Grátis 7 Dias <ChevronRight style={{ width: "16px", height: "16px" }} />
                </button>
              </div>
            ))}
          </div>

          {/* Addons – valor adicional */}
          <div style={{ marginTop: "40px", maxWidth: "700px", margin: "40px auto 0", display: "flex", flexDirection: "column", gap: "16px" }}>
            {[
              { icon: DoorOpen, title: "Abertura Remota (IoT)", desc: "Abra portões e portas pelo app com ESP32 + relé. Taxa única de configuração:", price: "R$200", label: "na configuração", link: "/portaria-virtual-tutorial" },
            ].map((addon, idx) => (
              <button type="button" key={addon.title} tabIndex={0} onClick={() => navigate(addon.link)} onKeyDown={(e) => handleKeyActivate(e, () => navigate(addon.link))} style={{
                background: modeStyle(mode, "transparent", "#003580"),
                border: `3px solid ${modeStyle(mode, "rgba(255,255,255,0.6)", "#ffffff")}`, borderRadius: "16px",
                padding: "24px 28px", display: "flex", alignItems: "center", gap: "16px",
                flexWrap: "wrap", cursor: "pointer",
                fontFamily: "inherit", fontSize: "inherit", color: "inherit", textAlign: "left", width: "100%",
              }}>
                <div style={{
                  width: "48px", height: "48px", borderRadius: "12px",
                  background: modeStyle(mode, "rgba(255,255,255,0.1)", "rgba(255,255,255,0.15)"),
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <addon.icon style={{ width: "24px", height: "24px", color: modeStyle(mode, "#f1f5f9", "#ffffff") }} />
                </div>
                <div style={{ flex: 1, minWidth: "200px" }}>
                  <p style={{ fontWeight: 700, fontSize: "16px", color: modeStyle(mode, "#f1f5f9", "#ffffff"), marginBottom: "4px" }}>
                    {addon.title}
                  </p>
                  <p style={{ fontSize: "13px", color: mode === "dark" ? t.text3 : "rgba(255,255,255,0.8)", lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: addon.desc }} />
                </div>
                <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                  <div>
                    <span style={{ fontSize: "32px", fontWeight: 900, color: modeStyle(mode, "#f1f5f9", "#ffffff") }}>+{addon.price}</span>
                    <span style={{ fontSize: "13px", color: mode === "dark" ? t.text3 : "rgba(255,255,255,0.8)", display: "block" }}>{addon.label || "/mês"}</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(addon.link); }}
                    style={{
                      padding: "8px 18px", borderRadius: "8px",
                      border: "2px solid #ffffff", background: "transparent",
                      color: "#ffffff", fontWeight: 700, fontSize: "12px", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: "4px",
                      transition: "background 0.2s", whiteSpace: "nowrap",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    Saiba mais <ChevronRight style={{ width: "14px", height: "14px" }} />
                  </button>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════
          CUSTOM DEV CTA
      ═══════════════════════════════════ */}
      <section style={{
        background: "#ffffff",
        padding: "80px 24px", textAlign: "center",
      }}>
        <div style={{ maxWidth: "700px", margin: "0 auto" }}>
          <h2 style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 800, color: "#003580", marginBottom: "16px", lineHeight: 1.3 }}>
            PRECISA DE UMA FUNÇÃO OU PARÂMETRO ESPECÍFICO?
          </h2>
          <p style={{ fontSize: "clamp(1.1rem, 2vw, 1.4rem)", color: "#003580", fontWeight: 700, marginBottom: "32px" }}>
            🚀 DESENVOLVEMOS PARA VOCÊ SEM NENHUM CUSTO ADICIONAL!
          </p>
          <div style={{ display: "flex", justifyContent: "center", marginTop: "8px" }}>
            <div style={{
              width: "80px", height: "80px", borderRadius: "50%",
              background: "transparent", border: "3px solid #003580",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Code2 style={{ width: "40px", height: "40px", color: "#003580" }} />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════
          FAQ
      ═══════════════════════════════════ */}
      <section style={{ background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)", transition: "background 0.4s" }}>
        <div className="landing-section" style={{ maxWidth: "800px" }}>
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <h2 style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 800, marginBottom: "8px", color: "#ffffff" }}>
              Perguntas Frequentes
            </h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {faqs.map((faq, i) => (
              <div key={faq.q} style={{
                borderRadius: "12px",
                border: "2px solid #ffffff", overflow: "hidden",
                transition: "background 0.4s",
              }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{
                    width: "100%", padding: "18px 20px", border: "none", background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)",
                    color: "#ffffff", fontWeight: 600, fontSize: "15px", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    textAlign: "left", borderRadius: openFaq === i ? "12px 12px 0 0" : "12px",
                  }}
                >
                  {faq.q}
                  <ChevronRight style={{
                    width: "18px", height: "18px", color: "rgba(255,255,255,0.6)",
                    transition: "transform 0.2s",
                    transform: openFaq === i ? "rotate(90deg)" : "rotate(0)",
                  }} />
                </button>
                {openFaq === i && (
                  <div style={{ padding: "16px 20px 18px", fontSize: "14px", color: "#003580", lineHeight: 1.6, background: "#ffffff" }}>
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════
          NOSSOS APLICATIVOS
      ═══════════════════════════════════ */}
      <section style={{ background: "#ffffff", transition: "background 0.4s" }}>
        <div className="landing-section" style={{ maxWidth: "900px", textAlign: "center" }}>
          <h2 style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 800, marginBottom: "12px", color: "#003580" }}>
            Nossos Aplicativos
          </h2>
          <p style={{ fontSize: "clamp(0.95rem, 1.5vw, 1.1rem)", color: "#336699", marginBottom: "48px" }}>
            Conheça as soluções completas do nosso ecossistema
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "32px" }}>
            {/* App Interfone */}
            <a href="https://www.appinterfone.com.br" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", width: "160px" }}>
              <div style={{ width: "90px", height: "90px", borderRadius: "20px", overflow: "hidden", boxShadow: "0 4px 16px rgba(0,53,128,0.15)", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", transition: "transform 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.08)")}
                onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
              >
                <AppLogo size={80} rounded={18} />
              </div>
              <span style={{ fontWeight: 700, fontSize: "14px", color: "#003580" }}>App Interfone</span>
              <span style={{ fontSize: "12px", color: "#336699" }}>appinterfone.com.br</span>
            </a>
            {/* Gestão e Limpeza */}
            <a href="https://www.gestaoelimpeza.com.br" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", width: "160px" }}>
              <div style={{ width: "90px", height: "90px", borderRadius: "20px", overflow: "hidden", boxShadow: "0 4px 16px rgba(0,53,128,0.15)", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", transition: "transform 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.08)")}
                onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
              >
                <img src="/logo-gestaoelimpeza.png" alt="Gestão e Limpeza" style={{ width: "80px", height: "80px", objectFit: "contain" }} />
              </div>
              <span style={{ fontWeight: 700, fontSize: "14px", color: "#003580" }}>Gestão e Limpeza</span>
              <span style={{ fontSize: "12px", color: "#336699" }}>gestaoelimpeza.com.br</span>
            </a>
            {/* App Correspondência */}
            <a href="https://www.appcorrespondencia.com.br" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", width: "160px" }}>
              <div style={{ width: "90px", height: "90px", borderRadius: "20px", overflow: "hidden", boxShadow: "0 4px 16px rgba(0,53,128,0.15)", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", transition: "transform 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.08)")}
                onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
              >
                <img src="/logo-appcorrespondencia.png" alt="App Correspondência" style={{ width: "80px", height: "80px", objectFit: "contain" }} />
              </div>
              <span style={{ fontWeight: 700, fontSize: "14px", color: "#003580" }}>App Correspondência</span>
              <span style={{ fontSize: "12px", color: "#336699" }}>appcorrespondencia.com.br</span>
            </a>
            {/* Manutenção X */}
            <a href="https://www.manutencaox.com.br" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", width: "160px" }}>
              <div style={{ width: "90px", height: "90px", borderRadius: "20px", overflow: "hidden", boxShadow: "0 4px 16px rgba(0,53,128,0.15)", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", transition: "transform 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.08)")}
                onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
              >
                <img src="/logo-manutencaox.png" alt="Manutenção X" style={{ width: "80px", height: "80px", objectFit: "contain" }} />
              </div>
              <span style={{ fontWeight: 700, fontSize: "14px", color: "#003580" }}>Manutenção X</span>
              <span style={{ fontSize: "12px", color: "#336699" }}>manutencaox.com.br</span>
            </a>
          </div>

        </div>
      </section>

      {/* ═══════════════════════════════════
          FOOTER
      ═══════════════════════════════════ */}
      <footer style={{ background: "#ffffff", borderTop: "1px solid rgba(0,53,128,0.15)", padding: "48px 24px", transition: "background 0.4s" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", flexWrap: "wrap", gap: "32px", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ fontWeight: 800, fontSize: "18px", color: "#003580", marginBottom: "4px" }}>
              App Interfone
            </p>
            <p style={{ fontSize: "13px", color: "#336699" }}>
              © 2026 — www.appinterfone.com.br
            </p>
          </div>
          <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
            <button
              onClick={() => navigate("/login")}
              style={{
                padding: "10px 20px", borderRadius: "10px",
                border: "1px solid #003580", background: "transparent",
                color: "#003580", fontWeight: 600, fontSize: "14px", cursor: "pointer",
              }}
            >
              Entrar
            </button>
          </div>
        </div>
      </footer>

      {activeTutorial && (
        <LandingTutorialModal
          featureTitle={activeTutorial}
          onClose={() => setActiveTutorial(null)}
        />
      )}
    </div>
  );
}
