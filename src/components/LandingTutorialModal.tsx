import type { ReactNode } from "react";
import { X, ArrowRight, Building, User } from "lucide-react";

/* ── Reusable styled blocks (same as TutorialButton) ── */
const flowBoxStyle = (bg: string, border: string): React.CSSProperties => ({
  background: bg, borderRadius: "12px", padding: "14px", border: `2px solid ${border}`, marginBottom: "10px",
});
const flowHeaderStyle = (color: string): React.CSSProperties => ({
  display: "flex", alignItems: "center", gap: "8px", fontWeight: 800, fontSize: "13px", color, marginBottom: "8px", flexWrap: "wrap",
});

function FlowPortaria({ children }: { children: ReactNode }) {
  return (
    <div style={flowBoxStyle("#eef0f5", "#2d3354")}>
      <div style={flowHeaderStyle("#2d3354")}>
        <Building style={{ width: "16px", height: "16px" }} /> PORTARIA ENVIA
        <ArrowRight style={{ width: "14px", height: "14px" }} />
        <User style={{ width: "16px", height: "16px" }} /> MORADOR RECEBE
      </div>
      <div style={{ fontSize: "13px", color: "#374151", lineHeight: 1.7 }}>{children}</div>
    </div>
  );
}
function FlowMorador({ children }: { children: ReactNode }) {
  return (
    <div style={flowBoxStyle("#f0fdf4", "#86efac")}>
      <div style={flowHeaderStyle("#166534")}>
        <User style={{ width: "16px", height: "16px" }} /> MORADOR ENVIA
        <ArrowRight style={{ width: "14px", height: "14px" }} />
        <Building style={{ width: "16px", height: "16px" }} /> PORTARIA RECEBE
      </div>
      <div style={{ fontSize: "13px", color: "#374151", lineHeight: 1.7 }}>{children}</div>
    </div>
  );
}
function S({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 800, fontSize: "14px", color: "#1e293b", marginBottom: "8px" }}>{icon}{title}</div>
      <div style={{ fontSize: "13px", color: "#475569", lineHeight: 1.7 }}>{children}</div>
    </div>
  );
}
function St({ n, children }: { n: number; children: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: "10px", marginBottom: "6px" }}>
      <span style={{ width: "22px", height: "22px", borderRadius: "50%", background: "#6366f1", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 800, flexShrink: 0, marginTop: "1px" }}>{n}</span>
      <span style={{ fontSize: "13px", color: "#374151", lineHeight: 1.6 }}>{children}</span>
    </div>
  );
}
function B({ children }: { children: ReactNode }) {
  return <p style={{ fontSize: "13px", color: "#475569", lineHeight: 1.6, margin: "3px 0", paddingLeft: "8px" }}>• {children}</p>;
}

/* ═══════════════════════════════════════════════════════
   TUTORIAL CONTENT MAP — keyed by feature title
   ═══════════════════════════════════════════════════════ */
