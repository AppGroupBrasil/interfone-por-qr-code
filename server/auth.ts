import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import db, { deleteUserCascade, type DbUser, type DbCondominio } from "./db.js";
import { authenticate } from "./middleware.js";
import { emailBoasVindasMorador, emailBoasVindasSindico, emailSenhaAlterada, emailCodigoRecuperacao } from "./emailService.js";
import { JWT_SECRET, DEMO_MODE, SAMPLE_ACCOUNTS_ON_REGISTER } from "./config.js";
import { validatePin } from "./passwordPolicy.js";
import { log } from "./logger.js";

const router = Router();
const COOKIE_NAME = "session_token";
const TOKEN_TTL = "24h";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30d — o cookie sobrevive ao JWT
// O JWT vale 24h, mas o /refresh aceita um token vencido há até 30 dias. Sem isso o
// morador que fica um dia sem abrir o app perde a sessão — e sem sessão não há push,
// ou seja, a campainha simplesmente para de tocar.
const REFRESH_GRACE_SEC = 30 * 24 * 60 * 60;

function signToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function sanitizeUser(user: DbUser) {
  // Fetch condominio name if user belongs to one
  let condominioNome: string | null = null;
  if (user.condominio_id) {
    const condo = db.prepare("SELECT name FROM condominios WHERE id = ?").get(user.condominio_id) as { name: string } | undefined;
    condominioNome = condo?.name || null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    cpf: user.cpf,
    role: user.role,
    perfil: user.perfil,
    unit: user.unit,
    block: user.block,
    condominioId: user.condominio_id,
    condominio_nome: condominioNome,
    parent_administradora_id: user.parent_administradora_id || null,
    avatarUrl: user.avatar_url,
    aprovado: user.aprovado ?? 1,
  };
}

