import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  QrCode,
  Printer,
  Layout,
  ChevronRight,
  Shield,
  Smartphone,
  UserCheck,
  CheckCircle2,
  Award,
  Zap,
  Building2,
  Lock,
  Fingerprint,
  Globe,
  Cpu,
} from "lucide-react";
import { APP_ORIGIN } from "@/lib/config";
import { useTheme } from "@/hooks/useTheme";

/* ═══════════════════════════════════════════════════════
   Modelos de Layout para impressão do QR Code
   ═══════════════════════════════════════════════════════ */
type LayoutId = "classico" | "executivo" | "elegante" | "minimal" | "platinum" | "corptech" | "institucional";

const LAYOUTS: { id: LayoutId; name: string; desc: string }[] = [
  { id: "classico", name: "Clássico", desc: "Layout tradicional com passos numerados" },
  { id: "executivo", name: "Executivo", desc: "Visual corporativo premium com faixa azul" },
  { id: "elegante", name: "Elegante Escuro", desc: "Tema escuro sofisticado com detalhes dourados" },
  { id: "minimal", name: "Minimalista", desc: "Design limpo e moderno, foco no QR Code" },
  { id: "platinum", name: "Platinum", desc: "Luxo platina com design geométrico e tipografia premium" },
  { id: "corptech", name: "Corporate Tech", desc: "Visual tech-corporativo moderno com gradientes vibrantes" },
  { id: "institucional", name: "Institucional", desc: "Formal com selo de autenticidade e marca d'água" },
];

/* ─── Step data ─── */
const steps = [
  { n: "1", title: "Escaneie o QR Code", desc: "Use a câmera do celular para ler o código" },
  { n: "2", title: "Preencha seus dados", desc: "Informe nome, documento e destino" },
  { n: "3", title: "Aguarde autorização", desc: "O morador receberá uma notificação para liberar sua entrada" },
];

/* ═══════════════════════════════════════════════════════ */

