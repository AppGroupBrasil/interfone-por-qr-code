import { Router, Request, Response } from "express";
import db from "./db.js";
import { authenticate, authorize } from "./middleware.js";
import crypto from "crypto";
import { emailPreAuthEntradaConfirmada, emailPreAuthAutoCadastro } from "./emailService.js";
import { notifyPortariaWhatsApp, notifyUserWhatsApp } from "./whatsappService.js";
import { log } from "./logger.js";

const router = Router();

// ─── GET all pre-authorizations (porteiro/sindico+ sees all, morador sees own) ──
router.get("/", authenticate, (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const condominioId = user.condominio_id;
    const { status, search } = req.query;

    let query: string;
    const params: any[] = [];

    if (user.role === "morador") {
      query = "SELECT * FROM pre_authorizations WHERE morador_id = ?";
      params.push(user.id);
    } else {
      query = "SELECT * FROM pre_authorizations WHERE condominio_id = ?";
      params.push(condominioId);
    }

    if (status && status !== "todas") {
      query += " AND status = ?";
      params.push(status);
    }

    if (search) {
      query += " AND (visitante_nome LIKE ? OR morador_name LIKE ? OR bloco LIKE ? OR apartamento LIKE ?)";
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    query += " ORDER BY created_at DESC";

    const results = db.prepare(query).all(...params);
    res.json(results);
  } catch (err: any) {
    log.error("Erro em preAuthorizations :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ─── CREATE pre-authorization (morador creates) ─────────
router.post("/", authenticate, (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const {
      visitante_nome,
      visitante_documento,
      visitante_telefone,
      visitante_foto,
      tipo,
      data_inicio,
      data_fim,
      hora_inicio,
      hora_fim,
      observacao,
    } = req.body;

    if (!visitante_nome) {
      res.status(400).json({ error: "Nome do visitante é obrigatório." });
      return;
    }
    if (!data_inicio || !data_fim) {
      res.status(400).json({ error: "Data de início e fim são obrigatórias." });
      return;
    }

    const token = crypto.randomUUID();

    const result = db.prepare(`
      INSERT INTO pre_authorizations (
        condominio_id, morador_id, morador_name, morador_phone,
        bloco, apartamento, visitante_nome, visitante_documento,
        visitante_telefone, visitante_foto, tipo,
        data_inicio, data_fim, hora_inicio, hora_fim,
        observacao, status, token
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ativa', ?)
    `).run(
      user.condominio_id,
      user.id,
      user.name,
      user.phone || null,
      user.block || null,
      user.unit || null,
      visitante_nome,
      visitante_documento || null,
      visitante_telefone || null,
      visitante_foto || null,
      tipo || "simples",
      data_inicio,
      data_fim,
      hora_inicio || null,
      hora_fim || null,
      observacao || null,
      token
    );

    const auth = db.prepare("SELECT * FROM pre_authorizations WHERE id = ?").get(result.lastInsertRowid);

    // WhatsApp: notify portaria about new pre-authorization
    notifyPortariaWhatsApp(
      user.condominio_id!,
      "whatsapp_notify_pre_authorization",
      `📋 Nova pré-autorização: ${visitante_nome} — Morador: ${user.name} (${user.block || ""}/${user.unit || ""})`
    );

    res.status(201).json(auth);
  } catch (err: any) {
    log.error("Erro em preAuthorizations :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ─── UPDATE pre-authorization (morador edits) ───────────
router.put("/:id", authenticate, (req: Request, res: Response) => {
  try {
    const user = req.user!;
    let auth: any;

    if (user.role === "morador") {
      auth = db.prepare("SELECT * FROM pre_authorizations WHERE id = ? AND morador_id = ?").get(req.params.id, user.id);
    } else {
      auth = db.prepare("SELECT * FROM pre_authorizations WHERE id = ? AND condominio_id = ?").get(req.params.id, user.condominio_id);
    }

    if (!auth) {
      res.status(404).json({ error: "Autorização não encontrada." });
      return;
    }

    if (auth.status !== "ativa") {
      res.status(400).json({ error: "Só é possível editar autorizações ativas." });
      return;
    }

    const {
      visitante_nome,
      visitante_documento,
      visitante_telefone,
      data_inicio,
      data_fim,
      hora_inicio,
      hora_fim,
      observacao,
    } = req.body;

    db.prepare(`
      UPDATE pre_authorizations
      SET visitante_nome = COALESCE(?, visitante_nome),
          visitante_documento = COALESCE(?, visitante_documento),
          visitante_telefone = COALESCE(?, visitante_telefone),
          data_inicio = COALESCE(?, data_inicio),
          data_fim = COALESCE(?, data_fim),
          hora_inicio = ?,
          hora_fim = ?,
          observacao = ?
      WHERE id = ?
    `).run(
      visitante_nome || null,
      visitante_documento || null,
      visitante_telefone || null,
      data_inicio || null,
      data_fim || null,
      hora_inicio || null,
      hora_fim || null,
      observacao || null,
      req.params.id
    );

    const updated = db.prepare("SELECT * FROM pre_authorizations WHERE id = ?").get(req.params.id);
    res.json(updated);
  } catch (err: any) {
    log.error("Erro em preAuthorizations :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ─── GET self-register link info (PUBLIC) ────────────────
router.get("/auto-cadastro/:token", (req: Request, res: Response) => {
  try {
    const auth = db.prepare(
      "SELECT id, morador_name, bloco, apartamento, visitante_nome, data_inicio, data_fim, hora_inicio, hora_fim, observacao, status FROM pre_authorizations WHERE token = ?"
    ).get(req.params.token) as any;

    if (!auth) {
      res.status(404).json({ error: "Autorização não encontrada." });
      return;
    }

    res.json(auth);
  } catch (err: any) {
    log.error("Erro em preAuthorizations :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ─── VISITOR self-register from pre-auth link (PUBLIC) ───
router.post("/auto-cadastro/:token", (req: Request, res: Response) => {
  try {
    const auth = db.prepare("SELECT * FROM pre_authorizations WHERE token = ?").get(req.params.token) as any;

    if (!auth) {
      res.status(404).json({ error: "Autorização não encontrada." });
      return;
    }

    if (auth.status !== "ativa") {
      res.status(400).json({ error: "Esta autorização não está mais ativa." });
      return;
    }

    const { visitante_nome, visitante_documento, visitante_telefone, visitante_foto, face_descriptor, documento_foto } = req.body;

    const tooLong = (s: unknown, n: number) => typeof s === "string" && s.length > n;
    if (tooLong(visitante_nome, 120) || tooLong(visitante_documento, 30) || tooLong(visitante_telefone, 30)) {
      res.status(400).json({ error: "Campo excede tamanho permitido." });
      return;
    }
    if (tooLong(visitante_foto, 2_000_000) || tooLong(documento_foto, 2_000_000)) {
      res.status(413).json({ error: "Foto muito grande." });
      return;
    }

    db.prepare(`
      UPDATE pre_authorizations 
      SET visitante_nome = COALESCE(?, visitante_nome),
          visitante_documento = COALESCE(?, visitante_documento),
          visitante_telefone = COALESCE(?, visitante_telefone),
          visitante_foto = COALESCE(?, visitante_foto),
          face_descriptor = COALESCE(?, face_descriptor),
          documento_foto = COALESCE(?, documento_foto),
          tipo = 'auto_cadastro'
      WHERE token = ?
    `).run(
      visitante_nome || null,
      visitante_documento || null,
      visitante_telefone || null,
      visitante_foto || null,
      face_descriptor ? JSON.stringify(face_descriptor) : null,
      documento_foto || null,
      req.params.token
    );

    const updated = db.prepare("SELECT * FROM pre_authorizations WHERE token = ?").get(req.params.token);

    // 📧 Email: notify morador about auto-cadastro completion
    if (auth.morador_id) {
      emailPreAuthAutoCadastro({
        condominioId: auth.condominio_id,
        moradorId: auth.morador_id,
        moradorName: auth.morador_name,
        visitanteNome: visitante_nome || auth.visitante_nome,
        bloco: auth.bloco,
        apartamento: auth.apartamento,
      }).catch((err) => log.error("[EMAIL] Erro pré-auth auto-cadastro:", err));
    }

    res.json(updated);
  } catch (err: any) {
    log.error("Erro em preAuthorizations :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ─── CONFIRM ENTRY (porteiro confirms visitor arrived) ───
router.post("/:id/confirmar-entrada", authenticate, authorize("master", "administradora", "sindico", "funcionario"), (req: Request, res: Response) => {
  try {
    const auth = db.prepare("SELECT * FROM pre_authorizations WHERE id = ? AND condominio_id = ?")
      .get(req.params.id, req.user!.condominio_id) as any;

    if (!auth) {
      res.status(404).json({ error: "Autorização não encontrada." });
      return;
    }

    if (auth.status !== "ativa") {
      res.status(400).json({ error: "Esta autorização não está mais ativa." });
      return;
    }

    db.prepare(`
      UPDATE pre_authorizations 
      SET status = 'utilizada', 
          entrada_confirmada_at = datetime('now'),
          entrada_confirmada_por = ?
      WHERE id = ?
    `).run(req.user!.id, req.params.id);

    const updated = db.prepare("SELECT * FROM pre_authorizations WHERE id = ?").get(req.params.id);

    // 📧 Email: notify morador about entry confirmation
    if (auth.morador_id) {
      emailPreAuthEntradaConfirmada({
        condominioId: auth.condominio_id,
        moradorId: auth.morador_id,
        moradorName: auth.morador_name,
        visitanteNome: auth.visitante_nome,
        bloco: auth.bloco,
        apartamento: auth.apartamento,
      }).catch((err) => log.error("[EMAIL] Erro pré-auth entrada:", err));

      // WhatsApp: notify morador about visitor entry confirmation
      notifyUserWhatsApp(
        auth.condominio_id,
        "whatsapp_notify_pre_authorization",
        auth.morador_id,
        `✅ Visitante ${auth.visitante_nome} chegou e entrada foi confirmada — Bloco ${auth.bloco || ""} Apt ${auth.apartamento || ""}`
      );
    }

    res.json(updated);
  } catch (err: any) {
    log.error("Erro em preAuthorizations :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ─── CANCEL pre-authorization (morador or admin) ────────
router.delete("/:id", authenticate, (req: Request, res: Response) => {
  try {
    const user = req.user!;
    let auth: any;

    if (user.role === "morador") {
      auth = db.prepare("SELECT * FROM pre_authorizations WHERE id = ? AND morador_id = ?").get(req.params.id, user.id);
    } else {
      auth = db.prepare("SELECT * FROM pre_authorizations WHERE id = ? AND condominio_id = ?").get(req.params.id, user.condominio_id);
    }

    if (!auth) {
      res.status(404).json({ error: "Autorização não encontrada." });
      return;
    }

    db.prepare("UPDATE pre_authorizations SET status = 'cancelada' WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    log.error("Erro em preAuthorizations :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ─── GET face descriptors for active pre-authorizations ──
router.get("/face-descriptors", authenticate, authorize("master", "administradora", "sindico", "funcionario"), (req: Request, res: Response) => {
  try {
    const condominioId = req.user!.condominio_id;
    const results = db.prepare(`
      SELECT id, visitante_nome, visitante_documento, visitante_foto, 
             face_descriptor, bloco, apartamento, morador_name, morador_phone,
             data_inicio, data_fim, hora_inicio, hora_fim, observacao
      FROM pre_authorizations 
      WHERE condominio_id = ? AND status = 'ativa' AND face_descriptor IS NOT NULL
    `).all(condominioId) as any[];

    const parsed = results.map((r: any) => ({
      ...r,
      face_descriptor: r.face_descriptor ? JSON.parse(r.face_descriptor) : null,
    }));

    res.json(parsed);
  } catch (err: any) {
    log.error("Erro em preAuthorizations :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

export default router;
