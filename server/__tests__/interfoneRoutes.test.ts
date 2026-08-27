import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../emailService.js", () => ({
  emailChamadaPerdida: vi.fn(async () => {}),
}));

const { emailChamadaPerdida } = await import("../emailService.js");
const router = (await import("../interfone.js")).default;
const db = (await import("../db.js")).default;

const CONDO = 910;
const MORADOR = 910;

db.prepare("INSERT OR IGNORE INTO condominios (id, name) VALUES (?, 'Condominio Rotas')").run(CONDO);
db.prepare(
  `INSERT OR IGNORE INTO users (id, name, email, password, role, condominio_id)
   VALUES (?, 'Morador Rotas', 'rotas.teste@exemplo.invalid', 'x', 'morador', ?)`
).run(MORADOR, CONDO);

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(router);

const chamadaValida = {
  condominio_id: CONDO,
  bloco: "Torre A",
  apartamento: "101",
  morador_id: MORADOR,
  morador_nome: "Morador Rotas",
  visitante_nome: "Visitante Rotas",
};

let seq = 0;
async function criarChamada(): Promise<{ callId: string; id: number }> {
  const callId = `ICALL-ROTAS-${++seq}-${Date.now()}`;
  const r = await request(app).post("/calls").send({ ...chamadaValida, call_id: callId });
  expect(r.status).toBe(201);
  return { callId, id: Number(r.body.id) };
}

const ler = (callId: string) =>
  db.prepare("SELECT * FROM interfone_calls WHERE call_id = ?").get(callId) as any;

describe("POST /calls", () => {
  it("registra a chamada como chamando", async () => {
    const { callId } = await criarChamada();
    expect(ler(callId)).toMatchObject({ status: "chamando", condominio_id: CONDO, morador_id: MORADOR });
  });

  it("exige bloco e apartamento", async () => {
    const r = await request(app).post("/calls").send({ ...chamadaValida, apartamento: "" });
    expect(r.status).toBe(400);
  });

  it("exige um morador de destino", async () => {
    const r = await request(app)
      .post("/calls")
      .send({ ...chamadaValida, morador_id: null, morador_nome: null });
    expect(r.status).toBe(400);
  });

  it("recusa condominio_id inválido — endpoint público", async () => {
    for (const condominio_id of [null, 0, -1, "abc"]) {
      const r = await request(app).post("/calls").send({ ...chamadaValida, condominio_id });
      expect(r.status).toBe(400);
    }
  });

  it("recusa condomínio inexistente", async () => {
    const r = await request(app).post("/calls").send({ ...chamadaValida, condominio_id: 999999 });
    expect(r.status).toBe(404);
  });

  it("corta campo fora do tamanho, para não virar despejo de storage", async () => {
    const r = await request(app)
      .post("/calls")
      .send({ ...chamadaValida, visitante_nome: "x".repeat(121) });
    expect(r.status).toBe(400);
  });
});

