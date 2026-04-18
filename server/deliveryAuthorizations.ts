import { Router, Request, Response } from "express";
import db from "./db.js";
import { authenticate } from "./middleware.js";
import { captureSnapshotForCondominio } from "./cameraSnapshot.js";
import { emailDeliveryRecebido } from "./emailService.js";
import { notifyPortariaWhatsApp, notifyUserWhatsApp } from "./whatsappService.js";

const router = Router();

// ─── GET all delivery authorizations ─────────────────────
// Morador sees own, porteiro/sindico+ sees all for condominio
router.get("/", authenticate, (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const condominioId = user.condominio_id;
    const { status } = req.query;

    let query: string;
    const params: any[] = [];

    if (user.role === "morador") {
      query = "SELECT * FROM delivery_authorizations WHERE morador_id = ?";
      params.push(user.id);
    } else {
      query = "SELECT * FROM delivery_authorizations WHERE condominio_id = ?";
      params.push(condominioId);
    }

    if (status && status !== "todas") {
      query += " AND status = ?";
      params.push(status);
    }

    query += " ORDER BY created_at DESC";

    const results = db.prepare(query).all(...params);
    res.json(results);
  } catch (err: any) {
    console.error("Erro em deliveryAuthorizations :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ─── CREATE delivery authorization (morador) ────────────
router.post("/", authenticate, (req: Request, res: Response) => {
  try {
    const user = req.user!;
    if (!user.condominio_id) {
      res.status(400).json({ error: "Condomínio não configurado." });
      return;
    }
    const {
      servico,
      servico_custom,
      numero_pedido,
      print_pedido,
      observacao,
    } = req.body;

    if (!servico) {
      res.status(400).json({ error: "Serviço de delivery é obrigatório." });
      return;
    }

    const result = db.prepare(`
      INSERT INTO delivery_authorizations
        (condominio_id, morador_id, morador_name, morador_phone, bloco, apartamento,
         servico, servico_custom, numero_pedido, print_pedido, observacao, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente')
    `).run(
      user.condominio_id,
      user.id,
      user.name,
      user.phone,
      user.block,
      user.unit,
      servico,
      servico_custom || null,
      numero_pedido || null,
      print_pedido || null,
      observacao || null
    );

    // 📱 WhatsApp: notificar portaria sobre delivery autorizado
    notifyPortariaWhatsApp(user.condominio_id, "whatsapp_notify_delivery",
      `📦 *App Interfone* — Delivery Autorizado\n\n👤 ${user.name} (${user.block || "-"}/${user.unit || "-"})\n🛵 ${servico}${numero_pedido ? ` — Pedido: ${numero_pedido}` : ""}\n\nAguardando chegada.`);

    res.status(201).json({
      id: result.lastInsertRowid,
      message: "Autorização de delivery criada com sucesso.",
    });
  } catch (err: any) {
    console.error("Erro em deliveryAuthorizations :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ─── CREATE delivery (porteiro — morador didn't pre-authorize) ──
router.post("/portaria", authenticate, (req: Request, res: Response) => {
  try {
    const user = req.user!;
    if (!user.condominio_id) {
      res.status(400).json({ error: "Condomínio não configurado." });
      return;
    }
    if (user.role === "morador") {
      res.status(403).json({ error: "Apenas porteiros podem usar este endpoint." });
      return;
    }

    const { morador_id, morador_name, morador_phone, bloco, apartamento, servico, servico_custom, numero_pedido, observacao, foto_entrega } = req.body;

    if (!servico || !morador_name) {
      res.status(400).json({ error: "Serviço e morador são obrigatórios." });
      return;
    }

    const result = db.prepare(`
      INSERT INTO delivery_authorizations
        (condominio_id, morador_id, morador_name, morador_phone, bloco, apartamento,
         servico, servico_custom, numero_pedido, print_pedido, observacao, status, foto_entrega, recebido_por, recebido_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 'pendente', ?, ?, datetime('now'))
    `).run(
      user.condominio_id,
      morador_id || null,
      morador_name,
      morador_phone || null,
      bloco || null,
      apartamento || null,
      servico,
      servico_custom || null,
      numero_pedido || null,
      observacao || null,
      foto_entrega || null,
      user.id
    );

    const newId = result.lastInsertRowid;

    // Auto-capture snapshot from entrance camera
    if (user.condominio_id) {
      captureSnapshotForCondominio(user.condominio_id, ["entrada_principal", "portaria", "entrada_servico"]).then((snap) => {
        if (snap) {
          db.prepare(
            "UPDATE delivery_authorizations SET camera_snapshot = ?, camera_snapshot_at = datetime('now'), camera_snapshot_nome = ? WHERE id = ?"
          ).run(snap.snapshot, snap.camera_nome, newId);
        }
      }).catch(() => {});
    }

    // WhatsApp: notify morador about delivery arrival
    if (morador_id) {
      notifyUserWhatsApp(user.condominio_id, "whatsapp_notify_delivery", morador_id,
        `*App Interfone* — Delivery na Portaria\n\n${servico_custom || servico}${numero_pedido ? ` — Pedido: ${numero_pedido}` : ""}\nBloco ${bloco || "-"}, Apto ${apartamento || "-"}\n\nSua entrega chegou e esta na portaria. Por favor, venha retirar.`);
    }

    // Email: notify morador
    if (morador_id) {
      emailDeliveryRecebido({
        condominioId: user.condominio_id,
        moradorId: morador_id,
        moradorName: morador_name,
        servico: servico_custom || servico,
        numeroPedido: numero_pedido || undefined,
        bloco,
        apartamento,
      }).catch((err) => console.error("[EMAIL] Erro delivery portaria:", err));
    }

    res.status(201).json({
      id: newId,
      morador_phone: morador_phone || null,
      message: "Delivery registrado pela portaria.",
    });
  } catch (err: any) {
    console.error("Erro em deliveryAuthorizations /portaria:", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ─── MARK AS RECEIVED (porteiro) ─────────────────────────
router.post("/:id/recebido", authenticate, (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { foto_entrega } = req.body;

    const delivery = db.prepare(
      "SELECT * FROM delivery_authorizations WHERE id = ? AND condominio_id = ?"
    ).get(req.params.id, user.condominio_id) as any;

    if (!delivery) {
      res.status(404).json({ error: "Delivery não encontrado." });
      return;
    }

    if (delivery.status === "recebido") {
      res.status(400).json({ error: "Delivery já foi marcado como recebido." });
      return;
    }

    db.prepare(`
      UPDATE delivery_authorizations
      SET status = 'recebido',
          foto_entrega = ?,
          recebido_por = ?,
          recebido_at = datetime('now')
      WHERE id = ?
    `).run(foto_entrega || null, user.id, req.params.id);

    // Auto-capture snapshot from entrance camera
    if (user.condominio_id) {
      captureSnapshotForCondominio(user.condominio_id, ["entrada_principal", "portaria", "entrada_servico"]).then((snap) => {
        if (snap) {
          db.prepare(
            "UPDATE delivery_authorizations SET camera_snapshot = ?, camera_snapshot_at = datetime('now'), camera_snapshot_nome = ? WHERE id = ?"
          ).run(snap.snapshot, snap.camera_nome, req.params.id);
        }
      }).catch(() => {});
    }

    // Return updated record with morador info for WhatsApp
    const updated = db.prepare(
      "SELECT * FROM delivery_authorizations WHERE id = ?"
    ).get(req.params.id) as any;

    // 📧 Email: notify morador delivery received
    if (delivery.morador_id) {
      emailDeliveryRecebido({
        condominioId: delivery.condominio_id,
        moradorId: delivery.morador_id,
        moradorName: delivery.morador_name,
        servico: delivery.servico_custom || delivery.servico,
        numeroPedido: delivery.numero_pedido || undefined,
        bloco: delivery.bloco,
        apartamento: delivery.apartamento,
      }).catch((err) => console.error("[EMAIL] Erro delivery recebido:", err));
    }

    // 📱 WhatsApp: notificar morador que delivery foi recebido
    if (delivery.morador_id) {
      notifyUserWhatsApp(delivery.condominio_id, "whatsapp_notify_delivery", delivery.morador_id,
        `📦 *App Interfone* — Delivery Recebido!\n\n🛵 ${delivery.servico_custom || delivery.servico}${delivery.numero_pedido ? ` — Pedido: ${delivery.numero_pedido}` : ""}\n📍 Bloco ${delivery.bloco || "-"}, Apto ${delivery.apartamento || "-"}\n\nJá está na portaria.`);
    }

    res.json({ message: "Delivery marcado como recebido.", delivery: updated });
  } catch (err: any) {
    console.error("Erro em deliveryAuthorizations :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ─── CANCEL delivery authorization (morador or admin) ───
router.delete("/:id", authenticate, (req: Request, res: Response) => {
  try {
    const user = req.user!;

    let delivery: any;
    if (user.role === "morador") {
      delivery = db.prepare(
        "SELECT * FROM delivery_authorizations WHERE id = ? AND morador_id = ?"
      ).get(req.params.id, user.id);
    } else {
      delivery = db.prepare(
        "SELECT * FROM delivery_authorizations WHERE id = ? AND condominio_id = ?"
      ).get(req.params.id, user.condominio_id);
    }

    if (!delivery) {
      res.status(404).json({ error: "Delivery não encontrado." });
      return;
    }

    db.prepare("DELETE FROM delivery_authorizations WHERE id = ?").run(req.params.id);
    res.json({ message: "Autorização de delivery cancelada." });
  } catch (err: any) {
    console.error("Erro em deliveryAuthorizations :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

export default router;
