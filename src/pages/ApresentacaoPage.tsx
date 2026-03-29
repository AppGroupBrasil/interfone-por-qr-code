import { useNavigate } from "react-router-dom";
import {
  Shield, UserPlus, Car, Package, Truck, BookOpen, DoorOpen, Camera,
  ShieldCheck, Users, Building2, Check, Star,
  ArrowLeft, Phone, Eye, Fingerprint,
  QrCode, Printer, Copy, MessageCircle, Share2,
  Monitor, Route, ScanLine, BarChart3, Cog,
  Cpu, Globe, Wifi, Signal, Wrench,
} from "lucide-react";
import { useState } from "react";
import { BRANDS, INTEGRATION_LABELS } from "@/lib/deviceLibrary";

const WHATSAPP_NUMBER = "5511933284364";
const SITE_URL = "https://www.appinterfone.com.br";

/* ─── Profile badge config ─── */
const PROFILES = {
  portaria: { label: "Portaria", icon: Shield, color: "#2563eb", bg: "#2563eb" },
  morador:  { label: "Morador",  icon: Users,  color: "#059669", bg: "#059669" },
  sindico:  { label: "Síndico",  icon: Building2, color: "#7c3aed", bg: "#7c3aed" },
} as const;
type ProfileKey = keyof typeof PROFILES;

/* ─── Feature data ─── */
const allFeatures = [
  { icon: UserPlus, title: "Cadastro de Visitantes", desc: "Registre visitantes com foto, documento e reconhecimento facial. QR Code de acesso enviado por WhatsApp.", profiles: ["portaria"] as ProfileKey[] },
  { icon: ShieldCheck, title: "Autorizações Prévias", desc: "Moradores pré-autorizam visitantes pelo app. Porteiro já sabe quem pode entrar antes de chegar.", profiles: ["portaria", "morador"] as ProfileKey[] },
  { icon: Car, title: "Controle de Veículos", desc: "Cadastro com leitura automática de placas (OCR). Entrada e saída registradas. Morador acompanha pelo app.", profiles: ["portaria", "morador"] as ProfileKey[] },
  { icon: Package, title: "Correspondências", desc: "Registro de encomendas com foto. Morador recebe aviso no WhatsApp na hora. Controle de retirada.", profiles: ["portaria", "morador"] as ProfileKey[] },
  { icon: Truck, title: "Delivery", desc: "Morador avisa que espera delivery. Porteiro já tem o código. Notificação automática quando chegar.", profiles: ["portaria", "morador"] as ProfileKey[] },
  { icon: Phone, title: "Interfone Digital", desc: "QR Code por bloco. Visitante escaneia e liga direto pro morador com vídeo. 3 níveis de segurança configuráveis.", profiles: ["portaria", "morador", "sindico"] as ProfileKey[] },
  { icon: DoorOpen, title: "Portaria Virtual (IoT)", desc: "Abra portões e portas dos blocos pelo app com ESP32 + relé. Multi-portão. Sem fio. Instalação simples.", profiles: ["portaria", "morador", "sindico"] as ProfileKey[], badge: "+R$200/mês" },
  { icon: BookOpen, title: "Livro de Protocolo", desc: "Registro digital com assinatura na tela. Gera PDF oficial. Síndico e administradora acompanham em tempo real.", profiles: ["portaria"] as ProfileKey[] },
  { icon: Camera, title: "Espelho de Portaria", desc: "Monitore tudo que acontece na portaria em tempo real, de qualquer lugar. Visão completa para o síndico.", profiles: ["portaria", "sindico"] as ProfileKey[] },
  { icon: Monitor, title: "Monitoramento de Câmeras", desc: "Câmeras RTSP em tempo real. Grade multi-câmera com snapshot automático. Configure pelo painel do síndico.", profiles: ["portaria", "sindico"] as ProfileKey[] },
  { icon: Route, title: "Controle de Rondas", desc: "Rondas com checkpoints QR Code, registro fotográfico e geolocalização. Relatório automático para o síndico.", profiles: ["portaria", "sindico"] as ProfileKey[] },
  { icon: ScanLine, title: "QR Scanner de Visitantes", desc: "Leia o QR Code do visitante e valide a autorização instantaneamente. Rápido, seguro e sem papel.", profiles: ["portaria"] as ProfileKey[] },
  { icon: Building2, title: "Gestão de Condomínio", desc: "Cadastre blocos, moradores e funcionários. Multi-perfil e multi-condomínio. Tudo centralizado.", profiles: ["sindico"] as ProfileKey[] },
  { icon: BarChart3, title: "Relatórios e Dashboards", desc: "Relatórios em PDF + dashboards visuais com gráficos de visitantes, veículos, rondas e correspondências.", profiles: ["sindico"] as ProfileKey[] },
  { icon: Cog, title: "Configuração de Features", desc: "Ative ou desative funcionalidades por condomínio. Personalize o sistema conforme a necessidade.", profiles: ["sindico"] as ProfileKey[] },
  { icon: Eye, title: "Leitura de Placa Veicular por Câmera IP", desc: "Câmera IP lê a placa automaticamente na entrada e saída. Identifica veículos cadastrados e libera acesso sem interação manual. Pelo celular já incluso no plano.", profiles: ["portaria", "sindico"] as ProfileKey[], badge: "+R$200/mês" },
  { icon: Fingerprint, title: "Biometria Facial por Câmera IP", desc: "Reconhecimento facial via câmera IP na entrada do condomínio. Identificação automática sem contato. Pelo celular já incluso no plano.", profiles: ["portaria", "sindico"] as ProfileKey[], badge: "+R$200/mês" },
];