function setCookie(res: any, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

// ─── DEMO MODE ────────────────────────────────────────────
const DEMO_CONDO_CNPJ = "00000000000100";

function ensureDemoData() {
  const existing = db.prepare("SELECT id FROM condominios WHERE cnpj = ?").get(DEMO_CONDO_CNPJ) as { id: number } | undefined;
  if (existing) return existing.id;

  const hashedPw = bcrypt.hashSync("123456", 10);

  // Create demo condomínio
  const condoResult = db.prepare(
    `INSERT INTO condominios (name, cnpj, address, city, state, units_count) VALUES (?, ?, ?, ?, ?, ?)`
  ).run("Residencial App Interfone — Demonstração", DEMO_CONDO_CNPJ, "Av. Paulista, 1000", "São Paulo", "SP", 48);
  const condoId = condoResult.lastInsertRowid as number;

  // Create blocks
  const blockNames = ["Bloco A", "Bloco B", "Bloco C"];
  for (const bn of blockNames) {
    db.prepare("INSERT INTO blocks (condominio_id, name) VALUES (?, ?)").run(condoId, bn);
  }

  // Create demo síndico
  const sindicoRes = db.prepare(
    `INSERT INTO users (name, email, phone, password, role, perfil, unit, block, condominio_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run("Carlos Mendes", "demo.sindico@appinterfone.com", "(11) 99999-0001", hashedPw, "sindico", null, "101", "Bloco A", condoId);
  const sindicoId = sindicoRes.lastInsertRowid as number;
  db.prepare("UPDATE condominios SET admin_user_id = ? WHERE id = ?").run(sindicoId, condoId);

  // Create demo porteiro (funcionario)
  db.prepare(
    `INSERT INTO users (name, email, phone, password, role, perfil, unit, block, condominio_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run("Roberto Silva", "demo.porteiro@appinterfone.com", "+351913899907", hashedPw, "funcionario", null, null, null, condoId);

  // Create demo moradores
  const moradores = [
    { name: "Ana Souza", email: "demo.morador@appinterfone.com", phone: "(11) 99999-0003", unit: "201", block: "Bloco A", perfil: "proprietario" },
    { name: "Marcos Lima", email: "demo.morador2@appinterfone.com", phone: "(11) 99999-0004", unit: "302", block: "Bloco B", perfil: "inquilino" },
    { name: "Juliana Costa", email: "demo.morador3@appinterfone.com", phone: "(11) 99999-0005", unit: "103", block: "Bloco C", perfil: "proprietario" },
  ];
  const moradorIds: number[] = [];
  for (const m of moradores) {
    const r = db.prepare(
      `INSERT INTO users (name, email, phone, password, role, perfil, unit, block, condominio_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(m.name, m.email, m.phone, hashedPw, "morador", m.perfil, m.unit, m.block, condoId);
    moradorIds.push(r.lastInsertRowid as number);
  }

  // Seed visitors
  const now = new Date().toISOString();
  const visitors = [
    { nome: "João Pereira", documento: "123.456.789-00", telefone: "(11) 98888-1001", bloco: "Bloco A", apartamento: "201", status: "autorizado" },
    { nome: "Maria Oliveira", documento: "987.654.321-00", telefone: "(11) 98888-1002", bloco: "Bloco B", apartamento: "302", status: "pendente" },
    { nome: "Pedro Santos", documento: "456.789.123-00", telefone: "(11) 98888-1003", bloco: "Bloco A", apartamento: "101", status: "autorizado" },
    { nome: "Fernanda Alves", documento: "321.654.987-00", telefone: "(11) 98888-1004", bloco: "Bloco C", apartamento: "103", status: "saiu" },
  ];
  for (const v of visitors) {
    db.prepare(
      `INSERT INTO visitors (condominio_id, nome, documento, telefone, bloco, apartamento, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(condoId, v.nome, v.documento, v.telefone, v.bloco, v.apartamento, v.status, now);
  }

  // Seed vehicles
  const vehicles = [
    { placa: "ABC-1234", modelo: "Honda Civic Preto", cor: "Preto", morador_id: moradorIds[0], morador_name: "Ana Souza", bloco: "Bloco A", apartamento: "201" },
    { placa: "DEF-5678", modelo: "VW Golf Branco", cor: "Branco", morador_id: moradorIds[1], morador_name: "Marcos Lima", bloco: "Bloco B", apartamento: "302" },
    { placa: "GHI-9012", modelo: "Toyota Corolla Prata", cor: "Prata", morador_id: moradorIds[2], morador_name: "Juliana Costa", bloco: "Bloco C", apartamento: "103" },
  ];
  for (const v of vehicles) {
    db.prepare(
      `INSERT INTO vehicle_authorizations (condominio_id, morador_id, morador_name, bloco, apartamento, placa, modelo, cor, data_inicio, data_fim, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(condoId, v.morador_id, v.morador_name, v.bloco, v.apartamento, v.placa, v.modelo, v.cor, "2026-01-01", "2027-12-31", "ativa", now);
  }

  // Seed correspondências
  const corresp = [
    { morador_id: moradorIds[0], morador_name: "Ana Souza", bloco: "Bloco A", apartamento: "201", tipo: "Encomenda", remetente: "Mercado Livre" },
    { morador_id: moradorIds[1], morador_name: "Marcos Lima", bloco: "Bloco B", apartamento: "302", tipo: "Carta Registrada", remetente: "Banco do Brasil" },
    { morador_id: moradorIds[2], morador_name: "Juliana Costa", bloco: "Bloco C", apartamento: "103", tipo: "Caixa Grande", remetente: "Amazon" },
  ];
  for (let i = 0; i < corresp.length; i++) {
    const c = corresp[i];
    db.prepare(
      `INSERT INTO correspondencias (condominio_id, protocolo, morador_id, morador_name, bloco, apartamento, tipo, remetente, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(condoId, `DEMO-${String(i + 1).padStart(4, "0")}`, c.morador_id, c.morador_name, c.bloco, c.apartamento, c.tipo, c.remetente, "pendente", now);
  }

  // Seed pre-authorizations
  const preAuths = [
    { morador_id: moradorIds[0], morador_name: "Ana Souza", bloco: "Bloco A", apartamento: "201", visitante_nome: "Técnico NET", visitante_documento: "111.222.333-44" },
    { morador_id: moradorIds[1], morador_name: "Marcos Lima", bloco: "Bloco B", apartamento: "302", visitante_nome: "Entregador iFood", visitante_documento: "" },
  ];
  for (const pa of preAuths) {
    db.prepare(
      `INSERT INTO pre_authorizations (condominio_id, morador_id, morador_name, bloco, apartamento, visitante_nome, visitante_documento, data_inicio, data_fim, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(condoId, pa.morador_id, pa.morador_name, pa.bloco, pa.apartamento, pa.visitante_nome, pa.visitante_documento, "2026-03-01", "2026-03-31", "ativa", now);
  }

  // Seed delivery authorizations
  db.prepare(
    `INSERT INTO delivery_authorizations (condominio_id, morador_id, morador_name, bloco, apartamento, servico, numero_pedido, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(condoId, moradorIds[0], "Ana Souza", "Bloco A", "201", "iFood", "PED-88432", "pendente", now);

  db.prepare(
    `INSERT INTO delivery_authorizations (condominio_id, morador_id, morador_name, bloco, apartamento, servico, numero_pedido, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(condoId, moradorIds[1], "Marcos Lima", "Bloco B", "302", "Rappi", "RPP-55123", "pendente", now);

  return condoId;
}

// Ensure demo data exists on server start — somente quando DEMO_MODE ativo
if (DEMO_MODE) {
  try { ensureDemoData(); } catch (e) { log.warn("[DEMO] Demo data may already exist:", e); }

  // Fix demo passwords: update from "demo123" to numeric "123456"
  try {
    const demoEmails = [
      "demo.sindico@portariax.com",
      "demo.porteiro@portariax.com",
      "demo.morador@portariax.com",
      "demo.morador2@portariax.com",
      "demo.morador3@portariax.com",
    ];
    const numericHash = bcrypt.hashSync("123456", 10);
    for (const em of demoEmails) {
      const u = db.prepare("SELECT id, password FROM users WHERE email = ?").get(em) as { id: number; password: string } | undefined;
      if (u && !bcrypt.compareSync("123456", u.password)) {
        db.prepare("UPDATE users SET password = ? WHERE id = ?").run(numericHash, u.id);
      }
    }
  } catch (e) { log.warn("[DEMO] Password migration error:", e); }
}

const DEMO_EMAILS: Record<string, string> = {
  sindico: "demo.sindico@portariax.com",
  portaria: "demo.porteiro@portariax.com",
  morador: "demo.morador@portariax.com",
};

router.post("/demo", (req, res) => {
  try {
    if (!DEMO_MODE) {
      res.status(404).json({ error: "Modo de demonstração desativado." });
      return;
    }
    const { role } = req.body;
    if (!role || !DEMO_EMAILS[role]) {
      res.status(400).json({ error: "Perfil inválido. Use: sindico, portaria ou morador." });
      return;
    }

    ensureDemoData();

    const email = DEMO_EMAILS[role];
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as DbUser | undefined;
    if (!user) {
      res.status(500).json({ error: "Erro ao criar dados de demonstração." });
      return;
    }

    const token = signToken(user.id);
    setCookie(res, token);
    res.json({ user: sanitizeUser(user), token, demo: true });
  } catch (err) {
    log.error("[DEMO] Erro ao iniciar demonstração:", err);
    res.status(500).json({ error: "Erro interno ao iniciar demonstração." });
  }
});

// ─── SEARCH CONDOMÍNIO BY CNPJ ────────────────────────────
router.get("/condominio/search", (req, res) => {
  try {
    const { cnpj } = req.query;
    if (!cnpj || typeof cnpj !== "string") {
      res.status(400).json({ error: "Informe o CNPJ." });
      return;
    }

    const cleanCnpj = cnpj.replaceAll(/\D/g, "");
    if (cleanCnpj.length !== 14) {
      res.status(400).json({ error: "CNPJ deve ter 14 dígitos." });
      return;
    }

    const condo = db.prepare("SELECT * FROM condominios WHERE cnpj = ?").get(cleanCnpj) as DbCondominio | undefined;
    if (!condo) {
      res.status(404).json({ error: "Condomínio não encontrado. Verifique o CNPJ." });
      return;
    }

    const blocks = db.prepare("SELECT id, name FROM blocks WHERE condominio_id = ? ORDER BY name").all(condo.id) as { id: number; name: string }[];

    res.json({
      condominio: {
        id: condo.id,
        name: condo.name,
        address: condo.address,
        city: condo.city,
        state: condo.state,
        blocks: blocks.map((b) => b.name),
      },
    });
  } catch (err) {
    log.error("Condominio search error:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// ─── REGISTER MORADOR ────────────────────────────────────
router.post("/register/morador", async (req, res) => {
  try {
    const { name, email, phone, perfil, password, unit, block, condominioId } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ error: "Nome, e-mail e senha são obrigatórios." });
      return;
    }
    if (!validatePin(password, res)) return;

    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase().trim());
    if (existing) {
      res.status(409).json({ error: "Este e-mail já está cadastrado." });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Check if auto-cadastro requires approval for this condomínio
    let needsApproval = false;
    if (condominioId) {
      const configRow = db.prepare(
        "SELECT value FROM condominio_config WHERE condominio_id = ? AND key = 'feature_auto_cadastro'"
      ).get(condominioId) as { value: string } | undefined;
      if (configRow?.value === "true") {
        needsApproval = true;
      }
    }

    const result = db.prepare(
      "INSERT INTO users (name, email, phone, perfil, password, role, unit, block, condominio_id, aprovado) VALUES (?, ?, ?, ?, ?, 'morador', ?, ?, ?, ?)"
    ).run(
      name.trim(),
      email.toLowerCase().trim(),
      phone?.replaceAll(/\D/g, "") || null,
      perfil || null,
      hashedPassword,
      unit?.trim() || null,
      block?.trim() || null,
      condominioId || null,
      needsApproval ? 0 : 1
    );

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid) as DbUser;

    // 📧 Email: welcome morador
    const condoName = condominioId
      ? (db.prepare("SELECT name FROM condominios WHERE id = ?").get(condominioId) as { name: string } | undefined)?.name || "Condomínio"
      : "Condomínio";
    emailBoasVindasMorador({
      email: email.toLowerCase().trim(),
      nome: name.trim(),
      condominioNome: condoName,
      bloco: block?.trim() || undefined,
      apartamento: unit?.trim() || undefined,
    }).catch((err) => log.error("[EMAIL] Erro boas-vindas morador:", err));

    if (needsApproval) {
      // Don't auto-login — return a pending message
      res.json({
        pendingApproval: true,
        message: "Cadastro realizado com sucesso! Aguarde a aprovação do síndico ou administradora para acessar o sistema.",
      });
      return;
    }

    const token = signToken(user.id);
    setCookie(res, token);
    res.json({ user: sanitizeUser(user), token });
  } catch (err) {
    log.error("Register morador error:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// ─── REGISTER CONDOMÍNIO ─────────────────────────────────
router.post("/register/condominio", async (req, res) => {
  try {
    const { condominioName, cnpj, address, city, state, zipCode, unitsCount, hasPortaria, adminName, email, phone, password } = req.body;

    if (!condominioName || !adminName || !email || !password) {
      res.status(400).json({ error: "Nome do condomínio, responsável, e-mail e senha são obrigatórios." });
      return;
    }
    if (!validatePin(password, res)) return;

    const existingUser = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase().trim());
    if (existingUser) {
      res.status(409).json({ error: "Este e-mail já está cadastrado." });
      return;
    }

    if (cnpj) {
      const existingCondo = db.prepare("SELECT id FROM condominios WHERE cnpj = ?").get(cnpj.replaceAll(/\D/g, ""));
      if (existingCondo) {
        res.status(409).json({ error: "Este CNPJ já está cadastrado." });
        return;
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Create condominio
    const condoResult = db.prepare(
      "INSERT INTO condominios (name, cnpj, address, city, state, zip_code, units_count) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(
      condominioName.trim(),
      cnpj?.replaceAll(/\D/g, "") || null,
      address?.trim() || null,
      city?.trim() || null,
      state?.trim() || null,
      zipCode?.replaceAll(/\D/g, "") || null,
      unitsCount ? Number.parseInt(unitsCount) : 0
    );

    // Create admin user linked to condominio
    const userResult = db.prepare(
      "INSERT INTO users (name, email, phone, password, role, condominio_id) VALUES (?, ?, ?, ?, 'sindico', ?)"
    ).run(
      adminName.trim(),
      email.toLowerCase().trim(),
      phone?.replaceAll(/\D/g, "") || null,
      hashedPassword,
      condoResult.lastInsertRowid
    );

    // Link sindico to condominio
    db.prepare("UPDATE condominios SET admin_user_id = ? WHERE id = ?").run(
      userResult.lastInsertRowid,
      condoResult.lastInsertRowid
    );

    // Condomínio sem portaria: esconde o botão PORTARIA na tela do visitante.
    // Só grava quando é false — a ausência da chave já significa "tem portaria".
    if (hasPortaria === false) {
      db.prepare(
        `INSERT INTO condominio_config (condominio_id, key, value, updated_at)
         VALUES (?, 'feature_portaria', 'false', datetime('now'))
         ON CONFLICT(condominio_id, key) DO UPDATE SET value = 'false', updated_at = datetime('now')`
      ).run(condoResult.lastInsertRowid);
    }

    // ─── CREATE SAMPLE MORADOR ───────────────────────────
    // Gate atrás de SAMPLE_ACCOUNTS_ON_REGISTER (off em prod por padrão).
    if (SAMPLE_ACCOUNTS_ON_REGISTER) try {
      const sampleEmail = `morador.exemplo.${condoResult.lastInsertRowid}@demo.app`;
      const sampleName = "Morador Exemplo";
      const sampleBlock = "A";
      const sampleUnit = "101";

      db.prepare(
        `INSERT INTO users (name, email, phone, password, role, unit, block, condominio_id, is_demo)
         VALUES (?, ?, ?, ?, 'morador', ?, ?, ?, 1)`
      ).run(
        sampleName,
        sampleEmail,
        phone?.replaceAll(/\D/g, "") || null,
        hashedPassword,               // same 4-digit password
        sampleUnit,
        sampleBlock,
        condoResult.lastInsertRowid
      );
    } catch (sampleErr) {
      // Non-critical — don't fail the whole registration if sample creation fails
      log.warn("[REGISTER] Falha ao criar morador exemplo:", sampleErr);
    }

    // ─── CREATE SAMPLE PORTEIRO ───────────────────────────
    let samplePorteiroData: { email: string; name: string; cargo: string } | null = null;
    if (SAMPLE_ACCOUNTS_ON_REGISTER) try {
      const porteiroEmail = `porteiro.exemplo.${condoResult.lastInsertRowid}@demo.app`;
      const porteiroName = "Porteiro Exemplo";

      db.prepare(
        `INSERT INTO users (name, email, phone, password, role, condominio_id, is_demo)
         VALUES (?, ?, ?, ?, 'funcionario', ?, 1)`
      ).run(
        porteiroName,
        porteiroEmail,
        phone?.replaceAll(/\D/g, "") || null,
        hashedPassword,               // same 4-digit password
        condoResult.lastInsertRowid
      );

      samplePorteiroData = { email: porteiroEmail, name: porteiroName, cargo: "Porteiro" };
    } catch (porteiroErr) {
      log.warn("[REGISTER] Falha ao criar porteiro exemplo:", porteiroErr);
    }

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userResult.lastInsertRowid) as DbUser;
    const token = signToken(user.id);
    setCookie(res, token);

    // 📧 Email: welcome síndico
    emailBoasVindasSindico({
      email: email.toLowerCase().trim(),
      nome: adminName.trim(),
      condominioNome: condominioName.trim(),
    }).catch((err) => log.error("[EMAIL] Erro boas-vindas síndico:", err));

    // Include sample credentials in the response so the admin knows
    res.json({
      user: sanitizeUser(user),
      token,
      sampleMorador: SAMPLE_ACCOUNTS_ON_REGISTER ? {
        email: `morador.exemplo.${condoResult.lastInsertRowid}@demo.app`,
        name: "Morador Exemplo",
        block: "A",
        unit: "101",
        phone: phone?.replaceAll(/\D/g, "") || null,
        message: "Acesso de morador de exemplo criado automaticamente. Use o mesmo WhatsApp e senha para testar a experiência do morador."
      } : null,
      samplePorteiro: samplePorteiroData ? {
        email: samplePorteiroData.email,
        name: samplePorteiroData.name,
        cargo: samplePorteiroData.cargo,
        phone: phone?.replaceAll(/\D/g, "") || null,
        message: "Acesso de porteiro de exemplo criado automaticamente. Use o mesmo WhatsApp e senha para testar a experiência da portaria."
      } : null
    });
  } catch (err) {
    log.error("Register condominio error:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// ─── LOGIN HELPERS ───────────────────────────────────────
function setCookieAndRespond(res: any, token: string, userData: any) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
  res.json(userData);
}

function checkCondominioBlocked(condominioId: number, res: any): boolean {
  const condo = db.prepare("SELECT bloqueado, bloqueado_motivo, name FROM condominios WHERE id = ?")
    .get(condominioId) as { bloqueado: number; bloqueado_motivo: string | null; name: string } | undefined;
  if (condo?.bloqueado === 1) {
    res.status(403).json({
      error: "Usuário bloqueado! Entre em contato com seu síndico ou administradora.",
      blocked: true,
    });
    return true;
  }
  return false;
}

function trackCondominioAccess(condominioId: number) {
  db.prepare(`
    UPDATE condominios 
    SET last_access_at = datetime('now'), 
        access_count = COALESCE(access_count, 0) + 1 
    WHERE id = ?
  `).run(condominioId);
}

// ─── BLOQUEIO POR CONTA ──────────────────────────────────
// Com PIN de 6 dígitos numéricos (1 milhão de combinações), limitar por IP
// não basta: trocando de IP o atacante ganha 5 tentativas novas. Este
// contador mora na conta, então o alvo fica protegido venha de onde vier.
const MAX_TENTATIVAS = 5;
// Escalona a cada novo estouro de 5 falhas: 15min, 30min, 1h, 2h.
const BLOQUEIO_MINUTOS = [15, 30, 60, 120];
type TabelaLogin = "users" | "funcionarios";

// Minutos restantes de bloqueio, ou null se a conta está liberada.
function bloqueioRestante(tabela: TabelaLogin, id: number): number | null {
  const row = db
    .prepare(
      `SELECT CAST((julianday(locked_until) - julianday('now')) * 1440 + 0.999 AS INTEGER) AS minutos
         FROM ${tabela}
        WHERE id = ? AND locked_until IS NOT NULL AND locked_until > datetime('now')`
    )
    .get(id) as { minutos: number } | undefined;
  return row ? Math.max(1, row.minutos) : null;
}

function registrarFalha(tabela: TabelaLogin, id: number): void {
  db.prepare(`UPDATE ${tabela} SET failed_attempts = failed_attempts + 1 WHERE id = ?`).run(id);
  const row = db.prepare(`SELECT failed_attempts FROM ${tabela} WHERE id = ?`).get(id) as
    | { failed_attempts: number }
    | undefined;
  const falhas = row?.failed_attempts ?? 0;
  if (falhas > 0 && falhas % MAX_TENTATIVAS === 0) {
    const nivel = Math.floor(falhas / MAX_TENTATIVAS) - 1;
    const minutos = BLOQUEIO_MINUTOS[Math.min(nivel, BLOQUEIO_MINUTOS.length - 1)];
    db.prepare(`UPDATE ${tabela} SET locked_until = datetime('now', ?) WHERE id = ?`).run(
      `+${minutos} minutes`,
      id
    );
    log.warn(`[LOGIN] ${tabela}#${id} bloqueada por ${minutos} min após ${falhas} falhas`);
  }
}

// Acertou a senha (ou redefiniu): o histórico de falhas deixa de contar.
export function limparFalhasLogin(tabela: TabelaLogin, id: number): void {
  db.prepare(
    `UPDATE ${tabela} SET failed_attempts = 0, locked_until = NULL
      WHERE id = ? AND (failed_attempts != 0 OR locked_until IS NOT NULL)`
  ).run(id);
}

// Responde 429 e corta o login se a conta estiver bloqueada.
function barrarSeBloqueada(tabela: TabelaLogin, id: number, res: any): boolean {
  const minutos = bloqueioRestante(tabela, id);
  if (minutos === null) return false;
  res.status(429).json({
    error: `Conta temporariamente bloqueada por excesso de tentativas. Tente novamente em ${minutos} minuto${minutos > 1 ? "s" : ""}.`,
    lockedMinutes: minutos,
  });
  return true;
}

interface DbFuncionario {
  id: number;
  nome: string;
  sobrenome: string;
  login: string;
  password: string;
  cargo: string | null;
  condominio_id: number | null;
  created_at: string;
  updated_at: string;
}

async function handleFuncionarioLogin(credential: string, password: string, res: any) {
  const func = db.prepare("SELECT * FROM funcionarios WHERE login = ?").get(credential) as DbFuncionario | undefined;
  if (!func) {
    res.status(401).json({ error: "Login ou senha incorretos." });
    return;
  }

  if (barrarSeBloqueada("funcionarios", func.id, res)) return;

  const valid = await bcrypt.compare(password, func.password);
  if (!valid) {
    registrarFalha("funcionarios", func.id);
    res.status(401).json({ error: "Login ou senha incorretos." });
    return;
  }
  limparFalhasLogin("funcionarios", func.id);

  if (func.condominio_id && checkCondominioBlocked(func.condominio_id, res)) return;

  db.prepare("UPDATE funcionarios SET updated_at = datetime('now') WHERE id = ?").run(func.id);
  if (func.condominio_id) trackCondominioAccess(func.condominio_id);

  const token = jwt.sign({ funcId: func.id }, JWT_SECRET, { expiresIn: TOKEN_TTL });

  let condominioNome: string | null = null;
  if (func.condominio_id) {
    const condo = db.prepare("SELECT name FROM condominios WHERE id = ?").get(func.condominio_id) as { name: string } | undefined;
    condominioNome = condo?.name || null;
  }

  setCookieAndRespond(res, token, {
    user: {
      id: func.id,
      name: `${func.nome} ${func.sobrenome}`,
      email: func.login,
      phone: null,
      cpf: null,
      role: "funcionario",
      perfil: func.cargo,
      unit: null,
      block: null,
      condominioId: func.condominio_id,
      condominio_nome: condominioNome,
      parent_administradora_id: null,
      avatarUrl: null,
      aprovado: 1,
    },
    token,
  });
}

async function handleUserLogin(credential: string, password: string, res: any) {
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(credential) as DbUser | undefined;
  if (!user) {
    res.status(401).json({ error: "E-mail ou senha incorretos." });
    return;
  }

  if (barrarSeBloqueada("users", user.id, res)) return;

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    registrarFalha("users", user.id);
    res.status(401).json({ error: "E-mail ou senha incorretos." });
    return;
  }
  limparFalhasLogin("users", user.id);

  if (user.condominio_id && user.role !== "master" && checkCondominioBlocked(user.condominio_id, res)) return;

  if (user.role === "morador" && user.aprovado === 0) {
    res.status(403).json({
      error: "Seu cadastro ainda está aguardando aprovação do síndico ou administradora. Você será notificado quando for liberado.",
      pendingApproval: true,
    });
    return;
  }

  db.prepare("UPDATE users SET updated_at = datetime('now') WHERE id = ?").run(user.id);
  if (user.condominio_id) trackCondominioAccess(user.condominio_id);

  const token = signToken(user.id);
  setCookieAndRespond(res, token, { user: sanitizeUser(user), token });
}

// ─── LOGIN ───────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "E-mail/login e senha são obrigatórios." });
      return;
    }

    const credential = email.toLowerCase().trim();

    if (credential.includes("@")) {
      await handleUserLogin(credential, password, res);
    } else {
      await handleFuncionarioLogin(credential, password, res);
    }
  } catch (err) {
    log.error("Login error:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// ─── ME (Check session) ─────────────────────────────────
// Delega ao authenticate: trata token de usuário {userId}, de funcionário {funcId}
// e da central {sub, apps[]}. Antes só lia userId e quebrava a sessão de porteiros
// e de usuários da central no restore (401 → logout a cada recarga/reabertura).
router.get("/me", authenticate, (req, res) => {
  res.json({ user: sanitizeUser(req.user!) });
});

// ─── REFRESH (renew token before expiry) ─────────────────
router.post("/refresh", (req, res) => {
  try {
    let token: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) token = authHeader.slice(7);
    if (!token) token = req.cookies?.[COOKIE_NAME];
    if (!token) {
      res.status(401).json({ error: "Não autenticado." });
      return;
    }

    // ignoreExpiration: renovar token já expirado é justamente o caso de uso.
    // A assinatura continua sendo validada; só a validade é conferida à mão.
    const decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true }) as {
      userId?: number;
      funcId?: number;
      exp?: number;
    };
    const agora = Math.floor(Date.now() / 1000);
    if (decoded.exp && agora - decoded.exp > REFRESH_GRACE_SEC) {
      res.status(401).json({ error: "Sessão expirada. Faça login novamente." });
      return;
    }
    // O bloqueio comercial é conferido no login. Com a sessão longa (30 dias),
    // sem esta checagem o condomínio bloqueado por inadimplência continuaria
    // renovando o token e usando o sistema por semanas.
    let newToken: string;
    if (decoded.userId) {
      const user = db.prepare("SELECT id, role, condominio_id FROM users WHERE id = ?")
        .get(decoded.userId) as { id: number; role: string; condominio_id: number | null } | undefined;
      if (!user) { res.status(401).json({ error: "Usuário não encontrado." }); return; }
      if (user.condominio_id && user.role !== "master" && checkCondominioBlocked(user.condominio_id, res)) return;
      newToken = signToken(decoded.userId);
    } else if (decoded.funcId) {
      const func = db.prepare("SELECT id, condominio_id FROM funcionarios WHERE id = ?")
        .get(decoded.funcId) as { id: number; condominio_id: number | null } | undefined;
      if (!func) { res.status(401).json({ error: "Funcionário não encontrado." }); return; }
      if (func.condominio_id && checkCondominioBlocked(func.condominio_id, res)) return;
      newToken = jwt.sign({ funcId: decoded.funcId }, JWT_SECRET, { expiresIn: TOKEN_TTL });
    } else {
      res.status(401).json({ error: "Token inválido." });
      return;
    }

    setCookie(res, newToken);
    res.json({ token: newToken });
  } catch {
    res.status(401).json({ error: "Sessão expirada. Faça login novamente." });
  }
});

// ─── LOGOUT ──────────────────────────────────────────────
router.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.json({ success: true });
});

// ─── UPDATE MY ACCOUNT ──────────────────────────────────
router.put("/account", authenticate, async (req, res) => {
  try {
    const user = req.user!;
    const { name, phone, email, block, unit } = req.body;

    if (!name?.trim()) {
      res.status(400).json({ error: "Nome é obrigatório." });
      return;
    }

    // Funcionário: req.user.id é funcionarios.id — gravar em users corromperia a
    // conta de OUTRA pessoa com o mesmo id numérico. Atualiza a tabela correta.
    if (req.isFuncionario) {
      const partes = name.trim().split(/\s+/);
      const nome = partes.shift() || name.trim();
      const sobrenome = partes.join(" ");
      db.prepare(
        "UPDATE funcionarios SET nome = ?, sobrenome = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(nome, sobrenome, user.id);
      res.json({ user: sanitizeUser({ ...user, name: name.trim() } as DbUser), message: "Dados atualizados com sucesso." });
      return;
    }

    const normEmail = email ? String(email).toLowerCase().trim() : null;

    // Check email uniqueness if changed
    if (normEmail && normEmail !== user.email) {
      const existing = db.prepare("SELECT id FROM users WHERE email = ? AND id != ?").get(normEmail, user.id) as any;
      if (existing) {
        res.status(400).json({ error: "Este e-mail já está em uso." });
        return;
      }
    }

    db.prepare(
      "UPDATE users SET name = ?, phone = ?, email = ?, block = ?, unit = ? WHERE id = ?"
    ).run(name.trim(), phone || null, normEmail || user.email, block ?? user.block, unit ?? user.unit, user.id);

    // Return updated user
    const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id) as DbUser;
    res.json({ user: sanitizeUser(updated), message: "Dados atualizados com sucesso." });
  } catch (err: any) {
    log.error("Erro em auth :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ─── CHANGE PASSWORD ─────────────────────────────────────
router.put("/account/password", authenticate, async (req, res) => {
  try {
    const user = req.user!;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "Senha atual e nova senha são obrigatórias." });
      return;
    }

    // Mesma política de PIN do resto do sistema (6 dígitos, sem PINs fracos).
    if (!validatePin(newPassword, res)) return;

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      res.status(400).json({ error: "Senha atual incorreta." });
      return;
    }

    const hash = await bcrypt.hash(newPassword, 12);
    // Funcionário: req.user.id é funcionarios.id — gravar em users trocaria a senha
    // de OUTRA pessoa. Atualiza a tabela correta.
    if (req.isFuncionario) {
      db.prepare("UPDATE funcionarios SET password = ?, updated_at = datetime('now') WHERE id = ?").run(hash, user.id);
      res.json({ message: "Senha alterada com sucesso." });
      return;
    }
    db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hash, user.id);
    // Quem redefiniu a senha não deve continuar preso ao bloqueio anterior.
    limparFalhasLogin("users", user.id);

    // 📧 Email: password changed notification
    if (user.email) {
      emailSenhaAlterada({
        email: user.email,
        nome: user.name,
      }).catch((err) => log.error("[EMAIL] Erro senha alterada:", err));
    }

    res.json({ message: "Senha alterada com sucesso." });
  } catch (err: any) {
    log.error("Erro em auth :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ─── DELETE MY ACCOUNT (morador only) ────────────────────
router.delete("/account", authenticate, (req, res) => {
  try {
    const user = req.user!;

    if (user.role !== "morador") {
      res.status(403).json({ error: "Apenas moradores podem excluir sua própria conta." });
      return;
    }

    // Delete user (com limpeza de dependências para evitar erro de FK)
    deleteUserCascade(user.id);

    // Clear session
    res.clearCookie(COOKIE_NAME, { path: "/" });
    res.json({ message: "Conta excluída com sucesso." });
  } catch (err: any) {
    log.error("Erro em auth :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ─── PASSWORD RESET — Request code ──────────────────────
router.post("/password-reset/request", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: "Informe um e-mail válido." });
      return;
    }
    const emailNorm = String(email).toLowerCase().trim();

    const user = db.prepare("SELECT id, name, email FROM users WHERE email = ?").get(emailNorm) as { id: number; name: string; email: string } | undefined;
    // Always return success to prevent email enumeration
    if (!user) {
      res.json({ message: "Se o e-mail estiver cadastrado, você receberá um código de recuperação." });
      return;
    }

    // Invalidate previous codes
    db.prepare("UPDATE password_reset_codes SET used = 1 WHERE email = ? AND used = 0").run(emailNorm);

    // Generate 6-digit code
    const code = String(crypto.randomInt(100000, 999999));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min

    db.prepare("INSERT INTO password_reset_codes (email, code, expires_at) VALUES (?, ?, ?)").run(emailNorm, code, expiresAt);

    // Send email
    emailCodigoRecuperacao({ email: user.email, nome: user.name, codigo: code })
      .catch((err) => log.error("[EMAIL] Erro código recuperação:", err));

    res.json({ message: "Se o e-mail estiver cadastrado, você receberá um código de recuperação." });
  } catch (err: any) {
    log.error("Erro password-reset/request:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// ─── PASSWORD RESET — Verify code ───────────────────────
router.post("/password-reset/verify", (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      res.status(400).json({ error: "E-mail e código são obrigatórios." });
      return;
    }
    const emailNorm = String(email).toLowerCase().trim();

    const record = db.prepare(
      "SELECT id, expires_at FROM password_reset_codes WHERE email = ? AND code = ? AND used = 0 ORDER BY id DESC LIMIT 1"
    ).get(emailNorm, code) as { id: number; expires_at: string } | undefined;

    if (!record) {
      res.status(400).json({ error: "Código inválido ou já utilizado." });
      return;
    }

    if (new Date(record.expires_at) < new Date()) {
      res.status(400).json({ error: "Código expirado. Solicite um novo." });
      return;
    }

    res.json({ valid: true });
  } catch (err: any) {
    log.error("Erro password-reset/verify:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// ─── PASSWORD RESET — Set new password ──────────────────
router.post("/password-reset/reset", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      res.status(400).json({ error: "Dados incompletos." });
      return;
    }

    if (!validatePin(newPassword, res)) return;
    const emailNorm = String(email).toLowerCase().trim();

    const record = db.prepare(
      "SELECT id, expires_at FROM password_reset_codes WHERE email = ? AND code = ? AND used = 0 ORDER BY id DESC LIMIT 1"
    ).get(emailNorm, code) as { id: number; expires_at: string } | undefined;

    if (!record || new Date(record.expires_at) < new Date()) {
      res.status(400).json({ error: "Código inválido ou expirado." });
      return;
    }

    const user = db.prepare("SELECT id, name FROM users WHERE email = ?").get(emailNorm) as { id: number; name: string } | undefined;
    if (!user) {
      res.status(400).json({ error: "Usuário não encontrado." });
      return;
    }

    const hash = await bcrypt.hash(newPassword, 12);
    db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hash, user.id);

    // Mark code as used
    db.prepare("UPDATE password_reset_codes SET used = 1 WHERE id = ?").run(record.id);

    // Notify user
    emailSenhaAlterada({ email, nome: user.name })
      .catch((err) => log.error("[EMAIL] Erro senha alterada:", err));

    res.json({ message: "Senha redefinida com sucesso." });
  } catch (err: any) {
    log.error("Erro password-reset/reset:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

export default router;
