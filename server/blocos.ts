import { Router } from "express";
import db from "./db.js";
import { authenticate, authorize, condominioScope } from "./middleware.js";
import { log } from "./logger.js";

const router = Router();

// ─── PUBLIC ENDPOINT (no auth) — lista blocos + unidades de UM condomínio.
// Exige `condominio_id` na query string. Sem o filtro, qualquer um
// poderia enumerar todos os condomínios + unidades do sistema.
router.get("/public", (req, res) => {
  try {
    const cid = Number(req.query.condominio_id);
    if (!Number.isInteger(cid) || cid <= 0) {
      res.status(400).json({ error: "Informe o condomínio (condominio_id)." });
      return;
    }
    // Garante existência (e bloqueia id=0, registro de sistema).
    const condo = db.prepare("SELECT id FROM condominios WHERE id = ? AND id != 0").get(cid);
    if (!condo) {
      res.status(404).json({ error: "Condomínio não encontrado." });
      return;
    }

    const blocks = db.prepare(
      "SELECT id, name, condominio_id FROM blocks WHERE condominio_id = ? ORDER BY CAST(name AS INTEGER), name ASC"
    ).all(cid) as any[];

    const users = db.prepare(
      "SELECT DISTINCT block, unit FROM users WHERE role = 'morador' AND block IS NOT NULL AND unit IS NOT NULL AND condominio_id = ? ORDER BY block, CAST(unit AS INTEGER), unit"
    ).all(cid) as any[];

    const unitsByBlock = new Map<string, string[]>();
    for (const u of users) {
      if (!unitsByBlock.has(u.block)) unitsByBlock.set(u.block, []);
      if (!unitsByBlock.get(u.block)!.includes(u.unit)) {
        unitsByBlock.get(u.block)!.push(u.unit);
      }
    }

    const result = blocks.map((b: any) => ({
      id: b.id,
      name: b.name,
      condominio_id: b.condominio_id,
      unidades: unitsByBlock.get(b.name) || [],
    }));

    res.json(result);
  } catch (err) {
    log.error("Erro ao listar blocos (public):", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// All remaining blocos routes require authentication
router.use(authenticate);

// POST /api/blocos/automatico - Cadastrar N blocos automaticamente (Bloco 1, Bloco 2...)
// Only sindico, administradora, master can create
router.post("/automatico", authorize("master", "administradora", "sindico"), async (req, res) => {
  try {
    const { quantidade, condominioId } = req.body;

    if (!quantidade || quantidade < 1) {
      res.status(400).json({ error: "Quantidade deve ser pelo menos 1." });
      return;
    }
    if (quantidade > 200) {
      res.status(400).json({ error: "Quantidade máxima: 200 blocos." });
      return;
    }

    // Resolve condominio: use body condominioId (for administradoras) or user's condominio_id
    let condoId = req.user!.condominio_id || condominioId || null;
    if (!condoId) {
      res.status(400).json({ error: "Selecione um condomínio." });
      return;
    }

    const insert = db.prepare("INSERT INTO blocks (condominio_id, name) VALUES (?, ?)");

    const created: string[] = [];
    const duplicates: string[] = [];

    for (let i = 1; i <= quantidade; i++) {
      const name = `Bloco ${i}`;
      const existing = db.prepare("SELECT id FROM blocks WHERE condominio_id = ? AND name = ?").get(condoId, name);
      if (existing) {
        duplicates.push(name);
      } else {
        insert.run(condoId, name);
        created.push(name);
      }
    }

    if (created.length === 0 && duplicates.length > 0) {
      res.status(409).json({ error: "Todos os blocos já existem." });
      return;
    }

    res.status(201).json({
      created: created.length,
      duplicates: duplicates.length,
      message: `${created.length} bloco(s) criado(s)${duplicates.length > 0 ? `, ${duplicates.length} já existiam` : ""}.`,
    });
  } catch (err: any) {
    log.error("Erro ao cadastrar blocos:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// POST /api/blocos/personalizado - Cadastrar blocos com nomes personalizados
router.post("/personalizado", authorize("master", "administradora", "sindico"), async (req, res) => {
  try {
    const { nomes, condominioId } = req.body;

    if (!nomes || !Array.isArray(nomes) || nomes.length === 0) {
      res.status(400).json({ error: "Informe pelo menos um nome de bloco." });
      return;
    }

    // Resolve condominio: use body condominioId (for administradoras) or user's condominio_id
    let condoId = req.user!.condominio_id || condominioId || null;
    if (!condoId) {
      res.status(400).json({ error: "Selecione um condomínio." });
      return;
    }

    const insert = db.prepare("INSERT INTO blocks (condominio_id, name) VALUES (?, ?)");

    const created: string[] = [];
    const duplicates: string[] = [];

    for (const nome of nomes) {
      const trimmed = nome.trim();
      if (!trimmed) continue;

      const existing = db.prepare("SELECT id FROM blocks WHERE condominio_id = ? AND name = ?").get(condoId, trimmed);
      if (existing) {
        duplicates.push(trimmed);
      } else {
        insert.run(condoId, trimmed);
        created.push(trimmed);
      }
    }

    if (created.length === 0 && duplicates.length > 0) {
      res.status(409).json({ error: "Todos os blocos já existem." });
      return;
    }

    res.status(201).json({
      created: created.length,
      duplicates: duplicates.length,
      message: `${created.length} bloco(s) criado(s)${duplicates.length > 0 ? `, ${duplicates.length} já existiam` : ""}.`,
    });
  } catch (err: any) {
    log.error("Erro ao cadastrar blocos:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// PUT /api/blocos/:id - Renomear bloco (sindico+)
router.put("/:id", authorize("master", "administradora", "sindico"), (req, res) => {
  try {
    const id = req.params.id as string;
    const { name } = req.body;
    const scope = condominioScope(req.user!);

    if (!name || !name.trim()) { res.status(400).json({ error: "Nome do bloco é obrigatório." }); return; }

    const bloco = db.prepare(
      `SELECT id, condominio_id FROM blocks WHERE id = ? AND ${scope.clause}`
    ).get(parseInt(id), ...scope.params) as any;
    if (!bloco) { res.status(404).json({ error: "Bloco não encontrado." }); return; }

    const dup = db.prepare("SELECT id FROM blocks WHERE condominio_id = ? AND name = ? AND id != ?").get(bloco.condominio_id, name.trim(), parseInt(id));
    if (dup) { res.status(409).json({ error: "Já existe um bloco com esse nome." }); return; }

    db.prepare("UPDATE blocks SET name = ? WHERE id = ?").run(name.trim(), parseInt(id));
    res.json({ success: true, message: "Bloco renomeado." });
  } catch (err) {
    log.error("Erro ao renomear bloco:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// DELETE /api/blocos/:id - Excluir bloco (sindico+)
router.delete("/:id", authorize("master", "administradora", "sindico"), (req, res) => {
  try {
    const id = req.params.id as string;
    const scope = condominioScope(req.user!);

    const bloco = db.prepare(
      `SELECT id FROM blocks WHERE id = ? AND ${scope.clause}`
    ).get(parseInt(id), ...scope.params);
    if (!bloco) { res.status(404).json({ error: "Bloco não encontrado." }); return; }

    db.prepare("DELETE FROM blocks WHERE id = ?").run(parseInt(id));
    res.json({ success: true, message: "Bloco excluído." });
  } catch (err) {
    log.error("Erro ao excluir bloco:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// GET /api/blocos - Listar blocos (scoped by condominio)
router.get("/", (req, res) => {
  try {
    const scope = condominioScope(req.user!);
    const blocos = db.prepare(
      `SELECT id, name, condominio_id, created_at FROM blocks WHERE ${scope.clause} ORDER BY name ASC`
    ).all(...scope.params);
    res.json(blocos);
  } catch (err) {
    log.error("Erro ao listar blocos:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

export default router;
