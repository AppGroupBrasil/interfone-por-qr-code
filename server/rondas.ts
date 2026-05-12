import { Router, Request, Response } from "express";
import db from "./db.js";
import { authenticate, authorize } from "./middleware.js";
import crypto from "crypto";
import { notifyPortariaWhatsApp } from "./whatsappService.js";
import { log } from "./logger.js";

const router = Router();

// ═══════════════════════════════════════════════════════════
// CHECKPOINTS — Managed by síndico
// ═══════════════════════════════════════════════════════════

// GET all checkpoints for condominium
router.get("/checkpoints", authenticate, (req: Request, res: Response) => {
  try {
    const checkpoints = db.prepare(
      "SELECT * FROM ronda_checkpoints WHERE condominio_id = ? ORDER BY ordem, id"
    ).all(req.user!.condominio_id);
    res.json(checkpoints);
  } catch (err: any) {
    log.error("Erro em rondas :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// GET single checkpoint
router.get("/checkpoints/:id", authenticate, (req: Request, res: Response) => {
  try {
    const cp = db.prepare(
      "SELECT * FROM ronda_checkpoints WHERE id = ? AND condominio_id = ?"
    ).get(req.params.id, req.user!.condominio_id);
    if (!cp) { res.status(404).json({ error: "Checkpoint não encontrado." }); return; }
    res.json(cp);
  } catch (err: any) {
    log.error("Erro em rondas :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// CREATE checkpoint
router.post("/checkpoints", authenticate, authorize("master", "administradora", "sindico"), (req: Request, res: Response) => {
  try {
    const { nome, descricao, localizacao, ordem } = req.body;
    if (!nome) { res.status(400).json({ error: "Nome é obrigatório." }); return; }

    // Generate unique QR code data
    const qr_code_data = `RONDA-CP-${req.user!.condominio_id}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

    const result = db.prepare(
      `INSERT INTO ronda_checkpoints (condominio_id, nome, descricao, localizacao, qr_code_data, ordem, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      req.user!.condominio_id,
      nome,
      descricao || null,
      localizacao || null,
      qr_code_data,
      ordem || 0,
      req.user!.id
    );

    const cp = db.prepare("SELECT * FROM ronda_checkpoints WHERE id = ?").get(result.lastInsertRowid);
    res.status(201).json(cp);
  } catch (err: any) {
    log.error("Erro em rondas :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// UPDATE checkpoint
router.put("/checkpoints/:id", authenticate, authorize("master", "administradora", "sindico"), (req: Request, res: Response) => {
  try {
    const existing = db.prepare(
      "SELECT id FROM ronda_checkpoints WHERE id = ? AND condominio_id = ?"
    ).get(req.params.id, req.user!.condominio_id);
    if (!existing) {
      res.status(404).json({ error: "Checkpoint não encontrado." });
      return;
    }

    const { nome, descricao, localizacao, ativo, ordem } = req.body;
    db.prepare(
      `UPDATE ronda_checkpoints
       SET nome = COALESCE(?, nome), descricao = COALESCE(?, descricao),
           localizacao = COALESCE(?, localizacao), ativo = COALESCE(?, ativo),
           ordem = COALESCE(?, ordem), updated_at = datetime('now')
       WHERE id = ? AND condominio_id = ?`
    ).run(nome, descricao, localizacao, ativo, ordem, req.params.id, req.user!.condominio_id);

    const cp = db.prepare(
      "SELECT * FROM ronda_checkpoints WHERE id = ? AND condominio_id = ?"
    ).get(req.params.id, req.user!.condominio_id);
    res.json(cp);
  } catch (err: any) {
    log.error("Erro ao atualizar checkpoint:", err);
    res.status(500).json({ error: "Erro ao atualizar checkpoint" });
  }
});

// DELETE checkpoint
router.delete("/checkpoints/:id", authenticate, authorize("master", "administradora", "sindico"), (req: Request, res: Response) => {
  try {
    db.prepare(
      "DELETE FROM ronda_checkpoints WHERE id = ? AND condominio_id = ?"
    ).run(req.params.id, req.user!.condominio_id);
    res.json({ success: true });
  } catch (err: any) {
    log.error("Erro em rondas :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ═══════════════════════════════════════════════════════════
// SCHEDULES — Managed by síndico
// ═══════════════════════════════════════════════════════════

// GET all schedules
router.get("/schedules", authenticate, (req: Request, res: Response) => {
  try {
    const schedules = db.prepare(
      "SELECT * FROM ronda_schedules WHERE condominio_id = ? ORDER BY horario"
    ).all(req.user!.condominio_id);
    res.json(schedules);
  } catch (err: any) {
    log.error("Erro em rondas :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// CREATE schedule
router.post("/schedules", authenticate, authorize("master", "administradora", "sindico"), (req: Request, res: Response) => {
  try {
    const { nome, horario, dias_semana, som_alerta } = req.body;
    if (!nome || !horario) { res.status(400).json({ error: "Nome e horário são obrigatórios." }); return; }

    const result = db.prepare(
      `INSERT INTO ronda_schedules (condominio_id, nome, horario, dias_semana, som_alerta, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      req.user!.condominio_id,
      nome,
      horario,
      dias_semana || "0,1,2,3,4,5,6",
      som_alerta !== undefined ? som_alerta : 1,
      req.user!.id
    );

    const sched = db.prepare("SELECT * FROM ronda_schedules WHERE id = ?").get(result.lastInsertRowid);
    res.status(201).json(sched);
  } catch (err: any) {
    log.error("Erro em rondas :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// UPDATE schedule
router.put("/schedules/:id", authenticate, authorize("master", "administradora", "sindico"), (req: Request, res: Response) => {
  try {
    const { nome, horario, dias_semana, som_alerta, ativo } = req.body;
    db.prepare(
      `UPDATE ronda_schedules
       SET nome = COALESCE(?, nome), horario = COALESCE(?, horario),
           dias_semana = COALESCE(?, dias_semana), som_alerta = COALESCE(?, som_alerta),
           ativo = COALESCE(?, ativo), updated_at = datetime('now')
       WHERE id = ? AND condominio_id = ?`
    ).run(nome, horario, dias_semana, som_alerta, ativo, req.params.id, req.user!.condominio_id);

    const sched = db.prepare("SELECT * FROM ronda_schedules WHERE id = ?").get(req.params.id);
    res.json(sched);
  } catch (err: any) {
    log.error("Erro em rondas :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// DELETE schedule
router.delete("/schedules/:id", authenticate, authorize("master", "administradora", "sindico"), (req: Request, res: Response) => {
  try {
    db.prepare(
      "DELETE FROM ronda_schedules WHERE id = ? AND condominio_id = ?"
    ).run(req.params.id, req.user!.condominio_id);
    res.json({ success: true });
  } catch (err: any) {
    log.error("Erro em rondas :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ═══════════════════════════════════════════════════════════
// REGISTROS — Created by porteiro/security via QR scan
// ═══════════════════════════════════════════════════════════

// GET all records (with Optional filters)
router.get("/registros", authenticate, (req: Request, res: Response) => {
  try {
    const { funcionario_id, checkpoint_id, data_inicio, data_fim } = req.query;
    let sql = "SELECT * FROM ronda_registros WHERE condominio_id = ?";
    const params: any[] = [req.user!.condominio_id];

    if (funcionario_id) {
      sql += " AND funcionario_id = ?";
      params.push(funcionario_id);
    }
    if (checkpoint_id) {
      sql += " AND checkpoint_id = ?";
      params.push(checkpoint_id);
    }
    if (data_inicio) {
      sql += " AND created_at >= ?";
      params.push(data_inicio + "T00:00:00");
    }
    if (data_fim) {
      sql += " AND created_at <= ?";
      params.push(data_fim + "T23:59:59");
    }

    sql += " ORDER BY created_at DESC";

    const registros = db.prepare(sql).all(...params);
    res.json(registros);
  } catch (err: any) {
    log.error("Erro em rondas :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// RECORD a checkpoint scan (porteiro scans QR)
router.post("/registros", authenticate, authorize("master", "administradora", "sindico", "funcionario"), (req: Request, res: Response) => {
  try {
    const { qr_code_data, observacao, foto, latitude, longitude, schedule_id } = req.body;
    if (!qr_code_data) { res.status(400).json({ error: "Dados do QR Code são obrigatórios." }); return; }

    // Find checkpoint by QR code data
    const checkpoint = db.prepare(
      "SELECT * FROM ronda_checkpoints WHERE qr_code_data = ? AND condominio_id = ?"
    ).get(qr_code_data, req.user!.condominio_id) as any;

    if (!checkpoint) {
      res.status(404).json({ error: "Ponto de ronda não encontrado ou QR Code inválido." });
      return;
    }

    if (!checkpoint.ativo) {
      res.status(400).json({ error: "Este ponto de ronda está desativado." });
      return;
    }

    const result = db.prepare(
      `INSERT INTO ronda_registros
       (condominio_id, checkpoint_id, funcionario_id, funcionario_nome, checkpoint_nome, localizacao, observacao, foto, latitude, longitude, ronda_schedule_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      req.user!.condominio_id,
      checkpoint.id,
      req.user!.id,
      req.user!.name,
      checkpoint.nome,
      checkpoint.localizacao || null,
      observacao || null,
      foto || null,
      latitude || null,
      longitude || null,
      schedule_id || null
    );

    const registro = db.prepare("SELECT * FROM ronda_registros WHERE id = ?").get(result.lastInsertRowid);

    // WhatsApp: notify about ronda checkpoint scanned
    notifyPortariaWhatsApp(
      req.user!.condominio_id!,
      "whatsapp_notify_ronda",
      `🔒 Ronda: ${req.user!.name} registrou ponto "${checkpoint.nome}"${checkpoint.localizacao ? " — " + checkpoint.localizacao : ""}`
    );

    res.status(201).json(registro);
  } catch (err: any) {
    log.error("Erro em rondas :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ═══════════════════════════════════════════════════════════
// STATS — Summary for reports
// ═══════════════════════════════════════════════════════════
router.get("/stats", authenticate, (req: Request, res: Response) => {
  try {
    const condId = req.user!.condominio_id;
    const { data_inicio, data_fim, funcionario_id } = req.query;

    let dateFilter = "";
    const params: any[] = [condId];

    if (data_inicio && data_fim) {
      dateFilter = " AND r.created_at >= ? AND r.created_at <= ?";
      params.push(data_inicio + "T00:00:00", data_fim + "T23:59:59");
    }

    let funcFilter = "";
    if (funcionario_id) {
      funcFilter = " AND r.funcionario_id = ?";
      params.push(funcionario_id);
    }

    // Total records
    const total = db.prepare(
      `SELECT COUNT(*) as count FROM ronda_registros r WHERE r.condominio_id = ?${dateFilter}${funcFilter}`
    ).get(...params) as any;

    // Records by checkpoint
    const byCheckpoint = db.prepare(
      `SELECT r.checkpoint_nome, COUNT(*) as count
       FROM ronda_registros r WHERE r.condominio_id = ?${dateFilter}${funcFilter}
       GROUP BY r.checkpoint_nome ORDER BY count DESC`
    ).all(...params);

    // Records by funcionário
    const byFuncionario = db.prepare(
      `SELECT r.funcionario_nome, COUNT(*) as count
       FROM ronda_registros r WHERE r.condominio_id = ?${dateFilter}${funcFilter}
       GROUP BY r.funcionario_nome ORDER BY count DESC`
    ).all(...params);

    // Records by hour
    const byHour = db.prepare(
      `SELECT CAST(strftime('%H', r.created_at) AS INTEGER) as hora, COUNT(*) as count
       FROM ronda_registros r WHERE r.condominio_id = ?${dateFilter}${funcFilter}
       GROUP BY hora ORDER BY hora`
    ).all(...params);

    // Records by day of week
    const byDay = db.prepare(
      `SELECT CAST(strftime('%w', r.created_at) AS INTEGER) as dia, COUNT(*) as count
       FROM ronda_registros r WHERE r.condominio_id = ?${dateFilter}${funcFilter}
       GROUP BY dia ORDER BY dia`
    ).all(...params);

    // Total active checkpoints
    const totalCheckpoints = db.prepare(
      "SELECT COUNT(*) as count FROM ronda_checkpoints WHERE condominio_id = ? AND ativo = 1"
    ).get(condId) as any;

    // Expected vs completed (per checkpoint in period)
    const completedCheckpoints = db.prepare(
      `SELECT DISTINCT checkpoint_id FROM ronda_registros r WHERE r.condominio_id = ?${dateFilter}${funcFilter}`
    ).all(...params) as any[];

    res.json({
      total: total.count,
      totalCheckpoints: totalCheckpoints.count,
      checkpointsCobertos: completedCheckpoints.length,
      byCheckpoint,
      byFuncionario,
      byHour,
      byDay,
    });
  } catch (err: any) {
    log.error("Erro em rondas :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// GET employees list for filter
router.get("/funcionarios", authenticate, (req: Request, res: Response) => {
  try {
    const funcs = db.prepare(
      `SELECT DISTINCT r.funcionario_id, r.funcionario_nome
       FROM ronda_registros r WHERE r.condominio_id = ?
       ORDER BY r.funcionario_nome`
    ).all(req.user!.condominio_id);
    res.json(funcs);
  } catch (err: any) {
    log.error("Erro em rondas :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

export default router;
