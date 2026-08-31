import { Router } from "express";
import db, { deleteUserCascade, type DbCondominio } from "./db.js";
import { authenticate, authorize, condominioScope } from "./middleware.js";
import { log } from "./logger.js";

const router = Router();

// All condominios routes require authentication
router.use(authenticate);

// GET /api/condominios - Listar condominios (scoped by role)
router.get("/", (req, res) => {
  try {
    const scope = condominioScope(req.user!, "id");
    const condominios = db.prepare(
      `SELECT id, name, cnpj, address, city, state, units_count, created_at
       FROM condominios WHERE ${scope.clause} ORDER BY name ASC`
    ).all(...scope.params);
    res.json(condominios);
  } catch (err) {
    log.error("Erro ao listar condomínios:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// GET /api/condominios/:id - Detalhes de um condominio
router.get("/:id", (req, res) => {
  try {
    const { id } = req.params;
    const scope = condominioScope(req.user!, "id");

    const condo = db.prepare(
      `SELECT * FROM condominios WHERE id = ? AND ${scope.clause}`
    ).get(parseInt(id), ...scope.params) as DbCondominio | undefined;

    if (!condo) {
      res.status(404).json({ error: "Condomínio não encontrado." });
      return;
    }

    // Count stats
    const moradoresCount = db.prepare(
      "SELECT COUNT(*) as count FROM users WHERE condominio_id = ? AND role = 'morador'"
    ).get(condo.id) as { count: number };

    const blocosCount = db.prepare(
      "SELECT COUNT(*) as count FROM blocks WHERE condominio_id = ?"
    ).get(condo.id) as { count: number };

    const funcionariosCount = db.prepare(
      "SELECT COUNT(*) as count FROM funcionarios WHERE condominio_id = ?"
    ).get(condo.id) as { count: number };

    res.json({
      ...condo,
      stats: {
        moradores: moradoresCount.count,
        blocos: blocosCount.count,
        funcionarios: funcionariosCount.count,
      },
    });
  } catch (err) {
    log.error("Erro ao buscar condomínio:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// DELETE /api/condominios/:id - Excluir condominio (MASTER ONLY)
router.delete("/:id", authorize("master"), (req, res) => {
  try {
    const id = req.params.id as string;
    const condoId = parseInt(id);

    const condo = db.prepare("SELECT id, name FROM condominios WHERE id = ?").get(condoId) as DbCondominio | undefined;
    if (!condo) {
      res.status(404).json({ error: "Condomínio não encontrado." });
      return;
    }

    // Delete all related data
    const deleteCondominio = db.transaction(() => {
      db.prepare("DELETE FROM interfone_calls WHERE condominio_id = ?").run(condoId);
      db.prepare("DELETE FROM interfone_config WHERE condominio_id = ?").run(condoId);
      db.prepare("DELETE FROM interfone_tokens WHERE condominio_id = ?").run(condoId);
      db.prepare("DELETE FROM ronda_registros WHERE condominio_id = ?").run(condoId);
      db.prepare("DELETE FROM ronda_schedules WHERE condominio_id = ?").run(condoId);
      db.prepare("DELETE FROM ronda_checkpoints WHERE condominio_id = ?").run(condoId);
      db.prepare("DELETE FROM cameras WHERE condominio_id = ?").run(condoId);
      db.prepare("DELETE FROM condominio_config WHERE condominio_id = ?").run(condoId);
      db.prepare("DELETE FROM livro_protocolo WHERE condominio_id = ?").run(condoId);
      db.prepare("DELETE FROM correspondencias WHERE condominio_id = ?").run(condoId);
      db.prepare("DELETE FROM vehicle_authorizations WHERE condominio_id = ?").run(condoId);
      db.prepare("DELETE FROM delivery_authorizations WHERE condominio_id = ?").run(condoId);
      db.prepare("DELETE FROM pre_authorizations WHERE condominio_id = ?").run(condoId);
      db.prepare("DELETE FROM visitors WHERE condominio_id = ?").run(condoId);
      db.prepare("DELETE FROM blocks WHERE condominio_id = ?").run(condoId);
      db.prepare("DELETE FROM funcionarios WHERE condominio_id = ?").run(condoId);
      const condoUsers = db.prepare("SELECT id FROM users WHERE condominio_id = ?").all(condoId) as { id: number }[];
      for (const u of condoUsers) deleteUserCascade(u.id);
      db.prepare("DELETE FROM condominios WHERE id = ?").run(condoId);
    });
    deleteCondominio();

    res.json({ success: true, message: `Condomínio "${condo.name}" excluído com todos os dados.` });
  } catch (err) {
    log.error("Erro ao excluir condomínio:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// PUT /api/condominios/:id - Editar condominio (sindico+)
router.put("/:id", authorize("master", "administradora", "sindico"), (req, res) => {
  try {
    const id = req.params.id as string;
    const scope = condominioScope(req.user!, "id");

    const condo = db.prepare(
      `SELECT id FROM condominios WHERE id = ? AND ${scope.clause}`
    ).get(parseInt(id), ...scope.params);

    if (!condo) {
      res.status(404).json({ error: "Condomínio não encontrado." });
      return;
    }

    const { name, cnpj, address, city, state, unitsCount } = req.body;

    const updates: string[] = [];
    const params: any[] = [];

    if (name) { updates.push("name = ?"); params.push(name.trim()); }
    if (cnpj !== undefined) {
      const cleanDoc = String(cnpj ?? "").replace(/\D/g, "");
      if (cleanDoc && cleanDoc.length !== 11 && cleanDoc.length !== 14) {
        res.status(400).json({ error: "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido." });
        return;
      }
      if (cleanDoc) {
        const emUso = db.prepare("SELECT id FROM condominios WHERE cnpj = ? AND id != ?").get(cleanDoc, parseInt(id));
        if (emUso) {
          res.status(409).json({ error: `Este ${cleanDoc.length === 11 ? "CPF" : "CNPJ"} já está cadastrado.` });
          return;
        }
      }
      updates.push("cnpj = ?");
      params.push(cleanDoc || null);
    }
    if (address !== undefined) { updates.push("address = ?"); params.push(address?.trim() || null); }
    if (city !== undefined) { updates.push("city = ?"); params.push(city?.trim() || null); }
    if (state !== undefined) { updates.push("state = ?"); params.push(state?.trim() || null); }
    if (unitsCount !== undefined) { updates.push("units_count = ?"); params.push(parseInt(unitsCount) || 0); }

    if (updates.length === 0) {
      res.status(400).json({ error: "Nenhum campo para atualizar." });
      return;
    }

    updates.push("updated_at = datetime('now')");
    params.push(parseInt(id));

    db.prepare(`UPDATE condominios SET ${updates.join(", ")} WHERE id = ?`).run(...params);

    res.json({ success: true, message: "Condomínio atualizado." });
  } catch (err) {
    log.error("Erro ao atualizar condomínio:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

export default router;