const tutorials: Record<string, ReactNode> = {
  /* ── PORTEIRO ── */
  "Cadastro de Visitantes": (
    <>
      <S icon={<span>📋</span>} title="O QUE E ESTA FUNCAO?">
        <p>Registra a <strong>entrada de visitantes</strong> no condominio. O porteiro cadastra o visitante com nome, foto, documento e morador visitado. O sistema registra data, hora e porteiro responsável. Tudo fica no histórico para consulta futura.</p>
      </S>
      <FlowPortaria>
        <St n={1}>Porteiro toca em <strong>+</strong> para abrir o formulario de novo visitante</St>
        <St n={2}>Preenche o <strong>nome completo</strong> do visitante</St>
        <St n={3}>Seleciona o <strong>morador que esta recebendo</strong> a visita (bloco + unidade)</St>
        <St n={4}>Informa o <strong>documento</strong> (RG ou CPF) — opcional</St>
        <St n={5}>Tira uma <strong>foto do visitante</strong> com a camera do celular (opcional mas recomendado)</St>
        <St n={6}>Clica em <strong>"Registrar Entrada"</strong> — sistema salva com data, hora e porteiro</St>
        <p style={{ marginTop: "8px", fontSize: "13px", color: "#2d3354" }}>👉 <strong>O morador ve:</strong> No app dele, aparece a notificacao de visitante e o registro na lista de visitas recebidas.</p>
      </FlowPortaria>
      <FlowMorador>
        <St n={1}>Morador cria uma <strong>autorizacao previa</strong> no app (nome, data, horario)</St>
        <St n={2}>Visitante chega na portaria e porteiro <strong>busca a autorizacao</strong></St>
        <St n={3}>Porteiro confirma a identidade e <strong>libera a entrada</strong> com um toque</St>
        <p style={{ marginTop: "8px", fontSize: "13px", color: "#166534" }}>👉 <strong>Portaria ve:</strong> O visitante ja aparece pre-autorizado na lista — so precisa confirmar e registrar a entrada.</p>
      </FlowMorador>
      <S icon={<span>🔧</span>} title="FUNCOES DISPONIVEIS">
        <B><strong>Foto do visitante</strong> — Tire foto com a camera do celular para registro de seguranca</B>
        <B><strong>Reconhecimento Facial</strong> — O sistema identifica visitantes recorrentes pela foto</B>
        <B><strong>QR Code</strong> — Visitante apresenta QR Code (gerado pelo morador) na portaria para entrada rapida</B>
        <B><strong>Busca rapida</strong> — Pesquise visitantes ja cadastrados anteriormente para reentrada rapida</B>
        <B><strong>Registro de saida</strong> — Marque quando o visitante sair do condominio</B>
        <B><strong>Relatorio PDF</strong> — Gere relatorios de visitantes por periodo com dados completos</B>
      </S>
      <S icon={<span>⭐</span>} title="DICAS IMPORTANTES">
        <B>Tire <strong>foto de todos os visitantes</strong> — e a melhor forma de garantir seguranca</B>
        <B>Visitantes que ja vieram antes aparecem na <strong>busca rapida</strong></B>
        <B>Autorizacoes previas dos moradores aparecem com <strong>destaque verde</strong></B>
        <B>Sempre <strong>registre a saida</strong> do visitante para manter o controle</B>
      </S>
    </>
  ),

  "Autorizações Prévias": (
    <>
      <S icon={<span>📋</span>} title="O QUE E ESTA FUNCAO?">
        <p>Lista todas as <strong>autorizacoes de visitantes criadas pelos moradores</strong>. Quando um morador autoriza um visitante pelo app, a autorizacao aparece aqui automaticamente para o porteiro consultar.</p>
      </S>
      <FlowMorador>
        <St n={1}>Morador abre o app e toca em <strong>"Autorizar Visitante"</strong></St>
        <St n={2}>Preenche <strong>nome do visitante</strong>, data e horario da visita</St>
        <St n={3}>Envia a autorizacao — pode adicionar CPF e veiculo (opcional)</St>
        <St n={4}>A autorizacao e <strong>enviada automaticamente</strong> para a portaria</St>
        <p style={{ marginTop: "8px", fontSize: "13px", color: "#166534" }}>👉 <strong>Portaria ve:</strong> A autorizacao aparece com status "Ativa" e todos os dados do visitante.</p>
      </FlowMorador>
      <FlowPortaria>
        <St n={1}>Visitante chega na portaria e se identifica</St>
        <St n={2}>Porteiro <strong>busca o nome</strong> na lista de autorizacoes</St>
        <St n={3}>Confirma que a autorizacao esta <strong>ativa e dentro do horario</strong></St>
        <St n={4}>Toca em <strong>"Confirmar Entrada"</strong> para liberar o visitante</St>
        <St n={5}>O sistema registra a entrada com data, hora e porteiro responsavel</St>
        <p style={{ marginTop: "8px", fontSize: "13px", color: "#2d3354" }}>👉 <strong>O morador ve:</strong> No app, o status muda para "Utilizada" com a data e hora da entrada.</p>
      </FlowPortaria>
      <S icon={<span>🔍</span>} title="STATUS DAS AUTORIZACOES">
        <B><strong style={{ color: "#16a34a" }}>Ativa</strong> — Visitante autorizado e pode entrar</B>
        <B><strong style={{ color: "#2d3354" }}>Utilizada</strong> — Visitante ja entrou</B>
        <B><strong style={{ color: "#d97706" }}>Pendente</strong> — Ainda nao chegou a data/hora</B>
        <B><strong style={{ color: "#dc2626" }}>Expirada</strong> — O prazo venceu</B>
        <B><strong style={{ color: "#6b7280" }}>Cancelada</strong> — Morador cancelou</B>
      </S>
      <S icon={<span>⭐</span>} title="DICAS IMPORTANTES">
        <B>Use a <strong>busca</strong> para encontrar autorizacoes rapidamente</B>
        <B>Autorizacoes <strong>expiram automaticamente</strong> apos o horario definido</B>
        <B>O morador pode <strong>cancelar</strong> a qualquer momento pelo app</B>
      </S>
    </>
  ),

  "Controle de Veículos": (
    <>
      <S icon={<span>📋</span>} title="O QUE E ESTA FUNCAO?">
        <p>Gerencia a <strong>entrada e saida de veiculos</strong> no condominio. O porteiro controla quais veiculos estao autorizados, registra movimentacoes e pode usar a <strong>camera LPR</strong> para leitura automatica de placas.</p>
      </S>
      <FlowMorador>
        <St n={1}>Morador abre o app e vai em <strong>"Meus Veiculos"</strong></St>
        <St n={2}>Cadastra o veiculo com <strong>placa, modelo, cor e tipo</strong></St>
        <St n={3}>O veiculo chega na sua tela com status <strong>"Pendente"</strong></St>
        <p style={{ marginTop: "8px", fontSize: "13px", color: "#166534" }}>👉 <strong>Sua acao:</strong> Revise os dados. Se estiver correto, toque em <strong>"Aprovar"</strong>.</p>
      </FlowMorador>
      <FlowPortaria>
        <St n={1}>Veiculo chega no portao do condominio</St>
        <St n={2}>Voce busca pela <strong>placa</strong> ou usa a <strong>camera LPR</strong></St>
        <St n={3}>O sistema mostra se o veiculo e <strong>autorizado</strong> (verde) ou <strong>desconhecido</strong> (vermelho)</St>
        <St n={4}>Se autorizado, toque em <strong>"Registrar Entrada"</strong> e abra o portao</St>
        <St n={5}>Na saida, toque em <strong>"Registrar Saida"</strong></St>
        <p style={{ marginTop: "8px", fontSize: "13px", color: "#2d3354" }}>👉 <strong>O morador ve:</strong> Historico de entradas e saidas com data e hora.</p>
      </FlowPortaria>
      <S icon={<span>🔧</span>} title="FUNCOES DISPONIVEIS">
        <B><strong>Camera LPR (OCR)</strong> — Aponte a camera para a placa e o sistema le automaticamente</B>
        <B><strong>Busca rapida</strong> — Pesquise por placa, morador, bloco ou modelo</B>
        <B><strong>Painel em tempo real</strong> — Veja quais veiculos estao dentro do condominio agora</B>
        <B><strong>Relatorio PDF</strong> — Gere relatorios de movimentacao por periodo</B>
      </S>
      <S icon={<span>⭐</span>} title="DICAS IMPORTANTES">
        <B>A <strong>camera LPR</strong> agiliza muito o trabalho — nao precisa digitar a placa</B>
        <B>Se um veiculo <strong>desconhecido</strong> tentar entrar, verifique com o morador antes</B>
        <B>Sempre <strong>registre entrada E saida</strong></B>
      </S>
    </>
  ),

  "Correspondências": (
    <>
      <S icon={<span>📋</span>} title="O QUE E ESTA FUNCAO?">
        <p>Registra e gerencia <strong>todas as correspondencias</strong> que chegam na portaria. O porteiro registra, o sistema envia <strong>notificacao automatica no WhatsApp</strong> do morador, e tudo fica com foto, tipo, origem, data e hora.</p>
      </S>
      <FlowPortaria>
        <St n={1}>Chegou uma encomenda, carta ou pacote na portaria</St>
        <St n={2}>Toque em <strong>+</strong> para registrar</St>
        <St n={3}>Selecione o <strong>morador destinatario</strong></St>
        <St n={4}>Informe o <strong>tipo</strong>: Encomenda, Carta, Documento, Pacote, Sedex</St>
        <St n={5}>Informe a <strong>origem</strong>: Correios, Mercado Livre, Amazon, Shopee, etc.</St>
        <St n={6}>Tire uma <strong>foto do pacote</strong> (opcional mas recomendado)</St>
        <St n={7}>Toque em <strong>"Registrar"</strong> — sistema envia <strong>WhatsApp automatico</strong></St>
        <p style={{ marginTop: "8px", fontSize: "13px", color: "#2d3354" }}>👉 <strong>O morador ve:</strong> Recebe WhatsApp + aparece no app com status "Aguardando retirada" e a foto.</p>
      </FlowPortaria>
      <FlowMorador>
        <St n={1}>Morador recebe a notificacao e vai ate a portaria</St>
        <St n={2}>Voce localiza a correspondencia e entrega</St>
        <St n={3}>Toque em <strong>"Confirmar Retirada"</strong></St>
        <St n={4}>Status muda para <strong>"Retirada"</strong> com data/hora</St>
      </FlowMorador>
      <S icon={<span>🔧</span>} title="FUNCOES DISPONIVEIS">
        <B><strong>Notificacao WhatsApp automatica</strong> — Morador recebe aviso instantaneo</B>
        <B><strong>Foto da correspondencia</strong> — Tire foto para comprovante</B>
        <B><strong>Busca rapida</strong> — Pesquise por morador, tipo ou origem</B>
        <B><strong>Relatorio PDF</strong> — Gere relatorios por periodo</B>
      </S>
      <S icon={<span>⭐</span>} title="DICAS IMPORTANTES">
        <B><strong>Sempre tire foto</strong> de encomendas e pacotes</B>
        <B>Correspondencias <strong>pendentes ha mais de 3 dias</strong> devem ser re-notificadas</B>
        <B>O morador recebe <strong>WhatsApp automatico</strong> — voce nao precisa ligar</B>
      </S>
    </>
  ),

  "Delivery": (
    <>
      <S icon={<span>📋</span>} title="O QUE E ESTA FUNCAO?">
        <p>Gerencia <strong>todas as entregas de delivery</strong> (iFood, Rappi, Uber Eats, Mercado Livre, Correios, etc.) que chegam na portaria.</p>
      </S>
      <FlowPortaria>
        <St n={1}>Entregador chega na portaria com o pedido</St>
        <St n={2}>Porteiro toca em <strong>+</strong> para registrar</St>
        <St n={3}>Seleciona o <strong>morador destinatario</strong></St>
        <St n={4}>Informa a <strong>origem</strong>: iFood, Rappi, Correios, etc.</St>
        <St n={5}>Informa o <strong>tipo</strong>: Comida, Pacote, Documento</St>
        <St n={6}>Tira <strong>foto da entrega</strong> (opcional)</St>
        <St n={7}>Toca em <strong>"Registrar"</strong> — notifica o morador automaticamente</St>
        <p style={{ marginTop: "8px", fontSize: "13px", color: "#2d3354" }}>👉 <strong>O morador ve:</strong> Notificacao no WhatsApp + aparece no app com "Aguardando retirada".</p>
      </FlowPortaria>
      <FlowMorador>
        <St n={1}>Morador pode avisar antecipado: <strong>"Estou esperando um iFood"</strong></St>
        <St n={2}>O aviso aparece na tela da portaria com <strong>destaque</strong></St>
        <St n={3}>Quando o entregador chegar, porteiro <strong>ja tem as informacoes</strong></St>
        <St n={4}>Morador desce e retira. Porteiro toca em <strong>"Confirmar Retirada"</strong></St>
      </FlowMorador>
      <S icon={<span>🔧</span>} title="FUNCOES DISPONIVEIS">
        <B><strong>Foto da entrega</strong> — Tire foto como comprovante</B>
        <B><strong>Notificacao automatica</strong> — WhatsApp + push no app</B>
        <B><strong>Busca rapida</strong> — Pesquise por morador, tipo ou origem</B>
        <B><strong>Relatorio PDF</strong> — Gere relatorios por periodo</B>
      </S>
      <S icon={<span>⭐</span>} title="DICAS IMPORTANTES">
        <B><strong>Sempre tire foto</strong> da entrega</B>
        <B>Entregas de <strong>comida</strong> devem ser entregues rapido</B>
        <B>Se o morador avisou previamente, aparece com <strong>destaque azul</strong></B>
      </S>
    </>
  ),

  "Livro de Protocolo": (
    <>
      <S icon={<span>📋</span>} title="O QUE E ESTA FUNCAO?">
        <p>E o <strong>livro de registro oficial da portaria</strong>. Substitui o caderno de papel por registro digital com <strong>fotos, assinatura digital, data/hora automatica e nome do porteiro</strong>.</p>
      </S>
      <FlowPortaria>
        <St n={1}>Toque em <strong>+</strong> para criar um novo registro</St>
        <St n={2}>Selecione o <strong>tipo do registro</strong>:</St>
        <B>→ <strong>Encomenda</strong> — Pacotes e correspondencias recebidas</B>
        <B>→ <strong>Entrega</strong> — Deliveries e entregas recebidas</B>
        <B>→ <strong>Retirada</strong> — Moradores que retiraram itens</B>
        <B>→ <strong>Ocorrencia</strong> — Incidentes, problemas, observacoes</B>
        <St n={3}>Preencha a <strong>descricao detalhada</strong></St>
        <St n={4}>Tire uma <strong>foto</strong> como comprovante visual (opcional)</St>
        <St n={5}><strong>Assine digitalmente</strong> desenhando com o dedo na tela</St>
        <St n={6}>Toque em <strong>"Registrar"</strong> — sistema salva com data, hora e seu nome</St>
        <p style={{ marginTop: "8px", fontSize: "13px", color: "#2d3354" }}>👉 <strong>Sindico/Administradora ve:</strong> No Espelho da Portaria, todos os registros com fotos e assinaturas.</p>
      </FlowPortaria>
      <S icon={<span>🔧</span>} title="FUNCOES DISPONIVEIS">
        <B><strong>Assinatura digital</strong> — Desenhe na tela do celular</B>
        <B><strong>Foto anexada</strong> — Tire foto de encomendas ou ocorrencias</B>
        <B><strong>Data/hora automatica</strong> — Registrado automaticamente</B>
        <B><strong>Relatorio PDF</strong> — Gere relatorios por periodo</B>
      </S>
      <S icon={<span>⭐</span>} title="DICAS IMPORTANTES">
        <B><strong>Registre TUDO</strong> que acontece na portaria</B>
        <B>Sempre <strong>tire foto</strong> de encomendas e pacotes</B>
        <B>A <strong>assinatura digital</strong> tem valor de comprovante</B>
        <B>O sindico pode <strong>consultar tudo remotamente</strong></B>
      </S>
    </>
  ),

  "Espelho de Portaria": (
    <>
      <S icon={<span>📋</span>} title="O QUE E ESTA FUNCAO?">
        <p>Tela de <strong>monitoramento e consulta</strong> para sindicos e administradoras acompanharem <strong>tudo que acontece na portaria em tempo real</strong>. Visao completa de correspondencias, autorizacoes, visitantes, veiculos, deliveries e livro de protocolo.</p>
      </S>
      <S icon={<span>👁️</span>} title="O QUE VOCE CONSEGUE VER">
        <B><strong>Correspondencias</strong> — Todas as encomendas e cartas, com status</B>
        <B><strong>Autorizacoes</strong> — Visitantes pre-autorizados pelos moradores</B>
        <B><strong>Visitantes</strong> — Registro completo de todas as entradas</B>
        <B><strong>Veiculos</strong> — Movimentacao com placa, modelo e horarios</B>
        <B><strong>Deliveries</strong> — Entregas recebidas com tipo e status</B>
        <B><strong>Livro de Protocolo</strong> — Registros oficiais com assinaturas e fotos</B>
      </S>
      <S icon={<span>🔧</span>} title="COMO USAR">
        <St n={1}>Selecione a <strong>aba desejada</strong> no topo</St>
        <St n={2}>Use a <strong>barra de busca</strong> para encontrar registros</St>
        <St n={3}>Use os <strong>filtros de data</strong> para periodos especificos</St>
        <St n={4}>Toque em um registro para ver os <strong>detalhes completos</strong></St>
        <St n={5}>Gere <strong>relatorios PDF</strong> quando necessario</St>
      </S>
      <S icon={<span>⚠️</span>} title="IMPORTANTE">
        <B>Esta tela e <strong>somente para consulta</strong></B>
        <B>Os registros sao criados <strong>automaticamente</strong></B>
        <B>Dados <strong>atualizados em tempo real</strong></B>
        <B>Use os <strong>relatorios PDF</strong> para reunioes de condominio</B>
      </S>
    </>
  ),

  "Monitoramento de Câmeras": (
    <>
      <S icon={<span>📋</span>} title="O QUE É ESTA FUNÇÃO?">
        <p><strong>Monitoramento ao vivo</strong> de todas as câmeras de segurança em uma única tela. Imagens em tempo real, layouts (1, 4 ou 9 câmeras), tela cheia e <strong>ronda automática</strong>.</p>
      </S>
      <S icon={<span>🏗️</span>} title="COMO USAR">
        <St n={1}>Câmeras cadastradas aparecem <strong>automaticamente</strong> no grid</St>
        <St n={2}>Escolha o <strong>layout</strong>: 1x1, 2x2 ou 3x3</St>
        <St n={3}>Clique em qualquer câmera para <strong>tela cheia</strong></St>
        <St n={4}>Ative a <strong>ronda automática</strong> para alternar entre câmeras</St>
      </S>
      <S icon={<span>🔧</span>} title="FUNÇÕES DISPONÍVEIS">
        <B><strong>Ronda automática</strong> — Alterna entre câmeras a cada X segundos</B>
        <B><strong>Status em tempo real</strong> — Verde (online) ou vermelho (offline)</B>
        <B><strong>Tela cheia</strong> — Clique para ampliar</B>
        <B><strong>Multi-formato</strong> — MJPEG, HLS e RTSP</B>
      </S>
      <S icon={<span>📱</span>} title="LAYOUTS DE MONITORAMENTO">
        <B><strong>1x1</strong> — Uma câmera grande. Ideal para ronda automática</B>
        <B><strong>2x2</strong> — 4 câmeras. Bom equilíbrio</B>
        <B><strong>3x3</strong> — 9 câmeras. Visão completa</B>
      </S>
      <S icon={<span>⭐</span>} title="DICAS IMPORTANTES">
        <B>Câmera <strong>offline (vermelha)</strong>? Avise o técnico</B>
        <B><strong>Ronda automática</strong> é ideal quando o porteiro faz outras tarefas</B>
        <B>Use <strong>3x3</strong> de dia e <strong>1x1 com ronda</strong> à noite</B>
      </S>
    </>
  ),

  "Controle de Rondas": (
    <>
      <S icon={<span>📋</span>} title="O QUE É ESTA FUNÇÃO?">
        <p>O porteiro executa as <strong>rondas de segurança</strong> escaneando QR Codes nos checkpoints. Cada ronda registra horário, fotos e observações. O síndico acompanha remotamente.</p>
      </S>
      <S icon={<span>🏗️</span>} title="COMO FAZER UMA RONDA">
        <St n={1}>Clique em <strong>"Iniciar Ronda"</strong> — cronômetro começa</St>
        <St n={2}>Vá até o <strong>primeiro checkpoint</strong></St>
        <St n={3}>Escaneie o <strong>QR Code</strong> com a câmera do celular</St>
        <St n={4}>Sistema registra: <strong>ponto + horário exato</strong></St>
        <St n={5}>Adicione <strong>observações</strong> e tire <strong>fotos</strong> se necessário</St>
        <St n={6}>Vá até o <strong>próximo checkpoint</strong> e repita</St>
        <St n={7}>Após todos os pontos, clique em <strong>"Finalizar Ronda"</strong></St>
      </S>
      <S icon={<span>🔧</span>} title="FUNÇÕES DISPONÍVEIS">
        <B><strong>Escanear QR Code</strong> — Aponte a câmera para o checkpoint</B>
        <B><strong>Foto por checkpoint</strong> — Comprovação visual</B>
        <B><strong>Cronômetro</strong> — Tempo total contado automaticamente</B>
        <B><strong>Progresso visual</strong> — Barra mostra quantos faltam</B>
        <B><strong>Alerta sonoro</strong> — Som quando ronda está atrasada</B>
      </S>
      <S icon={<span>⭐</span>} title="DICAS IMPORTANTES">
        <B><strong>Não pule checkpoints</strong> — o síndico sabe quais foram visitados</B>
        <B>Se encontrar algo <strong>suspeito</strong>, tire foto e descreva</B>
        <B>Ronda completa só quando <strong>todos os checkpoints</strong> forem escaneados</B>
      </S>
    </>
  ),

  "QR Scanner de Visitantes": (
    <>
      <S icon={<span>📋</span>} title="O QUE É ESTA FUNÇÃO?">
        <p>Gere <strong>QR Codes de autorização</strong> para visitantes. Compartilhe por WhatsApp e o visitante apresenta na portaria. O porteiro escaneia e libera instantaneamente — <strong>sem precisar ligar para você</strong>.</p>
      </S>
      <FlowMorador>
        <St n={1}>Toque em <strong>"+Novo"</strong> para criar autorização</St>
        <St n={2}>Informe o <strong>nome completo do visitante</strong></St>
        <St n={3}>Adicione <strong>CPF</strong> e <strong>veículo</strong> (opcional)</St>
        <St n={4}>Defina a <strong>data e horário de validade</strong></St>
        <St n={5}>O sistema gera o <strong>QR Code automaticamente</strong></St>
        <St n={6}>Toque em <strong>"Compartilhar"</strong> para enviar por WhatsApp</St>
        <p style={{ marginTop: "8px", fontSize: "13px", color: "#166534" }}>👉 <strong>Na portaria:</strong> Porteiro escaneia o QR Code e libera a entrada com um toque.</p>
      </FlowMorador>
      <S icon={<span>📱</span>} title="COMO O VISITANTE USA">
        <St n={1}>Recebe o QR Code por <strong>WhatsApp</strong></St>
        <St n={2}>Chega na portaria e mostra na <strong>tela do celular</strong></St>
        <St n={3}>Porteiro <strong>escaneia</strong> e vê todos os dados</St>
        <St n={4}>Porteiro <strong>libera a entrada</strong> com um toque</St>
      </S>
      <S icon={<span>⭐</span>} title="DICAS IMPORTANTES">
        <B>QR Code <strong>expira automaticamente</strong> na data definida</B>
        <B>Cada QR Code é <strong>único</strong> — não pode ser reusado</B>
        <B>Ideal para <strong>festas e eventos</strong></B>
        <B>Visitante <strong>não precisa instalar nenhum app</strong></B>
      </S>
    </>
  ),

  "Interfone Digital": (
    <>
      <S icon={<span>📋</span>} title="O QUE É ESTA FUNÇÃO?">
        <p>O <strong>Interfone Digital</strong> substitui o interfone físico. Cada bloco recebe um <strong>QR Code exclusivo</strong> que permite ao visitante ligar diretamente para o morador com <strong>vídeo unidirecional</strong>.</p>
      </S>
      <S icon={<span>🏢</span>} title="DOIS MODOS DE QR CODE">
        <St n={1}><strong>QR Code da Entrada Principal</strong> — Um único QR para o condomínio inteiro</St>
        <St n={2}><strong>QR Code por Bloco</strong> — Cada bloco tem seu próprio QR</St>
      </S>
      <S icon={<span>📱</span>} title="FLUXO DO VISITANTE">
        <St n={1}>Visitante escaneia o QR Code na entrada</St>
        <St n={2}>Seleciona o bloco e apartamento</St>
        <St n={3}>Dependendo do <strong>nível de segurança</strong>:</St>
        <B><strong>Nível 1</strong> — Ligação direta</B>
        <B><strong>Nível 2</strong> — Visitante digita o nome</B>
        <B><strong>Nível 3</strong> — Nome, empresa e foto</B>
        <St n={4}>Morador recebe a chamada com <strong>vídeo do visitante</strong></St>
        <St n={5}>Morador pode atender ou recusar a chamada</St>
      </S>
      <S icon={<span>🎮</span>} title="CONTROLES">
        <B><strong>🔇 Mudo</strong> — Desliga microfone</B>
        <B><strong>📞 Encerrar</strong> — Finaliza a chamada</B>
        <B><strong>🏢 PORTARIA</strong> — Visitante liga direto para o porteiro</B>
      </S>
      <S icon={<span>⭐</span>} title="DICAS IMPORTANTES">
        <B>Se um QR Code vazar, <strong>regenere-o</strong></B>
        <B>Moradores configuram <strong>nível de segurança</strong> individualmente</B>
        <B><strong>Horário silencioso</strong> impede chamadas em horários configurados</B>
        <B>Todas as chamadas ficam no <strong>histórico</strong></B>
        <B>Funciona em qualquer celular com <strong>câmera e navegador</strong></B>
      </S>
    </>
  ),

  /* ── MORADOR ── */
  "Autorizar Visitantes": (
    <>
      <S icon={<span>📋</span>} title="O QUE É ESTA FUNÇÃO?">
        <p><strong>Pré-autorize visitantes com antecedência</strong> para que a portaria saiba que eles podem entrar. Basta informar o nome, data e horário — a portaria libera sem precisar te ligar.</p>
      </S>
      <FlowMorador>
        <St n={1}>Toque em <strong>"+"</strong> para criar nova autorização</St>
        <St n={2}>Preencha o <strong>nome completo</strong> do visitante</St>
        <St n={3}>Defina a <strong>data e horário</strong> previsto</St>
        <St n={4}>Adicione <strong>CPF e veículo</strong> (opcional)</St>
        <St n={5}>Toque em <strong>"Enviar"</strong> — vai automaticamente para a portaria</St>
        <p style={{ marginTop: "8px", fontSize: "13px", color: "#166534" }}>👉 <strong>Portaria vê:</strong> A autorização com status "Ativa". Quando o visitante chegar, libera com um toque.</p>
      </FlowMorador>
      <S icon={<span>🔍</span>} title="STATUS">
        <B><strong style={{ color: "#16a34a" }}>Ativa</strong> — Aguardando chegada</B>
        <B><strong style={{ color: "#2d3354" }}>Utilizada</strong> — Visitante já entrou</B>
        <B><strong style={{ color: "#dc2626" }}>Expirada</strong> — Prazo venceu</B>
        <B><strong style={{ color: "#6b7280" }}>Cancelada</strong> — Você cancelou</B>
      </S>
      <S icon={<span>⭐</span>} title="DICAS IMPORTANTES">
        <B>Pode <strong>cancelar</strong> a qualquer momento antes do visitante chegar</B>
        <B>Autorizações <strong>expiram automaticamente</strong></B>
        <B>Para visitantes frequentes, use o <strong>QR Code</strong></B>
        <B>A portaria <strong>não precisa te ligar</strong> para confirmar</B>
      </S>
    </>
  ),

  "Meus Veículos": (
    <>
      <S icon={<span>📋</span>} title="O QUE É ESTA FUNÇÃO?">
        <p>Cadastre seus <strong>veículos (carros, motos, bicicletas)</strong> para que a portaria saiba quais são seus e liberem entrada/saída rapidamente.</p>
      </S>
      <FlowMorador>
        <St n={1}>Toque em <strong>"+"</strong> para cadastrar</St>
        <St n={2}>Informe a <strong>placa</strong></St>
        <St n={3}>Informe <strong>modelo</strong> e <strong>cor</strong></St>
        <St n={4}>Selecione o <strong>tipo</strong>: Carro, Moto, Van, Bicicleta</St>
        <St n={5}>Toque em <strong>"Cadastrar"</strong></St>
        <St n={6}>Status fica <strong>"Pendente"</strong> até o porteiro aprovar</St>
        <p style={{ marginTop: "8px", fontSize: "13px", color: "#166534" }}>👉 <strong>Portaria:</strong> Revisa e aprova. Após aprovado, autorizado permanentemente.</p>
      </FlowMorador>
      <S icon={<span>⭐</span>} title="DICAS IMPORTANTES">
        <B>Cadastre <strong>todos os veículos da família</strong></B>
        <B>Pode <strong>editar ou remover</strong> a qualquer momento</B>
        <B>Se trocar de carro, <strong>atualize o cadastro</strong></B>
        <B>Condomínios com <strong>câmera LPR</strong> identificam automaticamente</B>
      </S>
    </>
  ),

  "Minha Conta": (
    <>
      <S icon={<span>📋</span>} title="O QUE É ESTA FUNÇÃO?">
        <p>Atualize seus <strong>dados pessoais</strong> diretamente pelo app. Mantenha seu perfil atualizado para receber notificações e ser encontrado pela portaria.</p>
      </S>
      <S icon={<span>🏗️</span>} title="O QUE VOCÊ PODE FAZER">
        <St n={1}>Atualizar sua <strong>foto de perfil</strong></St>
        <St n={2}>Alterar seu <strong>nome</strong> e <strong>e-mail</strong></St>
        <St n={3}>Atualizar seu <strong>telefone/WhatsApp</strong></St>
        <St n={4}>Verificar seu <strong>bloco e unidade</strong></St>
        <St n={5}>Alterar sua <strong>senha</strong></St>
      </S>
      <S icon={<span>⭐</span>} title="DICAS IMPORTANTES">
        <B>Mantenha o <strong>WhatsApp atualizado</strong> para receber notificações</B>
        <B>A <strong>foto de perfil</strong> ajuda a portaria a te identificar</B>
        <B>Se mudar de unidade, peça ao <strong>síndico para atualizar</strong></B>
      </S>
    </>
  ),

  "QR Code de Visitante": (
    <>
      <S icon={<span>📋</span>} title="O QUE É ESTA FUNÇÃO?">
        <p>Gere um <strong>QR Code de convite</strong> para visitantes autorizados. O visitante apresenta o QR Code na portaria e o porteiro valida instantaneamente.</p>
      </S>
      <S icon={<span>🏗️</span>} title="COMO GERAR O QR CODE">
        <St n={1}>Abra o app e toque em <strong>"QR Code de Visitante"</strong></St>
        <St n={2}>Preencha o <strong>nome do visitante</strong></St>
        <St n={3}>Selecione a <strong>data e horário</strong> da visita</St>
        <St n={4}>Toque em <strong>"Gerar QR Code"</strong></St>
        <St n={5}>Compartilhe via <strong>WhatsApp</strong> com um toque</St>
      </S>
      <S icon={<span>📱</span>} title="NA PORTARIA">
        <St n={1}>Visitante apresenta o <strong>QR Code</strong> na portaria</St>
        <St n={2}>Porteiro escaneia com o <strong>QR Scanner</strong></St>
        <St n={3}>Sistema exibe dados do visitante e status da <strong>autorização</strong></St>
        <St n={4}>Porteiro confirma a <strong>entrada</strong></St>
      </S>
      <S icon={<span>⭐</span>} title="DICAS IMPORTANTES">
        <B>O QR Code tem <strong>validade</strong> — gere um novo se expirar</B>
        <B>Você pode <strong>revogar</strong> a autorização a qualquer momento</B>
        <B>Combinado com <strong>Autorizações Prévias</strong>, o processo é instantâneo</B>
      </S>
    </>
  ),

  /* ── ADMIN ── */
  "Gestão de Condomínio": (
    <>
      <S icon={<span>📋</span>} title="O QUE É ESTA FUNÇÃO?">
        <p><strong>Painel Master</strong> para criar, editar e gerenciar todos os condomínios. Cadastra com nome, CPF ou CNPJ, endereço, vincula administradoras e síndicos.</p>
      </S>
      <S icon={<span>🏗️</span>} title="COMO CADASTRAR">
        <St n={1}>Clique em <strong>"+"</strong> para abrir o formulário</St>
        <St n={2}>Preencha o <strong>nome</strong></St>
        <St n={3}>Escolha <strong>CPF ou CNPJ</strong> e informe o documento (se houver)</St>
        <St n={4}>Preencha o <strong>endereço completo</strong></St>
        <St n={5}>Informe o <strong>número de unidades</strong></St>
        <St n={6}>Vincule uma <strong>administradora</strong> (opcional)</St>
        <St n={7}>Clique em <strong>"Cadastrar"</strong></St>
      </S>
      <S icon={<span>⭐</span>} title="DICAS IMPORTANTES">
        <B>Ordem ideal: Condomínio → Administradora → Síndico → Blocos → Moradores → Funcionários</B>
        <B>Excluir condomínio <strong>apaga TODOS os dados</strong></B>
        <B>CPF/CNPJ é <strong>opcional mas recomendado</strong></B>
      </S>
    </>
  ),

  "Multi-perfil": (
    <>
      <S icon={<span>📋</span>} title="O QUE É ESTA FUNÇÃO?">
        <p>O sistema possui <strong>5 níveis de acesso</strong>, cada um com permissões específicas. Cada usuário vê apenas o que precisa para sua função.</p>
      </S>
      <S icon={<span>👥</span>} title="NÍVEIS DE ACESSO">
        <St n={1}><strong>Master</strong> — Acesso total. Gerencia todos os condomínios, administradoras e usuários. Painel de controle geral.</St>
        <St n={2}><strong>Administradora</strong> — Gerencia os condomínios vinculados. Cadastra síndicos, moradores e funcionários.</St>
        <St n={3}><strong>Síndico</strong> — Visualiza o Espelho da Portaria, configura rondas, câmeras, interfone. Relatórios gerenciais.</St>
        <St n={4}><strong>Funcionário/Porteiro</strong> — Opera a portaria: visitantes, veículos, correspondências, delivery, livro de protocolo, rondas.</St>
        <St n={5}><strong>Morador</strong> — Autoriza visitantes, acompanha entregas, cadastra veículos, usa interfone, gera QR Codes.</St>
      </S>
      <S icon={<span>⭐</span>} title="DICAS IMPORTANTES">
        <B>Cada nível vê <strong>apenas suas funções</strong> no menu</B>
        <B>Funcionários não veem dados administrativos</B>
        <B>Moradores só veem <strong>seus próprios dados</strong></B>
      </S>
    </>
  ),

  "Multi-condomínio": (
    <>
      <S icon={<span>📋</span>} title="O QUE É ESTA FUNÇÃO?">
        <p>Empresas de terceirização e administradoras gerenciam <strong>vários condomínios de uma única conta</strong>. Troque entre condomínios com um toque, sem precisar fazer login novamente.</p>
      </S>
      <S icon={<span>🏗️</span>} title="COMO FUNCIONA">
        <St n={1}>A administradora é vinculada a <strong>múltiplos condomínios</strong></St>
        <St n={2}>No topo da tela, aparece o <strong>seletor de condomínio</strong></St>
        <St n={3}>Toque para <strong>alternar entre condomínios</strong> instantaneamente</St>
        <St n={4}>Todos os dados (visitantes, veículos, etc.) são <strong>separados por condomínio</strong></St>
      </S>
      <S icon={<span>⭐</span>} title="DICAS IMPORTANTES">
        <B>Cada condomínio tem seus <strong>dados independentes</strong></B>
        <B>Relatórios são gerados <strong>por condomínio</strong></B>
        <B>Funcionários são vinculados a <strong>um condomínio específico</strong></B>
      </S>
    </>
  ),

  "Relatórios e PDF": (
    <>
      <S icon={<span>📋</span>} title="O QUE É ESTA FUNÇÃO?">
        <p>Gere <strong>relatórios profissionais em PDF</strong> de todas as atividades da portaria. Visitantes, veículos, correspondências, deliveries, rondas e protocolo — tudo documentado com dados completos.</p>
      </S>
      <S icon={<span>🏗️</span>} title="RELATÓRIOS DISPONÍVEIS">
        <St n={1}><strong>Visitantes</strong> — Lista de entradas com nome, foto, morador e horário</St>
        <St n={2}><strong>Veículos</strong> — Movimentação com placa, modelo e horários</St>
        <St n={3}><strong>Correspondências</strong> — Encomendas recebidas e retiradas</St>
        <St n={4}><strong>Deliveries</strong> — Entregas com tipo, origem e status</St>
        <St n={5}><strong>Rondas</strong> — Checkpoints visitados com fotos e horários</St>
        <St n={6}><strong>Livro de Protocolo</strong> — Registros com assinaturas</St>
      </S>
      <S icon={<span>⭐</span>} title="DICAS IMPORTANTES">
        <B>Filtre por <strong>período</strong> para relatórios específicos</B>
        <B>PDFs profissionais prontos para <strong>reuniões de condomínio</strong></B>
        <B>Podem ser <strong>enviados por e-mail</strong> ou impressos</B>
      </S>
    </>
  ),

  "Cadastro de Câmeras": (
    <>
      <S icon={<span>📋</span>} title="O QUE É ESTA FUNÇÃO?">
        <p>Cadastra e configura as <strong>câmeras de segurança</strong> do condomínio para monitoramento ao vivo. Adicione cada câmera com URL de stream, setor e teste a conexão.</p>
      </S>
      <S icon={<span>🏗️</span>} title="COMO CADASTRAR">
        <St n={1}>Clique em <strong>"+"</strong> para adicionar</St>
        <St n={2}>Informe o <strong>nome</strong> (ex: "Entrada Principal", "Garagem Bloco A")</St>
        <St n={3}>Selecione o <strong>setor</strong>: Entrada, Garagem, Portaria, Área Comum, Elevador</St>
        <St n={4}>Cole a <strong>URL de stream</strong>:</St>
        <B>→ <strong>MJPEG</strong>: http://IP:porta/video</B>
        <B>→ <strong>HLS</strong>: http://IP:porta/stream.m3u8</B>
        <B>→ <strong>RTSP</strong>: rtsp://IP:porta/stream</B>
        <St n={5}>Configure <strong>usuário e senha</strong> se necessário</St>
        <St n={6}>Clique em <strong>"Testar Conexão"</strong></St>
        <St n={7}>Se OK, clique em <strong>"Salvar"</strong></St>
      </S>
      <S icon={<span>⭐</span>} title="DICAS IMPORTANTES">
        <B>A URL é informada pelo <strong>técnico de CFTV</strong></B>
        <B>Câmeras devem estar na <strong>mesma rede</strong></B>
        <B>Formato <strong>MJPEG</strong> é o mais compatível</B>
      </S>
    </>
  ),

  "Relatórios com Gráficos": (
    <>
      <S icon={<span>📋</span>} title="O QUE É ESTA FUNÇÃO?">
        <p><strong>Dashboards visuais com gráficos</strong> de todas as atividades da portaria. Acompanhe tendências de visitantes, veículos, correspondências e rondas com visualizações claras e intuitivas.</p>
      </S>
      <S icon={<span>📊</span>} title="GRÁFICOS DISPONÍVEIS">
        <St n={1}><strong>Visitantes por período</strong> — Gráfico de barras/linha com entradas diárias, semanais ou mensais</St>
        <St n={2}><strong>Veículos</strong> — Fluxo de entrada/saída por horário (picos de movimento)</St>
        <St n={3}><strong>Correspondências</strong> — Volume recebido vs retirado por semana</St>
        <St n={4}><strong>Rondas</strong> — Percentual de conclusão e pontualidade</St>
        <St n={5}><strong>Dashboard geral</strong> — Visão consolidada de todas as métricas</St>
      </S>
      <S icon={<span>⭐</span>} title="DICAS IMPORTANTES">
        <B>Filtre por <strong>período</strong> para análises específicas</B>
        <B>Ideal para <strong>reuniões de condomínio</strong> e prestação de contas</B>
        <B>Gráficos <strong>atualizam em tempo real</strong></B>
      </S>
    </>
  ),

  "Configuração de Features": (
    <>
      <S icon={<span>📋</span>} title="O QUE É ESTA FUNÇÃO?">
        <p><strong>Ative ou desative funcionalidades</strong> para cada condomínio individualmente. Personalize o sistema conforme a necessidade de cada condomínio — sem pagar por recursos que não usa.</p>
      </S>
      <S icon={<span>🏗️</span>} title="COMO USAR">
        <St n={1}>Selecione o <strong>condomínio</strong></St>
        <St n={2}>Veja a lista de <strong>todas as features disponíveis</strong></St>
        <St n={3}>Ative ou desative cada feature com o <strong>botão de toggle</strong></St>
        <St n={4}>Features desativadas ficam <strong>invisíveis</strong> para porteiros e moradores</St>
        <St n={5}>As alterações são <strong>aplicadas imediatamente</strong></St>
      </S>
      <S icon={<span>🔧</span>} title="FEATURES CONFIGURÁVEIS">
        <B><strong>Cadastro de Visitantes</strong>, <strong>Autorizações Prévias</strong></B>
        <B><strong>Controle de Veículos</strong>, <strong>Correspondências</strong>, <strong>Delivery</strong></B>
        <B><strong>Livro de Protocolo</strong>, <strong>Monitoramento de Câmeras</strong></B>
        <B><strong>Controle de Rondas</strong>, <strong>Interfone Digital</strong></B>
        <B><strong>Portaria Virtual (IoT)</strong>, <strong>QR Code de Visitante</strong></B>
      </S>
      <S icon={<span>⭐</span>} title="DICAS IMPORTANTES">
        <B>Condomínios pequenos podem <strong>desativar features complexas</strong></B>
        <B>Features desativadas <strong>não aparecem no menu</strong> dos usuários</B>
        <B>Pode <strong>reativar</strong> a qualquer momento sem perder dados</B>
      </S>
    </>
  ),

  /* ── VITRINE DA LANDING (interfonia v1) ── */
  "QR Code Inteligente": (
    <>
      <S icon={<span>📋</span>} title="O QUE É ESTA FUNÇÃO?">
        <p>Cada bloco — ou o condomínio inteiro — recebe um <strong>QR Code exclusivo</strong>. O visitante aponta a câmera, escolhe o apartamento e a chamada sai na hora. <strong>Sem instalar aplicativo</strong> e sem interfone físico na parede.</p>
      </S>
      <S icon={<span>🏗️</span>} title="COMO COLOCAR NO AR">
        <St n={1}>O síndico cadastra os <strong>blocos e unidades</strong> no painel</St>
        <St n={2}>O sistema gera o <strong>QR Code de cada bloco</strong></St>
        <St n={3}>Imprima a placa e fixe na <strong>entrada correspondente</strong></St>
        <St n={4}>Pronto: o visitante já consegue chamar o morador</St>
      </S>
      <S icon={<span>⭐</span>} title="DICAS IMPORTANTES">
        <B>Se uma placa for adulterada ou o link vazar, <strong>regenere o QR Code</strong> — o antigo para de funcionar</B>
        <B>O visitante usa <strong>o próprio celular</strong>, no navegador</B>
        <B>Também funciona por <strong>link direto</strong>, sem a placa</B>
      </S>
    </>
  ),

  "Videochamada em Tempo Real": (
    <>
      <S icon={<span>📋</span>} title="O QUE É ESTA FUNÇÃO?">
        <p>A chamada do interfone é uma <strong>videochamada de verdade</strong>: o morador vê e ouve o visitante ao vivo, esteja em casa, no trabalho ou viajando.</p>
      </S>
      <S icon={<span>📱</span>} title="COMO FUNCIONA">
        <St n={1}>O visitante aparece com <strong>vídeo e áudio</strong> para o morador</St>
        <St n={2}>O morador responde <strong>por áudio</strong> — a câmera dele não é exposta</St>
        <St n={3}>A conversa é <strong>direta entre os dois aparelhos</strong>, sem passar por gravação</St>
        <St n={4}>Se o morador não atender, a chamada segue para o <strong>plano B</strong></St>
      </S>
      <S icon={<span>⭐</span>} title="DICAS IMPORTANTES">
        <B>Funciona em <strong>Wi-Fi ou dados móveis</strong></B>
        <B>Nada é gravado: fica registrado <strong>quem chamou e quando</strong></B>
        <B>Na primeira chamada o navegador pede permissão de <strong>câmera e microfone</strong></B>
      </S>
    </>
  ),

  "Notificações Instantâneas": (
    <>
      <S icon={<span>📋</span>} title="O QUE É ESTA FUNÇÃO?">
        <p>O celular do morador <strong>toca como uma ligação</strong> quando alguém chama no interfone — mesmo com o aplicativo fechado e a tela bloqueada.</p>
      </S>
      <S icon={<span>📱</span>} title="COMO FUNCIONA">
        <St n={1}>A chamada chega como <strong>notificação de campainha</strong>, com toque e vibração</St>
        <St n={2}>A tela mostra <strong>atender</strong> ou <strong>recusar</strong>, como numa chamada telefônica</St>
        <St n={3}>Ao atender, a videochamada abre <strong>direto na tela</strong></St>
        <St n={4}>Se ninguém atender, o visitante é direcionado ao <strong>WhatsApp do morador</strong> — se o morador tiver autorizado</St>
      </S>
      <S icon={<span>⭐</span>} title="DICAS IMPORTANTES">
        <B>Mantenha o app instalado e <strong>logado</strong> para receber a campainha</B>
        <B>O <strong>horário silencioso</strong> bloqueia chamadas nos períodos que o morador definir</B>
        <B>Toda tentativa fica registrada no <strong>histórico</strong>, atendida ou não</B>
      </S>
    </>
  ),

  "3 Níveis de Segurança": (
    <>
      <S icon={<span>📋</span>} title="O QUE É ESTA FUNÇÃO?">
        <p>Cada morador escolhe <strong>quanta informação o visitante precisa dar</strong> antes de tocar o interfone. A configuração é por unidade — o síndico não decide pelo morador.</p>
      </S>
      <S icon={<span>🏗️</span>} title="OS TRÊS NÍVEIS">
        <St n={1}><strong>Nível 1 — Chamada direta</strong>: o visitante liga na hora</St>
        <St n={2}><strong>Nível 2 — Identificação</strong>: o visitante informa o nome antes de chamar</St>
        <St n={3}><strong>Nível 3 — Identificação completa</strong>: nome, empresa e foto</St>
      </S>
      <S icon={<span>⭐</span>} title="DICAS IMPORTANTES">
        <B>O morador troca de nível <strong>quando quiser</strong>, pelo próprio app</B>
        <B>Nos níveis 2 e 3 os dados informados aparecem <strong>antes de atender</strong></B>
        <B>Some-se a isso o <strong>horário silencioso</strong> para as madrugadas</B>
      </S>
    </>
  ),

  "Gestão de Blocos e Unidades": (
    <>
      <S icon={<span>📋</span>} title="O QUE É ESTA FUNÇÃO?">
        <p>É no painel do síndico que o condomínio ganha forma: <strong>blocos, unidades, moradores e funcionários</strong>. Cada bloco cadastrado gera o seu QR Code automaticamente.</p>
      </S>
      <S icon={<span>🏗️</span>} title="ORDEM DE CADASTRO">
        <St n={1}>Cadastre os <strong>blocos</strong> (ou apenas a entrada principal)</St>
        <St n={2}>Cadastre as <strong>unidades</strong> de cada bloco</St>
        <St n={3}>Cadastre os <strong>moradores</strong> e envie o acesso</St>
        <St n={4}>Cadastre os <strong>funcionários da portaria</strong>, se houver</St>
        <St n={5}>Imprima e fixe os <strong>QR Codes</strong> nas entradas</St>
      </S>
      <S icon={<span>⭐</span>} title="DICAS IMPORTANTES">
        <B>Cada pessoa entra com <strong>PIN de 6 dígitos</strong></B>
        <B>Uma unidade pode ter <strong>mais de um morador</strong> recebendo a chamada</B>
        <B>Morador desligado <strong>para de receber</strong> chamadas na hora</B>
      </S>
    </>
  ),

  "Histórico de Chamadas": (
    <>
      <S icon={<span>📋</span>} title="O QUE É ESTA FUNÇÃO?">
        <p>Toda chamada fica registrada: <strong>data, hora, unidade, quem chamou e o que aconteceu</strong> — atendida, recusada, perdida ou encaminhada para o WhatsApp.</p>
      </S>
      <S icon={<span>🏗️</span>} title="O QUE VOCÊ CONSULTA">
        <St n={1}>O <strong>morador</strong> vê as chamadas da própria unidade</St>
        <St n={2}>O <strong>síndico</strong> vê o movimento do condomínio inteiro</St>
        <St n={3}>Filtre por <strong>período</strong> e exporte em <strong>PDF</strong></St>
      </S>
      <S icon={<span>⭐</span>} title="DICAS IMPORTANTES">
        <B>Serve de <strong>prova de tentativa de contato</strong> em caso de discussão</B>
        <B>Chamada não atendida aparece como <strong>perdida</strong>, não some</B>
        <B>Nenhum áudio ou vídeo é gravado — <strong>só o registro</strong></B>
      </S>
    </>
  ),
};

