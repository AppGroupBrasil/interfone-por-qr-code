import { Router, Request, Response } from "express";
import db from "./db.js";
import { authenticate, authorize } from "./middleware.js";
import crypto from "crypto";
import { captureSnapshotForCondominio } from "./cameraSnapshot.js";
import { emailVisitantePendente, emailVisitanteRespondido } from "./emailService.js";
import { notifyWhatsApp, notifyPortariaWhatsApp } from "./whatsappService.js";

const router = Router();

// ─── GET all visitors (with search) ──────────────────────
router.get("/", authenticate, authorize("master", "administradora", "sindico", "funcionario"), (req: Request, res: Response) => {
  try {
    const { search, status } = req.query;
    const condominioId = req.user!.condominio_id;

    let query = "SELECT * FROM visitors WHERE condominio_id = ?";
    const params: any[] = [condominioId];

    if (search) {
      query += " AND (nome LIKE ? OR documento LIKE ? OR telefone LIKE ? OR apartamento LIKE ?)";
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    if (status && status !== "todos") {
      query += " AND status = ?";
      params.push(status);
    }

    query += " ORDER BY created_at DESC";

    const visitors = db.prepare(query).all(...params);
    res.json(visitors);
  } catch (err: any) {
    console.error("Erro em visitors :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ─── CREATE visitor ──────────────────────────────────────
router.post("/", authenticate, authorize("master", "administradora", "sindico", "funcionario"), (req: Request, res: Response) => {
  try {
    const { nome, documento, telefone, foto, documento_foto, bloco, apartamento, autorizado_interfone, quem_autorizou, morador_whatsapp, face_descriptor } = req.body;

    if (!nome) {
      res.status(400).json({ error: "Nome é obrigatório." });
      return;
    }

    const token = crypto.randomUUID();
    const condominioId = req.user!.condominio_id;

    const result = db.prepare(`
      INSERT INTO visitors (nome, documento, telefone, foto, documento_foto, bloco, apartamento, autorizado_interfone, quem_autorizou, morador_whatsapp, token, condominio_id, created_by, status, face_descriptor)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente', ?)
    `).run(nome, documento || null, telefone || null, foto || null, documento_foto || null, bloco || null, apartamento || null, autorizado_interfone || 'nao', quem_autorizou || null, morador_whatsapp || null, token, condominioId, req.user!.id, face_descriptor ? JSON.stringify(face_descriptor) : null);

    const visitorId = result.lastInsertRowid;

    // Auto-capture snapshot from entrance camera (async, non-blocking)
    if (condominioId) {
      captureSnapshotForCondominio(condominioId).then((snap) => {
        if (snap) {
          db.prepare(
            "UPDATE visitors SET camera_snapshot = ?, camera_snapshot_at = datetime('now'), camera_snapshot_nome = ? WHERE id = ?"
          ).run(snap.snapshot, snap.camera_nome, visitorId);
        }
      }).catch(() => { /* silent */ });
    }

    const visitor = db.prepare("SELECT * FROM visitors WHERE id = ?").get(visitorId);

    // 📧 Email: notify morador about pending visitor
    if (bloco && apartamento && condominioId) {
      emailVisitantePendente({
        condominioId: condominioId,
        bloco: bloco || "",
        apartamento: apartamento || "",
        visitanteNome: nome,
        visitanteDocumento: documento || undefined,
        token,
      }).catch((err) => console.error("[EMAIL] Erro visitante pendente:", err));
    }

    // 📱 WhatsApp: notificar moradores do bloco/apartamento sobre visitante
    if (bloco && apartamento && condominioId) {
      const moradores = db.prepare(
        "SELECT phone FROM users WHERE condominio_id = ? AND block = ? AND unit = ? AND role = 'morador' AND phone IS NOT NULL AND phone != ''"
      ).all(condominioId, bloco, apartamento) as { phone: string }[];
      for (const m of moradores) {
        notifyWhatsApp(condominioId, "whatsapp_notify_visitor_arrival", m.phone,
          `🔔 *App Interfone* — Visitante na portaria\n\n👤 *${nome}*\n📍 Bloco ${bloco}, Apto ${apartamento}\n\nAguardando sua autorização.`);
      }
    }

    res.status(201).json(visitor);
  } catch (err: any) {
    console.error("Erro em visitors :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ─── GET visitor by token (PUBLIC - no auth) ─────────────
router.get("/auth/:token", (req: Request, res: Response) => {
  try {
    const visitor = db.prepare("SELECT id, nome, documento, telefone, foto, documento_foto, bloco, apartamento, autorizado_interfone, quem_autorizou, status, created_at FROM visitors WHERE token = ?").get(req.params.token);

    if (!visitor) {
      res.status(404).json({ error: "Visitante não encontrado." });
      return;
    }

    res.json(visitor);
  } catch (err: any) {
    console.error("Erro em visitors :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ─── AUTHORIZE/REJECT visitor (PUBLIC - via token) ───────
router.post("/auth/:token/respond", (req: Request, res: Response) => {
  try {
    const { status: action } = req.body; // 'liberado' or 'recusado'

    if (!["liberado", "recusado"].includes(action)) {
      res.status(400).json({ error: "Ação inválida." });
      return;
    }

    const visitor = db.prepare("SELECT * FROM visitors WHERE token = ?").get(req.params.token) as any;

    if (!visitor) {
      res.status(404).json({ error: "Visitante não encontrado." });
      return;
    }

    if (visitor.status !== "pendente") {
      res.status(400).json({ error: "Este visitante já foi respondido." });
      return;
    }

    db.prepare("UPDATE visitors SET status = ?, responded_at = datetime('now') WHERE token = ?").run(action, req.params.token);

    // 📧 Email: notify about visitor response
    if (visitor.bloco && visitor.apartamento) {
      emailVisitanteRespondido({
        condominioId: visitor.condominio_id,
        bloco: visitor.bloco,
        apartamento: visitor.apartamento,
        visitanteNome: visitor.nome,
        status: action,
      }).catch((err) => console.error("[EMAIL] Erro visitante respondido:", err));
    }

    const updated = db.prepare("SELECT id, nome, documento, foto, bloco, apartamento, status FROM visitors WHERE token = ?").get(req.params.token);
    res.json(updated);
  } catch (err: any) {
    console.error("Erro em visitors :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ─── SELF-REGISTER visitor (PUBLIC) ──────────────────────
router.post("/self-register", (req: Request, res: Response) => {
  try {
    const { nome, documento, telefone, foto, documento_foto, bloco, apartamento, condominio_id, face_descriptor, observacoes } = req.body;

    if (!nome) {
      res.status(400).json({ error: "Nome é obrigatório." });
      return;
    }

    const token = crypto.randomUUID();

    const result = db.prepare(`
      INSERT INTO visitors (nome, documento, telefone, foto, documento_foto, bloco, apartamento, autorizado_interfone, token, condominio_id, status, face_descriptor, observacoes)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'nao', ?, ?, 'pendente', ?, ?)
    `).run(nome, documento || null, telefone || null, foto || null, documento_foto || null, bloco || null, apartamento || null, token, condominio_id || null, face_descriptor ? JSON.stringify(face_descriptor) : null, observacoes || null);

    const visitor = db.prepare("SELECT * FROM visitors WHERE id = ?").get(result.lastInsertRowid);

    // 📱 WhatsApp: notificar moradores sobre visitante auto-registrado
    if (bloco && apartamento && condominio_id) {
      const moradores = db.prepare(
        "SELECT phone FROM users WHERE condominio_id = ? AND block = ? AND unit = ? AND role = 'morador' AND phone IS NOT NULL AND phone != ''"
      ).all(condominio_id, bloco, apartamento) as { phone: string }[];
      for (const m of moradores) {
        notifyWhatsApp(condominio_id, "whatsapp_notify_visitor_arrival", m.phone,
          `🔔 *App Interfone* — Visitante se registrou\n\n👤 *${nome}*\n📍 Bloco ${bloco}, Apto ${apartamento}\n\nAguardando sua autorização.`);
      }
    }

    res.status(201).json(visitor);
  } catch (err: any) {
    console.error("Erro em visitors :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ─── LIST moradores by block (name, unit, phone) ─────────
router.get("/moradores-bloco", authenticate, authorize("master", "administradora", "sindico", "funcionario"), (req: Request, res: Response) => {
  try {
    const { bloco } = req.query;
    if (!bloco) {
      res.json([]);
      return;
    }
    const condominioId = req.user!.condominio_id;
    const moradores = db.prepare(
      "SELECT id, name, unit, phone FROM users WHERE role = 'morador' AND block = ? AND condominio_id = ? ORDER BY unit ASC, name ASC"
    ).all(String(bloco), condominioId) as { id: number; name: string; unit: string; phone: string | null }[];
    res.json(moradores);
  } catch (err: any) {
    console.error("Erro em visitors :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ─── GET all face descriptors for matching ───────────────
// ?ready=true  → retorna SÓ quem já tem descriptor (payload leve, sem foto)
// ?pending=true → retorna SÓ quem tem foto mas NÃO tem descriptor
// sem params    → retorna tudo (comportamento antigo)
router.get("/face-descriptors", authenticate, authorize("master", "administradora", "sindico", "funcionario"), (req: Request, res: Response) => {
  try {
    const condominioId = req.user!.condominio_id;
    const { ready, pending } = req.query;

    if (ready === "true") {
      // Apenas visitantes com descriptor pré-computado (sem foto = payload pequeno)
      const visitors = db.prepare(
        "SELECT id, nome, documento, bloco, apartamento, face_descriptor, created_at FROM visitors WHERE (condominio_id = ? OR condominio_id IS NULL) AND face_descriptor IS NOT NULL ORDER BY created_at DESC"
      ).all(condominioId) as any[];
      res.json(visitors.map((v: any) => ({
        ...v,
        foto: null,
        face_descriptor: JSON.parse(v.face_descriptor),
      })));
      return;
    }

    if (pending === "true") {
      // Apenas visitantes com foto mas SEM descriptor (para pré-extração)
      const visitors = db.prepare(
        "SELECT id, nome, documento, foto, bloco, apartamento, created_at FROM visitors WHERE (condominio_id = ? OR condominio_id IS NULL) AND face_descriptor IS NULL AND foto IS NOT NULL ORDER BY created_at DESC"
      ).all(condominioId) as any[];
      res.json(visitors.map((v: any) => ({
        ...v,
        face_descriptor: null,
      })));
      return;
    }

    // Fallback: tudo (comportamento antigo)
    const visitors = db.prepare(
      "SELECT id, nome, documento, foto, bloco, apartamento, face_descriptor, created_at FROM visitors WHERE (condominio_id = ? OR condominio_id IS NULL) AND (face_descriptor IS NOT NULL OR foto IS NOT NULL) ORDER BY created_at DESC"
    ).all(condominioId) as any[];
    res.json(visitors.map((v: any) => ({
      ...v,
      face_descriptor: v.face_descriptor ? JSON.parse(v.face_descriptor) : null,
    })));
  } catch (err: any) {
    console.error("Erro em visitors :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ─── PATCH save face_descriptor for a visitor ───────────────
router.patch("/:id/face-descriptor", authenticate, authorize("master", "administradora", "sindico", "funcionario"), (req: Request, res: Response) => {
  try {
    const { face_descriptor } = req.body;
    if (!face_descriptor || !Array.isArray(face_descriptor)) {
      res.status(400).json({ error: "face_descriptor inválido" });
      return;
    }
    db.prepare("UPDATE visitors SET face_descriptor = ? WHERE id = ?").run(
      JSON.stringify(face_descriptor),
      req.params.id
    );
    res.json({ ok: true });
  } catch (err: any) {
    console.error("Erro ao salvar face_descriptor:", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ─── GET pending visitors for morador (authenticated) ───
router.get("/pendentes-morador", authenticate, (req: Request, res: Response) => {
  try {
    const user = req.user!;
    if (user.role !== "morador") {
      res.status(403).json({ error: "Apenas moradores podem ver solicitações pendentes." });
      return;
    }
    const visitors = db.prepare(
      "SELECT id, nome, documento, telefone, foto, documento_foto, bloco, apartamento, autorizado_interfone, quem_autorizou, status, created_at FROM visitors WHERE condominio_id = ? AND bloco = ? AND apartamento = ? AND status = 'pendente' ORDER BY created_at DESC"
    ).all(user.condominio_id, user.block, user.unit);
    res.json(visitors);
  } catch (err: any) {
    console.error("Erro em visitors :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ─── MORADOR responds to visitor (authenticated) ────────
router.post("/:id/responder-morador", authenticate, (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { status: action } = req.body; // 'liberado' or 'recusado'

    if (!["liberado", "recusado"].includes(action)) {
      res.status(400).json({ error: "Ação inválida." });
      return;
    }

    const visitor = db.prepare(
      "SELECT * FROM visitors WHERE id = ? AND condominio_id = ?"
    ).get(req.params.id, user.condominio_id) as any;

    if (!visitor) {
      res.status(404).json({ error: "Visitante não encontrado." });
      return;
    }
    if (visitor.status !== "pendente") {
      res.status(400).json({ error: "Este visitante já foi respondido." });
      return;
    }

    db.prepare("UPDATE visitors SET status = ?, responded_at = datetime('now') WHERE id = ?").run(action, req.params.id);

    // 📱 WhatsApp: notificar portaria sobre resposta do morador
    if (visitor.condominio_id) {
      const statusText = action === "liberado" ? "✅ LIBERADO" : "❌ RECUSADO";
      notifyPortariaWhatsApp(visitor.condominio_id, "whatsapp_notify_visitor_arrival",
        `🔔 *App Interfone* — Visitante ${statusText}\n\n👤 *${visitor.nome}*\n📍 Bloco ${visitor.bloco || "-"}, Apto ${visitor.apartamento || "-"}\n\nMorador respondeu: ${statusText}`);
    }

    const updated = db.prepare("SELECT id, nome, documento, foto, bloco, apartamento, status FROM visitors WHERE id = ?").get(req.params.id);
    res.json(updated);
  } catch (err: any) {
    console.error("Erro em visitors :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ─── DELETE visitor ──────────────────────────────────────
router.delete("/:id", authenticate, authorize("master", "administradora", "sindico", "funcionario"), (req: Request, res: Response) => {
  try {
    db.prepare("DELETE FROM visitors WHERE id = ? AND condominio_id = ?").run(req.params.id, req.user!.condominio_id);
    res.json({ success: true });
  } catch (err: any) {
    console.error("Erro em visitors :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ─── GET entrance camera stream for visitor token (PUBLIC) ───
// Returns the entrance camera URL so the resident can see who is at the door
router.get("/auth/:token/camera", (req: Request, res: Response) => {
  try {
    const visitor = db.prepare("SELECT id, condominio_id, status FROM visitors WHERE token = ?").get(req.params.token) as any;
    if (!visitor) {
      res.status(404).json({ error: "Visitante não encontrado." });
      return;
    }
    // Only show camera if visitor is still pending
    if (visitor.status !== "pendente") {
      res.status(400).json({ error: "Visitante já foi respondido." });
      return;
    }
    // Find entrance camera for this condominium
    const camera = db.prepare(
      `SELECT id, nome, url_stream, tipo_stream, setor FROM cameras
       WHERE condominio_id = ? AND ativa = 1 AND url_stream IS NOT NULL
       AND setor IN ('entrada_principal', 'portaria', 'entrada_servico')
       ORDER BY CASE setor WHEN 'entrada_principal' THEN 1 WHEN 'portaria' THEN 2 ELSE 3 END
       LIMIT 1`
    ).get(visitor.condominio_id) as any;

    if (!camera) {
      res.json({ available: false });
      return;
    }

    res.json({
      available: true,
      nome: camera.nome,
      url_stream: camera.url_stream,
      tipo_stream: camera.tipo_stream,
      setor: camera.setor,
    });
  } catch (err: any) {
    console.error("Erro em visitors :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

export default router;
