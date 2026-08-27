import bcrypt from "bcryptjs";
import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

// Nenhum e-mail sai daqui: o SES é real e um destino de teste geraria bounce.
vi.mock("../emailService.js", () => ({
  emailBoasVindasMorador: vi.fn(async () => {}),
  emailBoasVindasSindico: vi.fn(async () => {}),
  emailSenhaAlterada: vi.fn(async () => {}),
  emailCodigoRecuperacao: vi.fn(async () => {}),
}));

const router = (await import("../auth.js")).default;
const db = (await import("../db.js")).default;

const CONDO = 920;
const SENHA = "SenhaDeTeste#2026";
// Custo 4 só no teste: bcrypt.compare aceita qualquer custo gravado no hash.
const HASH = bcrypt.hashSync(SENHA, 4);

db.prepare("INSERT OR IGNORE INTO condominios (id, name) VALUES (?, 'Condominio Auth')").run(CONDO);

let seq = 0;
function criarUsuario(opts: { aprovado?: number; role?: string } = {}): { id: number; email: string } {
  const email = `auth.teste.${++seq}.${Date.now()}@exemplo.invalid`;
  const info = db
    .prepare(
      `INSERT INTO users (name, email, password, role, condominio_id, aprovado)
       VALUES ('Morador Auth', ?, ?, ?, ?, ?)`
    )
    .run(email, HASH, opts.role ?? "morador", CONDO, opts.aprovado ?? 1);
  return { id: Number(info.lastInsertRowid), email };
}

const lerUsuario = (id: number) =>
  db.prepare("SELECT failed_attempts, locked_until FROM users WHERE id = ?").get(id) as any;

const app = express();
app.use(express.json());
app.use(router);

describe("POST /login", () => {
  it("exige credencial e senha", async () => {
    expect((await request(app).post("/login").send({})).status).toBe(400);
    expect((await request(app).post("/login").send({ email: "a@b.com" })).status).toBe(400);
  });

  it("e-mail desconhecido e senha errada respondem igual, sem revelar qual falhou", async () => {
    const { email, id } = criarUsuario();
    const inexistente = await request(app)
      .post("/login")
      .send({ email: "nao.existe@exemplo.invalid", password: SENHA });
    const senhaErrada = await request(app).post("/login").send({ email, password: "errada" });

    expect(inexistente.status).toBe(401);
    expect(senhaErrada.status).toBe(401);
    expect(senhaErrada.body.error).toBe(inexistente.body.error);
    // A falha fica registrada na conta — é o que sustenta o bloqueio.
    expect(lerUsuario(id).failed_attempts).toBe(1);
  });

  it("senha certa devolve token, cookie de sessão e zera as falhas", async () => {
    const { email, id } = criarUsuario();
    await request(app).post("/login").send({ email, password: "errada" });

    const r = await request(app).post("/login").send({ email, password: SENHA });
    expect(r.status).toBe(200);
    expect(r.body.token).toBeTruthy();
    expect(r.body.user).toMatchObject({ id, role: "morador", condominioId: CONDO });
    expect(r.body.user.password).toBeUndefined();

    const cookie = (r.headers["set-cookie"] as unknown as string[]).join(";");
    expect(cookie).toContain("session_token=");
    expect(cookie).toContain("HttpOnly");

    expect(lerUsuario(id).failed_attempts).toBe(0);
  });

  it("aceita o e-mail como o morador digitou (maiúsculas, espaço)", async () => {
    const { email } = criarUsuario();
    const r = await request(app)
      .post("/login")
      .send({ email: `  ${email.toUpperCase()} `, password: SENHA });
    expect(r.status).toBe(200);
  });

  it("morador ainda não aprovado não entra", async () => {
    const { email } = criarUsuario({ aprovado: 0 });
    const r = await request(app).post("/login").send({ email, password: SENHA });
    expect(r.status).toBe(403);
    expect(r.body.pendingApproval).toBe(true);
    expect(r.body.token).toBeUndefined();
  });

  it("bloqueia a conta na 5ª falha — e a senha certa também espera", async () => {
    const { email, id } = criarUsuario();
    for (let i = 0; i < 5; i++) {
      const r = await request(app).post("/login").send({ email, password: "errada" });
      expect(r.status).toBe(401);
    }
    expect(lerUsuario(id).locked_until).toBeTruthy();

    const bloqueado = await request(app).post("/login").send({ email, password: SENHA });
    expect(bloqueado.status).toBe(429);
    expect(bloqueado.body.lockedMinutes).toBeGreaterThan(0);
    expect(bloqueado.body.lockedMinutes).toBeLessThanOrEqual(15);
    expect(bloqueado.body.token).toBeUndefined();

    // Passado o bloqueio, a conta volta a aceitar a senha correta.
    db.prepare("UPDATE users SET locked_until = datetime('now', '-1 minute') WHERE id = ?").run(id);
    const liberado = await request(app).post("/login").send({ email, password: SENHA });
    expect(liberado.status).toBe(200);
    expect(lerUsuario(id)).toMatchObject({ failed_attempts: 0, locked_until: null });
  });

  it("condomínio bloqueado barra o login do morador", async () => {
    const { email } = criarUsuario();
    db.prepare("UPDATE condominios SET bloqueado = 1 WHERE id = ?").run(CONDO);
    try {
      const r = await request(app).post("/login").send({ email, password: SENHA });
      expect(r.status).toBe(403);
      expect(r.body.blocked).toBe(true);
    } finally {
      db.prepare("UPDATE condominios SET bloqueado = 0 WHERE id = ?").run(CONDO);
    }
  });
});

describe("GET /me", () => {
  it("devolve a sessão do token emitido no login", async () => {
    const { email, id } = criarUsuario();
    const login = await request(app).post("/login").send({ email, password: SENHA });
    const r = await request(app).get("/me").set("Authorization", `Bearer ${login.body.token}`);
    expect(r.status).toBe(200);
    expect(r.body.user ?? r.body).toMatchObject({ id, email });
  });

  it("sem token não há sessão", async () => {
    expect((await request(app).get("/me")).status).toBe(401);
    expect((await request(app).get("/me").set("Authorization", "Bearer nao-e-um-jwt")).status).toBe(401);
  });
});

describe("POST /register/condominio — portaria opcional", () => {
  const registrar = async (hasPortaria?: boolean) => {
    const email = `sindico.portaria.${++seq}.${Date.now()}@exemplo.invalid`;
    const r = await request(app).post("/register/condominio").send({
      condominioName: `Condominio Portaria ${seq}`,
      adminName: "Sindico Teste",
      email,
      password: "748213",
      ...(hasPortaria === undefined ? {} : { hasPortaria }),
    });
    expect(r.status).toBe(200);
    const cid = (db.prepare("SELECT condominio_id c FROM users WHERE email = ?").get(email) as any).c;
    return db.prepare(
      "SELECT value FROM condominio_config WHERE condominio_id = ? AND key = 'feature_portaria'"
    ).get(cid) as { value: string } | undefined;
  };

  it("sem portaria grava feature_portaria=false", async () => {
    expect(await registrar(false)).toMatchObject({ value: "false" });
  });

  it("com portaria não grava nada (padrão continua ligado)", async () => {
    expect(await registrar(true)).toBeUndefined();
    expect(await registrar()).toBeUndefined();
  });
});