/* Titulos da vitrine que reaproveitam um tutorial ja escrito. */
const aliases: Record<string, string> = {
  "Interfone Digital por QR Code": "Interfone Digital",
};

/* ═══════════════════════════════════════════════════════
   MODAL COMPONENT
   ═══════════════════════════════════════════════════════ */
interface Props {
  featureTitle: string;
  onClose: () => void;
}

export default function LandingTutorialModal({ featureTitle, onClose }: Props) {
  const content = tutorials[featureTitle] ?? tutorials[aliases[featureTitle] ?? ""];
  if (!content) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px",
        animation: "fadeIn 0.2s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: "20px",
          maxWidth: "480px", width: "100%",
          maxHeight: "85vh", overflow: "auto",
          boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
          animation: "slideUp 0.25s ease",
        }}
      >
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, #0062d1 0%, #003d99 50%, #001d4a 100%)",
          padding: "20px 20px 16px", borderRadius: "20px 20px 0 0",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          position: "sticky", top: 0, zIndex: 2,
        }}>
          <div>
            <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)", fontWeight: 700, textTransform: "uppercase", margin: 0 }}>
              Tutorial
            </p>
            <h2 style={{ fontSize: "17px", fontWeight: 800, color: "#fff", margin: "4px 0 0" }}>
              {featureTitle}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              width: "32px", height: "32px", borderRadius: "50%",
              background: "rgba(255,255,255,0.15)", border: "none",
              color: "#fff", cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center",
            }}
          >
            <X style={{ width: "18px", height: "18px" }} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "20px" }}>
          {content}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(30px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </div>
  );
}
