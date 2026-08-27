import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import TutorialButton, { TSection, TStep, TBullet } from "@/components/TutorialButton";
import { AppLogo } from "@/components/AppLogo";
import { safeHtml } from "@/lib/sanitize";
import {
  ArrowLeft,
  Plus,
  QrCode,
  Trash2,
  RefreshCw,
  Download,
  Printer,
  Building2,
  Phone,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Copy,
  ExternalLink,
  History,
  ToggleLeft,
  ToggleRight,
  Layout,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { APP_ORIGIN } from "@/lib/config";
import { apiFetch } from "@/lib/api";
import { useTheme } from "@/hooks/useTheme";

const API = "/api";

interface Block {
  id: number;
  name: string;
}

interface InterfoneToken {
  id: number;
  bloco_id: number;
  bloco_nome: string;
  token: string;
  ativo: number;
  created_at: string;
}

/* ═══════════════════════════════════════════════
   SÍNDICO — Interfone Digital — QR Code por Bloco
   ═══════════════════════════════════════════════ */
export default function SindicoInterfoneConfig() {
  const { isDark, p } = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [tokens, setTokens] = useState<InterfoneToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showQR, setShowQR] = useState<InterfoneToken | null>(null);
  const [copied, setCopied] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [condoToken, setCondoToken] = useState<InterfoneToken | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [temPortaria, setTemPortaria] = useState(true);
  const [savingPortaria, setSavingPortaria] = useState(false);

  const fetchData = async () => {
    try {
      const [blocksRes, tokensRes, cfgRes] = await Promise.all([
        apiFetch(`${API}/blocos`),
        apiFetch(`${API}/interfone/tokens`),
        apiFetch(`${API}/condominio-config`),
      ]);
      if (cfgRes.ok) {
        const cfg = await cfgRes.json();
        setTemPortaria(cfg.feature_portaria !== "false");
      }
      if (blocksRes.ok) setBlocks(await blocksRes.json());
      if (tokensRes.ok) {
        const allTokens = await tokensRes.json();
        const condo = allTokens.find((t: InterfoneToken & { tipo?: string }) => (t as any).tipo === "condominio");
        setCondoToken(condo || null);
        setTokens(allTokens.filter((t: InterfoneToken & { tipo?: string }) => (t as any).tipo !== "condominio"));
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Liga/desliga o botão PORTARIA na tela do visitante.
  const togglePortaria = async (valor: boolean) => {
    const anterior = temPortaria;
    setTemPortaria(valor);
    setSavingPortaria(true);
    try {
      const res = await apiFetch(`${API}/condominio-config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature_portaria: valor ? "true" : "false" }),
      });
      if (!res.ok) throw new Error();
      setSuccess(valor ? "Botão PORTARIA ativado para os visitantes." : "Botão PORTARIA removido da tela do visitante.");
    } catch {
      setTemPortaria(anterior);
      setError("Não foi possível salvar. Tente novamente.");
    }
    setSavingPortaria(false);
  };

  const getQRUrl = (data: string) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(data)}`;

  const getInterfoneUrl = (token: string) =>
    `${APP_ORIGIN}/interfone/${token}`;

  // Create QR for a block
  const handleCreate = async (block: Block) => {
    setCreating(true);
    setError("");
    try {
      const res = await apiFetch(`${API}/interfone/tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bloco_id: block.id, bloco_nome: block.name }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) setError(`Bloco ${block.name} já possui QR Code.`);
        else setError(data.error || "Erro ao gerar.");
      } else {
        setSuccess(`QR Code do ${block.name} gerado com sucesso!`);
        setTimeout(() => setSuccess(""), 3000);
        fetchData();
      }
    } catch { setError("Erro de conexão."); }
    setCreating(false);
  };

  // Create all at once
  const handleCreateAll = async () => {
    const missing = blocks.filter(b => !tokens.find(t => t.bloco_id === b.id));
    if (missing.length === 0) { setError("Todos os blocos já possuem QR Code."); return; }
    setCreating(true);
    for (const block of missing) {
      try {
        await apiFetch(`${API}/interfone/tokens`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bloco_id: block.id, bloco_nome: block.name }),
        });
      } catch {}
    }
    setSuccess(`${missing.length} QR Codes gerados!`);
    setTimeout(() => setSuccess(""), 3000);
    await fetchData();
    setCreating(false);
  };

  // Regenerate
  const handleRegenerate = async (token: InterfoneToken) => {
    if (!window.confirm(`Regenerar QR Code do bloco ${token.bloco_nome}? O QR antigo será invalidado.`)) return;
    try {
      await apiFetch(`${API}/interfone/tokens/${token.id}/regenerate`, { method: "PUT" });
      setSuccess(`QR Code do ${token.bloco_nome} regenerado!`);
      setTimeout(() => setSuccess(""), 3000);
      fetchData();
    } catch {}
  };

  // Delete
  const handleDelete = async (token: InterfoneToken) => {
    if (!window.confirm(`Remover QR Code do bloco ${token.bloco_nome}?`)) return;
    await apiFetch(`${API}/interfone/tokens/${token.id}`, { method: "DELETE" });
    fetchData();
  };

  // Copy link
  const handleCopy = (token: string) => {
    navigator.clipboard.writeText(getInterfoneUrl(token));
    setCopied(token);
    setTimeout(() => setCopied(""), 2000);
  };

  // Print single QR
  // Página A4 ou A5 para impressão de QR Code
  const buildPrintHtml = (opts: { title: string; subtitle: string; qrUrl: string; accent: string; instructions: string[]; size: "A4" | "A5" }) => {
    const isA5 = opts.size === "A5";
    const qrPx = isA5 ? 220 : 320;
    const titleSize = isA5 ? 26 : 36;
    const subtitleSize = isA5 ? 14 : 18;
    const stepFont = isA5 ? 12 : 15;
    const stepNumSize = isA5 ? 28 : 36;
    const stepNumFont = isA5 ? 14 : 18;
    const margin = isA5 ? "10mm" : "18mm";
    const stepsTitleSize = isA5 ? 16 : 20;
    const ctaSize = isA5 ? 16 : 22;
    const stepPadding = isA5 ? "8px 12px" : "14px 16px";
    const stepMargin = isA5 ? 8 : 12;
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${opts.title} — App Interfone (${opts.size})</title>
      <style>
        @page { size: ${opts.size}; margin: ${margin}; }
        * { box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 0; color: #1e293b; }
        .page { width: 100%; min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding: ${isA5 ? 8 : 16}px 0; }
        .header { text-align: center; margin-bottom: ${isA5 ? 10 : 18}px; }
        .brand { font-size: ${isA5 ? 12 : 16}px; font-weight: 700; color: #336699; letter-spacing: 0.08em; text-transform: uppercase; }
        .title { font-size: ${titleSize}px; font-weight: 900; color: ${opts.accent}; margin: 4px 0 0; line-height: 1.1; }
        .subtitle { font-size: ${subtitleSize}px; color: #64748b; margin-top: 4px; }
        .qr-box { padding: ${isA5 ? 14 : 22}px; border: 4px solid ${opts.accent}; border-radius: ${isA5 ? 16 : 24}px; margin: ${isA5 ? 10 : 18}px 0; background: #fff; }
        .qr-box img { display: block; width: ${qrPx}px; height: ${qrPx}px; }
        .cta { font-size: ${ctaSize}px; font-weight: 800; color: ${opts.accent}; text-align: center; margin-top: 4px; }
        .steps { margin: ${isA5 ? 14 : 24}px auto 0; max-width: ${isA5 ? 380 : 520}px; width: 100%; }
        .steps h2 { font-size: ${stepsTitleSize}px; font-weight: 800; color: ${opts.accent}; text-align: center; margin: 0 0 ${isA5 ? 10 : 16}px; }
        .step { display: flex; align-items: flex-start; gap: ${isA5 ? 10 : 14}px; margin-bottom: ${stepMargin}px; padding: ${stepPadding}; border-radius: 12px; background: #f1f5f9; border: 1px solid #e2e8f0; }
        .step-num { width: ${stepNumSize}px; height: ${stepNumSize}px; border-radius: 50%; background: ${opts.accent}; color: #fff; font-weight: 900; font-size: ${stepNumFont}px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .step-text { font-size: ${stepFont}px; line-height: 1.4; color: #1e293b; padding-top: 3px; }
        .step-text strong { color: ${opts.accent}; }
        .footer { margin-top: auto; padding-top: ${isA5 ? 12 : 22}px; font-size: ${isA5 ? 9 : 11}px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; width: 100%; max-width: ${isA5 ? 380 : 520}px; }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="header">
          <div class="brand">📞 App Interfone</div>
          <div class="title">${opts.title}</div>
          <div class="subtitle">${opts.subtitle}</div>
        </div>

        <div class="qr-box"><img src="${opts.qrUrl}" alt="QR Code" /></div>
        <div class="cta">📱 Escaneie com a câmera do celular</div>

        <div class="steps">
          <h2>Como usar</h2>
          ${opts.instructions.map((t, i) => `
            <div class="step">
              <div class="step-num">${i + 1}</div>
              <div class="step-text">${t}</div>
            </div>
          `).join("")}
        </div>

        <div class="footer">App Interfone — Interfone Digital para Condomínios — www.appinterfone.com.br</div>
      </div>
      <script>setTimeout(() => { window.print(); }, 600);</script>
    </body>
    </html>
  `;
  };

  const handlePrint = (token: InterfoneToken, size: "A4" | "A5" = "A4") => {
    const url = getInterfoneUrl(token.token);
    const win = window.open("", "_blank", "width=820,height=900");
    if (!win) return;
    win.document.write(buildPrintHtml({
      title: `Bloco ${token.bloco_nome}`,
      subtitle: "Interfone Digital",
      qrUrl: getQRUrl(url),
      accent: "#003580",
      size,
      instructions: [
        "<strong>Escaneie o QR Code</strong> com a câmera do celular.",
        "<strong>Escolha o apartamento</strong> que deseja chamar.",
        "<strong>Confirme o nome</strong> do morador para falar com ele.",
        "Aguarde o morador atender e <strong>fale pelo próprio celular</strong>.",
      ],
    }));
    win.document.close();
  };

  // Download QR
  const handleDownload = async (token: InterfoneToken) => {
    try {
      const url = getInterfoneUrl(token.token);
      const resp = await fetch(getQRUrl(url));
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `interfone-bloco-${token.bloco_nome.replace(/\s+/g, "-").toLowerCase()}.png`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {}
  };

  // Blocks that don't yet have a token
  const missingBlocks = blocks.filter(b => !tokens.find(t => t.bloco_id === b.id));

  // Create condominium-wide QR
  const handleCreateCondoToken = async () => {
    setCreating(true);
    setError("");
    try {
      const res = await apiFetch(`${API}/interfone/tokens/condominio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao gerar QR Code geral.");
      } else {
        setSuccess("QR Code da Entrada Principal gerado com sucesso!");
        setTimeout(() => setSuccess(""), 3000);
        fetchData();
      }
    } catch { setError("Erro de conexão."); }
    setCreating(false);
  };

  // Regenerate condominium token
  const handleRegenerateCondoToken = async () => {
    if (!window.confirm("Regenerar QR Code da Entrada Principal? O QR antigo será invalidado.")) return;
    try {
      await apiFetch(`${API}/interfone/tokens/condominio/regenerate`, { method: "PUT" });
      setSuccess("QR Code geral regenerado!");
      setTimeout(() => setSuccess(""), 3000);
      fetchData();
    } catch {}
  };

  // Delete condominium token
  const handleDeleteCondoToken = async () => {
    if (!condoToken) return;
    if (!window.confirm("Remover QR Code da Entrada Principal?")) return;
    await apiFetch(`${API}/interfone/tokens/${condoToken.id}`, { method: "DELETE" });
    fetchData();
  };

  // Print condominium QR
  const handlePrintCondoToken = (size: "A4" | "A5" = "A4") => {
    if (!condoToken) return;
    const url = getInterfoneUrl(condoToken.token);
    const win = window.open("", "_blank", "width=820,height=900");
    if (!win) return;
    win.document.write(buildPrintHtml({
      title: "Entrada Principal",
      subtitle: "Interfone Digital — Todos os Blocos",
      qrUrl: getQRUrl(url),
      accent: "#10b981",
      size,
      instructions: [
        "<strong>Escaneie o QR Code</strong> com a câmera do celular.",
        "<strong>Escolha o bloco</strong> e depois o <strong>apartamento</strong>.",
        "<strong>Confirme o nome</strong> do morador para falar com ele.",
        "Aguarde o morador atender e <strong>fale pelo próprio celular</strong>.",
      ],
    }));
    win.document.close();
  };

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: p.pageBg }}>
      {/* Header */}
      <header className="safe-area-top" style={{ background: p.headerBg, padding: "18px 24px", borderBottom: p.headerBorder, boxShadow: p.headerShadow }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} style={{ width: 40, height: 40, borderRadius: 12, background: p.btnBg, border: p.btnBorder, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: p.text }}>
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div style={{ flex: 1 }}>
            <h1 className="text-white flex items-center gap-2" style={{ fontWeight: 700, fontSize: 18 }}>
              <Phone className="w-5 h-5" /> Interfone Digital
            </h1>
            <p style={{ fontSize: 12, color: "rgba(147,197,253,0.8)", marginTop: 2 }}>QR Code por Bloco</p>
          </div>
          <TutorialButton title="Interfone Digital">
            <TSection icon={<span>📋</span>} title="O QUE É ESTA FUNÇÃO?">
              <p>O <strong>Interfone Digital</strong> substitui o interfone físico do condomínio. Cada bloco recebe um <strong>QR Code exclusivo</strong> que, ao ser escaneado pelo visitante, permite que ele ligue diretamente para o morador pelo celular — com <strong>vídeo unidirecional</strong> (o morador vê quem está chamando, mas o visitante só ouve a voz do morador).</p>
            </TSection>
            <TSection icon={<span>🏢</span>} title="DOIS MODOS DE QR CODE">
              <TStep n={1}><strong>QR Code da Entrada Principal</strong> — Um único QR para o condomínio inteiro. O visitante primeiro <strong>escolhe o bloco</strong>, depois o apartamento. Ideal para <strong>grandes condomínios</strong> (muitos blocos). O visitante também pode usar a <strong>barra de busca</strong> para encontrar rapidamente.</TStep>
              <TStep n={2}><strong>QR Code por Bloco</strong> — Cada bloco tem seu próprio QR. O visitante já cai direto na <strong>lista de apartamentos</strong> daquele bloco. Ideal para fixar na <strong>entrada de cada bloco</strong>.</TStep>
              <p style={{ marginTop: "8px", fontSize: "13px", color: "#2d3354" }}>👉 <strong>Dica:</strong> Para condomínios com muitos blocos (ex: 54 blocos), use o <strong>QR da Entrada Principal</strong> na portaria. Para blocos individuais, use os QR por bloco.</p>
            </TSection>
            <TSection icon={<span>🏗️</span>} title="COMO CONFIGURAR (SÍNDICO)">
              <TStep n={1}>Acesse esta tela — <strong>Interfone Digital</strong></TStep>
              <TStep n={2}>Para grandes condomínios: clique em <strong>"Gerar QR Code da Entrada Principal"</strong> (QR único para todos os blocos)</TStep>
              <TStep n={3}>Para QR por bloco: clique em <strong>"Gerar Todos"</strong> ou gere individualmente</TStep>
              <TStep n={4}><strong>Imprima</strong> o QR Code (individual ou todos de uma vez)</TStep>
              <TStep n={5}>Fixe o QR Code impresso na <strong>entrada do condomínio</strong> ou de <strong>cada bloco</strong></TStep>
              <TStep n={6}>Pronto! Visitantes podem escanear e ligar para os moradores</TStep>
              <p style={{ marginTop: "8px", fontSize: "13px", color: "#2d3354" }}>👉 <strong>Dica:</strong> Você pode <strong>regenerar</strong> qualquer QR Code a qualquer momento — o anterior será automaticamente invalidado.</p>
            </TSection>
            <TSection icon={<span>📱</span>} title="FLUXO DO VISITANTE">
              <TStep n={1}>Visitante chega e <strong>escaneia o QR Code</strong> com a câmera do celular</TStep>
              <TStep n={2}><strong>QR da Entrada:</strong> vê o botão PORTARIA, a <strong>barra de busca</strong> e a <strong>lista de blocos</strong> — escolhe o bloco, depois o apartamento</TStep>
              <TStep n={3}><strong>QR por Bloco:</strong> vê o botão PORTARIA e a <strong>lista de apartamentos</strong> direto — se houver muitos, pode <strong>buscar por número</strong></TStep>
              <TStep n={4}>Dependendo do <strong>nível de segurança</strong> do morador, pode ser solicitado:</TStep>
              <TBullet><strong>Nível 1</strong> — Ligação direta, sem nenhuma verificação</TBullet>
              <TBullet><strong>Nível 2</strong> — Visitante precisa digitar o <strong>nome do morador</strong> corretamente</TBullet>
              <TBullet><strong>Nível 3</strong> — Visitante preenche <strong>nome, empresa e tira uma foto</strong> para aprovação</TBullet>
              <TStep n={5}>Após a verificação, a <strong>chamada é iniciada</strong> — o morador recebe no app</TStep>
              <TStep n={6}>Morador pode <strong>atender</strong>, <strong>recusar</strong> ou <strong>abrir o portão</strong> remotamente</TStep>
            </TSection>
            <TSection icon={<span>👀</span>} title="O QUE O MORADOR VÊ?">
              <TBullet>Recebe notificação de <strong>chamada no app</strong> com toque sonoro</TBullet>
              <TBullet>Vê o <strong>vídeo do visitante em tempo real</strong> (câmera frontal)</TBullet>
              <TBullet>Morador fala por <strong>áudio</strong> — visitante não vê o morador (privacidade)</TBullet>
              <TBullet>No nível 3, morador vê <strong>nome, empresa e foto</strong> antes de atender</TBullet>
              <TBullet>Pode <strong>abrir o portão</strong> direto pelo app durante a chamada</TBullet>
            </TSection>
            <TSection icon={<span>🔧</span>} title="GERENCIAMENTO DE QR CODES">
              <TBullet><strong>Copiar Link</strong> — copia o link do interfone para compartilhar</TBullet>
              <TBullet><strong>Download PNG</strong> — baixa a imagem do QR Code</TBullet>
              <TBullet><strong>Imprimir Individual</strong> — imprime um QR Code específico</TBullet>
              <TBullet><strong>Imprimir Todos</strong> — imprime todos os QR Codes de uma vez</TBullet>
              <TBullet><strong>Regenerar</strong> — invalida o QR antigo e gera um novo (segurança)</TBullet>
              <TBullet><strong>Excluir</strong> — remove o QR Code do bloco</TBullet>
            </TSection>
            <TSection icon={<span>⭐</span>} title="DICAS IMPORTANTES">
              <TBullet>Se um QR Code vazar, <strong>regenere-o</strong> — o antigo para de funcionar na hora</TBullet>
              <TBullet>Moradores configuram seu <strong>nível de segurança</strong> individualmente no app</TBullet>
              <TBullet>O <strong>horário silencioso</strong> impede chamadas em horários configurados pelo morador</TBullet>
              <TBullet>Todas as chamadas ficam registradas no <strong>histórico</strong> com data, hora e resultado</TBullet>
              <TBullet>Funciona em qualquer celular com <strong>câmera e navegador</strong> — não precisa instalar nada</TBullet>
              <TBullet>O botão <strong>PORTARIA</strong> permite que visitantes liguem diretamente para o <strong>porteiro/zelador</strong> do condomínio — sem filtros</TBullet>
              <TBullet>Funcionários recebem as chamadas na tela <strong>Interfone Portaria</strong> no painel deles</TBullet>
            </TSection>
          </TutorialButton>
        </div>
      </header>

      <main className="flex-1" style={{ padding: "1.5rem", paddingBottom: "3rem", maxWidth: 800, margin: "0 auto", width: "100%" }}>

        {/* ── Como funciona dropdown ── */}
        <div style={{
          background: isDark ? "rgba(59,130,246,0.10)" : "#eff6ff",
          border: isDark ? "1px solid rgba(59,130,246,0.25)" : "1px solid #bfdbfe",
          borderRadius: 16,
          marginBottom: "1.25rem",
          overflow: "hidden",
        }}>
          <button
            onClick={() => setInfoOpen(!infoOpen)}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.875rem 1.25rem", background: "transparent", border: "none", cursor: "pointer" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>&#128222;</span>
              <span style={{ fontWeight: 700, fontSize: 14, color: isDark ? "#93c5fd" : "#1d4ed8" }}>Como funciona o Interfone Digital</span>
            </div>
            {infoOpen
              ? <ChevronUp style={{ width: 18, height: 18, color: isDark ? "#93c5fd" : "#1d4ed8", flexShrink: 0 }} />
              : <ChevronDown style={{ width: 18, height: 18, color: isDark ? "#93c5fd" : "#1d4ed8", flexShrink: 0 }} />}
          </button>
          {infoOpen && (
            <div style={{ padding: "0 1.25rem 1rem", display: "flex", flexDirection: "column", gap: 8 }}>
              {([
                ["&#128247;", "Substitui o interfone fisico. Cada bloco recebe um QR Code exclusivo fixado na entrada."],
                ["&#128241;", "O visitante escaneia o QR com a camera do celular — nao precisa instalar nenhum aplicativo."],
                ["&#127968;", "QR da Entrada Principal: visitante escolhe o bloco e apartamento. QR por Bloco: cai direto na lista do bloco."],
                ["&#128222;", "Apos escolher o apartamento, o app liga para o morador. O morador recebe a chamada no App Interfone."],
                ["&#128064;", "O morador ve o video do visitante em tempo real (camera frontal). O visitante nao ve o morador — apenas ouve a voz."],
                ["&#128682;", "O morador pode abrir o portao ou cancela remotamente durante a chamada, sem precisar sair de casa."],
                ["&#128274;", "Nivel de seguranca configuravel por morador: Nivel 1 (direto), Nivel 2 (confirmar nome), Nivel 3 (nome + empresa + foto)."],
                ["&#128203;", "Todas as chamadas ficam registradas no historico com data, hora, nome do visitante e acao tomada."],
                ["&#128296;", "Se um QR vazar, regenere-o: o anterior e invalidado imediatamente e um novo e gerado."],
              ] as [string, string][]).map(([icon, text], i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }} dangerouslySetInnerHTML={safeHtml(icon)} />
                  <p style={{ fontSize: 13, color: isDark ? "#cbd5e1" : "#334155", lineHeight: 1.5, margin: 0 }}>{text}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Condomínio tem portaria? ── */}
        <div style={{
          background: temPortaria
            ? (isDark ? "rgba(16,185,129,0.10)" : "#ecfdf5")
            : (isDark ? "rgba(245,158,11,0.12)" : "#fffbeb"),
          border: temPortaria
            ? (isDark ? "1px solid rgba(16,185,129,0.30)" : "1px solid #a7f3d0")
            : "2px solid #f59e0b",
          borderRadius: 16,
          padding: "1rem 1.25rem",
          marginBottom: "1.25rem",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>&#127978;</span>
            <div>
              <p style={{ fontWeight: 700, fontSize: 14, color: p.textHeading, margin: 0 }}>Seu condomínio tem portaria?</p>
              <p style={{ fontSize: 12.5, color: isDark ? "#cbd5e1" : "#475569", lineHeight: 1.5, margin: "4px 0 0" }}>
                Sem portaria, o botão <strong>PORTARIA</strong> não aparece para o visitante — ele chama direto o apartamento.
              </p>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button
              onClick={() => togglePortaria(true)}
              disabled={savingPortaria}
              style={{
                height: 44, borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer",
                border: temPortaria ? "2px solid #10b981" : (isDark ? "2px solid rgba(255,255,255,0.15)" : "2px solid #e2e8f0"),
                background: temPortaria ? "rgba(16,185,129,0.18)" : "transparent",
                color: temPortaria ? "#10b981" : p.textSecondary,
              }}
            >
              Sim, tem porteiro
            </button>
            <button
              onClick={() => togglePortaria(false)}
              disabled={savingPortaria}
              style={{
                height: 44, borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer",
                border: !temPortaria ? "2px solid #f59e0b" : (isDark ? "2px solid rgba(255,255,255,0.15)" : "2px solid #e2e8f0"),
                background: !temPortaria ? "rgba(245,158,11,0.20)" : "transparent",
                color: !temPortaria ? "#f59e0b" : p.textSecondary,
              }}
            >
              Não tem portaria
            </button>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl mb-4" style={{ background: "#fef2f2", border: "1px solid #fca5a5" }}>
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <span className="text-sm text-red-700">{error}</span>
            <button onClick={() => setError("")} className="ml-auto text-red-400 text-xs font-bold">✕</button>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 p-3 rounded-xl mb-4" style={{ background: "#f0fdf4", border: "1px solid #86efac" }}>
            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
            <span className="text-sm text-green-700">{success}</span>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-wrap gap-4" style={{ marginBottom: "1.2rem" }}>
          {missingBlocks.length > 0 && (
            <button
              onClick={handleCreateAll}
              disabled={creating}
              className="flex items-center gap-2 rounded-xl font-bold text-white"
              style={{ background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)", height: "auto", fontSize: "15px", padding: "12px 64px" }}
            >
              <Plus className="w-4 h-4" />
              {creating ? "Gerando..." : `Gerar Todos (${missingBlocks.length} blocos)`}
            </button>
          )}
          <button
            onClick={() => navigate("/portaria/visitante-qrcode")}
            className="flex items-center gap-2 rounded-xl font-bold text-white"
            style={{ background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)", height: "auto", fontSize: "15px", padding: "12px 64px" }}
          >
            <Layout className="w-4 h-4" />
            Layout QR Code
          </button>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 rounded-xl text-sm font-bold"
            style={{ background: "#f1f5f9", border: "2px solid #003580", color: "#003580", padding: "14px 32px" }}
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
        </div>

        {/* ═══ CONDOMINIUM-WIDE QR CODE ═══ */}
        <div style={{ marginBottom: "1.2rem" }}>
          <h2 className="font-bold flex items-center gap-2" style={{ color: "#10b981", fontSize: "16px", marginBottom: "0.6rem" }}>
            <AppLogo size={20} rounded={4} objectFit="cover" /> QR Code da Entrada Principal
          </h2>
          <p style={{ fontSize: "14px", marginBottom: "0.8rem", color: isDark ? "rgba(255,255,255,0.7)" : "#475569" }}>
            QR Code único para a <strong>entrada do condomínio</strong>. O visitante escolhe o bloco e depois o apartamento.
            Ideal para condomínios grandes com muitos blocos.
          </p>

          {condoToken ? (
            <div className="rounded-xl p-4" style={{ background: "#f0fdf4", border: "2px solid #86efac" }}>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowQR(condoToken)}
                  className="shrink-0 rounded-lg overflow-hidden"
                  style={{ border: "2px solid #10b981", width: 80, height: 80, padding: "6px", background: "#ffffff" }}
                >
                  <img
                    src={getQRUrl(getInterfoneUrl(condoToken.token))}
                    alt="QR Entrada Principal"
                    className="w-full h-full"
                  />
                </button>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold" style={{ color: "#10b981", fontSize: "15px" }}>
                    🏢 Entrada Principal (todos os blocos)
                  </h3>
                  <p className="mt-0.5 truncate" style={{ fontSize: "13px", color: "#64748b" }}>
                    {getInterfoneUrl(condoToken.token)}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-bold">ATIVO</span>
                    <span className="text-[10px]" style={{ color: "#64748b" }}>
                      {new Date(condoToken.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => handleCopy(condoToken.token)} className="p-2 rounded-lg hover:bg-green-50" title="Copiar link">
                    {copied === condoToken.token ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-green-600" />}
                  </button>
                  <button onClick={() => handlePrintCondoToken("A4")} className="p-2 rounded-lg hover:bg-green-50 flex items-center gap-1" title="Imprimir A4" style={{ fontSize: 11, color: "#16a34a", fontWeight: 700 }}>
                    <Printer className="w-4 h-4 text-green-600" /> A4
                  </button>
                  <button onClick={() => handlePrintCondoToken("A5")} className="p-2 rounded-lg hover:bg-green-50 flex items-center gap-1" title="Imprimir A5" style={{ fontSize: 11, color: "#16a34a", fontWeight: 700 }}>
                    <Printer className="w-4 h-4 text-green-600" /> A5
                  </button>
                  <button onClick={handleRegenerateCondoToken} className="p-2 rounded-lg hover:bg-orange-50" title="Regenerar">
                    <RefreshCw className="w-4 h-4 text-orange-500" />
                  </button>
                  <button onClick={handleDeleteCondoToken} className="p-2 rounded-lg hover:bg-red-50" title="Excluir">
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={handleCreateCondoToken}
              disabled={creating}
              className="w-full flex items-center justify-center gap-3 rounded-xl font-bold text-white transition-transform hover:scale-[1.01]"
              style={{ background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)", fontSize: "15px", padding: "16px 32px", height: "80px" }}
            >
              <QrCode className="w-5 h-5" />
              {creating ? "Gerando..." : "Gerar QR Code da Entrada Principal"}
            </button>
          )}
        </div>

        {/* Separator */}
        <div className="flex items-center gap-3" style={{ marginBottom: "1.2rem" }}>
          <div className="flex-1 h-px bg-border" />
          <span className="font-semibold" style={{ fontSize: "14px", color: isDark ? "rgba(255,255,255,0.7)" : "#475569" }}>QR Codes por Bloco (individual)</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {loading ? (
          <div className="text-center py-12" style={{ color: isDark ? "rgba(255,255,255,0.7)" : "#475569" }}>Carregando...</div>
        ) : (
          <>
            {/* Existing tokens */}
            {tokens.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem", marginBottom: "1.2rem" }}>
                <h2 className="font-bold flex items-center gap-2" style={{ color: isDark ? "#ffffff" : "#1e293b", fontSize: "16px" }}>
                  <QrCode className="w-5 h-5" /> QR Codes Gerados ({tokens.length})
                </h2>
                {tokens.map((token) => (
                  <div
                    key={token.id}
                    className="rounded-xl p-4"
                    style={{ background: "#ffffff", border: "2px solid #e2e8f0" }}
                  >
                    <div className="flex items-center gap-3">
                      {/* QR thumbnail */}
                      <button
                        onClick={() => setShowQR(token)}
                        className="shrink-0 rounded-lg overflow-hidden"
                        style={{ border: "2px solid #003580", width: 64, height: 64 }}
                      >
                        <img
                          src={getQRUrl(getInterfoneUrl(token.token))}
                          alt={`QR ${token.bloco_nome}`}
                          className="w-full h-full"
                        />
                      </button>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold" style={{ color: "#003580", fontSize: "15px" }}>
                          Bloco {token.bloco_nome}
                        </h3>
                        <p className="mt-0.5 truncate" style={{ fontSize: "13px", color: "#64748b" }}>
                          {getInterfoneUrl(token.token)}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-bold">
                            ATIVO
                          </span>
                          <span className="text-[10px]" style={{ color: "#64748b" }}>
                            {new Date(token.created_at).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => handleCopy(token.token)} className="p-2 rounded-lg hover:bg-[#2d3354]/10" title="Copiar link">
                          {copied === token.token ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-[#2d3354]" />}
                        </button>
                        <button onClick={() => handleDownload(token)} className="p-2 rounded-lg hover:bg-[#2d3354]/10" title="Baixar QR">
                          <Download className="w-4 h-4 text-[#2d3354]" />
                        </button>
                        <button onClick={() => handlePrint(token, "A5")} className="p-2 rounded-lg hover:bg-[#2d3354]/10 flex items-center gap-1" title="Imprimir A5" style={{ fontSize: 11, color: "#003580", fontWeight: 700 }}>
                          <Printer className="w-4 h-4 text-[#003580]" /> A5
                        </button>
                        <button onClick={() => handlePrint(token, "A4")} className="p-2 rounded-lg hover:bg-[#2d3354]/10 flex items-center gap-1" title="Imprimir A4" style={{ fontSize: 11, color: "#003580", fontWeight: 700 }}>
                          <Printer className="w-4 h-4 text-[#2d3354]" /> A4
                        </button>
                        <button onClick={() => handleRegenerate(token)} className="p-2 rounded-lg hover:bg-orange-50" title="Regenerar">
                          <RefreshCw className="w-4 h-4 text-orange-500" />
                        </button>
                        <button onClick={() => handleDelete(token)} className="p-2 rounded-lg hover:bg-red-50" title="Excluir">
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Missing blocks */}
            {missingBlocks.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
                <h2 className="font-bold flex items-center gap-2" style={{ fontSize: "16px", color: isDark ? "rgba(255,255,255,0.7)" : "#475569" }}>
                  <AppLogo size={20} rounded={4} objectFit="cover" /> Blocos sem QR Code ({missingBlocks.length})
                </h2>
                {missingBlocks.map((block) => (
                  <div
                    key={block.id}
                    className="flex items-center gap-3 rounded-xl p-4"
                    style={{ background: "#f8fafc", border: "2px solid #cbd5e1", paddingLeft: "20px" }}
                  >
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)" }}>
                      <Building2 className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold" style={{ color: "#003580", fontSize: "15px" }}>Bloco {block.name}</h3>
                      <p style={{ fontSize: "13px", color: "#64748b" }}>Sem QR Code gerado</p>
                    </div>
                    <button
                      onClick={() => handleCreate(block)}
                      disabled={creating}
                      className="flex items-center justify-center gap-1.5 font-bold text-white"
                      style={{ fontSize: "13px", background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)", borderRadius: "4px", width: "72px", height: "72px", flexDirection: "column", padding: "8px", marginRight: "20px" }}
                    >
                      <QrCode className="w-5 h-5" /> Gerar
                    </button>
                  </div>
                ))}
              </div>
            )}

            {blocks.length === 0 && (
              <div className="text-center py-12">
                <AppLogo size={48} rounded={12} style={{ margin: "0 auto 12px" }} />
                <p style={{ fontSize: "14px", marginBottom: "0.6rem", color: isDark ? "rgba(255,255,255,0.7)" : "#475569" }}>Nenhum bloco cadastrado</p>
                <button
                  onClick={() => navigate("/cadastros/blocos")}
                  className="font-bold px-4 py-2 rounded-lg text-white"
                  style={{ background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)", fontSize: "14px" }}
                >
                  Cadastrar Blocos
                </button>
              </div>
            )}

            {/* Call history */}
            <div style={{ marginTop: "1.2rem" }}>
              <button
                onClick={() => navigate("/sindico/interfone-historico")}
                className="flex items-center gap-2 w-full p-4 rounded-xl text-left"
                style={{ background: "#ffffff", border: "2px solid #e2e8f0" }}
              >
                <History className="w-5 h-5" style={{ color: "#003580" }} />
                <div className="flex-1">
                  <p className="font-bold" style={{ color: "#003580", fontSize: "15px" }}>Histórico de Chamadas</p>
                  <p style={{ fontSize: "13px", color: "#64748b" }}>Ver todas as ligações do interfone</p>
                </div>
                <ArrowLeft className="w-4 h-4 rotate-180 text-slate-400" />
              </button>
            </div>
          </>
        )}
      </main>

      {/* QR Code Modal */}
      {showQR && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setShowQR(null)}
        >
          <div
            className="rounded-2xl w-full text-center"
            style={{ background: "#fff", maxWidth: 420, padding: "32px 24px 24px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-bold mb-2" style={{ color: "#003580", fontSize: 22, marginTop: 8 }}>
              📞 Interfone Digital
            </h2>
            <p style={{ color: "#64748b", fontSize: 14, marginBottom: 20 }}>Bloco {showQR.bloco_nome}</p>
            <div className="inline-block rounded-xl" style={{ border: "3px solid #003580", padding: 12 }}>
              <img
                src={getQRUrl(getInterfoneUrl(showQR.token))}
                alt={`QR Bloco ${showQR.bloco_nome}`}
                className="w-64 h-64"
              />
            </div>
            <p style={{ color: "#64748b", fontSize: 13, marginTop: 14, marginBottom: 20 }}>
              Escaneie com a câmera do celular para ligar
            </p>
            <div className="grid grid-cols-2" style={{ gap: 10, marginBottom: 10 }}>
              <button
                onClick={() => handlePrint(showQR, "A4")}
                className="flex flex-col items-center justify-center font-bold text-white"
                style={{ background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)", padding: "14px 8px", borderRadius: 12, fontSize: 13, gap: 6, minHeight: 72 }}
              >
                <Printer className="w-5 h-5" />
                <span>Imprimir A4</span>
              </button>
              <button
                onClick={() => handlePrint(showQR, "A5")}
                className="flex flex-col items-center justify-center font-bold text-white"
                style={{ background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)", padding: "14px 8px", borderRadius: 12, fontSize: 13, gap: 6, minHeight: 72 }}
              >
                <Printer className="w-5 h-5" />
                <span>Imprimir A5</span>
              </button>
            </div>
            <div className="grid grid-cols-2" style={{ gap: 10 }}>
              <button
                onClick={() => handleCopy(showQR.token)}
                className="flex flex-col items-center justify-center font-bold"
                style={{ background: "#f8fafc", border: "1.5px solid #003580", color: "#003580", padding: "14px 8px", borderRadius: 12, fontSize: 13, gap: 6, minHeight: 72 }}
              >
                <Copy className="w-5 h-5" />
                <span>Copiar Link</span>
              </button>
              <button
                onClick={() => handleDownload(showQR)}
                className="flex flex-col items-center justify-center font-bold"
                style={{ background: "#f8fafc", border: "1.5px solid #003580", color: "#003580", padding: "14px 8px", borderRadius: 12, fontSize: 13, gap: 6, minHeight: 72 }}
              >
                <Download className="w-5 h-5" />
                <span>Baixar</span>
              </button>
            </div>
            <button
              onClick={() => setShowQR(null)}
              style={{ color: "#64748b", fontSize: 13, marginTop: 18, padding: "8px 16px" }}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
