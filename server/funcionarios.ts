import { Router } from "express";
import bcrypt from "bcryptjs";
import db from "./db.js";
import { authenticate, authorize, condominioScope } from "./middleware.js";
import { validatePin } from "./passwordPolicy.js";
import { log } from "./logger.js";

const router = Router();

// All funcionarios routes require authentication
router.use(authenticate);

// POST /api/funcionarios - Cadastrar funcionário (sindico+)
router.post("/", authorize("master", "administradora", "sindico"), async (req, res) => {
  try {
    const { nome, sobrenome, cargo, login, password } = req.body;

    if (!nome || !sobrenome || !cargo || !login || !password) {
      res.status(400).json({ error: "Todos os campos são obrigatórios." });
      return;
    }

    // Validar login: só minúsculas sem espaço/acento/especial
    if (!/^[a-z0-9]+$/.test(login)) {
      res.status(400).json({ error: "Login deve conter apenas letras minúsculas e números, sem espaços ou acentos." });
      return;
    }

    if (login.length < 3) {
      res.status(400).json({ error: "Login deve ter pelo menos 3 caracteres." });
      return;
    }

    // Validar senha: 6 dígitos
    if (!validatePin(password, res)) return;

    // Verificar login duplicado
    const existing = db.prepare("SELECT id FROM funcionarios WHERE login = ?").get(login);
    if (existing) {
      res.status(409).json({ error: "Este login já está em uso. Tente adicionar números ao final." });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const condoId = req.user!.condominio_id || null;

    const result = db.prepare(
      "INSERT INTO funcionarios (nome, sobrenome, cargo, login, password, condominio_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(nome.trim(), sobrenome.trim(), cargo, login, hashedPassword, condoId, req.user!.id);

    res.status(201).json({
      id: result.lastInsertRowid,
      nome: nome.trim(),
      sobrenome: sobrenome.trim(),
      cargo,
      login,
      message: "Funcionário cadastrado com sucesso!",
    });
  } catch (err: any) {
    log.error("Erro ao cadastrar funcionário:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// GET /api/funcionarios - Listar funcionários (scoped by condominio or created_by)
router.get("/", (req, res) => {
  try {
    const user = req.user!;
    let funcionarios;

    if (user.role === "master") {
      funcionarios = db.prepare(
        "SELECT id, nome, sobrenome, cargo, login, condominio_id, created_at FROM funcionarios ORDER BY nome ASC"
      ).all();
    } else if (user.role === "administradora") {
      // Get all admin IDs in this administradora group
      const adminId = user.parent_administradora_id || user.id;
      const groupIds = db.prepare(
        "SELECT id FROM users WHERE (id = ? OR parent_administradora_id = ?) AND role = 'administradora'"
      ).all(adminId, adminId) as { id: number }[];
      const allAdminIds = groupIds.map(r => r.id);
      if (allAdminIds.length === 0) allAdminIds.push(adminId);

      // Get condominios managed by this administradora group
      const ph = allAdminIds.map(() => "?").join(",");
      const condoIds = db.prepare(
        `SELECT id FROM condominios WHERE administradora_id IN (${ph})`
      ).all(...allAdminIds) as { id: number }[];

      // Build WHERE: funcionarios in those condominios OR created by any admin in the group
      const createdByPh = allAdminIds.map(() => "?").join(",");
      if (condoIds.length > 0) {
        const condoPh = condoIds.map(() => "?").join(",");
        funcionarios = db.prepare(
          `SELECT id, nome, sobrenome, cargo, login, condominio_id, created_at FROM funcionarios WHERE condominio_id IN (${condoPh}) OR created_by IN (${createdByPh}) ORDER BY nome ASC`
        ).all(...condoIds.map(c => c.id), ...allAdminIds);
      } else {
        funcionarios = db.prepare(
          `SELECT id, nome, sobrenome, cargo, login, condominio_id, created_at FROM funcionarios WHERE created_by IN (${createdByPh}) ORDER BY nome ASC`
        ).all(...allAdminIds);
      }
    } else {
      // sindico, funcionario - scope by condominio_id
      const scope = condominioScope(user);
      funcionarios = db.prepare(
        `SELECT id, nome, sobrenome, cargo, login, condominio_id, created_at FROM funcionarios WHERE ${scope.clause} ORDER BY nome ASC`
      ).all(...scope.params);
    }

    res.json(funcionarios);
  } catch (err) {
    log.error("Erro ao listar funcionários:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// PUT /api/funcionarios/:id - Editar funcionário (sindico+)
router.put("/:id", authorize("master", "administradora", "sindico"), async (req, res) => {
  try {
    const id = req.params.id as string;
    const { nome, sobrenome, cargo, login, password } = req.body;
    const scope = condominioScope(req.user!);

    const func = db.prepare(
      `SELECT id FROM funcionarios WHERE id = ? AND ${scope.clause}`
    ).get(parseInt(id), ...scope.params);
    if (!func) { res.status(404).json({ error: "Funcionário não encontrado." }); return; }

    if (!nome || !sobrenome || !cargo || !login) {
      res.status(400).json({ error: "Nome, sobrenome, cargo e login são obrigatórios." }); return;
    }
    if (!/^[a-z0-9]+$/.test(login) || login.length < 3) {
      res.status(400).json({ error: "Login inválido." }); return;
    }

    const dup = db.prepare("SELECT id FROM funcionarios WHERE login = ? AND id != ?").get(login, parseInt(id));
    if (dup) { res.status(409).json({ error: "Este login já está em uso." }); return; }

    if (password) {
      if (!validatePin(password, res)) return;
      const hashed = await bcrypt.hash(password, 10);
      db.prepare("UPDATE funcionarios SET nome = ?, sobrenome = ?, cargo = ?, login = ?, password = ? WHERE id = ?").run(nome.trim(), sobrenome.trim(), cargo, login, hashed, parseInt(id));
    } else {
      db.prepare("UPDATE funcionarios SET nome = ?, sobrenome = ?, cargo = ?, login = ? WHERE id = ?").run(nome.trim(), sobrenome.trim(), cargo, login, parseInt(id));
    }

    res.json({ success: true, message: "Funcionário atualizado." });
  } catch (err) {
    log.error("Erro ao atualizar funcionário:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// DELETE /api/funcionarios/:id - Excluir funcionário (sindico+)
router.delete("/:id", authorize("master", "administradora", "sindico"), (req, res) => {
  try {
    const id = req.params.id as string;
    const scope = condominioScope(req.user!);

    const func = db.prepare(
      `SELECT id FROM funcionarios WHERE id = ? AND ${scope.clause}`
    ).get(parseInt(id), ...scope.params);

    if (!func) {
      res.status(404).json({ error: "Funcionário não encontrado." });
      return;
    }

    db.prepare("DELETE FROM funcionarios WHERE id = ?").run(parseInt(id));
    res.json({ success: true, message: "Funcionário excluído." });
  } catch (err) {
    log.error("Erro ao excluir funcionário:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

export default router;
