import { useNavigate } from "react-router-dom";
import { ArrowLeft, Printer, Share2, FileText, Copy, MessageCircle, ArrowRight, Check } from "lucide-react";
import { useState } from "react";

const WHATSAPP_NUMBER = "5511933284364";

const PLANS = [
  { id: "plan199", label: "Até 199 unidades", price: 199 },
  { id: "plan249", label: "200 a 300 unidades", price: 249 },
  { id: "plan299", label: "Acima de 300 unidades", price: 299 },
];

const ADDONS = [
  { id: "iot", label: "Portaria Virtual (IoT)", desc: "Abertura de portões pelo app com ESP32 + relé", price: 200 },
  { id: "placa", label: "Leitura de Placa por Câmera IP", desc: "Câmera IP lê a placa na entrada e saída", price: 200 },
  { id: "bio", label: "Biometria Facial por Câmera IP", desc: "Reconhecimento facial via câmera IP", price: 200 },
];

const INPUT_STYLE: React.CSSProperties = {
  border: "none", borderBottom: "2px solid #003580", background: "transparent",
  padding: "4px 2px", fontSize: "15px", color: "#003580", fontWeight: 600,
  outline: "none", width: "100%", fontFamily: "inherit",
};

const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

function today() {
  const d = new Date();
  return { dia: String(d.getDate()).padStart(2, "0"), mes: MESES[d.getMonth()], ano: String(d.getFullYear()) };
}

function FieldRow({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || label}
        style={INPUT_STYLE}
      />
    </div>
  );
}

function SignatureBlock({ label, name, detail }: { label: string; name: string; detail: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ borderBottom: "2px solid #1e293b", marginBottom: "8px", paddingBottom: "48px" }} />
      <p style={{ fontWeight: 800, fontSize: "14px", color: "#003580", marginBottom: "2px" }}>{label}</p>
      <p style={{ fontSize: "14px", color: "#1e293b", fontWeight: 600 }}>{name}</p>
      <p style={{ fontSize: "13px", color: "#64748b" }}>{detail}</p>
    </div>
  );
}

