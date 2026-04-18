import { Router } from "express";
import bcrypt from "bcryptjs";
import db from "./db.js";
import { authenticate, authorize, condominioScope, moradorSelfScope } from "./middleware.js";
import { emailContaCriada } from "./emailService.js";

const router = Router();

// All moradores routes require authentication
router.use(authenticate);

// POST /api/moradores - Cadastrar morador (sindico+)
router.post("/", authorize("master", "administradora", "sindico"), async (req, res) => {
  try {
    const user = req.user!;
    const { nome, bloco, unidade, perfil, whatsapp, email, password } = req.body;

    if (!nome || !bloco || !unidade || !perfil || !email || !password) {
      res.status(400).json({ error: "Nome, bloco, unidade, perfil, e-mail e senha são obrigatórios." });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: "E-mail inválido." });
      return;
    }

    if (!/^\d{6}$/.test(password)) {
      res.status(400).json({ error: "Senha deve ter exatamente 6 dígitos numéricos." });
      return;
    }

    // Verificar e-mail duplicado
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase().trim());
    if (existing) {
      res.status(409).json({ error: "Este e-mail já está cadastrado." });
      return;
    }

    // Verificar se o bloco existe no condomínio
    const condoId = user.condominio_id || (req.body.condominioId ? Number(req.body.condominioId) : null);
    if (!condoId) {
      res.status(400).json({ error: "Selecione um condomínio." });
      return;
    }
    const blocoExists = db.prepare("SELECT id FROM blocks WHERE condominio_id = ? AND name = ?").get(condoId, bloco);
    if (!blocoExists) {
      res.status(400).json({ error: "Bloco não encontrado neste condomínio." });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = db.prepare(
      "INSERT INTO users (name, email, phone, password, role, perfil, unit, block, condominio_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      nome.trim(),
      email.toLowerCase().trim(),
      whatsapp || null,
      hashedPassword,
      "morador",
      perfil,
      unidade.trim(),
      bloco,
      condoId
    );

    // 📧 Email: notify morador about account creation
    const condoName = condoId
      ? (db.prepare("SELECT name FROM condominios WHERE id = ?").get(condoId) as { name: string } | undefined)?.name || "Condomínio"
      : "Condomínio";
    emailContaCriada({
      email: email.toLowerCase().trim(),
      nome: nome.trim(),
      condominioNome: condoName,
      bloco,
      apartamento: unidade.trim(),
      senhaProvisoria: password,
    }).catch((err) => console.error("[EMAIL] Erro conta criada:", err));

    res.status(201).json({
      id: result.lastInsertRowid,
      nome: nome.trim(),
      bloco,
      unidade: unidade.trim(),
      perfil,
      email: email.toLowerCase().trim(),
      message: "Morador cadastrado com sucesso!",
    });
  } catch (err: any) {
    console.error("Erro ao cadastrar morador:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// GET /api/moradores - Listar moradores (scoped)
// morador: só vê a si próprio
// funcionário/sindico: vê todos do condomínio
// administradora: vê todos dos seus condomínios
// master: vê todos
router.get("/", (req, res) => {
  try {
    const scope = condominioScope(req.user!);
    const selfScope = moradorSelfScope(req.user!);

    const moradores = db.prepare(
      `SELECT id, name, email, phone, perfil, unit, block, condominio_id, created_at
       FROM users
       WHERE role = 'morador' AND ${scope.clause} AND ${selfScope.clause}
       ORDER BY name ASC`
    ).all(...scope.params, ...selfScope.params);
    res.json(moradores);
  } catch (err) {
    console.error("Erro ao listar moradores:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// PUT /api/moradores/:id - Editar morador (sindico+)
router.put("/:id", authorize("master", "administradora", "sindico"), async (req, res) => {
  try {
    const user = req.user!;
    const id = req.params.id as string;
    const { nome, bloco, unidade, perfil, whatsapp, email, password } = req.body;
    const scope = condominioScope(user);

    const morador = db.prepare(
      `SELECT id FROM users WHERE id = ? AND role = 'morador' AND ${scope.clause}`
    ).get(Number.parseInt(id), ...scope.params);
    if (!morador) { res.status(404).json({ error: "Morador não encontrado." }); return; }

    if (!nome || !bloco || !unidade || !perfil || !email) {
      res.status(400).json({ error: "Nome, bloco, unidade, perfil e e-mail são obrigatórios." }); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { res.status(400).json({ error: "E-mail inválido." }); return; }

    // Verificar se o bloco existe no condomínio
    const condoId = user.condominio_id || null;
    if (condoId) {
      const blocoExists = db.prepare("SELECT id FROM blocks WHERE condominio_id = ? AND name = ?").get(condoId, bloco);
      if (!blocoExists) {
        res.status(400).json({ error: "Bloco não encontrado neste condomínio." });
        return;
      }
    }

    const dup = db.prepare("SELECT id FROM users WHERE email = ? AND id != ?").get(email.toLowerCase().trim(), Number.parseInt(id));
    if (dup) { res.status(409).json({ error: "Este e-mail já está cadastrado." }); return; }

    if (password) {
      if (!/^\d{6}$/.test(password)) { res.status(400).json({ error: "Senha deve ter exatamente 6 dígitos." }); return; }
      const hashed = await bcrypt.hash(password, 10);
      db.prepare("UPDATE users SET name = ?, email = ?, phone = ?, perfil = ?, unit = ?, block = ?, password = ? WHERE id = ?").run(nome.trim(), email.toLowerCase().trim(), whatsapp || null, perfil, unidade.trim(), bloco, hashed, Number.parseInt(id));
    } else {
      db.prepare("UPDATE users SET name = ?, email = ?, phone = ?, perfil = ?, unit = ?, block = ? WHERE id = ?").run(nome.trim(), email.toLowerCase().trim(), whatsapp || null, perfil, unidade.trim(), bloco, Number.parseInt(id));
    }

    res.json({ success: true, message: "Morador atualizado." });
  } catch (err) {
    console.error("Erro ao atualizar morador:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// DELETE /api/moradores/:id - Excluir morador (sindico+)
router.delete("/:id", authorize("master", "administradora", "sindico"), (req, res) => {
  try {
    const id = req.params.id as string;
    const scope = condominioScope(req.user!);

    const morador = db.prepare(
      `SELECT id FROM users WHERE id = ? AND role = 'morador' AND ${scope.clause}`
    ).get(Number.parseInt(id), ...scope.params);

    if (!morador) {
      res.status(404).json({ error: "Morador não encontrado." });
      return;
    }

    db.prepare("DELETE FROM users WHERE id = ?").run(Number.parseInt(id));
    res.json({ success: true, message: "Morador excluído." });
  } catch (err) {
    console.error("Erro ao excluir morador:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// POST /api/moradores/gerar-link - Gerar link de cadastro (sindico+)
router.post("/gerar-link", authorize("master", "administradora", "sindico"), (req, res) => {
  try {
    const user = req.user!;
    let condoId = user.condominio_id;
    // Administradora/master may not have condominio_id directly — try from body or query
    if (!condoId && req.body.condominio_id) {
      condoId = req.body.condominio_id;
    }
    const token = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    // Use Referer/Origin header to build frontend URL, or fallback to request host
    const origin = req.get("origin") || req.get("referer")?.replace(/\/[^/]*$/, "") || `${req.protocol}://${req.get("host")}`;
    const condoSuffix = condoId ? "&condo=" + condoId : "";
    const link = `${origin}/register/morador?ref=${token}${condoSuffix}`;
    res.json({ link, token });
  } catch (err) {
    console.error("Erro ao gerar link:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// GET /api/moradores/pendentes - Listar moradores aguardando aprovação
router.get("/pendentes", authorize("master", "administradora", "sindico"), (req, res) => {
  try {
    const scope = condominioScope(req.user!);
    const pendentes = db.prepare(
      `SELECT id, name, email, phone, perfil, unit, block, condominio_id, created_at
       FROM users
       WHERE role = 'morador' AND aprovado = 0 AND ${scope.clause}
       ORDER BY created_at DESC`
    ).all(...scope.params);
    res.json(pendentes);
  } catch (err) {
    console.error("Erro ao listar pendentes:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// GET /api/moradores/pendentes/count - Contar moradores aguardando
router.get("/pendentes/count", authorize("master", "administradora", "sindico"), (req, res) => {
  try {
    const scope = condominioScope(req.user!);
    const result = db.prepare(
      `SELECT COUNT(*) as count FROM users WHERE role = 'morador' AND aprovado = 0 AND ${scope.clause}`
    ).get(...scope.params) as { count: number };
    res.json({ count: result.count });
  } catch (err) {
    console.error("Erro ao contar pendentes:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// PUT /api/moradores/:id/aprovar - Aprovar cadastro
router.put("/:id/aprovar", authorize("master", "administradora", "sindico"), (req, res) => {
  try {
    const id = Number.parseInt(String(req.params.id));
    const scope = condominioScope(req.user!);
    const morador = db.prepare(
      `SELECT id, name FROM users WHERE id = ? AND role = 'morador' AND aprovado = 0 AND ${scope.clause}`
    ).get(id, ...scope.params) as { id: number; name: string } | undefined;
    if (!morador) {
      res.status(404).json({ error: "Morador pendente não encontrado." });
      return;
    }
    db.prepare("UPDATE users SET aprovado = 1, updated_at = datetime('now') WHERE id = ?").run(id);
    res.json({ success: true, message: `Cadastro de ${morador.name} aprovado com sucesso!` });
  } catch (err) {
    console.error("Erro ao aprovar morador:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// DELETE /api/moradores/:id/rejeitar - Rejeitar cadastro (remove user)
router.delete("/:id/rejeitar", authorize("master", "administradora", "sindico"), (req, res) => {
  try {
    const id = Number.parseInt(String(req.params.id));
    const scope = condominioScope(req.user!);
    const morador = db.prepare(
      `SELECT id, name FROM users WHERE id = ? AND role = 'morador' AND aprovado = 0 AND ${scope.clause}`
    ).get(id, ...scope.params) as { id: number; name: string } | undefined;
    if (!morador) {
      res.status(404).json({ error: "Morador pendente não encontrado." });
      return;
    }
    db.prepare("DELETE FROM users WHERE id = ?").run(id);
    res.json({ success: true, message: `Cadastro de ${morador.name} rejeitado e removido.` });
  } catch (err) {
    console.error("Erro ao rejeitar morador:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// POST /api/moradores/importar - Importar moradores em lote (sindico+)
router.post("/importar", authorize("master", "administradora", "sindico"), async (req, res) => {
  try {
    const user = req.user!;
    const { moradores } = req.body;
    if (!Array.isArray(moradores) || moradores.length === 0) {
      res.status(400).json({ error: "Lista de moradores vazia." });
      return;
    }

    const condoId = user.condominio_id || null;
    const defaultPassword = await bcrypt.hash("1234", 10); // Senha padrão para importação
    let imported = 0;
    let errors = 0;

    for (const m of moradores) {
      try {
        if (!m.nome || !m.email) {
          errors++;
          continue;
        }

        const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(m.email.toLowerCase().trim());
        if (existing) {
          errors++;
          continue;
        }

        db.prepare(
          "INSERT INTO users (name, email, phone, password, role, perfil, unit, block, condominio_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).run(
          m.nome.trim(),
          m.email.toLowerCase().trim(),
          m.whatsapp || null,
          defaultPassword,
          "morador",
          m.perfil || null,
          m.unidade?.trim() || null,
          m.bloco || null,
          condoId
        );
        imported++;
      } catch {
        errors++;
      }
    }

    const errorSuffix = errors > 0 ? `, ${errors} com erro` : "";
    res.json({
      imported,
      errors,
      message: `${imported} morador(es) importado(s)${errorSuffix}.`,
    });
  } catch (err) {
    console.error("Erro ao importar moradores:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

export default router;
