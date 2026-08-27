import { beforeEach, describe, expect, it, vi } from "vitest";

// O e-mail de chamada perdida sai por SES; aqui só interessa se foi chamado.
vi.mock("../emailService.js", () => ({
  emailChamadaPerdida: vi.fn(async () => {}),
}));

const { emailChamadaPerdida } = await import("../emailService.js");
const { registrarAtendimento, finalizarChamada, encerrarChamadasOrfas } = await import("../callLog.js");
const db = (await import("../db.js")).default;

const CONDO = 900;
const MORADOR = 900;

db.prepare("INSERT OR IGNORE INTO condominios (id, name) VALUES (?, 'Condominio Teste')").run(CONDO);
db.prepare(
  `INSERT OR IGNORE INTO users (id, name, email, password, role, condominio_id)
   VALUES (?, 'Morador Teste', 'morador.teste@exemplo.invalid', 'x', 'morador', ?)`
).run(MORADOR, CONDO);

let seq = 0;
function criarChamada(opts: { moradorId?: number | null } = {}): string {
  const callId = `TEST-${++seq}-${Date.now()}`;
  db.prepare(
    `INSERT INTO interfone_calls (condominio_id, bloco, apartamento, morador_id, morador_nome, visitante_nome, call_id)
     VALUES (?, 'Torre A', '101', ?, 'Morador Teste', 'Visitante Teste', ?)`
  ).run(CONDO, opts.moradorId === undefined ? MORADOR : opts.moradorId, callId);
  return callId;
}

const ler = (callId: string) =>
  db.prepare("SELECT * FROM interfone_calls WHERE call_id = ?").get(callId) as any;

/** Recua o atendimento no tempo para a duração ser verificável sem esperar. */
const atendeuHa = (callId: string, segundos: number) =>
  db.prepare(
    `UPDATE interfone_calls SET atendido_at = datetime('now', ?) WHERE call_id = ?`
  ).run(`-${segundos} seconds`, callId);

describe("registrarAtendimento", () => {
  it("marca a chamada como atendida", () => {
    const callId = criarChamada();
    registrarAtendimento(callId);
    const l = ler(callId);
    expect(l.status).toBe("atendida");
    expect(l.atendido_at).toBeTruthy();
  });

  it("não reinicia o cronômetro quando o app reatende (handoff)", () => {
    const callId = criarChamada();
    registrarAtendimento(callId);
    atendeuHa(callId, 10);
    const antes = ler(callId).atendido_at;
    registrarAtendimento(callId);
    expect(ler(callId).atendido_at).toBe(antes);
  });

  it("ignora callId ausente", () => {
    expect(() => registrarAtendimento(undefined)).not.toThrow();
  });
});

describe("finalizarChamada", () => {
  beforeEach(() => vi.mocked(emailChamadaPerdida).mockClear());

  it("encerra com a duração contada a partir do atendimento", () => {
    const callId = criarChamada();
    registrarAtendimento(callId);
    atendeuHa(callId, 7);
    finalizarChamada(callId);
    const l = ler(callId);
    expect(l.status).toBe("encerrada");
    expect(l.duracao_segundos).toBeGreaterThanOrEqual(7);
    expect(l.duracao_segundos).toBeLessThan(10);
    expect(l.encerrado_at).toBeTruthy();
    expect(emailChamadaPerdida).not.toHaveBeenCalled();
  });

  it("grava recusada sem duração", () => {
    const callId = criarChamada();
    finalizarChamada(callId, { recusada: true });
    const l = ler(callId);
    expect(l.status).toBe("recusada");
    expect(l.duracao_segundos).toBe(0);
    expect(emailChamadaPerdida).not.toHaveBeenCalled();
  });

  it("chamada não atendida vira timeout e avisa o morador", () => {
    const callId = criarChamada();
    finalizarChamada(callId);
    const l = ler(callId);
    expect(l.status).toBe("timeout");
    expect(l.duracao_segundos).toBe(0);
    expect(emailChamadaPerdida).toHaveBeenCalledTimes(1);
    expect(vi.mocked(emailChamadaPerdida).mock.calls[0][0]).toMatchObject({
      condominioId: CONDO,
      moradorId: MORADOR,
      visitorName: "Visitante Teste",
    });
  });

  it("não manda e-mail quando a chamada não tem morador cadastrado", () => {
    const callId = criarChamada({ moradorId: null });
    finalizarChamada(callId);
    expect(ler(callId).status).toBe("timeout");
    expect(emailChamadaPerdida).not.toHaveBeenCalled();
  });

  it("guarda o resultado da queda de conexão", () => {
    const callId = criarChamada();
    registrarAtendimento(callId);
    finalizarChamada(callId, { resultado: "desconectado" });
    expect(ler(callId).resultado).toBe("desconectado");
  });

  it("é idempotente: o segundo desfecho não sobrescreve o primeiro", () => {
    const callId = criarChamada();
    registrarAtendimento(callId);
    atendeuHa(callId, 5);
    finalizarChamada(callId);
    const primeiro = ler(callId);
    finalizarChamada(callId, { recusada: true });
    finalizarChamada(callId, { resultado: "desconectado" });
    const depois = ler(callId);
    expect(depois.status).toBe(primeiro.status);
    expect(depois.duracao_segundos).toBe(primeiro.duracao_segundos);
    expect(depois.encerrado_at).toBe(primeiro.encerrado_at);
    expect(emailChamadaPerdida).not.toHaveBeenCalled();
  });

  it("ignora callId desconhecido (chamada interna, portaria) sem lançar", () => {
    expect(() => finalizarChamada("NAO-EXISTE")).not.toThrow();
    expect(() => finalizarChamada(undefined)).not.toThrow();
    expect(emailChamadaPerdida).not.toHaveBeenCalled();
  });
});

describe("encerrarChamadasOrfas", () => {
  beforeEach(() => vi.mocked(emailChamadaPerdida).mockClear());

  it("fecha o que ficou aberto no restart e não mexe no que já terminou", () => {
    const aberta = criarChamada();
    const atendida = criarChamada();
    registrarAtendimento(atendida);
    const fechada = criarChamada();
    registrarAtendimento(fechada);
    atendeuHa(fechada, 4);
    finalizarChamada(fechada);
    const antes = ler(fechada);

    encerrarChamadasOrfas();

    expect(ler(aberta)).toMatchObject({ status: "timeout", resultado: "interrompido" });
    expect(ler(atendida)).toMatchObject({ status: "encerrada", resultado: "interrompido" });
    expect(ler(aberta).encerrado_at).toBeTruthy();
    expect(ler(fechada)).toMatchObject({
      status: antes.status,
      duracao_segundos: antes.duracao_segundos,
      encerrado_at: antes.encerrado_at,
    });
    // Aviso atrasado não serve para nada: o sweep não dispara e-mail.
    expect(emailChamadaPerdida).not.toHaveBeenCalled();
  });
});