export default function ContratoPage() {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  /* ─── Form state ─── */
  const [condo, setCondo] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [endereco, setEndereco] = useState("");
  const [numero, setNumero] = useState("");
  const [bairro, setBairro] = useState("");
  const [cep, setCep] = useState("");
  const [cidadeUf, setCidadeUf] = useState("");
  const [sindico, setSindico] = useState("");
  const [cpfSindico, setCpfSindico] = useState("");
  const [diaVenc, setDiaVenc] = useState("10");

  /* ─── Plan / Addon selection ─── */
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<Record<string, boolean>>({});

  const toggleAddon = (id: string) => setSelectedAddons(p => ({ ...p, [id]: !p[id] }));

  /* ─── Date ─── */
  const dt = today();
  const [dataInicio, setDataInicio] = useState(`${dt.dia}/${String(new Date().getMonth()+1).padStart(2,"0")}/${dt.ano}`);

  /* ─── Computed values ─── */
  const planObj = PLANS.find(p => p.id === selectedPlan);
  const planValue = planObj?.price ?? 0;
  const addonsValue = ADDONS.filter(a => selectedAddons[a.id]).reduce((s, a) => s + a.price, 0);
  const totalMensal = planValue + addonsValue;

  const handlePrint = () => window.print();

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent("Confira o modelo de contrato do App Interfone: " + window.location.href);
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${text}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", background: "#f8fafc", minHeight: "100vh" }}>

      {/* ═══ Print-only styles ═══ */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          .contract-container { box-shadow: none !important; border: none !important; max-width: 100% !important; }
        }
      `}</style>

      {/* ═══ Top Bar ═══ */}
      <div className="no-print" style={{
        background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)",
        padding: "16px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px",
      }}>
        <button
          onClick={() => navigate("/")}
          style={{
            display: "flex", alignItems: "center", gap: "8px",
            background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.3)",
            borderRadius: "10px", padding: "8px 16px", color: "#fff",
            fontWeight: 600, fontSize: "14px", cursor: "pointer",
          }}
        >
          <ArrowLeft style={{ width: "16px", height: "16px" }} /> Voltar
        </button>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button onClick={handlePrint} style={{
            display: "flex", alignItems: "center", gap: "6px",
            background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.3)",
            borderRadius: "10px", padding: "8px 16px", color: "#fff",
            fontWeight: 600, fontSize: "14px", cursor: "pointer",
          }}>
            <Printer style={{ width: "16px", height: "16px" }} /> Imprimir / PDF
          </button>
          <button onClick={handleCopyLink} style={{
            display: "flex", alignItems: "center", gap: "6px",
            background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.3)",
            borderRadius: "10px", padding: "8px 16px", color: "#fff",
            fontWeight: 600, fontSize: "14px", cursor: "pointer",
          }}>
            <Copy style={{ width: "16px", height: "16px" }} /> {copied ? "Copiado!" : "Copiar Link"}
          </button>
          <button onClick={handleShareWhatsApp} style={{
            display: "flex", alignItems: "center", gap: "6px",
            background: "#25D366", border: "none",
            borderRadius: "10px", padding: "8px 16px", color: "#fff",
            fontWeight: 600, fontSize: "14px", cursor: "pointer",
          }}>
            <MessageCircle style={{ width: "16px", height: "16px" }} /> WhatsApp
          </button>
        </div>
      </div>

      {/* ═══ Contract Content ═══ */}
      <div className="contract-container" style={{
        maxWidth: "900px", margin: "40px auto", padding: "60px 48px",
        background: "#ffffff", borderRadius: "16px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
        border: "1px solid rgba(0,53,128,0.1)",
        lineHeight: 1.8, color: "#1e293b", fontSize: "15px",
      }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "48px", borderBottom: "3px solid #003580", paddingBottom: "32px" }}>
          <div style={{
            width: "64px", height: "64px", borderRadius: "16px",
            background: "linear-gradient(135deg, #0062d1, #001d4a)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
          }}>
            <FileText style={{ width: "32px", height: "32px", color: "#fff" }} />
          </div>
          <h1 style={{ fontSize: "28px", fontWeight: 900, color: "#003580", marginBottom: "8px", letterSpacing: "-0.5px" }}>
            CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE SOFTWARE
          </h1>
          <p style={{ fontSize: "14px", color: "#64748b" }}>
            Modelo de Contrato — App Interfone
          </p>
        </div>

        {/* Cláusula 1 */}
        <Section n="1" title="DAS PARTES">
          <p><strong>CONTRATADA:</strong></p>
          <p>
            <strong>APP GROUP LTDA - ME</strong> (Nome Fantasia: APP GROUP), pessoa jurídica de direito privado,
            inscrita no CNPJ sob nº <strong>51.797.070/0001-53</strong>, com sede na
            Av. Paulista, 1106, Sala 01, Bairro Bela Vista, CEP 01310-914,
            São Paulo/SP, neste ato representada por seu representante legal,
            doravante denominada simplesmente <strong>CONTRATADA</strong>.
          </p>
          <p style={{ marginTop: "16px" }}><strong>CONTRATANTE:</strong></p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
            <FieldRow label="Condomínio / Razão Social" value={condo} onChange={setCondo} />
            <FieldRow label="CNPJ" value={cnpj} onChange={setCnpj} placeholder="00.000.000/0000-00" />
            <FieldRow label="Endereço" value={endereco} onChange={setEndereco} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <FieldRow label="Nº" value={numero} onChange={setNumero} />
              <FieldRow label="Bairro" value={bairro} onChange={setBairro} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <FieldRow label="CEP" value={cep} onChange={setCep} placeholder="00000-000" />
              <FieldRow label="Cidade / UF" value={cidadeUf} onChange={setCidadeUf} />
            </div>
            <FieldRow label="Síndico(a) / Representante Legal" value={sindico} onChange={setSindico} />
            <FieldRow label="CPF do Representante" value={cpfSindico} onChange={setCpfSindico} placeholder="000.000.000-00" />
          </div>
          <p style={{ marginTop: "12px" }}>
            Doravante denominado(a) simplesmente <strong>CONTRATANTE</strong>.
          </p>
        </Section>

        {/* Cláusula 2 */}
        <Section n="2" title="DO OBJETO">
          <p>
            O presente contrato tem por objeto a prestação de serviços de licenciamento,
            hospedagem e manutenção do sistema de gestão condominial <strong>"App Interfone"</strong>,
            plataforma digital (SaaS — Software as a Service) acessível via navegador web e
            dispositivos móveis, compreendendo:
          </p>
          <ul style={{ paddingLeft: "24px", marginTop: "12px" }}>
            <li>Cadastro de Visitantes com QR Code</li>
            <li>Autorizações Prévias de Visitantes</li>
            <li>Controle de Veículos com OCR (leitura de placa)</li>
            <li>Correspondências com Notificação Push</li>
            <li>Gestão de Delivery</li>
            <li>Interfone Digital com QR Code por Bloco</li>
            <li>Livro de Protocolo Digital com assinatura na tela</li>
            <li>Espelho de Portaria (monitoramento remoto)</li>
            <li>Monitoramento de Câmeras CFTV (RTSP)</li>
            <li>Controle de Rondas com QR Code e geolocalização</li>
            <li>Relatórios em PDF e Dashboards com gráficos</li>
            <li>Configuração de Features por condomínio</li>
            <li>App do Morador completo</li>
            <li>Multi-perfil com 5 níveis de acesso</li>
            <li>Integração com WhatsApp</li>
            <li>Suporte técnico por WhatsApp</li>
          </ul>
        </Section>

        {/* Cláusula 3 */}
        <Section n="3" title="DOS PLANOS E VALORES">
          <p>
            A CONTRATANTE deverá optar por um dos planos abaixo, conforme o número de unidades do condomínio:
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", margin: "20px 0" }}>
            {PLANS.map(plan => (
              <div
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                style={{
                  border: selectedPlan === plan.id ? "3px solid #003580" : "2px solid #cbd5e1",
                  borderRadius: "12px", padding: "20px", textAlign: "center",
                  background: selectedPlan === plan.id ? "#eff6ff" : "#f8fafc",
                  cursor: "pointer", transition: "all 0.2s", position: "relative",
                }}
              >
                {selectedPlan === plan.id && (
                  <div style={{ position: "absolute", top: "-10px", right: "-10px", width: "28px", height: "28px", borderRadius: "50%", background: "#003580", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Check style={{ width: "16px", height: "16px", color: "#fff" }} />
                  </div>
                )}
                <p style={{ fontWeight: 800, fontSize: "16px", color: "#003580" }}>Plano</p>
                <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "8px" }}>{plan.label}</p>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: "2px" }}>
                  <span style={{ fontSize: "13px", color: "#003580" }}>R$</span>
                  <span style={{ fontSize: "36px", fontWeight: 900, color: "#003580", lineHeight: 1 }}>{plan.price}</span>
                  <span style={{ fontSize: "13px", color: "#003580" }}>/mês</span>
                </div>
              </div>
            ))}
          </div>

          <p style={{ marginTop: "16px" }}>
            <strong>3.1.</strong> Todos os planos incluem todas as funcionalidades listadas na Cláusula 2ª.
          </p>
          <p>
            <strong>3.2.</strong> O valor será cobrado mensalmente, com vencimento todo dia{" "}
            <input
              type="text"
              value={diaVenc}
              onChange={e => setDiaVenc(e.target.value)}
              style={{ ...INPUT_STYLE, width: "40px", textAlign: "center", display: "inline-block" }}
            />{" "}
            de cada mês.
          </p>
          <p>
            <strong>3.3.</strong> O pagamento poderá ser realizado via boleto bancário, PIX ou cartão de crédito.
          </p>
        </Section>

        {/* Cláusula 4 */}
        <Section n="4" title="DOS MÓDULOS ADICIONAIS (ADD-ONS)">
          <p>
            A CONTRATANTE poderá contratar módulos adicionais, independentemente do plano escolhido,
            mediante acréscimo ao valor mensal:
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", margin: "20px 0" }}>
            {ADDONS.map(addon => (
              <div
                key={addon.id}
                onClick={() => toggleAddon(addon.id)}
                style={{
                  border: selectedAddons[addon.id] ? "3px solid #0ea5e9" : "2px solid #cbd5e1",
                  borderRadius: "12px", padding: "20px", textAlign: "center",
                  background: selectedAddons[addon.id] ? "#f0f9ff" : "#f8fafc",
                  cursor: "pointer", transition: "all 0.2s", position: "relative",
                }}
              >
                {selectedAddons[addon.id] && (
                  <div style={{ position: "absolute", top: "-10px", right: "-10px", width: "28px", height: "28px", borderRadius: "50%", background: "#0ea5e9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Check style={{ width: "16px", height: "16px", color: "#fff" }} />
                  </div>
                )}
                <p style={{ fontWeight: 800, fontSize: "15px", color: "#003580", marginBottom: "4px" }}>{addon.label}</p>
                <p style={{ fontSize: "12px", color: "#64748b", marginBottom: "8px", lineHeight: 1.5 }}>{addon.desc}</p>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: "2px" }}>
                  <span style={{ fontSize: "13px", color: "#0ea5e9", fontWeight: 700 }}>+R$</span>
                  <span style={{ fontSize: "28px", fontWeight: 900, color: "#0ea5e9", lineHeight: 1 }}>{addon.price}</span>
                  <span style={{ fontSize: "13px", color: "#0ea5e9" }}>/mês</span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Cláusula 5 */}
        <Section n="5" title="DO PERÍODO DE TESTE">
          <p>
            <strong>5.1.</strong> A CONTRATANTE terá direito a um período de teste gratuito de <strong>7 (sete) dias corridos</strong>,
            contados a partir da ativação do sistema.
          </p>
          <p>
            <strong>5.2.</strong> Ao término do período de teste, caso a CONTRATANTE não manifeste interesse
            na continuidade, o acesso será suspenso automaticamente, sem qualquer cobrança.
          </p>
        </Section>

        {/* Cláusula 6 */}
        <Section n="6" title="DA VIGÊNCIA">
          <p>
            <strong>6.1.</strong> O presente contrato terá vigência por prazo indeterminado, iniciando-se
            na data de sua assinatura.
          </p>
          <p>
            <strong>6.2.</strong> <strong>NÃO HÁ FIDELIDADE</strong>. Qualquer das partes poderá rescindir o presente
            contrato a qualquer tempo, mediante comunicação prévia de <strong>30 (trinta) dias</strong>.
          </p>
          <p>
            <strong>6.3.</strong> Não haverá multa por rescisão antecipada.
          </p>
        </Section>

        {/* Cláusula 7 */}
        <Section n="7" title="DAS OBRIGAÇÕES DA CONTRATADA">
          <p>A CONTRATADA se obriga a:</p>
          <ul style={{ paddingLeft: "24px", marginTop: "8px" }}>
            <li>Disponibilizar o sistema 24 horas por dia, 7 dias por semana, com disponibilidade mínima de 99,5% ao mês;</li>
            <li>Prestar suporte técnico por WhatsApp em horário comercial (segunda a sexta, 08h às 18h);</li>
            <li>Realizar atualizações e melhorias contínuas no sistema sem custo adicional;</li>
            <li>Manter backup diário dos dados do CONTRATANTE;</li>
            <li>Garantir a segurança e confidencialidade dos dados armazenados, em conformidade com a LGPD (Lei nº 13.709/2018).</li>
          </ul>
        </Section>

        {/* Cláusula 8 */}
        <Section n="8" title="DAS OBRIGAÇÕES DA CONTRATANTE">
          <p>A CONTRATANTE se obriga a:</p>
          <ul style={{ paddingLeft: "24px", marginTop: "8px" }}>
            <li>Efetuar o pagamento mensal na data de vencimento;</li>
            <li>Fornecer informações corretas e atualizadas para cadastro no sistema;</li>
            <li>Não compartilhar credenciais de acesso com terceiros não autorizados;</li>
            <li>Utilizar o sistema de acordo com a legislação vigente e boas práticas;</li>
            <li>Comunicar imediatamente qualquer irregularidade ou falha detectada no sistema.</li>
          </ul>
        </Section>

        {/* Cláusula 9 */}
        <Section n="9" title="DA PROTEÇÃO DE DADOS (LGPD)">
          <p>
            <strong>9.1.</strong> A CONTRATADA se compromete a tratar os dados pessoais coletados pelo sistema
            em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), atuando como
            <strong> Operadora de Dados</strong>.
          </p>
          <p>
            <strong>9.2.</strong> Os dados pessoais de moradores, visitantes e funcionários cadastrados no
            sistema são de responsabilidade da CONTRATANTE (<strong>Controladora de Dados</strong>).
          </p>
          <p>
            <strong>9.3.</strong> Em caso de rescisão contratual, a CONTRATADA manterá os dados por até
            <strong> 90 (noventa) dias</strong> para eventual migração, após os quais serão definitivamente excluídos.
          </p>
        </Section>

        {/* Cláusula 10 */}
        <Section n="10" title="DA PROPRIEDADE INTELECTUAL">
          <p>
            <strong>10.1.</strong> O sistema "App Interfone", incluindo código-fonte, design, documentação e
            marca, é de propriedade exclusiva da APP GROUP LTDA - ME.
          </p>
          <p>
            <strong>10.2.</strong> O presente contrato não transfere qualquer direito de propriedade intelectual
            à CONTRATANTE, que recebe apenas licença de uso não-exclusiva durante a vigência contratual.
          </p>
        </Section>

        {/* Cláusula 11 */}
        <Section n="11" title="DO REAJUSTE">
          <p>
            <strong>11.1.</strong> Os valores poderão ser reajustados anualmente com base no índice IGPM/FGV
            ou, na sua ausência, pelo IPCA/IBGE.
          </p>
          <p>
            <strong>11.2.</strong> Qualquer reajuste será comunicado com antecedência mínima de <strong>30 (trinta) dias</strong>.
          </p>
        </Section>

        {/* Cláusula 12 */}
        <Section n="12" title="DA RESCISÃO">
          <p>
            <strong>12.1.</strong> O presente contrato poderá ser rescindido:
          </p>
          <ul style={{ paddingLeft: "24px", marginTop: "8px" }}>
            <li>Por qualquer das partes, a qualquer tempo, sem multa, mediante aviso prévio de 30 dias;</li>
            <li>Por inadimplência da CONTRATANTE superior a 60 (sessenta) dias;</li>
            <li>Por descumprimento de qualquer cláusula contratual, após notificação e prazo de 15 dias para regularização.</li>
          </ul>
        </Section>

        {/* Cláusula 13 */}
        <Section n="13" title="DO FORO">
          <p>
            Fica eleito o foro da Comarca de <strong>São Paulo/SP</strong> para dirimir quaisquer dúvidas
            oriundas do presente contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.
          </p>
        </Section>

        {/* ═══ RESUMO DOS SERVIÇOS CONTRATADOS ═══ */}
        <div style={{
          marginTop: "48px", border: "3px solid #003580", borderRadius: "16px",
          overflow: "hidden",
        }}>
          <div style={{
            background: "linear-gradient(135deg, #0062d1, #001d4a)",
            padding: "20px 28px", color: "#fff",
          }}>
            <h2 style={{ fontSize: "18px", fontWeight: 800, margin: 0 }}>RESUMO DOS SERVIÇOS CONTRATADOS</h2>
          </div>

          <div style={{ padding: "28px" }}>
            {/* Contratante info */}
            {condo && (
              <div style={{ marginBottom: "20px", padding: "16px", background: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <p style={{ fontWeight: 700, color: "#003580", marginBottom: "4px" }}>CONTRATANTE</p>
                <p style={{ fontSize: "14px" }}><strong>{condo}</strong>{cnpj ? ` — CNPJ: ${cnpj}` : ""}</p>
                {endereco && <p style={{ fontSize: "13px", color: "#64748b" }}>{endereco}{numero ? `, ${numero}` : ""}{bairro ? ` — ${bairro}` : ""}{cidadeUf ? ` — ${cidadeUf}` : ""}{cep ? ` — CEP: ${cep}` : ""}</p>}
                {sindico && <p style={{ fontSize: "13px", color: "#64748b" }}>Representante: {sindico}{cpfSindico ? ` (CPF: ${cpfSindico})` : ""}</p>}
              </div>
            )}

            {/* Plano */}
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ background: "#f1f5f9" }}>
                  <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 700, color: "#003580", borderBottom: "2px solid #e2e8f0" }}>Serviço</th>
                  <th style={{ textAlign: "right", padding: "12px 16px", fontWeight: 700, color: "#003580", borderBottom: "2px solid #e2e8f0" }}>Valor Mensal</th>
                </tr>
              </thead>
              <tbody>
                {planObj ? (
                  <tr>
                    <td style={{ padding: "12px 16px", borderBottom: "1px solid #e2e8f0" }}>
                      <strong>Plano — {planObj.label}</strong>
                      <br /><span style={{ fontSize: "12px", color: "#64748b" }}>Todas as funcionalidades inclusas (Cláusula 2ª)</span>
                    </td>
                    <td style={{ padding: "12px 16px", borderBottom: "1px solid #e2e8f0", textAlign: "right", fontWeight: 700, color: "#003580" }}>
                      R$ {planObj.price},00
                    </td>
                  </tr>
                ) : (
                  <tr>
                    <td colSpan={2} style={{ padding: "12px 16px", borderBottom: "1px solid #e2e8f0", color: "#94a3b8", fontStyle: "italic" }}>
                      Nenhum plano selecionado — selecione na Cláusula 3ª
                    </td>
                  </tr>
                )}

                {ADDONS.filter(a => selectedAddons[a.id]).map(addon => (
                  <tr key={addon.id}>
                    <td style={{ padding: "12px 16px", borderBottom: "1px solid #e2e8f0" }}>
                      <strong>{addon.label}</strong> (Add-on)
                      <br /><span style={{ fontSize: "12px", color: "#64748b" }}>{addon.desc}</span>
                    </td>
                    <td style={{ padding: "12px 16px", borderBottom: "1px solid #e2e8f0", textAlign: "right", fontWeight: 700, color: "#0ea5e9" }}>
                      + R$ {addon.price},00
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "#003580" }}>
                  <td style={{ padding: "14px 16px", fontWeight: 800, color: "#fff", fontSize: "15px" }}>
                    TOTAL MENSAL
                  </td>
                  <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: 900, color: "#fff", fontSize: "20px" }}>
                    R$ {totalMensal},00
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* Vigência */}
            <div style={{ marginTop: "24px", padding: "16px", background: "#eff6ff", borderRadius: "10px", border: "1px solid #bfdbfe" }}>
              <p style={{ fontWeight: 700, color: "#003580", marginBottom: "8px" }}>DATA DE INÍCIO DA VIGÊNCIA</p>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "14px" }}>A partir de:</span>
                <input
                  type="text"
                  value={dataInicio}
                  onChange={e => setDataInicio(e.target.value)}
                  placeholder="dd/mm/aaaa"
                  style={{ ...INPUT_STYLE, width: "130px", textAlign: "center", fontSize: "16px", fontWeight: 800, color: "#003580" }}
                />
              </div>
              <p style={{ fontSize: "13px", color: "#64748b", marginTop: "8px" }}>
                Vencimento mensal: dia <strong>{diaVenc || "___"}</strong> de cada mês • Forma de pagamento: boleto, PIX ou cartão
              </p>
            </div>
          </div>
        </div>

        {/* Assinaturas */}
        <div style={{ marginTop: "60px", borderTop: "2px solid #e2e8f0", paddingTop: "40px" }}>
          <p style={{ textAlign: "center", color: "#64748b", fontSize: "14px", marginBottom: "48px" }}>
            E por estarem assim justas e contratadas, as partes assinam o presente instrumento em 2 (duas) vias
            de igual teor e forma, na presença de 2 (duas) testemunhas.
          </p>

          <p style={{ textAlign: "center", color: "#64748b", fontSize: "14px", marginBottom: "48px" }}>
            São Paulo, {dataInicio ? <strong style={{ color: "#003580" }}>{dataInicio}</strong> : "_____ de ___________________ de _________"}.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "48px", marginTop: "40px" }}>
            <SignatureBlock
              label="CONTRATADA"
              name="APP GROUP LTDA - ME"
              detail="CNPJ: 51.797.070/0001-53"
            />
            <SignatureBlock
              label="CONTRATANTE"
              name={condo || "________________________"}
              detail={cnpj ? `CNPJ: ${cnpj}` : "CNPJ: ___.___.___/____-__"}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "48px", marginTop: "60px" }}>
            <SignatureBlock
              label="TESTEMUNHA 1"
              name="________________________"
              detail="CPF: ___.___.___-__"
            />
            <SignatureBlock
              label="TESTEMUNHA 2"
              name="________________________"
              detail="CPF: ___.___.___-__"
            />
          </div>
        </div>
      </div>

      {/* ═══ Bottom Action Bar ═══ */}
      <div className="no-print" style={{
        maxWidth: "900px", margin: "0 auto 60px",
        display: "flex", justifyContent: "center", gap: "16px", flexWrap: "wrap",
        padding: "0 24px",
      }}>
        <button onClick={handlePrint} style={{
          display: "flex", alignItems: "center", gap: "8px",
          background: "#003580", border: "none", borderRadius: "12px",
          padding: "14px 28px", color: "#fff", fontWeight: 700, fontSize: "15px", cursor: "pointer",
        }}>
          <Printer style={{ width: "18px", height: "18px" }} /> Imprimir Contrato
        </button>
        <button onClick={handleCopyLink} style={{
          display: "flex", alignItems: "center", gap: "8px",
          background: "#fff", border: "2px solid #003580", borderRadius: "12px",
          padding: "14px 28px", color: "#003580", fontWeight: 700, fontSize: "15px", cursor: "pointer",
        }}>
          <Share2 style={{ width: "18px", height: "18px" }} /> {copied ? "Link Copiado!" : "Compartilhar Link"}
        </button>
        <button onClick={handleShareWhatsApp} style={{
          display: "flex", alignItems: "center", gap: "8px",
          background: "#25D366", border: "none", borderRadius: "12px",
          padding: "14px 28px", color: "#fff", fontWeight: 700, fontSize: "15px", cursor: "pointer",
        }}>
          <MessageCircle style={{ width: "18px", height: "18px" }} /> Enviar via WhatsApp
        </button>
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "36px" }}>
      <h2 style={{
        fontSize: "17px", fontWeight: 800, color: "#003580",
        marginBottom: "12px", textTransform: "uppercase",
        display: "flex", alignItems: "center", gap: "10px",
      }}>
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: "32px", height: "32px", borderRadius: "8px",
          background: "linear-gradient(135deg, #0062d1, #001d4a)",
          color: "#fff", fontSize: "13px", fontWeight: 800, flexShrink: 0,
        }}>
          {n}
        </span>
        {title}
      </h2>
      <div style={{ paddingLeft: "42px" }}>{children}</div>
    </div>
  );
}

function PlanBox({ name, subtitle, price }: { name: string; subtitle: string; price: string }) {
  return (
    <div style={{
      border: "2px solid #003580", borderRadius: "12px", padding: "20px",
      textAlign: "center", background: "#f8fafc",
    }}>
      <p style={{ fontWeight: 800, fontSize: "16px", color: "#003580" }}>{name}</p>
      <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "8px" }}>{subtitle}</p>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: "2px" }}>
        <span style={{ fontSize: "13px", color: "#003580" }}>R$</span>
        <span style={{ fontSize: "36px", fontWeight: 900, color: "#003580", lineHeight: 1 }}>{price}</span>
        <span style={{ fontSize: "13px", color: "#003580" }}>/mês</span>
      </div>
    </div>
  );
}

function AddonBox({ title, desc, price }: { title: string; desc: string; price: string }) {
  return (
    <div style={{
      border: "2px solid #0ea5e9", borderRadius: "12px", padding: "20px",
      textAlign: "center", background: "#f0f9ff",
    }}>
      <p style={{ fontWeight: 800, fontSize: "15px", color: "#003580", marginBottom: "4px" }}>{title}</p>
      <p style={{ fontSize: "12px", color: "#64748b", marginBottom: "8px", lineHeight: 1.5 }}>{desc}</p>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: "2px" }}>
        <span style={{ fontSize: "13px", color: "#0ea5e9", fontWeight: 700 }}>+R$</span>
        <span style={{ fontSize: "28px", fontWeight: 900, color: "#0ea5e9", lineHeight: 1 }}>{price}</span>
        <span style={{ fontSize: "13px", color: "#0ea5e9" }}>/mês</span>
      </div>
    </div>
  );
}


