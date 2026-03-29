import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import TutorialButton, { TSection, TStep, TBullet } from "@/components/TutorialButton";
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

  const fetchData = async () => {
    try {
      const [blocksRes, tokensRes] = await Promise.all([
        apiFetch(`${API}/blocos`),
        apiFetch(`${API}/interfone/tokens`),
      ]);
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
  const handlePrint = (token: InterfoneToken) => {
    const url = getInterfoneUrl(token.token);
    const win = window.open("", "_blank", "width=600,height=700");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head><title>Interfone Digital - ${token.bloco_nome}</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 40px; background: #fff; }
        .logo { font-size: 28px; font-weight: 900; color: #003580; margin-bottom: 4px; }
        .subtitle { font-size: 16px; color: #336699; margin-bottom: 30px; }
        .qr-container { display: inline-block; padding: 20px; border: 3px solid #003580; border-radius: 16px; margin-bottom: 24px; }
        .qr-container img { border-radius: 8px; }
        .bloco { font-size: 32px; font-weight: 900; color: #003580; margin-top: 20px; }
        .instruction { font-size: 15px; color: #336699; margin-top: 12px; line-height: 1.6; max-width: 350px; margin-left: auto; margin-right: auto; }
        .phone-icon { font-size: 38px; margin-bottom: 8px; }
        .footer { margin-top: 30px; font-size: 11px; color: #94a3b8; }
      </style>
      </head>
      <body>
        <div class="phone-icon">📞</div>
        <div class="logo">Interfone Digital</div>
        <div class="subtitle">App Interfone</div>
        <div class="qr-container">
          <img src="${getQRUrl(url)}" width="300" height="300" alt="QR Code" />
        </div>
        <div class="bloco">Bloco ${token.bloco_nome}</div>
        <div class="instruction">
          Escaneie o QR Code com a câmera do celular para ligar diretamente para o morador.
        </div>
        <div class="footer">App Interfone — Interfone Digital — www.appinterfone.com.br</div>
        <script>setTimeout(() => { window.print(); }, 500);</script>
      </body>
      </html>
    `);
    win.document.close();
  };

  // Print all
  const handlePrintAll = () => {
    if (tokens.length === 0) return;
    const win = window.open("", "_blank", "width=800,height=600");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head><title>Interfone Digital - Todos os Blocos</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { text-align: center; color: #003580; margin-bottom: 4px; }
        .sub { text-align: center; color: #336699; font-size: 14px; margin-bottom: 30px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
        .item { text-align: center; page-break-inside: avoid; border: 2px solid #003580; border-radius: 16px; padding: 24px; }
        .item img { border-radius: 8px; }
        .bloco { font-size: 22px; font-weight: 800; margin-top: 12px; color: #003580; }
        .info { font-size: 12px; color: #336699; margin-top: 6px; }
      </style>
      </head>
      <body>
        <h1>📞 Interfone Digital</h1>
        <p class="sub">App Interfone — ${tokens.length} blocos</p>
        <div class="grid">
          ${tokens.map((t) => `
            <div class="item">
              <img src="${getQRUrl(getInterfoneUrl(t.token))}" width="200" height="200" />
              <div class="bloco">Bloco ${t.bloco_nome}</div>
              <div class="info">Escaneie para ligar para o morador</div>
            </div>
          `).join("")}
        </div>
        <script>setTimeout(() => { window.print(); }, 800);</script>
      </body>
      </html>
    `);
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
  const handlePrintCondoToken = () => {
    if (!condoToken) return;
    const url = getInterfoneUrl(condoToken.token);
    const win = window.open("", "_blank", "width=600,height=700");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head><title>Interfone Digital - Entrada Principal</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 40px; background: #fff; }
        .logo { font-size: 28px; font-weight: 900; color: #003580; margin-bottom: 4px; }
        .subtitle { font-size: 16px; color: #336699; margin-bottom: 30px; }
        .qr-container { display: inline-block; padding: 20px; border: 3px solid #10b981; border-radius: 16px; margin-bottom: 24px; }
        .qr-container img { border-radius: 8px; }
        .bloco { font-size: 28px; font-weight: 900; color: #10b981; margin-top: 20px; }
        .instruction { font-size: 15px; color: #336699; margin-top: 12px; line-height: 1.6; max-width: 350px; margin-left: auto; margin-right: auto; }
        .phone-icon { font-size: 38px; margin-bottom: 8px; }
        .badge { display: inline-block; background: #10b981; color: #fff; padding: 6px 18px; border-radius: 20px; font-size: 14px; font-weight: 700; margin-top: 12px; }
        .footer { margin-top: 30px; font-size: 11px; color: #94a3b8; }
      </style>
      </head>
      <body>
        <div class="phone-icon">📞</div>
        <div class="logo">Interfone Digital</div>
        <div class="subtitle">App Interfone</div>
        <div class="qr-container">
          <img src="${getQRUrl(url)}" width="300" height="300" alt="QR Code" />
        </div>
        <div class="bloco">ENTRADA PRINCIPAL</div>
        <div class="badge">🏢 Todos os Blocos</div>
        <div class="instruction">
          Escaneie o QR Code com a câmera do celular.<br>
          Escolha o bloco e apartamento para ligar diretamente para o morador.
        </div>
        <div class="footer">App Interfone — Interfone Digital — www.appinterfone.com.br</div>
        <script>setTimeout(() => { window.print(); }, 500);</script>
      </body>
      </html>
    `);
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
                  <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }} dangerouslySetInnerHTML={{ __html: icon }} />
                  <p style={{ fontSize: 13, color: isDark ? "#cbd5e1" : "#334155", lineHeight: 1.5, margin: 0 }}>{text}</p>
                </div>
              ))}
            </div>
          )}
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
          {tokens.length > 0 && (
            <button
              onClick={handlePrintAll}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: "#ffffff", border: "2px solid #003580", color: "#003580", padding: "14px 32px" }}
            >
              <Printer className="w-4 h-4" /> Imprimir Todos
            </button>
          )}
        </div>

        {/* ═══ CONDOMINIUM-WIDE QR CODE ═══ */}
        <div style={{ marginBottom: "1.2rem" }}>
          <h2 className="font-bold flex items-center gap-2" style={{ color: "#10b981", fontSize: "16px", marginBottom: "0.6rem" }}>
            <Building2 className="w-5 h-5" /> QR Code da Entrada Principal
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
                  <button onClick={handlePrintCondoToken} className="p-2 rounded-lg hover:bg-green-50" title="Imprimir">
                    <Printer className="w-4 h-4 text-green-600" />
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
                        <button onClick={() => handlePrint(token)} className="p-2 rounded-lg hover:bg-[#2d3354]/10" title="Imprimir">
                          <Printer className="w-4 h-4 text-[#2d3354]" />
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
                  <Building2 className="w-5 h-5" /> Blocos sem QR Code ({missingBlocks.length})
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
                <Building2 className="w-12 h-12 mx-auto mb-3 text-slate-300" />
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
            className="rounded-2xl p-6 max-w-sm w-full text-center"
            style={{ background: "#fff" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-bold text-xl mb-1" style={{ color: "#003580" }}>
              📞 Interfone Digital
            </h2>
            <p className="text-sm mb-4" style={{ color: "#64748b" }}>Bloco {showQR.bloco_nome}</p>
            <div className="inline-block p-3 rounded-xl" style={{ border: "3px solid #003580" }}>
              <img
                src={getQRUrl(getInterfoneUrl(showQR.token))}
                alt={`QR Bloco ${showQR.bloco_nome}`}
                className="w-64 h-64"
              />
            </div>
            <p className="text-xs mt-3 mb-4" style={{ color: "#64748b" }}>
              Escaneie com a câmera do celular para ligar
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => handleCopy(showQR.token)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold"
                style={{ background: "#f8fafc", border: "1px solid #003580", color: "#003580" }}
              >
                <Copy className="w-3.5 h-3.5" /> Copiar Link
              </button>
              <button
                onClick={() => handlePrint(showQR)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white"
                style={{ background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)" }}
              >
                <Printer className="w-3.5 h-3.5" /> Imprimir
              </button>
              <button
                onClick={() => handleDownload(showQR)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold"
                style={{ background: "#f8fafc", border: "1px solid #003580", color: "#003580" }}
              >
                <Download className="w-3.5 h-3.5" /> Baixar
              </button>
            </div>
            <button
              onClick={() => setShowQR(null)}
              className="mt-4 text-xs"
              style={{ color: "#64748b" }}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
