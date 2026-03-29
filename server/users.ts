import { Router } from "express";
import bcrypt from "bcryptjs";
import db, { type DbUser } from "./db.js";
import { authenticate, authorize, condominioScope } from "./middleware.js";

const router = Router();

router.use(authenticate);

// ─── CREATE ADMINISTRADORA (MASTER ONLY) ─────────────────
router.post("/administradora", authorize("master"), async (req, res) => {
  try {
    const { nome, email, phone, password } = req.body;

    if (!nome || !email || !password) {
      res.status(400).json({ error: "Nome, e-mail e senha são obrigatórios." });
      return;
    }
    if (!/^\d{6}$/.test(password)) {
      res.status(400).json({ error: "Senha deve ter exatamente 6 dígitos numéricos." });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: "E-mail inválido." });
      return;
    }

    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase().trim());
    if (existing) {
      res.status(409).json({ error: "Este e-mail já está cadastrado." });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = db.prepare(
      "INSERT INTO users (name, email, phone, password, role) VALUES (?, ?, ?, ?, 'administradora')"
    ).run(nome.trim(), email.toLowerCase().trim(), phone || null, hashedPassword);

    res.status(201).json({
      id: result.lastInsertRowid,
      nome: nome.trim(),
      email: email.toLowerCase().trim(),
      role: "administradora",
      message: "Administradora cadastrada com sucesso!",
    });
  } catch (err) {
    console.error("Erro ao cadastrar administradora:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// ─── LIST ADMINISTRADORAS (MASTER ONLY) ──────────────────
router.get("/administradoras", authorize("master"), (_req, res) => {
  try {
    const admins = db.prepare(
      `SELECT id, name, email, phone, parent_administradora_id, created_at 
       FROM users WHERE role = 'administradora' 
       ORDER BY COALESCE(parent_administradora_id, id), parent_administradora_id IS NOT NULL, name ASC`
    ).all();
    res.json(admins);
  } catch (err) {
    console.error("Erro ao listar administradoras:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// ─── LIST SUB-USERS OF AN ADMINISTRADORA (MASTER ONLY) ──
router.get("/administradora/:id/sub-usuarios", authorize("master"), (req, res) => {
  try {
    const parentId = parseInt(String(req.params.id));
    const parent = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'administradora' AND parent_administradora_id IS NULL").get(parentId);
    if (!parent) {
      res.status(404).json({ error: "Administradora principal não encontrada." });
      return;
    }
    const subUsers = db.prepare(
      "SELECT id, name, email, phone, created_at FROM users WHERE parent_administradora_id = ? AND role = 'administradora' ORDER BY name ASC"
    ).all(parentId);
    res.json(subUsers);
  } catch (err) {
    console.error("Erro ao listar sub-usuários:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// ─── CREATE SUB-USER FOR ADMINISTRADORA (MASTER ONLY) ───
router.post("/administradora/:id/sub-usuario", authorize("master"), async (req, res) => {
  try {
    const parentId = parseInt(String(req.params.id));
    const parent = db.prepare("SELECT id, name FROM users WHERE id = ? AND role = 'administradora' AND parent_administradora_id IS NULL").get(parentId) as DbUser | undefined;
    if (!parent) {
      res.status(404).json({ error: "Administradora principal não encontrada." });
      return;
    }

    const { nome, email, phone, password } = req.body;

    if (!nome || !email || !password) {
      res.status(400).json({ error: "Nome, e-mail e senha são obrigatórios." });
      return;
    }
    if (!/^\d{6}$/.test(password)) {
      res.status(400).json({ error: "Senha deve ter exatamente 6 dígitos numéricos." });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: "E-mail inválido." });
      return;
    }

    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase().trim());
    if (existing) {
      res.status(409).json({ error: "Este e-mail já está cadastrado." });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = db.prepare(
      "INSERT INTO users (name, email, phone, password, role, parent_administradora_id) VALUES (?, ?, ?, ?, 'administradora', ?)"
    ).run(nome.trim(), email.toLowerCase().trim(), phone || null, hashedPassword, parentId);

    res.status(201).json({
      id: result.lastInsertRowid,
      nome: nome.trim(),
      email: email.toLowerCase().trim(),
      role: "administradora",
      parent_administradora_id: parentId,
      message: `Sub-usuário criado para "${parent.name}" com sucesso!`,
    });
  } catch (err) {
    console.error("Erro ao criar sub-usuário:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// ─── UPDATE ADMINISTRADORA (MASTER ONLY) ─────────────────
router.put("/administradora/:id", authorize("master"), async (req, res) => {
  try {
    const id = req.params.id as string;
    const { nome, email, phone, password } = req.body;

    const user = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'administradora'").get(parseInt(id)) as DbUser | undefined;
    if (!user) { res.status(404).json({ error: "Administradora não encontrada." }); return; }

    if (!nome || !email) { res.status(400).json({ error: "Nome e e-mail são obrigatórios." }); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { res.status(400).json({ error: "E-mail inválido." }); return; }

    const dup = db.prepare("SELECT id FROM users WHERE email = ? AND id != ?").get(email.toLowerCase().trim(), parseInt(id));
    if (dup) { res.status(409).json({ error: "Este e-mail já está cadastrado." }); return; }

    if (password) {
      if (!/^\d{6}$/.test(password)) { res.status(400).json({ error: "Senha deve ter exatamente 6 dígitos." }); return; }
      const hashed = await bcrypt.hash(password, 10);
      db.prepare("UPDATE users SET name = ?, email = ?, phone = ?, password = ? WHERE id = ?").run(nome.trim(), email.toLowerCase().trim(), phone || null, hashed, parseInt(id));
    } else {
      db.prepare("UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?").run(nome.trim(), email.toLowerCase().trim(), phone || null, parseInt(id));
    }

    res.json({ success: true, message: "Administradora atualizada." });
  } catch (err) {
    console.error("Erro ao atualizar administradora:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// ─── DELETE ADMINISTRADORA (MASTER ONLY) ─────────────────
router.delete("/administradora/:id", authorize("master"), (req, res) => {
  try {
    const id = req.params.id as string;
    const user = db.prepare(
      "SELECT id, name, parent_administradora_id FROM users WHERE id = ? AND role = 'administradora'"
    ).get(parseInt(id)) as DbUser | undefined;

    if (!user) {
      res.status(404).json({ error: "Administradora não encontrada." });
      return;
    }

    if (!user.parent_administradora_id) {
      // This is a main administradora — also delete all sub-users and unlink condominios
      db.prepare("DELETE FROM users WHERE parent_administradora_id = ? AND role = 'administradora'").run(parseInt(id));
      db.prepare("UPDATE condominios SET administradora_id = NULL WHERE administradora_id = ?").run(parseInt(id));
    }
    // If it's a sub-user, just delete it (no condominio unlink needed)

    db.prepare("DELETE FROM users WHERE id = ?").run(parseInt(id));
    res.json({ success: true, message: user.parent_administradora_id ? "Sub-usuário excluído." : "Administradora excluída." });
  } catch (err) {
    console.error("Erro ao excluir administradora:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// ─── CREATE SÍNDICO (MASTER + ADMINISTRADORA) ────────────
router.post("/sindico", authorize("master", "administradora"), async (req, res) => {
  try {
    const { nome, email, phone, password, condominioId } = req.body;

    if (!nome || !email || !password) {
      res.status(400).json({ error: "Nome, e-mail e senha são obrigatórios." });
      return;
    }
    if (!/^\d{6}$/.test(password)) {
      res.status(400).json({ error: "Senha deve ter exatamente 6 dígitos numéricos." });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: "E-mail inválido." });
      return;
    }

    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase().trim());
    if (existing) {
      res.status(409).json({ error: "Este e-mail já está cadastrado." });
      return;
    }

    // Se administradora, validar que o condomínio pertence a ela (ou ao grupo)
    if (req.user!.role === "administradora" && condominioId) {
      const adminId = req.user!.parent_administradora_id || req.user!.id;
      const groupIds = db.prepare(
        "SELECT id FROM users WHERE (id = ? OR parent_administradora_id = ?) AND role = 'administradora'"
      ).all(adminId, adminId) as { id: number }[];
      const allIds = groupIds.map(r => r.id);
      if (allIds.length === 0) allIds.push(adminId);
      const placeholders = allIds.map(() => "?").join(",");
      const condo = db.prepare(
        `SELECT id FROM condominios WHERE id = ? AND administradora_id IN (${placeholders})`
      ).get(condominioId, ...allIds);
      if (!condo) {
        res.status(403).json({ error: "Este condomínio não pertence à sua administradora." });
        return;
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = db.prepare(
      "INSERT INTO users (name, email, phone, password, role, condominio_id) VALUES (?, ?, ?, ?, 'sindico', ?)"
    ).run(
      nome.trim(),
      email.toLowerCase().trim(),
      phone || null,
      hashedPassword,
      condominioId || null
    );

    // Vincular como admin do condomínio
    if (condominioId) {
      db.prepare("UPDATE condominios SET admin_user_id = ? WHERE id = ?").run(
        result.lastInsertRowid,
        condominioId
      );
    }

    res.status(201).json({
      id: result.lastInsertRowid,
      nome: nome.trim(),
      email: email.toLowerCase().trim(),
      role: "sindico",
      condominioId,
      message: "Síndico cadastrado com sucesso!",
    });
  } catch (err) {
    console.error("Erro ao cadastrar síndico:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// ─── LIST SÍNDICOS (MASTER + ADMINISTRADORA) ─────────────
router.get("/sindicos", authorize("master", "administradora"), (req, res) => {
  try {
    let sindicos;
    if (req.user!.role === "master") {
      sindicos = db.prepare(
        `SELECT u.id, u.name, u.email, u.phone, u.condominio_id, c.name as condominio_nome, u.created_at
         FROM users u LEFT JOIN condominios c ON u.condominio_id = c.id
         WHERE u.role = 'sindico' ORDER BY u.name ASC`
      ).all();
    } else {
      // Administradora: só síndicos dos seus condomínios (inclui grupo de sub-usuários)
      const adminId = req.user!.parent_administradora_id || req.user!.id;
      const groupIds = db.prepare(
        "SELECT id FROM users WHERE (id = ? OR parent_administradora_id = ?) AND role = 'administradora'"
      ).all(adminId, adminId) as { id: number }[];
      const allIds = groupIds.map(r => r.id);
      if (allIds.length === 0) allIds.push(adminId);
      const placeholders = allIds.map(() => "?").join(",");
      sindicos = db.prepare(
        `SELECT u.id, u.name, u.email, u.phone, u.condominio_id, c.name as condominio_nome, u.created_at
         FROM users u LEFT JOIN condominios c ON u.condominio_id = c.id
         WHERE u.role = 'sindico' AND c.administradora_id IN (${placeholders})
         ORDER BY u.name ASC`
      ).all(...allIds);
    }
    res.json(sindicos);
  } catch (err) {
    console.error("Erro ao listar síndicos:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// ─── UPDATE SÍNDICO (MASTER + ADMINISTRADORA) ────────────
router.put("/sindico/:id", authorize("master", "administradora"), async (req, res) => {
  try {
    const id = req.params.id as string;
    const { nome, email, phone, password, condominioId } = req.body;

    let user;
    if (req.user!.role === "master") {
      user = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'sindico'").get(parseInt(id));
    } else {
      const adminId = req.user!.parent_administradora_id || req.user!.id;
      const groupIds = db.prepare(
        "SELECT id FROM users WHERE (id = ? OR parent_administradora_id = ?) AND role = 'administradora'"
      ).all(adminId, adminId) as { id: number }[];
      const allIds = groupIds.map(r => r.id);
      if (allIds.length === 0) allIds.push(adminId);
      const ph = allIds.map(() => "?").join(",");
      user = db.prepare(
        `SELECT u.id FROM users u JOIN condominios c ON u.condominio_id = c.id
         WHERE u.id = ? AND u.role = 'sindico' AND c.administradora_id IN (${ph})`
      ).get(parseInt(id), ...allIds);
    }
    if (!user) { res.status(404).json({ error: "Síndico não encontrado." }); return; }

    if (!nome || !email) { res.status(400).json({ error: "Nome e e-mail são obrigatórios." }); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { res.status(400).json({ error: "E-mail inválido." }); return; }

    const dup = db.prepare("SELECT id FROM users WHERE email = ? AND id != ?").get(email.toLowerCase().trim(), parseInt(id));
    if (dup) { res.status(409).json({ error: "Este e-mail já está cadastrado." }); return; }

    if (req.user!.role === "administradora" && condominioId) {
      const adminId2 = req.user!.parent_administradora_id || req.user!.id;
      const gIds = db.prepare(
        "SELECT id FROM users WHERE (id = ? OR parent_administradora_id = ?) AND role = 'administradora'"
      ).all(adminId2, adminId2) as { id: number }[];
      const aIds = gIds.map(r => r.id);
      if (aIds.length === 0) aIds.push(adminId2);
      const ph2 = aIds.map(() => "?").join(",");
      const condo = db.prepare(`SELECT id FROM condominios WHERE id = ? AND administradora_id IN (${ph2})`).get(condominioId, ...aIds);
      if (!condo) { res.status(403).json({ error: "Este condomínio não pertence à sua administradora." }); return; }
    }

    if (password) {
      if (!/^\d{6}$/.test(password)) { res.status(400).json({ error: "Senha deve ter exatamente 6 dígitos." }); return; }
      const hashed = await bcrypt.hash(password, 10);
      db.prepare("UPDATE users SET name = ?, email = ?, phone = ?, password = ?, condominio_id = ? WHERE id = ?").run(nome.trim(), email.toLowerCase().trim(), phone || null, hashed, condominioId || null, parseInt(id));
    } else {
      db.prepare("UPDATE users SET name = ?, email = ?, phone = ?, condominio_id = ? WHERE id = ?").run(nome.trim(), email.toLowerCase().trim(), phone || null, condominioId || null, parseInt(id));
    }

    if (condominioId) {
      db.prepare("UPDATE condominios SET admin_user_id = ? WHERE id = ?").run(parseInt(id), condominioId);
    }

    res.json({ success: true, message: "Síndico atualizado." });
  } catch (err) {
    console.error("Erro ao atualizar síndico:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// ─── DELETE SÍNDICO (MASTER + ADMINISTRADORA) ────────────
router.delete("/sindico/:id", authorize("master", "administradora"), (req, res) => {
  try {
    const id = req.params.id as string;

    let user;
    if (req.user!.role === "master") {
      user = db.prepare("SELECT id, name, condominio_id FROM users WHERE id = ? AND role = 'sindico'").get(parseInt(id));
    } else {
      const adminId = req.user!.parent_administradora_id || req.user!.id;
      const groupIds = db.prepare(
        "SELECT id FROM users WHERE (id = ? OR parent_administradora_id = ?) AND role = 'administradora'"
      ).all(adminId, adminId) as { id: number }[];
      const allIds = groupIds.map(r => r.id);
      if (allIds.length === 0) allIds.push(adminId);
      const ph = allIds.map(() => "?").join(",");
      user = db.prepare(
        `SELECT u.id, u.name, u.condominio_id FROM users u
         JOIN condominios c ON u.condominio_id = c.id
         WHERE u.id = ? AND u.role = 'sindico' AND c.administradora_id IN (${ph})`
      ).get(parseInt(id), ...allIds);
    }

    if (!user) {
      res.status(404).json({ error: "Síndico não encontrado." });
      return;
    }

    db.prepare("UPDATE condominios SET admin_user_id = NULL WHERE admin_user_id = ?").run(parseInt(id));
    db.prepare("DELETE FROM users WHERE id = ?").run(parseInt(id));
    res.json({ success: true, message: "Síndico excluído." });
  } catch (err) {
    console.error("Erro ao excluir síndico:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

export default router;