const planFeatures = [
  "Cadastro de Visitantes com QR Code", "Autorizações Prévias", "Controle de Veículos + OCR",
  "Correspondências com Notificação", "Delivery", "Interfone Digital com QR Code",
  "Livro de Protocolo Digital", "Espelho de Portaria",
  "Monitoramento de Câmeras (CFTV)", "Controle de Rondas", "Relatórios em PDF e Gráficos",
  "Configuração de Features", "App do Morador completo", "Multi-perfil (5 níveis)",
  "Integração com WhatsApp", "Suporte por WhatsApp",
];

const plans = [
  { name: "Plano", subtitle: "Até 199 unidades", price: "199" },
  { name: "Plano", subtitle: "200 a 300 unidades", price: "249" },
  { name: "Plano", subtitle: "Acima de 300 unidades", price: "299" },
];

const addons = [
  { icon: DoorOpen, title: "Portaria Virtual (IoT)", price: "R$200" },
  { icon: Eye, title: "Leitura de Placa por Câmera IP", price: "R$200" },
  { icon: Fingerprint, title: "Biometria Facial por Câmera IP", price: "R$200" },
];

const faqs = [
  { q: "Preciso instalar algo no celular?", a: "Não! O sistema funciona 100% no navegador — basta acessar o link. Funciona em qualquer celular, tablet ou computador." },
  { q: "Quanto tempo leva para implantar?", a: "O cadastro leva 5 minutos. Os moradores se cadastram via link ou QR Code. Em 24h o condomínio já está operando." },
  { q: "A Portaria Virtual precisa de obra?", a: "Não. O módulo IoT usa ESP32 + relé, instalação simples sem fio. Funciona com qualquer portão elétrico." },
  { q: "Posso cancelar quando quiser?", a: "Sim, sem fidelidade e sem multa. Cancele a qualquer momento pelo painel." },
  { q: "Preciso de uma função específica?", a: "Desenvolvemos para você sem nenhum custo adicional! Fale conosco pelo WhatsApp." },
];

