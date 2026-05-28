import { Router, Request, Response } from "express";
import db from "./db.js";
import { authenticate } from "./middleware.js";
import crypto from "crypto";
import { captureSnapshotForCondominio } from "./cameraSnapshot.js";
import { emailVeiculoPendenteAprovacao, emailVeiculoRespondido, emailVeiculoEncerrado } from "./emailService.js";
import { notifyPortariaWhatsApp, notifyUserWhatsApp } from "./whatsappService.js";
import { sendPushToUser } from "./pushService.js";
import { log } from "./logger.js";

const router = Router();

// ─── GET all vehicle authorizations ──────────────────────
router.get("/", authenticate, (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { status, search } = req.query;

    let query: string;
    const params: any[] = [];

    if (user.role === "morador") {
      query = "SELECT * FROM vehicle_authorizations WHERE morador_id = ?";
      params.push(user.id);
    } else {
      query = "SELECT * FROM vehicle_authorizations WHERE condominio_id = ?";
      params.push(user.condominio_id);
    }

    if (status && status !== "todas") {
      query += " AND status = ?";
      params.push(status);
    }

    if (search) {
      query += " AND (placa LIKE ? OR modelo LIKE ? OR motorista_nome LIKE ? OR morador_name LIKE ? OR bloco LIKE ?)";
      const s = `%${search}%`;
      params.push(s, s, s, s, s);
    }

    query += " ORDER BY created_at DESC";
    const results = db.prepare(query).all(...params);
    res.json(results);
  } catch (err: any) {
    log.error("Erro em vehicleAuthorizations :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ─── CREATE vehicle authorization (morador) ──────────────
router.post("/", authenticate, (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const {
      placa,
      modelo,
      cor,
      motorista_nome,
      data_inicio,
      data_fim,
      hora_inicio,
      hora_fim,
      requer_autorizacao_saida,
      observacao,
    } = req.body;

    if (!placa) {
      res.status(400).json({ error: "Placa é obrigatória." });
      return;
    }
    if (!data_inicio || !data_fim) {
      res.status(400).json({ error: "Datas de início e fim são obrigatórias." });
      return;
    }

    // ── Config validations ──
    const getConfig = (key: string) => {
      const row = db
        .prepare("SELECT value FROM condominio_config WHERE condominio_id = ? AND key = ?")
        .get(user.condominio_id, key) as { value: string } | undefined;
      return row?.value;
    };

    // Check: unique access per plate
    if (getConfig("vehicle_unique_access") === "true") {
      const existing = db.prepare(
        "SELECT id FROM vehicle_authorizations WHERE condominio_id = ? AND placa = ? AND status = 'ativa' AND data_fim >= date('now')"
      ).get(user.condominio_id, placa.toUpperCase()) as any;
      if (existing) {
        res.status(400).json({
          error: "Já existe uma autorização ativa para este veículo. Cancele a anterior ou aguarde o vencimento.",
        });
        return;
      }
    }

    // Check: limit per apartment
    if (getConfig("vehicle_limit_per_apt") === "true") {
      const limit = parseInt(getConfig("vehicle_limit_per_apt_count") || "3", 10);
      const count = db.prepare(
        "SELECT COUNT(*) as c FROM vehicle_authorizations WHERE condominio_id = ? AND bloco = ? AND apartamento = ? AND status = 'ativa' AND data_fim >= date('now')"
      ).get(user.condominio_id, user.block, user.unit) as { c: number };
      if (count.c >= limit) {
        res.status(400).json({
          error: `Limite de ${limit} veículo(s) ativo(s) por apartamento atingido. Cancele uma autorização existente.`,
        });
        return;
      }
    }

    const result = db.prepare(`
      INSERT INTO vehicle_authorizations
        (condominio_id, morador_id, morador_name, morador_phone, bloco, apartamento,
         placa, modelo, cor, motorista_nome, data_inicio, data_fim, hora_inicio, hora_fim,
         requer_autorizacao_saida, observacao, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ativa')
    `).run(
      user.condominio_id,
      user.id,
      user.name,
      user.phone,
      user.block,
      user.unit,
      placa.toUpperCase(),
      modelo || null,
      cor || null,
      motorista_nome || null,
      data_inicio,
      data_fim,
      hora_inicio || null,
      hora_fim || null,
      requer_autorizacao_saida ? 1 : 0,
      observacao || null
    );

    // WhatsApp: notify portaria about new vehicle authorization
    notifyPortariaWhatsApp(
      user.condominio_id!,
      "whatsapp_notify_vehicle_access",
      `🚗 Novo veículo autorizado: ${placa.toUpperCase()}${modelo ? " " + modelo : ""}${cor ? " (" + cor + ")" : ""} — Morador: ${user.name} (${user.block || ""}/${user.unit || ""})`
    );

    res.status(201).json({
      id: result.lastInsertRowid,
      message: "Autorização de veículo criada com sucesso.",
    });
  } catch (err: any) {
    log.error("Erro em vehicleAuthorizations :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ─── PORTEIRO CADASTRO (creates pending, notifies morador) ─
router.post("/portaria-cadastro", authenticate, (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { placa, modelo, cor, motorista_nome, bloco, apartamento, observacao, foto_placa } = req.body;

    if (!placa) {
      res.status(400).json({ error: "Placa é obrigatória." });
      return;
    }
    if (!bloco || !apartamento) {
      res.status(400).json({ error: "Bloco e apartamento são obrigatórios." });
      return;
    }

    // ── Config: dynamic required fields ──
    const getConfig = (key: string) => {
      const row = db.prepare("SELECT value FROM condominio_config WHERE condominio_id = ? AND key = ?").get(user.condominio_id, key) as { value: string } | undefined;
      return row?.value;
    };
    if (getConfig("vehicle_require_modelo") === "true" && !modelo?.trim()) {
      res.status(400).json({ error: "Modelo é obrigatório." }); return;
    }
    if (getConfig("vehicle_require_cor") === "true" && !cor?.trim()) {
      res.status(400).json({ error: "Cor é obrigatória." }); return;
    }
    if (getConfig("vehicle_require_motorista") === "true" && !motorista_nome?.trim()) {
      res.status(400).json({ error: "Nome do Motorista é obrigatório." }); return;
    }
    if (getConfig("vehicle_require_observacao") === "true" && !observacao?.trim()) {
      res.status(400).json({ error: "Observação é obrigatória." }); return;
    }

    // ── Config: unique access per plate ──
    const cfgRow = db
      .prepare("SELECT value FROM condominio_config WHERE condominio_id = ? AND key = ?")
      .get(user.condominio_id, "vehicle_unique_access") as { value: string } | undefined;
    if (cfgRow?.value === "true") {
      const existing = db.prepare(
        "SELECT id FROM vehicle_authorizations WHERE condominio_id = ? AND placa = ? AND status IN ('ativa','pendente_aprovacao') AND data_fim >= date('now')"
      ).get(user.condominio_id, placa.toUpperCase()) as any;
      if (existing) {
        res.status(400).json({
          error: "Já existe uma autorização ativa para este veículo. O morador precisa dar baixa na atual antes de cadastrar novamente.",
        });
        return;
      }
    }

    // ── Config: limit per apartment ──
    const limitRow = db
      .prepare("SELECT value FROM condominio_config WHERE condominio_id = ? AND key = ?")
      .get(user.condominio_id, "vehicle_limit_per_apt") as { value: string } | undefined;
    if (limitRow?.value === "true") {
      const limitCountRow = db
        .prepare("SELECT value FROM condominio_config WHERE condominio_id = ? AND key = ?")
        .get(user.condominio_id, "vehicle_limit_per_apt_count") as { value: string } | undefined;
      const limit = parseInt(limitCountRow?.value || "3", 10);
      const count = db.prepare(
        "SELECT COUNT(*) as c FROM vehicle_authorizations WHERE condominio_id = ? AND bloco = ? AND apartamento = ? AND status IN ('ativa','pendente_aprovacao') AND data_fim >= date('now')"
      ).get(user.condominio_id, bloco, apartamento) as { c: number };
      if (count.c >= limit) {
        res.status(400).json({
          error: `Limite de ${limit} veículo(s) ativo(s) por unidade atingido. É necessário dar baixa em uma autorização existente.`,
        });
        return;
      }
    }

    // Find morador for this bloco/apartamento
    const morador = db.prepare(
      "SELECT id, name, phone FROM users WHERE condominio_id = ? AND block = ? AND unit = ? AND role = 'morador' LIMIT 1"
    ).get(user.condominio_id, bloco, apartamento) as { id: number; name: string; phone: string | null } | undefined;

    const token = crypto.randomUUID();
    const today = new Date().toISOString().split("T")[0];

    const result = db.prepare(`
      INSERT INTO vehicle_authorizations
        (condominio_id, morador_id, morador_name, morador_phone, bloco, apartamento,
         placa, modelo, cor, motorista_nome, data_inicio, data_fim,
         requer_autorizacao_saida, observacao, status, token, cadastrado_por_porteiro, foto_placa)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'pendente_aprovacao', ?, 1, ?)
    `).run(
      user.condominio_id,
      morador?.id || null,
      morador?.name || `Morador ${bloco}-${apartamento}`,
      morador?.phone || null,
      bloco,
      apartamento,
      placa.toUpperCase(),
      modelo || null,
      cor || null,
      motorista_nome || null,
      today,
      today,
      observacao || null,
      token,
      foto_placa || null
    );

    // 📧 Email: notify morador about vehicle pending approval
    if (user.condominio_id) {
      emailVeiculoPendenteAprovacao({
        condominioId: user.condominio_id,
        moradorId: morador?.id,
        bloco,
        apartamento,
        placa: placa.toUpperCase(),
        modelo: modelo || undefined,
        cor: cor || undefined,
        motoristaNome: motorista_nome || undefined,
        token,
      }).catch((err) => log.error("[EMAIL] Erro veículo pendente:", err));

      // WhatsApp: notify morador about pending vehicle approval
      if (morador?.id) {
        notifyUserWhatsApp(
          user.condominio_id!,
          "whatsapp_notify_vehicle_access",
          morador.id,
          `🚗 Veículo ${placa.toUpperCase()} cadastrado pela portaria para Bloco ${bloco} Apt ${apartamento}. Aguardando sua aprovação.`
        );
      }
    }

    res.status(201).json({
      id: result.lastInsertRowid,
      token,
      morador_phone: morador?.phone || null,
      morador_name: morador?.name || null,
      message: "Cadastro de veículo criado. Aguardando aprovação do morador.",
    });
  } catch (err: any) {
    log.error("Erro em vehicleAuthorizations :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ─── GET PUBLIC APPROVAL PAGE DATA ──────────────────────
router.get("/aprovar/:token", (req: Request, res: Response) => {
  try {
    const vehicle = db.prepare(
      "SELECT * FROM vehicle_authorizations WHERE token = ?"
    ).get(req.params.token) as any;

    if (!vehicle) {
      res.status(404).json({ error: "Autorização não encontrada." });
      return;
    }

    res.json({
      id: vehicle.id,
      placa: vehicle.placa,
      modelo: vehicle.modelo,
      cor: vehicle.cor,
      motorista_nome: vehicle.motorista_nome,
      bloco: vehicle.bloco,
      apartamento: vehicle.apartamento,
      observacao: vehicle.observacao,
      status: vehicle.status,
      created_at: vehicle.created_at,
    });
  } catch (err: any) {
    log.error("Erro em vehicleAuthorizations :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ─── PUBLIC APPROVE/DENY ────────────────────────────────
router.post("/aprovar/:token", (req: Request, res: Response) => {
  try {
    const { acao, morador_observacao } = req.body; // acao: 'aprovar' | 'negar'

    if (acao !== "aprovar" && acao !== "negar") {
      res.status(400).json({ error: "Ação inválida." });
      return;
    }
    if (morador_observacao != null && (typeof morador_observacao !== "string" || morador_observacao.length > 500)) {
      res.status(400).json({ error: "Observação inválida (máx 500 caracteres)." });
      return;
    }

    const vehicle = db.prepare(
      "SELECT * FROM vehicle_authorizations WHERE token = ?"
    ).get(req.params.token) as any;

    if (!vehicle) {
      res.status(404).json({ error: "Autorização não encontrada." });
      return;
    }

    if (vehicle.status !== "pendente_aprovacao") {
      res.status(400).json({ error: "Esta solicitação já foi respondida." });
      return;
    }

    if (acao === "aprovar") {
      const today = new Date().toISOString().split("T")[0];
      db.prepare(`
        UPDATE vehicle_authorizations
        SET status = 'ativa',
            data_inicio = ?,
            data_fim = ?,
            morador_observacao = ?
        WHERE token = ?
      `).run(today, today, morador_observacao || null, req.params.token);

      // 📧 Email: vehicle approved
      emailVeiculoRespondido({
        condominioId: vehicle.condominio_id,
        moradorId: vehicle.morador_id || undefined,
        bloco: vehicle.bloco,
        apartamento: vehicle.apartamento,
        placa: vehicle.placa,
        status: "ativa",
      }).catch((err) => log.error("[EMAIL] Erro veículo aprovado:", err));

      res.json({ message: "Acesso aprovado com sucesso!" });
    } else {
      db.prepare(`
        UPDATE vehicle_authorizations
        SET status = 'negada',
            morador_observacao = ?
        WHERE token = ?
      `).run(morador_observacao || null, req.params.token);

      // 📧 Email: vehicle denied
      emailVeiculoRespondido({
        condominioId: vehicle.condominio_id,
        moradorId: vehicle.morador_id || undefined,
        bloco: vehicle.bloco,
        apartamento: vehicle.apartamento,
        placa: vehicle.placa,
        status: "negada",
      }).catch((err) => log.error("[EMAIL] Erro veículo negado:", err));

      res.json({ message: "Acesso negado." });
    }
  } catch (err: any) {
    log.error("Erro em vehicleAuthorizations :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ─── CONFIRM ENTRY (porteiro) ────────────────────────────
router.post("/:id/confirmar-entrada", authenticate, (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const vehicle = db.prepare(
      "SELECT * FROM vehicle_authorizations WHERE id = ? AND condominio_id = ?"
    ).get(req.params.id, user.condominio_id) as any;

    if (!vehicle) {
      res.status(404).json({ error: "Autorização não encontrada." });
      return;
    }

    db.prepare(`
      UPDATE vehicle_authorizations
      SET entrada_confirmada_at = datetime('now'),
          entrada_confirmada_por = ?
      WHERE id = ?
    `).run(user.id, req.params.id);

    // Auto-capture snapshot from garage/entrance camera
    if (user.condominio_id) {
      captureSnapshotForCondominio(user.condominio_id, ["garagem", "entrada_principal", "estacionamento", "portaria"]).then((snap) => {
        if (snap) {
          db.prepare(
            "UPDATE vehicle_authorizations SET camera_snapshot = ?, camera_snapshot_at = datetime('now'), camera_snapshot_nome = ? WHERE id = ?"
          ).run(snap.snapshot, snap.camera_nome, req.params.id);
        }
      }).catch((err) => log.warn("[vehicle] snapshot falhou:", err));
    }

    const updated = db.prepare("SELECT * FROM vehicle_authorizations WHERE id = ?").get(req.params.id);

    // WhatsApp: notify morador about vehicle entry confirmation
    if (vehicle.morador_id) {
      notifyUserWhatsApp(
        vehicle.condominio_id,
        "whatsapp_notify_vehicle_access",
        vehicle.morador_id,
        `✅ Veículo ${vehicle.placa} — entrada confirmada pela portaria.`
      );
    }

    res.json({ message: "Entrada confirmada.", vehicle: updated });
  } catch (err: any) {
    log.error("Erro em vehicleAuthorizations :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ─── REQUEST EXIT (porteiro) ─────────────────────────────
router.post("/:id/solicitar-saida", authenticate, (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const vehicle = db.prepare(
      "SELECT * FROM vehicle_authorizations WHERE id = ? AND condominio_id = ?"
    ).get(req.params.id, user.condominio_id) as any;

    if (!vehicle) {
      res.status(404).json({ error: "Autorização não encontrada." });
      return;
    }

    db.prepare(`
      UPDATE vehicle_authorizations
      SET saida_solicitada_at = datetime('now')
      WHERE id = ?
    `).run(req.params.id);

    const updated = db.prepare("SELECT * FROM vehicle_authorizations WHERE id = ?").get(req.params.id);
    res.json({ message: "Solicitação de saída registrada.", vehicle: updated });
  } catch (err: any) {
    log.error("Erro em vehicleAuthorizations :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ─── AUTHORIZE EXIT (via link / morador) ─────────────────
router.post("/:id/autorizar-saida", authenticate, (req: Request, res: Response) => {
  try {
    const condominioId = req.user!.condominio_id;

    const vehicle = db.prepare(
      "SELECT * FROM vehicle_authorizations WHERE id = ? AND condominio_id = ?"
    ).get(req.params.id, condominioId) as any;

    if (!vehicle) {
      res.status(404).json({ error: "Autorização não encontrada." });
      return;
    }

    db.prepare(`
      UPDATE vehicle_authorizations
      SET saida_autorizada = 1,
          saida_autorizada_at = datetime('now'),
          status = 'utilizada'
      WHERE id = ? AND condominio_id = ?
    `).run(req.params.id, condominioId);

    res.json({ message: "Saída autorizada." });
  } catch (err: any) {
    log.error("Erro ao autorizar saída:", err);
    res.status(500).json({ error: "Erro ao autorizar saída" });
  }
});

// ─── REGISTER EXIT (porteiro — direct) ───────────────────
router.post("/:id/registrar-saida", authenticate, (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const vehicle = db.prepare(
      "SELECT * FROM vehicle_authorizations WHERE id = ? AND condominio_id = ?"
    ).get(req.params.id, user.condominio_id) as any;

    if (!vehicle) {
      res.status(404).json({ error: "Autorização não encontrada." });
      return;
    }

    db.prepare(`
      UPDATE vehicle_authorizations
      SET saida_autorizada = 1,
          saida_autorizada_at = datetime('now'),
          status = 'utilizada'
      WHERE id = ?
    `).run(req.params.id);

    res.json({ message: "Saída registrada com sucesso." });
  } catch (err: any) {
    log.error("Erro ao registrar saída:", err);
    res.status(500).json({ error: "Erro ao registrar saída" });
  }
});

// ─── UPDATE vehicle authorization (morador edits) ────────
router.put("/:id", authenticate, (req: Request, res: Response) => {
  try {
    const user = req.user!;
    let vehicle: any;

    if (user.role === "morador") {
      vehicle = db.prepare("SELECT * FROM vehicle_authorizations WHERE id = ? AND morador_id = ?").get(req.params.id, user.id);
    } else {
      vehicle = db.prepare("SELECT * FROM vehicle_authorizations WHERE id = ? AND condominio_id = ?").get(req.params.id, user.condominio_id);
    }

    if (!vehicle) {
      res.status(404).json({ error: "Autorização não encontrada." });
      return;
    }
    if (vehicle.status !== "ativa") {
      res.status(400).json({ error: "Só é possível editar autorizações ativas." });
      return;
    }

    const { placa, modelo, cor, motorista_nome, data_inicio, data_fim, hora_inicio, hora_fim, requer_autorizacao_saida, observacao } = req.body;

    db.prepare(`
      UPDATE vehicle_authorizations
      SET placa = COALESCE(?, placa),
          modelo = ?,
          cor = ?,
          motorista_nome = ?,
          data_inicio = COALESCE(?, data_inicio),
          data_fim = COALESCE(?, data_fim),
          hora_inicio = ?,
          hora_fim = ?,
          requer_autorizacao_saida = ?,
          observacao = ?
      WHERE id = ?
    `).run(
      placa ? placa.toUpperCase() : null,
      modelo || null,
      cor || null,
      motorista_nome || null,
      data_inicio || null,
      data_fim || null,
      hora_inicio || null,
      hora_fim || null,
      requer_autorizacao_saida ? 1 : 0,
      observacao || null,
      req.params.id
    );

    const updated = db.prepare("SELECT * FROM vehicle_authorizations WHERE id = ?").get(req.params.id);
    res.json(updated);
  } catch (err: any) {
    log.error("Erro em vehicleAuthorizations :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ─── MORADOR responds to vehicle request (authenticated) ─
router.post("/:id/responder-morador", authenticate, (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { acao, morador_observacao } = req.body; // acao: 'aprovar' | 'negar'

    if (!["aprovar", "negar"].includes(acao)) {
      res.status(400).json({ error: "Ação inválida." });
      return;
    }

    const vehicle = db.prepare(
      "SELECT * FROM vehicle_authorizations WHERE id = ? AND condominio_id = ?"
    ).get(req.params.id, user.condominio_id) as any;

    if (!vehicle) {
      res.status(404).json({ error: "Autorização não encontrada." });
      return;
    }
    if (vehicle.status !== "pendente_aprovacao") {
      res.status(400).json({ error: "Esta solicitação já foi respondida." });
      return;
    }

    if (acao === "aprovar") {
      const today = new Date().toISOString().split("T")[0];
      db.prepare(`
        UPDATE vehicle_authorizations
        SET status = 'ativa', data_inicio = ?, data_fim = ?, morador_observacao = ?
        WHERE id = ?
      `).run(today, today, morador_observacao || null, req.params.id);
    } else {
      db.prepare(`
        UPDATE vehicle_authorizations
        SET status = 'negada', morador_observacao = ?
        WHERE id = ?
      `).run(morador_observacao || null, req.params.id);
    }

    const updated = db.prepare("SELECT * FROM vehicle_authorizations WHERE id = ?").get(req.params.id);
    res.json(updated);
  } catch (err: any) {
    log.error("Erro em vehicleAuthorizations :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ─── BULK CANCEL active authorizations for today ─────────
router.post("/cancelar-dia", authenticate, (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const today = new Date().toISOString().split("T")[0];

    // Fetch affected authorizations before cancelling (for notifications)
    const affected = db.prepare(`
      SELECT id, morador_id, morador_name, placa, bloco, apartamento
      FROM vehicle_authorizations
      WHERE condominio_id = ? AND status = 'ativa' AND data_fim = ?
    `).all(user.condominio_id, today) as { id: number; morador_id: number | null; morador_name: string; placa: string; bloco: string; apartamento: string }[];

    const result = db.prepare(`
      UPDATE vehicle_authorizations
      SET status = 'utilizada'
      WHERE condominio_id = ?
        AND status = 'ativa'
        AND data_fim = ?
    `).run(user.condominio_id, today);

    // Notify each morador whose authorization was cancelled (Push + Email)
    for (const v of affected) {
      if (!v.morador_id) continue;
      // Push notification
      sendPushToUser(v.morador_id, {
        title: "\u26A0\uFE0F Libera\u00E7\u00E3o de ve\u00EDculo encerrada",
        body: `Sua autoriza\u00E7\u00E3o para o ve\u00EDculo ${v.placa} (${v.bloco} - Apt ${v.apartamento}) foi encerrada. Refa\u00E7a pelo app se precisar.`,
        data: { type: "vehicle_cancelled", vehicleId: String(v.id) },
      }).catch((err) => log.warn("[vehicle] snapshot falhou:", err));
      // Email
      emailVeiculoEncerrado({
        condominioId: user.condominio_id!,
        moradorId: v.morador_id,
        bloco: v.bloco,
        apartamento: v.apartamento,
        placa: v.placa,
        motivo: "encerrada pela portaria",
      }).catch((err) => log.error("[EMAIL] Erro ve\u00EDculo encerrado:", err));
    }

    res.json({ message: `${result.changes} liberação(ões) do dia encerrada(s).`, count: result.changes });
  } catch (err: any) {
    log.error("Erro em cancelar-dia:", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ─── CANCEL (morador or admin) ───────────────────────────
router.delete("/:id", authenticate, (req: Request, res: Response) => {
  try {
    const user = req.user!;
    let vehicle: any;

    if (user.role === "morador") {
      vehicle = db.prepare(
        "SELECT * FROM vehicle_authorizations WHERE id = ? AND morador_id = ?"
      ).get(req.params.id, user.id);
    } else {
      vehicle = db.prepare(
        "SELECT * FROM vehicle_authorizations WHERE id = ? AND condominio_id = ?"
      ).get(req.params.id, user.condominio_id);
    }

    if (!vehicle) {
      res.status(404).json({ error: "Autorização não encontrada." });
      return;
    }

    db.prepare("DELETE FROM vehicle_authorizations WHERE id = ?").run(req.params.id);
    res.json({ message: "Autorização de veículo cancelada." });
  } catch (err: any) {
    log.error("Erro em vehicleAuthorizations :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ─── SEARCH vehicle by plate (returns latest match) ─────
router.get("/buscar-placa/:placa", authenticate, (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const placa = String(req.params.placa || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!placa || placa.length < 3) {
      res.status(400).json({ error: "Placa inválida." });
      return;
    }

    // Search for the most recent vehicle authorization with this plate in this condominio
    const vehicle = db.prepare(
      `SELECT placa, modelo, cor, motorista_nome, bloco, apartamento, morador_id, morador_name, morador_phone, status, data_inicio, data_fim
       FROM vehicle_authorizations
       WHERE condominio_id = ? AND placa = ?
       ORDER BY created_at DESC
       LIMIT 1`
    ).get(user.condominio_id, placa) as any;

    if (!vehicle) {
      res.json({ found: false });
      return;
    }

    res.json({
      found: true,
      placa: vehicle.placa,
      modelo: vehicle.modelo,
      cor: vehicle.cor,
      motorista_nome: vehicle.motorista_nome,
      bloco: vehicle.bloco,
      apartamento: vehicle.apartamento,
      morador_id: vehicle.morador_id,
      morador_name: vehicle.morador_name,
      morador_phone: vehicle.morador_phone,
      status: vehicle.status,
      data_inicio: vehicle.data_inicio,
      data_fim: vehicle.data_fim,
    });
  } catch (err: any) {
    log.error("Erro em vehicleAuthorizations :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

export default router;