describe("PUT /calls/:id", () => {
  beforeEach(() => vi.mocked(emailChamadaPerdida).mockClear());

  it("recusa status fora da lista", async () => {
    const { callId } = await criarChamada();
    for (const status of [undefined, "", "cancelada", "DROP TABLE"]) {
      const r = await request(app).put(`/calls/${callId}`).send({ status });
      expect(r.status).toBe(400);
    }
    expect(ler(callId).status).toBe("chamando");
  });

  it("marca atendida e não reinicia o cronômetro no reatender do handoff", async () => {
    const { callId } = await criarChamada();
    await request(app).put(`/calls/${callId}`).send({ status: "atendida" });
    const primeiro = ler(callId).atendido_at;
    expect(primeiro).toBeTruthy();

    db.prepare("UPDATE interfone_calls SET atendido_at = datetime('now', '-30 seconds') WHERE call_id = ?").run(callId);
    const recuado = ler(callId).atendido_at;
    await request(app).put(`/calls/${callId}`).send({ status: "atendida" });
    expect(ler(callId).atendido_at).toBe(recuado);
  });

  it("PUT atrasado não reabre chamada já encerrada", async () => {
    const { callId } = await criarChamada();
    await request(app).put(`/calls/${callId}`).send({ status: "encerrada", duracao_segundos: 42 });
    const fechada = ler(callId);
    expect(fechada).toMatchObject({ status: "encerrada", duracao_segundos: 42 });

    await request(app).put(`/calls/${callId}`).send({ status: "atendida" });
    await request(app).put(`/calls/${callId}`).send({ status: "timeout" });
    const depois = ler(callId);
    expect(depois.status).toBe("encerrada");
    expect(depois.duracao_segundos).toBe(42);
    expect(depois.encerrado_at).toBe(fechada.encerrado_at);
    expect(emailChamadaPerdida).not.toHaveBeenCalled();
  });

  it("timeout avisa o morador uma vez só", async () => {
    const { callId } = await criarChamada();
    await request(app).put(`/calls/${callId}`).send({ status: "timeout" });
    expect(ler(callId).status).toBe("timeout");
    expect(emailChamadaPerdida).toHaveBeenCalledTimes(1);
    expect(vi.mocked(emailChamadaPerdida).mock.calls[0][0]).toMatchObject({
      condominioId: CONDO,
      moradorId: MORADOR,
      visitorName: "Visitante Rotas",
    });

    await request(app).put(`/calls/${callId}`).send({ status: "timeout" });
    expect(emailChamadaPerdida).toHaveBeenCalledTimes(1);
  });

  it("não casa pelo id sequencial: enumerar a tabela não muda nada", async () => {
    const { callId, id } = await criarChamada();
    const r = await request(app).put(`/calls/${id}`).send({ status: "timeout" });
    expect(r.status).toBe(200);
    expect(ler(callId).status).toBe("chamando");
    expect(emailChamadaPerdida).not.toHaveBeenCalled();
  });

  it("call_id desconhecido responde ok sem tocar em nada", async () => {
    const antes = db.prepare("SELECT COUNT(*) c FROM interfone_calls").get() as any;
    const r = await request(app).put("/calls/ICALL-NAO-EXISTE").send({ status: "encerrada" });
    expect(r.status).toBe(200);
    expect((db.prepare("SELECT COUNT(*) c FROM interfone_calls").get() as any).c).toBe(antes.c);
  });
});

describe("GET /public/:token — condomínio sem portaria", () => {
  const TOKEN_CONDO = "QR-ROTAS-CONDO";
  const TOKEN_BLOCO = "QR-ROTAS-BLOCO";

  const criarTokens = () => {
    db.prepare(
      `INSERT OR IGNORE INTO interfone_tokens (condominio_id, bloco_nome, token, tipo)
       VALUES (?, 'Todos', ?, 'condominio')`
    ).run(CONDO, TOKEN_CONDO);
    db.prepare(
      `INSERT OR IGNORE INTO interfone_tokens (condominio_id, bloco_nome, token, tipo)
       VALUES (?, 'Torre A', ?, 'bloco')`
    ).run(CONDO, TOKEN_BLOCO);
  };

  const setPortaria = (valor: string | null) => {
    if (valor === null) {
      db.prepare("DELETE FROM condominio_config WHERE condominio_id = ? AND key = 'feature_portaria'").run(CONDO);
      return;
    }
    db.prepare(
      `INSERT INTO condominio_config (condominio_id, key, value)
       VALUES (?, 'feature_portaria', ?)
       ON CONFLICT(condominio_id, key) DO UPDATE SET value = excluded.value`
    ).run(CONDO, valor);
  };

  beforeEach(criarTokens);

  it("sem a chave, o condomínio tem portaria (retrocompatível)", async () => {
    setPortaria(null);
    for (const t of [TOKEN_CONDO, TOKEN_BLOCO]) {
      const r = await request(app).get(`/public/${t}`);
      expect(r.status).toBe(200);
      expect(r.body.tem_portaria).toBe(true);
    }
  });

  it("com feature_portaria=false, esconde a portaria nos dois tipos de QR", async () => {
    setPortaria("false");
    for (const t of [TOKEN_CONDO, TOKEN_BLOCO]) {
      const r = await request(app).get(`/public/${t}`);
      expect(r.status).toBe(200);
      expect(r.body.tem_portaria).toBe(false);
    }
  });

  it("voltando para true, a portaria reaparece", async () => {
    setPortaria("true");
    const r = await request(app).get(`/public/${TOKEN_CONDO}`);
    expect(r.body.tem_portaria).toBe(true);
    setPortaria(null);
  });
});