export default function ApresentacaoPage() {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(SITE_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(`Conheça o App Interfone — Interfone Digital para Condomínios!\n\n${SITE_URL}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  // Shared styles
  const sectionTitle: React.CSSProperties = { fontSize: "28px", fontWeight: 900, color: "#003580", marginBottom: "8px" };
  const sectionSub: React.CSSProperties = { fontSize: "15px", color: "#336699", lineHeight: 1.7, maxWidth: "600px", margin: "0 auto 32px" };
  const sectionWrap: React.CSSProperties = { maxWidth: "1000px", margin: "0 auto", padding: "48px 32px" };
  const divider: React.CSSProperties = { borderTop: "2px solid #e2e8f0", margin: "0" };

  return (
    <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", background: "#ffffff", color: "#1e293b" }}>

      {/* ─── Print-friendly styles ─── */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          section, .print-section { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      {/* ═══ TOP ACTION BAR ═══ */}
      <div className="no-print" style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "#ffffff", borderBottom: "1px solid #e2e8f0",
        padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: "12px",
      }}>
        <button onClick={() => navigate(-1)} style={{
          display: "flex", alignItems: "center", gap: "8px",
          background: "transparent", border: "none", color: "#003580",
          fontWeight: 700, fontSize: "15px", cursor: "pointer",
        }}>
          <ArrowLeft style={{ width: "18px", height: "18px" }} /> Voltar
        </button>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button onClick={() => window.print()} style={{
            display: "flex", alignItems: "center", gap: "6px",
            padding: "10px 20px", borderRadius: "10px",
            background: "linear-gradient(135deg, #0062d1, #003580)", border: "none",
            color: "#ffffff", fontWeight: 700, fontSize: "14px", cursor: "pointer",
          }}>
            <Printer style={{ width: "16px", height: "16px" }} /> Imprimir / PDF
          </button>
          <button onClick={handleCopy} style={{
            display: "flex", alignItems: "center", gap: "6px",
            padding: "10px 20px", borderRadius: "10px",
            background: copied ? "#10b981" : "#f8fafc", border: "1px solid #e2e8f0",
            color: copied ? "#ffffff" : "#003580", fontWeight: 700, fontSize: "14px", cursor: "pointer",
          }}>
            <Copy style={{ width: "16px", height: "16px" }} /> {copied ? "Copiado!" : "Copiar Link"}
          </button>
          <button onClick={handleWhatsApp} style={{
            display: "flex", alignItems: "center", gap: "6px",
            padding: "10px 20px", borderRadius: "10px",
            background: "#25D366", border: "none",
            color: "#ffffff", fontWeight: 700, fontSize: "14px", cursor: "pointer",
          }}>
            <MessageCircle style={{ width: "16px", height: "16px" }} /> WhatsApp
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════
          CAPA / HEADER
      ═══════════════════════════════════ */}
      <section style={{
        background: "linear-gradient(135deg, #001533 0%, #002a66 40%, #003580 70%, #004aad 100%)",
        padding: "80px 32px", textAlign: "center", color: "#ffffff",
      }}>
        <img src="/logo.png" alt="App Interfone" style={{ width: "100px", height: "100px", borderRadius: "20px", marginBottom: "24px", objectFit: "cover", border: "3px solid #ffffff" }} />
        <h1 style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 900, lineHeight: 1.15, marginBottom: "16px" }}>
          App Interfone<br />Interfone Digital para o seu Condomínio
        </h1>
        <p style={{ fontSize: "17px", color: "rgba(255,255,255,0.8)", maxWidth: "600px", margin: "0 auto 32px", lineHeight: 1.7 }}>
          Visitantes, veículos, correspondências, delivery, protocolo digital e portaria virtual — tudo em um só sistema.
          <strong style={{ color: "#ffffff" }}> Funciona no celular, tablet e computador.</strong>
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          {[
            { icon: Fingerprint, label: "Biometria Facial" },
            { icon: DoorOpen, label: "Portaria Virtual (IoT)" },
            { icon: MessageCircle, label: "Integrado ao WhatsApp" },
          ].map((b) => (
            <div key={b.label} style={{
              display: "flex", alignItems: "center", gap: "8px",
              border: "1.5px solid rgba(255,255,255,0.5)", borderRadius: "10px",
              padding: "10px 20px", fontSize: "14px", fontWeight: 600, color: "#ffffff",
            }}>
              <b.icon style={{ width: "18px", height: "18px" }} /> {b.label}
            </div>
          ))}
        </div>
        <p style={{ marginTop: "24px", fontSize: "14px", color: "rgba(255,255,255,0.5)" }}>www.appinterfone.com.br</p>
      </section>

      {/* ═══════════════════════════════════
          FUNCIONALIDADES
      ═══════════════════════════════════ */}
      <section style={sectionWrap}>
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <h2 style={sectionTitle}>Funcionalidades Completas</h2>
          <p style={sectionSub}>Cada funcionalidade atende portaria, morador e síndico. Veja quem usa cada recurso.</p>
          <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
            {(["portaria", "morador", "sindico"] as ProfileKey[]).map((k) => {
              const pr = PROFILES[k]; const PrIcon = pr.icon;
              return (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: "6px", background: pr.bg, padding: "5px 12px", borderRadius: "999px" }}>
                  <PrIcon style={{ width: "13px", height: "13px", color: "#fff" }} />
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#fff" }}>{pr.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
          {allFeatures.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="print-section" style={{
                border: "1.5px solid #e2e8f0", borderRadius: "14px", padding: "22px",
                display: "flex", flexDirection: "column", position: "relative",
              }}>
                {f.badge && (
                  <span style={{
                    position: "absolute", top: "10px", right: "10px",
                    border: "1.5px solid #003580", color: "#003580", fontSize: "11px",
                    fontWeight: 700, padding: "2px 8px", borderRadius: "999px",
                  }}>
                    {f.badge}
                  </span>
                )}
                <div style={{
                  width: "40px", height: "40px", borderRadius: "10px",
                  background: "rgba(0,53,128,0.08)", display: "flex", alignItems: "center",
                  justifyContent: "center", marginBottom: "12px",
                }}>
                  <Icon style={{ width: "20px", height: "20px", color: "#003580" }} />
                </div>
                <h3 style={{ fontWeight: 700, fontSize: "15px", color: "#003580", marginBottom: "6px" }}>{f.title}</h3>
                <p style={{ fontSize: "13px", color: "#475569", lineHeight: 1.6, flex: 1 }}>{f.desc}</p>
                <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", marginTop: "12px", paddingTop: "10px", borderTop: "1px solid #f1f5f9" }}>
                  {f.profiles.map((pk) => {
                    const pr = PROFILES[pk]; const PrIcon = pr.icon;
                    return (
                      <div key={pk} style={{ display: "flex", alignItems: "center", gap: "4px", background: pr.bg, padding: "3px 8px", borderRadius: "999px" }}>
                        <PrIcon style={{ width: "11px", height: "11px", color: "#fff" }} />
                        <span style={{ fontSize: "10px", fontWeight: 700, color: "#fff" }}>{pr.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* ─── SEJA NOSSO SÓCIO ─── */}
        <div style={{
          marginTop: "48px", padding: "40px 28px", borderRadius: "18px",
          background: "#f8fafc", border: "1.5px solid #e2e8f0",
          textAlign: "center",
        }}>
          <h3 style={{
            fontSize: "22px", fontWeight: 900,
            color: "#003580", marginBottom: "20px", lineHeight: 1.3,
          }}>
            Gostou dos nossos sistemas?<br />
            <span style={{ color: "#25D366" }}>Seja nosso sócio</span> e tenha ganhos de até <span style={{ color: "#25D366" }}>50%</span> em recorrência.
          </h3>

          <div style={{
            display: "flex", gap: "16px", justifyContent: "center",
            flexWrap: "wrap", marginBottom: "24px",
          }}>
            {[
              { emoji: "🚀", text: "1 Aplicativo novo lançado todo mês*" },
              { emoji: "🎨", text: "1 Aplicativo 100% customizado ao seu gosto" },
              { emoji: "♾️", text: "Recorrência por toda vida" },
            ].map((item) => (
              <div key={item.text} style={{
                display: "flex", alignItems: "center", gap: "8px",
                background: "#ffffff", border: "1.5px solid #e2e8f0",
                borderRadius: "12px", padding: "14px 20px",
                fontSize: "14px", fontWeight: 600, color: "#003580",
              }}>
                <span style={{ fontSize: "20px" }}>{item.emoji}</span>
                {item.text}
              </div>
            ))}
          </div>

          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Olá! Gostaria de saber mais sobre a parceria e ser sócio do App Interfone.")}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: "10px",
              background: "#25D366", color: "#ffffff",
              padding: "14px 32px", borderRadius: "12px",
              fontSize: "16px", fontWeight: 800,
              textDecoration: "none", cursor: "pointer",
              boxShadow: "0 4px 20px rgba(37,211,102,0.4)",
            }}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Entre em contato e saiba mais
          </a>
        </div>
      </section>

      <hr style={divider} />

      {/* ═══════════════════════════════════
          INTEGRAÇÕES
      ═══════════════════════════════════ */}
      <section style={sectionWrap}>
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <h2 style={sectionTitle}>Biblioteca de Integrações IoT</h2>
          <p style={sectionSub}>Conecte portões, fechaduras e acessos com dispositivos de diversas marcas.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
          {BRANDS.map((brand) => {
            const diffColor = brand.difficulty <= 3 ? "#10b981" : brand.difficulty <= 5 ? "#f59e0b" : brand.difficulty <= 7 ? "#f97316" : "#ef4444";
            const diffLabel = brand.difficulty <= 3 ? "Fácil" : brand.difficulty <= 5 ? "Moderado" : brand.difficulty <= 7 ? "Avançado" : "Expert";
            const IntegIcon = brand.integrationType === "cloud" ? Globe : brand.integrationType === "local" ? Wifi : Signal;
            return (
              <div key={brand.id} className="print-section" style={{
                border: "1.5px solid #e2e8f0", borderRadius: "14px", padding: "20px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(0,53,128,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Cpu style={{ width: "18px", height: "18px", color: "#003580" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontWeight: 700, fontSize: "15px", color: "#003580", margin: 0 }}>{brand.name}</h3>
                    <span style={{ fontSize: "11px", color: "#64748b" }}>{brand.country}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", background: "#f8fafc", padding: "3px 8px", borderRadius: "999px", fontSize: "11px", color: "#64748b", fontWeight: 600 }}>
                    <IntegIcon style={{ width: "12px", height: "12px" }} />
                    {INTEGRATION_LABELS[brand.integrationType].split(" ")[0]}
                  </div>
                </div>
                <p style={{ fontSize: "13px", color: "#475569", lineHeight: 1.6, marginBottom: "12px" }}>{brand.description}</p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#64748b", display: "flex", alignItems: "center", gap: "4px" }}>
                    <Wrench style={{ width: "12px", height: "12px" }} /> Dificuldade
                  </span>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: diffColor }}>{brand.difficulty}/10 — {diffLabel}</span>
                </div>
                <div style={{ width: "100%", height: "5px", borderRadius: "999px", background: "#f1f5f9", overflow: "hidden", marginTop: "6px" }}>
                  <div style={{ width: `${brand.difficulty * 10}%`, height: "100%", borderRadius: "999px", background: diffColor }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <hr style={divider} />

      {/* ═══════════════════════════════════
          PLANOS E PREÇOS
      ═══════════════════════════════════ */}
      <section style={sectionWrap}>
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <h2 style={sectionTitle}>Planos e Preços</h2>
          <p style={sectionSub}>Teste grátis por 7 dias. Sem taxa de implantação. Sem fidelidade. Cancele quando quiser.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px", maxWidth: "960px", margin: "0 auto" }}>
          {plans.map((plan) => (
            <div key={`${plan.name}-${plan.price}`} className="print-section" style={{
              border: "2px solid #003580", borderRadius: "16px", padding: "28px 24px",
            }}>
              <h3 style={{ fontWeight: 800, fontSize: "18px", color: "#003580", marginBottom: "2px" }}>{plan.name}</h3>
              <p style={{ fontSize: "13px", color: "#336699", marginBottom: "16px" }}>{plan.subtitle}</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginBottom: "20px" }}>
                <span style={{ fontSize: "14px", color: "#003580" }}>R$</span>
                <span style={{ fontSize: "44px", fontWeight: 900, color: "#003580", lineHeight: 1 }}>{plan.price}</span>
                <span style={{ fontSize: "14px", color: "#003580" }}>/mês</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {planFeatures.map((f) => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#003580" }}>
                    <Check style={{ width: "15px", height: "15px", color: "#10b981", flexShrink: 0 }} /> {f}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Addons */}
        <div style={{ maxWidth: "700px", margin: "32px auto 0", display: "flex", flexDirection: "column", gap: "12px" }}>
          <h3 style={{ textAlign: "center", fontWeight: 800, fontSize: "18px", color: "#003580", marginBottom: "8px" }}>Módulos Adicionais</h3>
          {addons.map((a, i) => (
            <div key={i} className="print-section" style={{
              display: "flex", alignItems: "center", gap: "16px", padding: "16px 20px",
              border: "2px solid #003580", borderRadius: "12px",
            }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(0,53,128,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <a.icon style={{ width: "20px", height: "20px", color: "#003580" }} />
              </div>
              <span style={{ flex: 1, fontWeight: 700, fontSize: "15px", color: "#003580" }}>{a.title}</span>
              <span style={{ fontWeight: 900, fontSize: "20px", color: "#003580" }}>+{a.price}<span style={{ fontSize: "13px", fontWeight: 600 }}>/mês</span></span>
            </div>
          ))}
        </div>
      </section>

      <hr style={divider} />

      {/* ═══════════════════════════════════
          FAQ (todas abertas)
      ═══════════════════════════════════ */}
      <section style={sectionWrap}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h2 style={sectionTitle}>Perguntas Frequentes</h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "700px", margin: "0 auto" }}>
          {faqs.map((faq, i) => (
            <div key={i} className="print-section" style={{ border: "1.5px solid #e2e8f0", borderRadius: "12px", overflow: "hidden" }}>
              <div style={{ background: "#f8fafc", padding: "14px 18px", fontWeight: 700, fontSize: "15px", color: "#003580" }}>
                {faq.q}
              </div>
              <div style={{ padding: "14px 18px", fontSize: "14px", color: "#475569", lineHeight: 1.7 }}>
                {faq.a}
              </div>
            </div>
          ))}
        </div>
      </section>

      <hr style={divider} />

      {/* ═══════════════════════════════════
          CONTATO / RODAPÉ
      ═══════════════════════════════════ */}
      <section style={{
        background: "linear-gradient(135deg, #001533 0%, #002a66 40%, #003580 70%, #004aad 100%)",
        padding: "48px 32px", textAlign: "center", color: "#ffffff",
      }}>
        <h2 style={{ fontWeight: 900, fontSize: "24px", marginBottom: "12px" }}>Entre em contato</h2>
        <p style={{ fontSize: "15px", color: "rgba(255,255,255,0.8)", marginBottom: "24px" }}>
          Teste grátis por 7 dias. Fale conosco e transforme a portaria do seu condomínio.
        </p>
        <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap", marginBottom: "32px" }}>
          <div style={{ border: "1.5px solid rgba(255,255,255,0.4)", borderRadius: "10px", padding: "12px 24px", fontSize: "15px", fontWeight: 600 }}>
            📱 (11) 93328-4364
          </div>
          <div style={{ border: "1.5px solid rgba(255,255,255,0.4)", borderRadius: "10px", padding: "12px 24px", fontSize: "15px", fontWeight: 600 }}>
            🌐 www.appinterfone.com.br
          </div>
        </div>
        <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>© 2026 App Interfone — APP GROUP LTDA-ME</p>
      </section>

      {/* ═══ BOTTOM ACTION BAR ═══ */}
      <div className="no-print" style={{
        position: "sticky", bottom: 0, zIndex: 100,
        background: "#ffffff", borderTop: "1px solid #e2e8f0",
        padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "center",
        gap: "10px", flexWrap: "wrap",
      }}>
        <button onClick={() => window.print()} style={{
          display: "flex", alignItems: "center", gap: "6px",
          padding: "12px 24px", borderRadius: "10px",
          background: "linear-gradient(135deg, #0062d1, #003580)", border: "none",
          color: "#ffffff", fontWeight: 700, fontSize: "14px", cursor: "pointer",
        }}>
          <Printer style={{ width: "16px", height: "16px" }} /> Imprimir / Salvar PDF
        </button>
        <button onClick={handleCopy} style={{
          display: "flex", alignItems: "center", gap: "6px",
          padding: "12px 24px", borderRadius: "10px",
          background: copied ? "#10b981" : "#f8fafc", border: "1px solid #e2e8f0",
          color: copied ? "#ffffff" : "#003580", fontWeight: 700, fontSize: "14px", cursor: "pointer",
        }}>
          <Share2 style={{ width: "16px", height: "16px" }} /> {copied ? "Link Copiado!" : "Compartilhar Link"}
        </button>
        <button onClick={handleWhatsApp} style={{
          display: "flex", alignItems: "center", gap: "6px",
          padding: "12px 24px", borderRadius: "10px",
          background: "#25D366", border: "none",
          color: "#ffffff", fontWeight: 700, fontSize: "14px", cursor: "pointer",
        }}>
          <MessageCircle style={{ width: "16px", height: "16px" }} /> Enviar via WhatsApp
        </button>
      </div>
    </div>
  );
}
