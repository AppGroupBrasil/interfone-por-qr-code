/**
 * ═══════════════════════════════════════════════════════════
 * HISTÓRICO DE CHAMADAS — desfecho gravado pelo servidor
 * ═══════════════════════════════════════════════════════════
 * A linha em interfone_calls nasce no POST /api/interfone/calls (visitante) com
 * status "chamando". Quem sabe como a chamada terminou é a sinalização, não a
 * tela: o app pode ser fechado, perder a rede ou trocar de socket no handoff
 * antes de mandar qualquer PUT — por isso o desfecho é gravado aqui, a partir
 * dos eventos do WebSocket.
 *
 * Toda escrita é idempotente: só mexe em chamada ainda aberta (encerrado_at
 * nulo), então call-end seguido de desconexão não sobrescreve o primeiro
 * desfecho nem conta a duração duas vezes.
 */
import db from "./db.js";
import { emailChamadaPerdida } from "./emailService.js";
import { log } from "./logger.js";

type LinhaChamada = {
  condominio_id: number;
  morador_id: number | null;
  morador_nome: string | null;
  visitante_nome: string | null;
  bloco: string;
  apartamento: string;
  created_at: string;
  atendido_at: string | null;
};

/** Marca a chamada como atendida (só a primeira vez: o timer da duração parte daqui). */
export function registrarAtendimento(callId: string | undefined): void {
  if (!callId) return;
  try {
    db.prepare(
      `UPDATE interfone_calls
          SET status = 'atendida', atendido_at = datetime('now')
        WHERE call_id = ? AND encerrado_at IS NULL AND atendido_at IS NULL`
    ).run(callId);
  } catch (err) {
    log.error("[HISTORICO] Erro ao marcar chamada atendida:", err);
  }
}

/**
 * Fecha a chamada no histórico.
 *
 * `recusada` é o único desfecho explícito; nos demais o status sai do que já
 * aconteceu: com atendido_at gravado a chamada foi "encerrada" (com duração),
 * sem ele ninguém atendeu — é "timeout", e o morador recebe o e-mail de chamada
 * perdida, disparado uma única vez porque a linha já não está mais aberta.
 */
export function finalizarChamada(
  callId: string | undefined,
  opcoes: { recusada?: boolean; resultado?: string } = {}
): void {
  if (!callId) return;
  try {
    const linha = db
      .prepare(
        `SELECT condominio_id, morador_id, morador_nome, visitante_nome, bloco,
                apartamento, created_at, atendido_at
           FROM interfone_calls
          WHERE call_id = ? AND encerrado_at IS NULL`
      )
      .get(callId) as LinhaChamada | undefined;
    if (!linha) return; // chamada inexistente (interna/portaria) ou já finalizada

    const status = opcoes.recusada ? "recusada" : linha.atendido_at ? "encerrada" : "timeout";
    const duracao = linha.atendido_at
      ? `MAX(0, CAST(strftime('%s', 'now') AS INTEGER) - CAST(strftime('%s', atendido_at) AS INTEGER))`
      : "0";

    db.prepare(
      `UPDATE interfone_calls
          SET status = ?, encerrado_at = datetime('now'),
              duracao_segundos = ${duracao},
              resultado = COALESCE(?, resultado)
        WHERE call_id = ? AND encerrado_at IS NULL`
    ).run(status, opcoes.resultado ?? null, callId);

    if (status === "timeout" && linha.morador_id) {
      emailChamadaPerdida({
        condominioId: linha.condominio_id,
        moradorId: linha.morador_id,
        moradorName: linha.morador_nome || "Morador",
        visitorName: linha.visitante_nome || "Visitante",
        bloco: linha.bloco,
        apartamento: linha.apartamento,
        horario: new Date(linha.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      }).catch((err) => log.error("[EMAIL] Erro chamada perdida:", err));
    }
  } catch (err) {
    log.error("[HISTORICO] Erro ao finalizar chamada:", err);
  }
}

/**
 * Fecha no boot as chamadas que ficaram abertas.
 *
 * Nenhuma chamada sobrevive a um restart (as conexões WS caem todas), então
 * linha com encerrado_at nulo aqui é resíduo — de um restart no meio da
 * chamada ou de antes deste desfecho existir. Fica marcada como interrompida,
 * sem duração (o servidor estava fora, não dá para saber quanto durou) e sem
 * e-mail de chamada perdida, que seria atrasado e inútil.
 */
export function encerrarChamadasOrfas(): void {
  try {
    const r = db
      .prepare(
        `UPDATE interfone_calls
            SET status = CASE WHEN atendido_at IS NULL THEN 'timeout' ELSE 'encerrada' END,
                encerrado_at = datetime('now'),
                resultado = COALESCE(resultado, 'interrompido')
          WHERE encerrado_at IS NULL`
      )
      .run();
    if (r.changes > 0) log.info(`[HISTORICO] ${r.changes} chamada(s) órfã(s) encerrada(s) no boot`);
  } catch (err) {
    log.error("[HISTORICO] Erro ao encerrar chamadas órfãs:", err);
  }
}