export default function VisitanteQRCode() {
  const { isDark, p } = useTheme();
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);
  const [condominioNome, setCondominioNome] = useState("Condomínio Residencial");
  const [layout, setLayout] = useState<LayoutId>("classico");

  const selfRegisterUrl = `${APP_ORIGIN}/visitante/auto-cadastro`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(selfRegisterUrl)}`;

  const handlePrint = () => window.print();

  /* ═══ RENDERERS POR LAYOUT ═══ */

  const renderClassico = () => (
    <div
      ref={printRef}
      className="mx-auto print:shadow-none"
      style={{ width: "210mm", minHeight: "297mm", padding: "30mm 25mm", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}
    >
      <div style={{ borderBottom: "3px solid #003580", paddingBottom: "16px", marginBottom: "24px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "800", color: "#003580", margin: 0 }}>App Interfone</h1>
        <p style={{ fontSize: "14px", color: "#64748b", marginTop: "4px" }}>Sistema de Controle de Acesso</p>
      </div>
      <div style={{ textAlign: "center", marginBottom: "32px" }}>
        <h2 style={{ fontSize: "22px", fontWeight: "700", color: "#1e293b" }}>{condominioNome}</h2>
      </div>
      <div style={{ textAlign: "center", marginBottom: "32px" }}>
        <div style={{ display: "inline-block", padding: "20px", border: "3px solid #003580", borderRadius: "20px" }}>
          <img src={qrCodeUrl} alt="QR Code" style={{ width: "250px", height: "250px" }} />
        </div>
      </div>
      <div style={{ textAlign: "center", marginBottom: "40px" }}>
        <h3 style={{ fontSize: "20px", fontWeight: "700", color: "#1e293b", marginBottom: "12px" }}>Cadastro de Visitante</h3>
        <p style={{ fontSize: "15px", color: "#475569", lineHeight: "1.6", maxWidth: "400px", margin: "0 auto" }}>
          Aponte a câmera do seu celular para o QR Code acima para realizar o cadastro de visitante de forma rápida e prática.
        </p>
      </div>
      <div style={{ maxWidth: "420px", margin: "0 auto" }}>
        {steps.map((s) => (
          <div key={s.n} style={{ display: "flex", gap: "16px", alignItems: "flex-start", marginBottom: "16px" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", fontSize: "14px", flexShrink: 0 }}>{s.n}</div>
            <div>
              <p style={{ fontSize: "14px", fontWeight: "600", color: "#1e293b" }}>{s.title}</p>
              <p style={{ fontSize: "13px", color: "#64748b" }}>{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: "40px", borderTop: "1px solid #e2e8f0", paddingTop: "16px", textAlign: "center" }}>
        <p style={{ fontSize: "11px", color: "#94a3b8" }}>App Interfone — Sistema de Gerenciamento de Condomínios</p>
        <p style={{ fontSize: "10px", color: "#cbd5e1", marginTop: "4px" }}>{selfRegisterUrl}</p>
      </div>
    </div>
  );

  const renderExecutivo = () => (
    <div
      ref={printRef}
      className="mx-auto print:shadow-none"
      style={{ width: "210mm", minHeight: "297mm", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", overflow: "hidden" }}
    >
      {/* Top blue bar */}
      <div style={{ background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)", padding: "40px 50px 32px", color: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ fontSize: "32px", fontWeight: "800", margin: 0, letterSpacing: "-0.5px" }}>APP INTERFONE</h1>
            <p style={{ fontSize: "13px", opacity: 0.75, marginTop: "4px", letterSpacing: "2px", textTransform: "uppercase" }}>Controle de Acesso Inteligente</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <Shield style={{ width: 40, height: 40, opacity: 0.3 }} />
          </div>
        </div>
        <div style={{ marginTop: "20px", background: isDark ? "rgba(255,255,255,0.15)" : "#f0f4f8", borderRadius: "12px", padding: "14px 20px" }}>
          <p style={{ fontSize: "18px", fontWeight: "700", margin: 0 }}>{condominioNome}</p>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "40px 50px" }}>
        <div style={{ display: "flex", gap: "40px", alignItems: "flex-start" }}>
          {/* Left: QR */}
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <div style={{ padding: "16px", border: "2px solid #003580", borderRadius: "16px", display: "inline-block" }}>
              <img src={qrCodeUrl} alt="QR Code" style={{ width: "220px", height: "220px" }} />
            </div>
            <p style={{ fontSize: "12px", color: "#003580", fontWeight: "700", marginTop: "12px", letterSpacing: "1px", textTransform: "uppercase" }}>Escaneie para cadastrar</p>
          </div>

          {/* Right: Steps */}
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: "22px", fontWeight: "800", color: "#003580", marginBottom: "8px", marginTop: 0 }}>Cadastro de Visitante</h3>
            <p style={{ fontSize: "14px", color: "#64748b", marginBottom: "28px", lineHeight: "1.5" }}>
              Siga os passos abaixo para registrar sua visita de forma rápida e segura.
            </p>
            {steps.map((s, i) => (
              <div key={s.n} style={{ display: "flex", gap: "14px", alignItems: "flex-start", marginBottom: "20px" }}>
                <div style={{ width: 36, height: 36, borderRadius: "10px", background: i === 0 ? "#003580" : "#e8edf5", color: i === 0 ? "#fff" : "#003580", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "15px", flexShrink: 0 }}>{s.n}</div>
                <div style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: "16px", flex: 1 }}>
                  <p style={{ fontSize: "15px", fontWeight: "700", color: "#1e293b", margin: 0 }}>{s.title}</p>
                  <p style={{ fontSize: "13px", color: "#64748b", margin: "4px 0 0" }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom info boxes */}
        <div style={{ display: "flex", gap: "16px", marginTop: "32px" }}>
          {[
            { icon: Smartphone, label: "Sem app", text: "Não precisa instalar nenhum aplicativo" },
            { icon: UserCheck, label: "Rápido", text: "Cadastro em menos de 1 minuto" },
            { icon: Shield, label: "Seguro", text: "Dados protegidos e criptografados" },
          ].map((b) => (
            <div key={b.label} style={{ flex: 1, background: "#f8fafc", borderRadius: "12px", padding: "16px", textAlign: "center", border: "1px solid #e2e8f0" }}>
              <b.icon style={{ width: 24, height: 24, color: "#003580", margin: "0 auto 8px" }} />
              <p style={{ fontSize: "13px", fontWeight: "700", color: "#1e293b", margin: 0 }}>{b.label}</p>
              <p style={{ fontSize: "11px", color: "#94a3b8", margin: "4px 0 0" }}>{b.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer bar */}
      <div style={{ background: "#f8fafc", borderTop: "1px solid #e2e8f0", padding: "16px 50px", textAlign: "center", marginTop: "auto" }}>
        <p style={{ fontSize: "11px", color: "#94a3b8", margin: 0 }}>App Interfone — Sistema de Gerenciamento de Condomínios</p>
        <p style={{ fontSize: "10px", color: "#cbd5e1", marginTop: "4px" }}>{selfRegisterUrl}</p>
      </div>
    </div>
  );

  const renderElegante = () => (
    <div
      ref={printRef}
      className="mx-auto print:shadow-none"
      style={{ width: "210mm", minHeight: "297mm", background: "#0f172a", boxShadow: "0 1px 3px rgba(0,0,0,0.3)", overflow: "hidden", color: p.text }}
    >
      {/* Gold top accent */}
      <div style={{ height: "4px", background: "linear-gradient(90deg, #b8860b, #daa520, #b8860b)" }} />

      <div style={{ padding: "44px 50px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <h1 style={{ fontSize: "30px", fontWeight: "800", margin: 0, letterSpacing: "3px", textTransform: "uppercase" }}>App Interfone</h1>
            <div style={{ width: "60px", height: "3px", background: "#daa520", marginTop: "8px", borderRadius: "2px" }} />
          </div>
          <div style={{ border: "1.5px solid rgba(218,165,32,0.4)", borderRadius: "12px", padding: "8px 16px" }}>
            <p style={{ fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", color: "#daa520", margin: 0, fontWeight: "600" }}>Controle de Acesso</p>
          </div>
        </div>

        {/* Condo name */}
        <div style={{ textAlign: "center", margin: "40px 0 36px", padding: "20px", borderTop: "1px solid rgba(255,255,255,0.08)", borderBottom: p.headerBorder }}>
          <p style={{ fontSize: "12px", letterSpacing: "3px", textTransform: "uppercase", color: "#daa520", margin: "0 0 8px" }}>Condomínio</p>
          <h2 style={{ fontSize: "24px", fontWeight: "700", margin: 0, color: "#f1f5f9" }}>{condominioNome}</h2>
        </div>

        {/* QR Code centered */}
        <div style={{ textAlign: "center", marginBottom: "36px" }}>
          <div style={{ display: "inline-block", padding: "24px", background: "#fff", borderRadius: "20px", boxShadow: "0 0 40px rgba(218,165,32,0.15)" }}>
            <img src={qrCodeUrl} alt="QR Code" style={{ width: "240px", height: "240px" }} />
          </div>
        </div>

        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h3 style={{ fontSize: "20px", fontWeight: "700", color: "#f1f5f9", marginBottom: "8px" }}>Cadastro de Visitante</h3>
          <p style={{ fontSize: "14px", color: "#94a3b8", lineHeight: "1.6", maxWidth: "420px", margin: "0 auto" }}>
            Aponte a câmera do seu celular para o QR Code e registre sua visita em segundos.
          </p>
        </div>

        {/* Steps — horizontal card style */}
        <div style={{ display: "flex", gap: "16px", marginBottom: "40px" }}>
          {steps.map((s) => (
            <div key={s.n} style={{ flex: 1, background: isDark ? "rgba(255,255,255,0.05)" : "#f8fafc", borderRadius: "14px", padding: "20px 16px", textAlign: "center", border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #cbd5e1" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#daa520", color: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "15px", margin: "0 auto 12px" }}>{s.n}</div>
              <p style={{ fontSize: "13px", fontWeight: "700", color: "#f1f5f9", margin: "0 0 4px" }}>{s.title}</p>
              <p style={{ fontSize: "11px", color: "#94a3b8", margin: 0, lineHeight: "1.4" }}>{s.desc}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "16px", textAlign: "center" }}>
          <p style={{ fontSize: "11px", color: "#64748b", margin: 0 }}>App Interfone — Sistema de Gerenciamento de Condomínios</p>
          <p style={{ fontSize: "10px", color: "#475569", marginTop: "4px" }}>{selfRegisterUrl}</p>
        </div>
      </div>
    </div>
  );

  const renderMinimal = () => (
    <div
      ref={printRef}
      className="mx-auto print:shadow-none"
      style={{ width: "210mm", minHeight: "297mm", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}
    >
      <div style={{ textAlign: "center", maxWidth: "400px", padding: "40px" }}>
        {/* Small logo */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)" }} />
          <span style={{ fontSize: "13px", fontWeight: "700", color: "#003580", letterSpacing: "3px", textTransform: "uppercase" }}>App Interfone</span>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)" }} />
        </div>

        {/* Condo name */}
        <h2 style={{ fontSize: "26px", fontWeight: "800", color: "#1e293b", marginBottom: "40px", lineHeight: "1.2" }}>{condominioNome}</h2>

        {/* QR — clean circle frame */}
        <div style={{ display: "inline-block", padding: "28px", borderRadius: "50%", background: "#f8fafc", border: "2px solid #e2e8f0", marginBottom: "32px" }}>
          <img src={qrCodeUrl} alt="QR Code" style={{ width: "220px", height: "220px", borderRadius: "8px" }} />
        </div>

        <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#1e293b", marginBottom: "8px" }}>Cadastro de Visitante</h3>
        <p style={{ fontSize: "14px", color: "#94a3b8", lineHeight: "1.7", marginBottom: "36px" }}>
          Escaneie o QR Code com a câmera do celular,<br />preencha seus dados e aguarde a autorização.
        </p>

        {/* Compact steps */}
        <div style={{ display: "flex", justifyContent: "center", gap: "32px", marginBottom: "48px" }}>
          {[
            { icon: Smartphone, label: "Escaneie" },
            { icon: CheckCircle2, label: "Cadastre-se" },
            { icon: UserCheck, label: "Acesse" },
          ].map((s, i) => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ position: "relative", display: "inline-block" }}>
                <div style={{ width: 48, height: 48, borderRadius: "12px", background: "#f0f4fa", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <s.icon style={{ width: 22, height: 22, color: "#003580" }} />
                </div>
                {i < 2 && (
                  <ChevronRight style={{ width: 14, height: 14, color: "#cbd5e1", position: "absolute", right: "-24px", top: "50%", transform: "translateY(-50%)" }} />
                )}
              </div>
              <p style={{ fontSize: "11px", fontWeight: "600", color: "#64748b", marginTop: "8px" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "16px" }}>
          <p style={{ fontSize: "10px", color: "#cbd5e1", margin: 0 }}>App Interfone — Sistema de Gerenciamento de Condomínios</p>
          <p style={{ fontSize: "9px", color: "#e2e8f0", marginTop: "4px" }}>{selfRegisterUrl}</p>
        </div>
      </div>
    </div>
  );

  /* ═══ LAYOUT: PLATINUM ═══ */
  const renderPlatinum = () => (
    <div
      ref={printRef}
      className="mx-auto print:shadow-none"
      style={{ width: "210mm", minHeight: "297mm", background: "linear-gradient(180deg, #f8f9fa 0%, #ffffff 30%, #f1f3f5 100%)", boxShadow: "0 2px 8px rgba(0,0,0,0.12)", overflow: "hidden", position: "relative" }}
    >
      {/* Geometric accent top-left */}
      <div style={{ position: "absolute", top: 0, left: 0, width: "180px", height: "180px", background: "linear-gradient(135deg, rgba(100,116,139,0.08) 0%, transparent 70%)", borderBottomRightRadius: "100%" }} />
      {/* Geometric accent bottom-right */}
      <div style={{ position: "absolute", bottom: 0, right: 0, width: "220px", height: "220px", background: "linear-gradient(315deg, rgba(100,116,139,0.06) 0%, transparent 70%)", borderTopLeftRadius: "100%" }} />

      {/* Platinum top strip */}
      <div style={{ height: "5px", background: "linear-gradient(90deg, #94a3b8, #cbd5e1, #e2e8f0, #cbd5e1, #94a3b8)" }} />

      <div style={{ padding: "40px 50px", position: "relative", zIndex: 1 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "linear-gradient(135deg, #64748b, #475569)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Shield style={{ width: 22, height: 22, color: "#fff" }} />
              </div>
              <div>
                <h1 style={{ fontSize: "28px", fontWeight: "800", color: "#1e293b", margin: 0, letterSpacing: "-0.5px" }}>APP INTERFONE</h1>
                <p style={{ fontSize: "10px", letterSpacing: "4px", textTransform: "uppercase", color: "#94a3b8", margin: "2px 0 0", fontWeight: "600" }}>Platinum Access</p>
              </div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <Award style={{ width: 36, height: 36, color: "#94a3b8", opacity: 0.4 }} />
          </div>
        </div>

        {/* Divider line */}
        <div style={{ height: "1px", background: "linear-gradient(90deg, transparent, #cbd5e1, transparent)", margin: "16px 0 32px" }} />

        {/* Condo name - centered card */}
        <div style={{ textAlign: "center", margin: "0 auto 36px", maxWidth: "480px", padding: "20px 32px", background: "#fff", borderRadius: "16px", border: "1px solid #e2e8f0", boxShadow: "0 4px 20px rgba(0,0,0,0.04)" }}>
          <p style={{ fontSize: "10px", letterSpacing: "3px", textTransform: "uppercase", color: "#94a3b8", margin: "0 0 6px", fontWeight: "600" }}>Condomínio</p>
          <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#1e293b", margin: 0 }}>{condominioNome}</h2>
        </div>

        {/* QR Code - platinum frame */}
        <div style={{ textAlign: "center", marginBottom: "36px" }}>
          <div style={{ display: "inline-block", padding: "3px", borderRadius: "24px", background: "linear-gradient(135deg, #94a3b8, #cbd5e1, #94a3b8)" }}>
            <div style={{ padding: "20px", background: "#fff", borderRadius: "22px" }}>
              <img src={qrCodeUrl} alt="QR Code" style={{ width: "230px", height: "230px" }} />
            </div>
          </div>
          <p style={{ fontSize: "12px", fontWeight: "700", color: "#64748b", marginTop: "14px", letterSpacing: "2px", textTransform: "uppercase" }}>Escaneie para Acesso</p>
        </div>

        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <h3 style={{ fontSize: "20px", fontWeight: "800", color: "#1e293b", marginBottom: "8px" }}>Cadastro de Visitante</h3>
          <p style={{ fontSize: "14px", color: "#64748b", lineHeight: "1.6", maxWidth: "400px", margin: "0 auto" }}>
            Acesso rápido e seguro ao condomínio via QR Code.
          </p>
        </div>

        {/* Steps - horizontal cards with platinum accents */}
        <div style={{ display: "flex", gap: "14px", marginBottom: "36px" }}>
          {steps.map((s, i) => (
            <div key={s.n} style={{ flex: 1, background: "#fff", borderRadius: "14px", padding: "20px 16px", textAlign: "center", border: "1px solid #e2e8f0", boxShadow: "0 2px 12px rgba(0,0,0,0.03)", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: i === 0 ? "linear-gradient(90deg, #64748b, #94a3b8)" : i === 1 ? "linear-gradient(90deg, #94a3b8, #cbd5e1)" : "linear-gradient(90deg, #cbd5e1, #e2e8f0)" }} />
              <div style={{ width: 40, height: 40, borderRadius: "12px", background: "linear-gradient(135deg, #64748b, #475569)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "16px", margin: "0 auto 12px" }}>{s.n}</div>
              <p style={{ fontSize: "13px", fontWeight: "700", color: "#1e293b", margin: "0 0 4px" }}>{s.title}</p>
              <p style={{ fontSize: "11px", color: "#94a3b8", margin: 0, lineHeight: "1.4" }}>{s.desc}</p>
            </div>
          ))}
        </div>

        {/* Security badges */}
        <div style={{ display: "flex", justifyContent: "center", gap: "24px", marginBottom: "32px" }}>
          {[
            { icon: Lock, label: "Criptografia AES-256" },
            { icon: Fingerprint, label: "Autenticação Biométrica" },
            { icon: Shield, label: "Dados Protegidos" },
          ].map((b) => (
            <div key={b.label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <b.icon style={{ width: 14, height: 14, color: "#94a3b8" }} />
              <span style={{ fontSize: "10px", color: "#94a3b8", fontWeight: "600", letterSpacing: "0.5px" }}>{b.label}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "16px", textAlign: "center" }}>
          <p style={{ fontSize: "11px", color: "#94a3b8", margin: 0, fontWeight: "500" }}>App Interfone — Platinum Access Control</p>
          <p style={{ fontSize: "9px", color: "#cbd5e1", marginTop: "4px" }}>{selfRegisterUrl}</p>
        </div>
      </div>

      {/* Bottom platinum strip */}
      <div style={{ height: "5px", background: "linear-gradient(90deg, #94a3b8, #cbd5e1, #e2e8f0, #cbd5e1, #94a3b8)", marginTop: "auto" }} />
    </div>
  );

  /* ═══ LAYOUT: CORPORATE TECH ═══ */
  const renderCorpTech = () => (
    <div
      ref={printRef}
      className="mx-auto print:shadow-none"
      style={{ width: "210mm", minHeight: "297mm", background: "#0c1222", boxShadow: "0 2px 8px rgba(0,0,0,0.3)", overflow: "hidden", position: "relative", color: "#e2e8f0" }}
    >
      {/* Grid pattern overlay */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(56,189,248,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.03) 1px, transparent 1px)", backgroundSize: "40px 40px", pointerEvents: "none" }} />

      {/* Top gradient accent */}
      <div style={{ height: "4px", background: "linear-gradient(90deg, #0ea5e9, #6366f1, #a855f7, #6366f1, #0ea5e9)" }} />

      {/* Glow orb top-right */}
      <div style={{ position: "absolute", top: "-80px", right: "-80px", width: "300px", height: "300px", borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)", pointerEvents: "none" }} />
      {/* Glow orb bottom-left */}
      <div style={{ position: "absolute", bottom: "-60px", left: "-60px", width: "250px", height: "250px", borderRadius: "50%", background: "radial-gradient(circle, rgba(14,165,233,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ padding: "40px 50px", position: "relative", zIndex: 1 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "linear-gradient(135deg, #0ea5e9, #6366f1)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(99,102,241,0.3)" }}>
              <Cpu style={{ width: 24, height: 24, color: "#fff" }} />
            </div>
            <div>
              <h1 style={{ fontSize: "26px", fontWeight: "800", margin: 0, letterSpacing: "-0.3px", background: "linear-gradient(135deg, #e2e8f0, #fff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>APP INTERFONE</h1>
              <p style={{ fontSize: "10px", letterSpacing: "3px", textTransform: "uppercase", color: "#0ea5e9", margin: "2px 0 0", fontWeight: "600" }}>Smart Access Platform</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 14px", borderRadius: "20px", border: "1px solid rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.08)" }}>
            <Zap style={{ width: 14, height: 14, color: "#818cf8" }} />
            <span style={{ fontSize: "10px", fontWeight: "700", color: "#818cf8", letterSpacing: "1px", textTransform: "uppercase" }}>Tech</span>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: "1px", background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.3), transparent)", margin: "16px 0 28px" }} />

        {/* Condo name */}
        <div style={{ textAlign: "center", margin: "0 auto 32px", maxWidth: "500px", padding: "18px 28px", borderRadius: "16px", border: "1px solid rgba(99,102,241,0.2)", background: "rgba(99,102,241,0.05)", backdropFilter: "blur(10px)" }}>
          <p style={{ fontSize: "10px", letterSpacing: "3px", textTransform: "uppercase", color: "#0ea5e9", margin: "0 0 6px", fontWeight: "600" }}>Condomínio</p>
          <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#f1f5f9", margin: 0 }}>{condominioNome}</h2>
        </div>

        {/* QR Code + Info side by side */}
        <div style={{ display: "flex", gap: "36px", alignItems: "center", marginBottom: "32px" }}>
          {/* QR with glow border */}
          <div style={{ flexShrink: 0, textAlign: "center" }}>
            <div style={{ display: "inline-block", padding: "3px", borderRadius: "20px", background: "linear-gradient(135deg, #0ea5e9, #6366f1, #a855f7)" }}>
              <div style={{ padding: "18px", background: "#0c1222", borderRadius: "18px" }}>
                <div style={{ padding: "12px", background: "#fff", borderRadius: "12px" }}>
                  <img src={qrCodeUrl} alt="QR Code" style={{ width: "200px", height: "200px" }} />
                </div>
              </div>
            </div>
            <p style={{ fontSize: "11px", fontWeight: "700", color: "#0ea5e9", marginTop: "12px", letterSpacing: "2px", textTransform: "uppercase" }}>Scan to Access</p>
          </div>

          {/* Right info */}
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: "22px", fontWeight: "800", color: "#f1f5f9", marginBottom: "8px", marginTop: 0 }}>Cadastro de Visitante</h3>
            <p style={{ fontSize: "13px", color: "#94a3b8", lineHeight: "1.6", marginBottom: "24px" }}>
              Acesso inteligente e automatizado. Escaneie o QR Code para iniciar o procedimento de entrada.
            </p>

            {/* Steps */}
            {steps.map((s, i) => (
              <div key={s.n} style={{ display: "flex", gap: "12px", alignItems: "flex-start", marginBottom: "16px" }}>
                <div style={{ width: 34, height: 34, borderRadius: "10px", background: `linear-gradient(135deg, ${i === 0 ? "#0ea5e9" : i === 1 ? "#6366f1" : "#a855f7"}, ${i === 0 ? "#0284c7" : i === 1 ? "#4f46e5" : "#9333ea"})`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "14px", flexShrink: 0, boxShadow: `0 2px 12px ${i === 0 ? "rgba(14,165,233,0.3)" : i === 1 ? "rgba(99,102,241,0.3)" : "rgba(168,85,247,0.3)"}` }}>{s.n}</div>
                <div style={{ flex: 1, paddingBottom: "12px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <p style={{ fontSize: "14px", fontWeight: "700", color: "#f1f5f9", margin: 0 }}>{s.title}</p>
                  <p style={{ fontSize: "12px", color: "#64748b", margin: "3px 0 0" }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Feature cards */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "32px" }}>
          {[
            { icon: Globe, label: "100% Web", text: "Sem instalação", color: "#0ea5e9" },
            { icon: Zap, label: "< 30s", text: "Tempo de cadastro", color: "#6366f1" },
            { icon: Lock, label: "E2E", text: "Criptografia total", color: "#a855f7" },
            { icon: Smartphone, label: "Mobile", text: "Qualquer dispositivo", color: "#10b981" },
          ].map((b) => (
            <div key={b.label} style={{ flex: 1, borderRadius: "14px", padding: "16px 12px", textAlign: "center", border: `1px solid ${b.color}22`, background: `${b.color}08` }}>
              <b.icon style={{ width: 20, height: 20, color: b.color, margin: "0 auto 8px" }} />
              <p style={{ fontSize: "14px", fontWeight: "800", color: b.color, margin: "0 0 2px" }}>{b.label}</p>
              <p style={{ fontSize: "10px", color: "#64748b", margin: 0 }}>{b.text}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "16px", textAlign: "center" }}>
          <p style={{ fontSize: "11px", color: "#475569", margin: 0, fontWeight: "500" }}>App Interfone — Smart Access Platform</p>
          <p style={{ fontSize: "9px", color: "#334155", marginTop: "4px" }}>{selfRegisterUrl}</p>
        </div>
      </div>

      {/* Bottom gradient accent */}
      <div style={{ height: "4px", background: "linear-gradient(90deg, #0ea5e9, #6366f1, #a855f7, #6366f1, #0ea5e9)", marginTop: "auto" }} />
    </div>
  );

  /* ═══ LAYOUT: INSTITUCIONAL ═══ */
  const renderInstitucional = () => (
    <div
      ref={printRef}
      className="mx-auto print:shadow-none"
      style={{ width: "210mm", minHeight: "297mm", background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", overflow: "hidden", position: "relative" }}
    >
      {/* Watermark */}
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%) rotate(-30deg)", fontSize: "120px", fontWeight: "900", color: "rgba(0,53,128,0.02)", letterSpacing: "20px", textTransform: "uppercase", pointerEvents: "none", whiteSpace: "nowrap" }}>APP INTERFONE</div>

      {/* Navy top bar */}
      <div style={{ background: "#0f2847", padding: "32px 50px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {/* Seal/emblem */}
          <div style={{ width: "56px", height: "56px", borderRadius: "50%", border: "2px solid rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.05)" }}>
            <Building2 style={{ width: 28, height: 28, color: "#e2e8f0" }} />
          </div>
          <div>
            <h1 style={{ fontSize: "26px", fontWeight: "800", color: "#fff", margin: 0, letterSpacing: "1px" }}>APP INTERFONE</h1>
            <p style={{ fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", margin: "4px 0 0", fontWeight: "500" }}>Sistema Institucional de Controle de Acesso</p>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
          <div style={{ padding: "4px 12px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)" }}>
            <span style={{ fontSize: "9px", fontWeight: "700", color: "rgba(255,255,255,0.6)", letterSpacing: "2px", textTransform: "uppercase" }}>Documento Oficial</span>
          </div>
        </div>
      </div>

      {/* Gold accent line */}
      <div style={{ height: "3px", background: "linear-gradient(90deg, #b8860b, #daa520, #f4c430, #daa520, #b8860b)" }} />

      <div style={{ padding: "36px 50px", position: "relative", zIndex: 1 }}>
        {/* Condo name - formal */}
        <div style={{ textAlign: "center", marginBottom: "32px", padding: "24px", border: "2px solid #0f2847", borderRadius: "4px", position: "relative" }}>
          <div style={{ position: "absolute", top: "-10px", left: "50%", transform: "translateX(-50%)", background: "#fff", padding: "0 16px" }}>
            <span style={{ fontSize: "10px", fontWeight: "700", color: "#64748b", letterSpacing: "4px", textTransform: "uppercase" }}>Condomínio</span>
          </div>
          <h2 style={{ fontSize: "24px", fontWeight: "800", color: "#0f2847", margin: "8px 0 0" }}>{condominioNome}</h2>
        </div>

        {/* Two-column layout */}
        <div style={{ display: "flex", gap: "40px", marginBottom: "36px" }}>
          {/* Left column - QR with seal */}
          <div style={{ flexShrink: 0, textAlign: "center" }}>
            <div style={{ display: "inline-block", position: "relative" }}>
              <div style={{ padding: "20px", border: "3px solid #0f2847", borderRadius: "4px" }}>
                <img src={qrCodeUrl} alt="QR Code" style={{ width: "210px", height: "210px" }} />
              </div>
              {/* Official seal overlay */}
              <div style={{ position: "absolute", bottom: "-12px", right: "-12px", width: "52px", height: "52px", borderRadius: "50%", background: "linear-gradient(135deg, #b8860b, #daa520)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(184,134,11,0.4)", border: "3px solid #fff" }}>
                <CheckCircle2 style={{ width: 24, height: 24, color: "#fff" }} />
              </div>
            </div>
            <p style={{ fontSize: "12px", fontWeight: "700", color: "#0f2847", marginTop: "20px", letterSpacing: "1px" }}>QR CODE DE ACESSO</p>
            <p style={{ fontSize: "10px", color: "#64748b", marginTop: "2px" }}>Válido para cadastro de visitantes</p>
          </div>

          {/* Right column - Instructions */}
          <div style={{ flex: 1 }}>
            <div style={{ borderLeft: "3px solid #b8860b", paddingLeft: "20px", marginBottom: "24px" }}>
              <h3 style={{ fontSize: "20px", fontWeight: "800", color: "#0f2847", margin: "0 0 6px" }}>Procedimento de Cadastro</h3>
              <p style={{ fontSize: "13px", color: "#64748b", lineHeight: "1.6", margin: 0 }}>
                Siga o protocolo abaixo para realizar o registro de visitante conforme as normas do condomínio.
              </p>
            </div>

            {/* Steps - formal numbered */}
            {steps.map((s, i) => (
              <div key={s.n} style={{ display: "flex", gap: "16px", alignItems: "flex-start", marginBottom: "18px" }}>
                <div style={{ width: 36, height: 36, borderRadius: "4px", background: i === 0 ? "#0f2847" : "#f1f5f9", color: i === 0 ? "#daa520" : "#0f2847", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "16px", flexShrink: 0, border: i !== 0 ? "1px solid #e2e8f0" : "none" }}>{s.n}</div>
                <div style={{ flex: 1, paddingBottom: "14px", borderBottom: "1px solid #f1f5f9" }}>
                  <p style={{ fontSize: "14px", fontWeight: "700", color: "#1e293b", margin: 0 }}>{s.title}</p>
                  <p style={{ fontSize: "12px", color: "#64748b", margin: "4px 0 0" }}>{s.desc}</p>
                </div>
              </div>
            ))}

            {/* Notice box */}
            <div style={{ background: "#fefce8", border: "1px solid #fde68a", borderRadius: "8px", padding: "14px 16px", marginTop: "8px" }}>
              <p style={{ fontSize: "11px", color: "#92400e", fontWeight: "600", margin: 0 }}>⚠ IMPORTANTE: Este QR Code é de uso exclusivo para cadastro de visitantes. Não compartilhe fora das dependências do condomínio.</p>
            </div>
          </div>
        </div>

        {/* Info bar */}
        <div style={{ display: "flex", gap: "1px", background: "#e2e8f0", borderRadius: "8px", overflow: "hidden", marginBottom: "28px" }}>
          {[
            { icon: Shield, label: "Acesso Controlado", text: "Monitoramento 24h" },
            { icon: Lock, label: "Dados Seguros", text: "LGPD Compliance" },
            { icon: Globe, label: "Acesso Web", text: "Sem instalação" },
          ].map((b) => (
            <div key={b.label} style={{ flex: 1, background: "#f8fafc", padding: "14px 16px", textAlign: "center" }}>
              <b.icon style={{ width: 18, height: 18, color: "#0f2847", margin: "0 auto 6px" }} />
              <p style={{ fontSize: "11px", fontWeight: "700", color: "#0f2847", margin: "0 0 2px" }}>{b.label}</p>
              <p style={{ fontSize: "9px", color: "#94a3b8", margin: 0 }}>{b.text}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ borderTop: "2px solid #0f2847", paddingTop: "14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ fontSize: "11px", color: "#0f2847", margin: 0, fontWeight: "700" }}>App Interfone</p>
            <p style={{ fontSize: "9px", color: "#94a3b8", marginTop: "2px" }}>Sistema Institucional de Gerenciamento de Condomínios</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: "9px", color: "#94a3b8", margin: 0 }}>{selfRegisterUrl}</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderLayout = () => {
    switch (layout) {
      case "executivo": return renderExecutivo();
      case "elegante": return renderElegante();
      case "minimal": return renderMinimal();
      case "platinum": return renderPlatinum();
      case "corptech": return renderCorpTech();
      case "institucional": return renderInstitucional();
      default: return renderClassico();
    }
  };

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: p.pageBg }}>
      {/* Header */}
      <header className="sticky top-0 z-40 print:hidden" style={{ background: p.headerBg, borderBottom: p.headerBorder, boxShadow: p.headerShadow, color: p.text }}>
        <div style={{ padding: "0 24px", height: "4.5rem", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => navigate(-1)} style={{ width: 40, height: 40, borderRadius: 12, background: p.btnBg, border: p.btnBorder, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <QrCode className="w-5 h-5" />
          <span style={{ fontWeight: 700, fontSize: 16 }}>QR Code para Impressão</span>
        </div>
      </header>

      {/* Controls */}
      <div className="print:hidden" style={{ padding: "16px 1cm" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5cm" }}>
          {/* Condo name */}
          <div>
            <label className="text-sm font-medium mb-1 block" style={{ color: p.text }}>Nome do Condomínio</label>
            <input
              value={condominioNome}
              onChange={(e) => setCondominioNome(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm text-foreground focus:outline-none focus:ring-2"
              style={{ boxShadow: "0 0 0 2px rgba(0,53,128,0.15)" }}
            />
          </div>

          {/* Layout selector */}
          <div>
            <label className="text-sm font-medium mb-2 flex items-center gap-1.5" style={{ color: p.text }}>
              <Layout className="w-4 h-4" style={{ color: p.text }} /> Modelo de Layout
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", maxHeight: "340px", overflowY: "auto", paddingRight: "4px" }}>
              {LAYOUTS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setLayout(l.id)}
                  style={{
                    padding: "12px 14px",
                    borderRadius: "12px",
                    border: layout === l.id ? "2px solid #003580" : "2px solid #e2e8f0",
                    background: layout === l.id ? "#edf2fa" : "#fff",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  <p style={{ fontSize: "13px", fontWeight: "700", color: layout === l.id ? "#003580" : "#1e293b", margin: 0 }}>{l.name}</p>
                  <p style={{ fontSize: "11px", color: "#94a3b8", margin: "4px 0 0", lineHeight: "1.3" }}>{l.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Print button */}
          <button
            onClick={handlePrint}
            className="w-full h-12 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)", border: isDark ? "2px solid rgba(255,255,255,0.5)" : "2px solid #cbd5e1" }}
          >
            <Printer className="w-5 h-5" />
            Imprimir A4
          </button>
        </div>
      </div>

      {/* Printable area — renders selected layout */}
      <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
        {renderLayout()}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print\\:hidden { display: none !important; }
          [ref] { visibility: visible; }
          header, .print\\:hidden { display: none !important; }
          @page { margin: 0; size: A4; }
        }
      `}</style>
    </div>
  );
}
