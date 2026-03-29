import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db, { type DbUser, type DbCondominio } from "./db.js";
import { authenticate } from "./middleware.js";
import { emailBoasVindasMorador, emailBoasVindasSindico, emailSenhaAlterada } from "./emailService.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production-32chars!!";
const COOKIE_NAME = "session_token";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

function signToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
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
    aprovado: (user as any).aprovado ?? 1,
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

  const hashedPw = bcrypt.hashSync("demo123", 10);

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
  ).run("Roberto Silva", "demo.porteiro@appinterfone.com", "(11) 99999-0002", hashedPw, "funcionario", null, null, null, condoId);

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

// Ensure demo data exists on server start
try { ensureDemoData(); } catch (e) { console.warn("[DEMO] Demo data may already exist:", e); }

const DEMO_EMAILS: Record<string, string> = {
  sindico: "demo.sindico@appinterfone.com",
  portaria: "demo.porteiro@appinterfone.com",
  morador: "demo.morador@appinterfone.com",
};

router.post("/demo", (req, res) => {
  try {
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
    console.error("[DEMO] Erro ao iniciar demonstração:", err);
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
    console.error("Condominio search error:", err);
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
    if (!/^\d{6}$/.test(password)) {
      res.status(400).json({ error: "Senha deve ter exatamente 6 dígitos numéricos." });
      return;
    }

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
    }).catch((err) => console.error("[EMAIL] Erro boas-vindas morador:", err));

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
    console.error("Register morador error:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// ─── REGISTER CONDOMÍNIO ─────────────────────────────────
router.post("/register/condominio", async (req, res) => {
  try {
    const { condominioName, cnpj, address, city, state, zipCode, unitsCount, adminName, email, phone, password } = req.body;

    if (!condominioName || !adminName || !email || !password) {
      res.status(400).json({ error: "Nome do condomínio, responsável, e-mail e senha são obrigatórios." });
      return;
    }
    if (!/^\d{6}$/.test(password)) {
      res.status(400).json({ error: "Senha deve ter exatamente 6 dígitos numéricos." });
      return;
    }

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

    // ─── CREATE SAMPLE MORADOR ───────────────────────────
    // Auto-create a demo resident account so the person who registered
    // can see the morador experience. Uses a derived email and the same
    // phone/WhatsApp + password so they can easily log in and test.
    try {
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
      console.warn("[REGISTER] Falha ao criar morador exemplo:", sampleErr);
    }

    // ─── CREATE SAMPLE PORTEIRO ───────────────────────────
    // Auto-create a demo porteiro/funcionario account so the person
    // can also test the portaria experience (visitor control, deliveries, etc.)
    let samplePorteiroData: { email: string; name: string; cargo: string } | null = null;
    try {
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
      console.warn("[REGISTER] Falha ao criar porteiro exemplo:", porteiroErr);
    }

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userResult.lastInsertRowid) as DbUser;
    const token = signToken(user.id);
    setCookie(res, token);

    // 📧 Email: welcome síndico
    emailBoasVindasSindico({
      email: email.toLowerCase().trim(),
      nome: adminName.trim(),
      condominioNome: condominioName.trim(),
    }).catch((err) => console.error("[EMAIL] Erro boas-vindas síndico:", err));

    // Include sample credentials in the response so the admin knows
    res.json({
      user: sanitizeUser(user),
      token,
      sampleMorador: {
        email: `morador.exemplo.${condoResult.lastInsertRowid}@demo.app`,
        name: "Morador Exemplo",
        block: "A",
        unit: "101",
        phone: phone?.replaceAll(/\D/g, "") || null,
        message: "Acesso de morador de exemplo criado automaticamente. Use o mesmo WhatsApp e senha para testar a experiência do morador."
      },
      samplePorteiro: samplePorteiroData ? {
        email: samplePorteiroData.email,
        name: samplePorteiroData.name,
        cargo: samplePorteiroData.cargo,
        phone: phone?.replaceAll(/\D/g, "") || null,
        message: "Acesso de porteiro de exemplo criado automaticamente. Use o mesmo WhatsApp e senha para testar a experiência da portaria."
      } : null
    });
  } catch (err) {
    console.error("Register condominio error:", err);
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

async function handleFuncionarioLogin(credential: string, password: string, res: any) {
  const func = db.prepare("SELECT * FROM funcionarios WHERE login = ?").get(credential) as any;
  if (!func) {
    res.status(401).json({ error: "Login ou senha incorretos." });
    return;
  }

  const valid = await bcrypt.compare(password, func.password);
  if (!valid) {
    res.status(401).json({ error: "Login ou senha incorretos." });
    return;
  }

  if (func.condominio_id && checkCondominioBlocked(func.condominio_id, res)) return;

  db.prepare("UPDATE funcionarios SET updated_at = datetime('now') WHERE id = ?").run(func.id);
  if (func.condominio_id) trackCondominioAccess(func.condominio_id);

  const token = jwt.sign({ funcId: func.id }, JWT_SECRET, { expiresIn: "7d" });

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

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    res.status(401).json({ error: "E-mail ou senha incorretos." });
    return;
  }

  if (user.condominio_id && user.role !== "master" && checkCondominioBlocked(user.condominio_id, res)) return;

  if (user.role === "morador" && (user as any).aprovado === 0) {
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
    console.error("Login error:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// ─── ME (Check session) ─────────────────────────────────
router.get("/me", (req, res) => {
  try {
    // 1) Try Authorization header first (Capacitor / mobile app)
    let token: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    }
    // 2) Fall back to cookie (web browser)
    if (!token) {
      token = req.cookies?.[COOKIE_NAME];
    }
    if (!token) {
      res.status(401).json({ error: "Não autenticado." });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(decoded.userId) as DbUser | undefined;

    if (!user) {
      res.clearCookie(COOKIE_NAME);
      res.status(401).json({ error: "Usuário não encontrado." });
      return;
    }

    res.json({ user: sanitizeUser(user) });
  } catch {
    res.clearCookie(COOKIE_NAME);
    res.status(401).json({ error: "Sessão inválida." });
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
    const user = req.user;
    const { name, phone, email, block, unit } = req.body;

    if (!name?.trim()) {
      res.status(400).json({ error: "Nome é obrigatório." });
      return;
    }

    // Check email uniqueness if changed (skip for funcionario who may not have email)
    if (email && email !== user.email) {
      const existing = db.prepare("SELECT id FROM users WHERE email = ? AND id != ?").get(email, user.id) as any;
      if (existing) {
        res.status(400).json({ error: "Este e-mail já está em uso." });
        return;
      }
    }

    db.prepare(
      "UPDATE users SET name = ?, phone = ?, email = ?, block = ?, unit = ? WHERE id = ?"
    ).run(name.trim(), phone || null, email || user.email, block ?? user.block, unit ?? user.unit, user.id);

    // Return updated user
    const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id) as DbUser;
    res.json({ user: sanitizeUser(updated), message: "Dados atualizados com sucesso." });
  } catch (err: any) {
    console.error("Erro em auth :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ─── CHANGE PASSWORD ─────────────────────────────────────
router.put("/account/password", authenticate, async (req, res) => {
  try {
    const user = req.user;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "Senha atual e nova senha são obrigatórias." });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ error: "A nova senha deve ter pelo menos 6 caracteres." });
      return;
    }

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      res.status(400).json({ error: "Senha atual incorreta." });
      return;
    }

    const hash = await bcrypt.hash(newPassword, 10);
    db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hash, user.id);

    // 📧 Email: password changed notification
    if (user.email) {
      emailSenhaAlterada({
        email: user.email,
        nome: user.name,
      }).catch((err) => console.error("[EMAIL] Erro senha alterada:", err));
    }

    res.json({ message: "Senha alterada com sucesso." });
  } catch (err: any) {
    console.error("Erro em auth :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ─── DELETE MY ACCOUNT (morador only) ────────────────────
router.delete("/account", authenticate, (req, res) => {
  try {
    const user = req.user;

    if (user.role !== "morador") {
      res.status(403).json({ error: "Apenas moradores podem excluir sua própria conta." });
      return;
    }

    // Delete user
    db.prepare("DELETE FROM users WHERE id = ?").run(user.id);

    // Clear session
    res.clearCookie(COOKIE_NAME, { path: "/" });
    res.json({ message: "Conta excluída com sucesso." });
  } catch (err: any) {
    console.error("Erro em auth :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

export default router;
