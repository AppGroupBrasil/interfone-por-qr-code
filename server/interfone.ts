import { Router, Request, Response } from "express";
import db from "./db.js";
import { authenticate, authorize } from "./middleware.js";
import crypto from "crypto";
import { emailChamadaPerdida } from "./emailService.js";

const router = Router();

// ═══════════════════════════════════════════════════════════
// TOKENS — QR Code per block (managed by síndico)
// ═══════════════════════════════════════════════════════════

// GET all tokens for condominium
router.get("/tokens", authenticate, (req: Request, res: Response) => {
  try {
    if (!req.user!.condominio_id) { res.json([]); return; }
    const tokens = db.prepare(
      "SELECT * FROM interfone_tokens WHERE condominio_id = ? ORDER BY bloco_nome, id"
    ).all(req.user!.condominio_id);
    res.json(tokens);
  } catch (err: any) {
    console.error("Erro em interfone :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// CREATE token for a block
router.post("/tokens", authenticate, authorize("master", "administradora", "sindico"), (req: Request, res: Response) => {
  try {
    const { bloco_id, bloco_nome } = req.body;
    if (!bloco_id || !bloco_nome) {
      res.status(400).json({ error: "Bloco é obrigatório." });
      return;
    }

    // Check if token already exists for this block
    const existing = db.prepare(
      "SELECT * FROM interfone_tokens WHERE bloco_id = ? AND condominio_id = ?"
    ).get(bloco_id, req.user!.condominio_id) as any;

    if (existing) {
      res.status(409).json({ error: "Já existe um QR Code para este bloco.", token: existing });
      return;
    }

    const token = `INT-${req.user!.condominio_id}-${bloco_id}-${crypto.randomBytes(6).toString("hex")}`;

    const result = db.prepare(
      `INSERT INTO interfone_tokens (condominio_id, bloco_id, bloco_nome, token, created_by)
       VALUES (?, ?, ?, ?, ?)`
    ).run(req.user!.condominio_id, bloco_id, bloco_nome, token, req.user!.id);

    const row = db.prepare("SELECT * FROM interfone_tokens WHERE id = ?").get(result.lastInsertRowid);
    res.status(201).json(row);
  } catch (err: any) {
    console.error("Erro em interfone :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// REGENERATE token (invalidate old QR Code)
router.put("/tokens/:id/regenerate", authenticate, authorize("master", "administradora", "sindico"), (req: Request, res: Response) => {
  try {
    const existing = db.prepare(
      "SELECT * FROM interfone_tokens WHERE id = ? AND condominio_id = ?"
    ).get(parseInt(req.params.id as string), req.user!.condominio_id) as any;

    if (!existing) {
      res.status(404).json({ error: "Token não encontrado." });
      return;
    }

    const newToken = `INT-${req.user!.condominio_id}-${existing.bloco_id}-${crypto.randomBytes(6).toString("hex")}`;

    db.prepare(
      "UPDATE interfone_tokens SET token = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(newToken, existing.id);

    const row = db.prepare("SELECT * FROM interfone_tokens WHERE id = ?").get(existing.id);
    res.json(row);
  } catch (err: any) {
    console.error("Erro em interfone :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// DELETE token
router.delete("/tokens/:id", authenticate, authorize("master", "administradora", "sindico"), (req: Request, res: Response) => {
  try {
    db.prepare(
      "DELETE FROM interfone_tokens WHERE id = ? AND condominio_id = ?"
    ).run(parseInt(req.params.id as string), req.user!.condominio_id);
    res.json({ success: true });
  } catch (err: any) {
    console.error("Erro em interfone :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ═══════════════════════════════════════════════════════════
// CONDOMINIUM-WIDE TOKEN — Single QR at main entrance
// For large condos (54 blocks × 32 units) — visitor picks block first
// ═══════════════════════════════════════════════════════════

// CREATE condominium-wide token
router.post("/tokens/condominio", authenticate, authorize("master", "administradora", "sindico"), (req: Request, res: Response) => {
  try {
    const condominioId = req.user!.condominio_id;
    if (!condominioId) {
      res.status(400).json({ error: "Usuário não vinculado a nenhum condomínio." });
      return;
    }

    // Check if one already exists
    const existing = db.prepare(
      "SELECT * FROM interfone_tokens WHERE condominio_id = ? AND tipo = 'condominio'"
    ).get(condominioId) as any;

    if (existing) {
      res.status(409).json({ error: "Já existe um QR Code geral do condomínio.", token: existing });
      return;
    }

    const token = `INT-CONDO-${condominioId}-${crypto.randomBytes(6).toString("hex")}`;

    const result = db.prepare(
      `INSERT INTO interfone_tokens (condominio_id, bloco_id, bloco_nome, token, created_by, tipo)
       VALUES (?, NULL, 'GERAL', ?, ?, 'condominio')`
    ).run(condominioId, token, req.user!.id);

    const row = db.prepare("SELECT * FROM interfone_tokens WHERE id = ?").get(result.lastInsertRowid);
    res.status(201).json(row);
  } catch (err: any) {
    console.error("Erro ao criar token de condomínio:", err);
    res.status(500).json({ error: "Erro ao criar QR Code" });
  }
});

// REGENERATE condominium-wide token
router.put("/tokens/condominio/regenerate", authenticate, authorize("master", "administradora", "sindico"), (req: Request, res: Response) => {
  try {
    const existing = db.prepare(
      "SELECT * FROM interfone_tokens WHERE condominio_id = ? AND tipo = 'condominio'"
    ).get(req.user!.condominio_id) as any;

    if (!existing) {
      res.status(404).json({ error: "Token de condomínio não encontrado." });
      return;
    }

    const newToken = `INT-CONDO-${req.user!.condominio_id}-${crypto.randomBytes(6).toString("hex")}`;
    db.prepare(
      "UPDATE interfone_tokens SET token = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(newToken, existing.id);

    const row = db.prepare("SELECT * FROM interfone_tokens WHERE id = ?").get(existing.id);
    res.json(row);
  } catch (err: any) {
    console.error("Erro em interfone :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ═══════════════════════════════════════════════════════════
// PUBLIC — Visitor resolves token → gets apartments
// ═══════════════════════════════════════════════════════════

// GET block info from token (PUBLIC - no auth)
router.get("/public/:token", (req: Request, res: Response) => {
  try {
    const tokenRow = db.prepare(
      "SELECT * FROM interfone_tokens WHERE token = ? AND ativo = 1"
    ).get(req.params.token) as any;

    if (!tokenRow) {
      res.status(404).json({ error: "QR Code inválido ou desativado." });
      return;
    }

    // Get condominium info
    const condo = db.prepare("SELECT id, name FROM condominios WHERE id = ?").get(tokenRow.condominio_id) as any;

    // ═══ CONDOMINIUM-WIDE TOKEN — Return ALL blocks ═══
    if (tokenRow.tipo === "condominio") {
      // Get all blocks for this condominium
      const allBlocks = db.prepare(
        "SELECT id, name FROM blocks WHERE condominio_id = ? ORDER BY CAST(name AS INTEGER), name"
      ).all(tokenRow.condominio_id) as any[];

      // Get ALL moradores grouped by block → apartment (include whatsapp_interfone)
      const allMoradores = db.prepare(
        `SELECT u.id, u.name, u.unit, u.block, u.phone, ic.whatsapp_interfone FROM users u
         LEFT JOIN interfone_config ic ON ic.user_id = u.id
         WHERE u.condominio_id = ? AND u.role = 'morador'
         ORDER BY u.block, CAST(u.unit AS INTEGER), u.unit`
      ).all(tokenRow.condominio_id) as any[];

      // Build blocks structure
      const blocos: { id: number; nome: string; apartamentos: { unit: string; moradores: { id: number; name: string }[] }[] }[] = [];

      for (const block of allBlocks) {
        const blockMoradores = allMoradores.filter((m: any) => m.block === block.name);
        const apartments = new Map<string, { unit: string; moradores: { id: number; name: string }[] }>();

        for (const m of blockMoradores) {
          const unit = m.unit || "?";
          if (!apartments.has(unit)) {
            apartments.set(unit, { unit, moradores: [] });
          }
          const moradorEntry: any = { id: m.id, name: m.name };
          if (m.whatsapp_interfone && m.phone) {
            moradorEntry.whatsapp = m.phone;
          }
          apartments.get(unit)!.moradores.push(moradorEntry);
        }

        blocos.push({
          id: block.id,
          nome: block.name,
          apartamentos: Array.from(apartments.values()),
        });
      }

      res.json({
        tipo: "condominio",
        condominio: condo?.name || "Condomínio",
        condominio_id: tokenRow.condominio_id,
        blocos,
      });
      return;
    }

    // ═══ BLOCK-SPECIFIC TOKEN — Return apartments in this block ═══
    const moradores = db.prepare(
      `SELECT u.id, u.name, u.unit, u.block, u.phone, ic.whatsapp_interfone FROM users u
       LEFT JOIN interfone_config ic ON ic.user_id = u.id
       WHERE u.condominio_id = ? AND u.block = ? AND u.role = 'morador'
       ORDER BY CAST(u.unit AS INTEGER), u.unit`
    ).all(tokenRow.condominio_id, tokenRow.bloco_nome) as any[];

    // Group by apartment
    const apartments = new Map<string, { unit: string; moradores: { id: number; name: string }[] }>();
    for (const m of moradores) {
      const unit = m.unit || "?";
      if (!apartments.has(unit)) {
        apartments.set(unit, { unit, moradores: [] });
      }
      const moradorEntry: any = { id: m.id, name: m.name };
      if (m.whatsapp_interfone && m.phone) {
        moradorEntry.whatsapp = m.phone;
      }
      apartments.get(unit)!.moradores.push(moradorEntry);
    }

    res.json({
      tipo: "bloco",
      condominio: condo?.name || "Condomínio",
      condominio_id: tokenRow.condominio_id,
      bloco: tokenRow.bloco_nome,
      apartamentos: Array.from(apartments.values()),
    });
  } catch (err: any) {
    console.error("Erro em interfone :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// GET funcionários for portaria direct call (PUBLIC)
router.get("/public/portaria/:condominioId", (req: Request, res: Response) => {
  try {
    const funcionarios = db.prepare(
      `SELECT id, name FROM users
       WHERE condominio_id = ? AND role = 'funcionario'
       ORDER BY name`
    ).all(parseInt(req.params.condominioId as string)) as any[];

    res.json(funcionarios);
  } catch (err: any) {
    console.error("Erro em interfone :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// GET morador security config (PUBLIC - for visitor call flow)
router.get("/public/security/:moradorId", (req: Request, res: Response) => {
  try {
    const config = db.prepare(
      "SELECT nivel_seguranca, nome_validacao, horario_silencioso_inicio, horario_silencioso_fim FROM interfone_config WHERE user_id = ?"
    ).get(parseInt(req.params.moradorId as string)) as any;

    // Check silent hours
    if (config?.horario_silencioso_inicio && config?.horario_silencioso_fim) {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const start = config.horario_silencioso_inicio;
      const end = config.horario_silencioso_fim;
      // Suporte a período que cruza meia-noite (ex: 22:00 → 06:00)
      const isSilent = start <= end
        ? (hhmm >= start && hhmm <= end)
        : (hhmm >= start || hhmm <= end);
      if (isSilent) {
        res.json({ nivel_seguranca: config.nivel_seguranca, silencioso: true });
        return;
      }
    }

    res.json({
      nivel_seguranca: config?.nivel_seguranca || 1,
      silencioso: false,
    });
  } catch (err: any) {
    console.error("Erro ao buscar config de segurança:", err);
    res.status(500).json({ error: "Erro ao buscar configuração" });
  }
});

// ═══════════════════════════════════════════════════════════
// MORADOR — Security configuration
// ═══════════════════════════════════════════════════════════

// GET my config
router.get("/config", authenticate, (req: Request, res: Response) => {
  try {
    const config = db.prepare(
      "SELECT * FROM interfone_config WHERE user_id = ?"
    ).get(req.user!.id) as any;
    res.json(config || {
      nivel_seguranca: 1,
      nome_validacao: req.user!.name,
      horario_silencioso_inicio: null,
      horario_silencioso_fim: null,
      bloqueados: "[]",
      whatsapp_interfone: null,
    });
  } catch (err: any) {
    console.error("Erro em interfone :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// SAVE config
router.put("/config", authenticate, (req: Request, res: Response) => {
  try {
    const { nivel_seguranca, nome_validacao, horario_silencioso_inicio, horario_silencioso_fim, bloqueados, whatsapp_interfone } = req.body;

    const existing = db.prepare("SELECT id FROM interfone_config WHERE user_id = ?").get(req.user!.id) as any;

    if (existing) {
      db.prepare(
        `UPDATE interfone_config SET
          nivel_seguranca = ?, nome_validacao = ?,
          horario_silencioso_inicio = ?, horario_silencioso_fim = ?,
          bloqueados = ?, whatsapp_interfone = ?, updated_at = datetime('now')
        WHERE user_id = ?`
      ).run(
        nivel_seguranca || 1,
        nome_validacao || req.user!.name,
        horario_silencioso_inicio || null,
        horario_silencioso_fim || null,
        bloqueados || "[]",
        whatsapp_interfone !== undefined ? whatsapp_interfone : null,
        req.user!.id
      );
    } else {
      db.prepare(
        `INSERT INTO interfone_config (user_id, condominio_id, nivel_seguranca, nome_validacao, horario_silencioso_inicio, horario_silencioso_fim, bloqueados, whatsapp_interfone)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        req.user!.id,
        req.user!.condominio_id,
        nivel_seguranca || 1,
        nome_validacao || req.user!.name,
        horario_silencioso_inicio || null,
        horario_silencioso_fim || null,
        bloqueados || "[]",
        whatsapp_interfone !== undefined ? whatsapp_interfone : null
      );
    }

    const config = db.prepare("SELECT * FROM interfone_config WHERE user_id = ?").get(req.user!.id);
    res.json(config);
  } catch (err: any) {
    console.error("Erro em interfone :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ═══════════════════════════════════════════════════════════
// CALL LOG — Register calls
// ═══════════════════════════════════════════════════════════

// POST a new call
router.post("/calls", (req: Request, res: Response) => {
  try {
    const { condominio_id, bloco, apartamento, morador_id, morador_nome, visitante_nome, visitante_empresa, visitante_foto, nivel_seguranca, call_id } = req.body;

    // Validação de campos obrigatórios
    if (!bloco || !apartamento) {
      return res.status(400).json({ error: "Bloco e apartamento são obrigatórios" });
    }
    if (!morador_id && !morador_nome) {
      return res.status(400).json({ error: "Morador destino é obrigatório" });
    }

    const result = db.prepare(
      `INSERT INTO interfone_calls (condominio_id, bloco, apartamento, morador_id, morador_nome, visitante_nome, visitante_empresa, visitante_foto, nivel_seguranca, call_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'chamando')`
    ).run(condominio_id, bloco, apartamento, morador_id, morador_nome, visitante_nome || null, visitante_empresa || null, visitante_foto || null, nivel_seguranca || 1, call_id || null);

    res.status(201).json({ id: result.lastInsertRowid });
  } catch (err: any) {
    console.error("Erro ao registrar chamada:", err);
    res.status(500).json({ error: "Erro ao registrar chamada" });
  }
});

// UPDATE call status
router.put("/calls/:id", (req: Request, res: Response) => {
  try {
    const { status, resultado, duracao_segundos } = req.body;

    // Validação: apenas status permitidos
    const statusPermitidos = ["atendida", "encerrada", "recusada", "timeout"];
    if (!status || !statusPermitidos.includes(status)) {
      return res.status(400).json({ error: "Status inválido" });
    }

    let sql = "UPDATE interfone_calls SET status = ?";
    const params: any[] = [status];

    if (status === "atendida") {
      sql += ", atendido_at = datetime('now')";
    }
    if (status === "encerrada" || status === "recusada" || status === "timeout") {
      sql += ", encerrado_at = datetime('now')";
      if (resultado) { sql += ", resultado = ?"; params.push(resultado); }
      if (duracao_segundos != null) { sql += ", duracao_segundos = ?"; params.push(duracao_segundos); }
    }

    sql += " WHERE id = ?";
    // Support both integer DB id and string call_id (WS signaling id)
    const idParam = String(req.params.id);
    const numId = parseInt(idParam);
    if (!isNaN(numId) && String(numId) === idParam) {
      params.push(numId);
    } else {
      // It's a WS call_id string — match by call_id column
      sql = sql.replace("WHERE id = ?", "WHERE call_id = ?");
      params.push(idParam);
    }

    db.prepare(sql).run(...params);

    // 📧 Email: send missed call notification on timeout
    if (status === "timeout") {
      const call = (!isNaN(numId) && String(numId) === idParam)
        ? db.prepare("SELECT * FROM interfone_calls WHERE id = ?").get(numId) as any
        : db.prepare("SELECT * FROM interfone_calls WHERE call_id = ?").get(idParam) as any;
      if (call?.morador_id) {
        emailChamadaPerdida({
          condominioId: call.condominio_id,
          moradorId: call.morador_id,
          moradorName: call.morador_nome || "Morador",
          visitorName: call.visitante_nome || "Visitante",
          bloco: call.bloco,
          apartamento: call.apartamento,
          horario: new Date(call.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
        }).catch((err) => console.error("[EMAIL] Erro chamada perdida:", err));
      }
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("Erro ao atualizar chamada:", err);
    res.status(500).json({ error: "Erro ao atualizar chamada" });
  }
});

// GET call history (morador/admin)
router.get("/calls", authenticate, (req: Request, res: Response) => {
  try {
    const { role, condominio_id, id } = req.user!;
    let rows;
    if (role === "morador") {
      rows = db.prepare(
        "SELECT * FROM interfone_calls WHERE morador_id = ? ORDER BY created_at DESC LIMIT 100"
      ).all(id);
    } else {
      rows = db.prepare(
        "SELECT * FROM interfone_calls WHERE condominio_id = ? ORDER BY created_at DESC LIMIT 200"
      ).all(condominio_id);
    }
    res.json(rows);
  } catch (err: any) {
    console.error("Erro em interfone :", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ═══════════════════════════════════════════════════════════
// MORADORES — List moradores for internal call (porteiro → morador)
// ═══════════════════════════════════════════════════════════
router.get("/moradores-call", authenticate, (req: Request, res: Response) => {
  try {
    if (!req.user!.condominio_id) { res.json([]); return; }
    const moradores = db.prepare(
      `SELECT id, name, block, unit FROM users
       WHERE condominio_id = ? AND role = 'morador' AND aprovado = 1
       ORDER BY block, unit`
    ).all(req.user!.condominio_id);
    res.json(moradores);
  } catch (err: any) {
    console.error("Erro em interfone moradores-call:", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// ═══════════════════════════════════════════════════════════
// INTERFONE WHATSAPP — Public endpoints for wa.me deep-link flow
// ═══════════════════════════════════════════════════════════

// Helper: normalize phone to 55XXXXXXXXXXX format for wa.me
function normalizePhoneForWaMe(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (!digits.startsWith("55")) digits = "55" + digits;
  return digits;
}

// GET /api/interfone/whatsapp/public/:token — Resolve QR token for WhatsApp mode
router.get("/whatsapp/public/:token", (req: Request, res: Response) => {
  try {
    const tokenRow = db.prepare(
      "SELECT * FROM interfone_tokens WHERE token = ? AND ativo = 1"
    ).get(req.params.token) as any;

    if (!tokenRow) {
      res.status(404).json({ error: "QR Code inválido ou desativado." });
      return;
    }

    const condo = db.prepare("SELECT id, name FROM condominios WHERE id = ?").get(tokenRow.condominio_id) as any;

    // Get WhatsApp interfone config
    const configRows = db.prepare(
      "SELECT key, value FROM condominio_config WHERE condominio_id = ? AND key LIKE 'interfone_whatsapp_%'"
    ).all(tokenRow.condominio_id) as { key: string; value: string }[];
    const cfg: Record<string, string> = {};
    for (const r of configRows) cfg[r.key] = r.value;

    if (cfg.interfone_whatsapp_enabled !== "true") {
      res.status(403).json({ error: "Interfone WhatsApp não está habilitado neste condomínio." });
      return;
    }

    const securityLevel = cfg.interfone_whatsapp_security_level || "baixo";
    const hasPortaria = cfg.interfone_whatsapp_has_portaria === "true";
    const portariaPhone = cfg.interfone_whatsapp_portaria_phone || null;

    // Build blocks/apartments list (only moradores with phone)
    if (tokenRow.tipo === "condominio") {
      const allBlocks = db.prepare(
        "SELECT id, name FROM blocks WHERE condominio_id = ? ORDER BY CAST(name AS INTEGER), name"
      ).all(tokenRow.condominio_id) as any[];

      const allMoradores = db.prepare(
        `SELECT u.id, u.name, u.unit, u.block, u.phone FROM users u
         WHERE u.condominio_id = ? AND u.role = 'morador' AND u.aprovado = 1 AND u.phone IS NOT NULL AND u.phone != ''
         ORDER BY u.block, CAST(u.unit AS INTEGER), u.unit`
      ).all(tokenRow.condominio_id) as any[];

      const blocos: any[] = [];
      for (const block of allBlocks) {
        const blockMoradores = allMoradores.filter((m: any) => m.block === block.name);
        const apartments = new Map<string, { unit: string; moradores: { id: number; name: string }[] }>();
        for (const m of blockMoradores) {
          const unit = m.unit || "?";
          if (!apartments.has(unit)) apartments.set(unit, { unit, moradores: [] });
          apartments.get(unit)!.moradores.push({ id: m.id, name: m.name });
        }
        if (apartments.size > 0) {
          blocos.push({ id: block.id, nome: block.name, apartamentos: Array.from(apartments.values()) });
        }
      }

      res.json({
        tipo: "condominio",
        condominio: condo?.name || "Condomínio",
        condominio_id: tokenRow.condominio_id,
        security_level: securityLevel,
        has_portaria: hasPortaria,
        portaria_phone: hasPortaria && portariaPhone ? normalizePhoneForWaMe(portariaPhone) : null,
        blocos,
      });
    } else {
      // Block-specific token
      const moradores = db.prepare(
        `SELECT u.id, u.name, u.unit, u.block, u.phone FROM users u
         WHERE u.condominio_id = ? AND u.block = ? AND u.role = 'morador' AND u.aprovado = 1 AND u.phone IS NOT NULL AND u.phone != ''
         ORDER BY CAST(u.unit AS INTEGER), u.unit`
      ).all(tokenRow.condominio_id, tokenRow.bloco_nome) as any[];

      const apartments = new Map<string, { unit: string; moradores: { id: number; name: string }[] }>();
      for (const m of moradores) {
        const unit = m.unit || "?";
        if (!apartments.has(unit)) apartments.set(unit, { unit, moradores: [] });
        apartments.get(unit)!.moradores.push({ id: m.id, name: m.name });
      }

      res.json({
        tipo: "bloco",
        condominio: condo?.name || "Condomínio",
        condominio_id: tokenRow.condominio_id,
        bloco: tokenRow.bloco_nome,
        security_level: securityLevel,
        has_portaria: hasPortaria,
        portaria_phone: hasPortaria && portariaPhone ? normalizePhoneForWaMe(portariaPhone) : null,
        apartamentos: Array.from(apartments.values()),
      });
    }
  } catch (err: any) {
    console.error("Erro em interfone whatsapp public:", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// POST /api/interfone/whatsapp/lookup — Lookup morador phone for wa.me link
router.post("/whatsapp/lookup", (req: Request, res: Response) => {
  try {
    const { condominio_id, bloco, apartamento, nome_morador } = req.body;
    if (!condominio_id || !apartamento) {
      res.status(400).json({ error: "Condomínio e apartamento são obrigatórios." });
      return;
    }

    // Get config
    const configRows = db.prepare(
      "SELECT key, value FROM condominio_config WHERE condominio_id = ? AND key LIKE 'interfone_whatsapp_%'"
    ).all(condominio_id) as { key: string; value: string }[];
    const cfg: Record<string, string> = {};
    for (const r of configRows) cfg[r.key] = r.value;

    if (cfg.interfone_whatsapp_enabled !== "true") {
      res.status(403).json({ error: "Interfone WhatsApp não habilitado." });
      return;
    }

    const securityLevel = cfg.interfone_whatsapp_security_level || "baixo";
    const hasPortaria = cfg.interfone_whatsapp_has_portaria === "true";
    const portariaPhone = cfg.interfone_whatsapp_portaria_phone || null;

    // Find moradores in that apartment
    let query = `SELECT u.id, u.name, u.phone FROM users u
       WHERE u.condominio_id = ? AND u.unit = ? AND u.role = 'morador' AND u.aprovado = 1 AND u.phone IS NOT NULL AND u.phone != ''`;
    const params: any[] = [condominio_id, apartamento];
    if (bloco) {
      query += " AND u.block = ?";
      params.push(bloco);
    }

    const moradores = db.prepare(query).all(...params) as any[];

    if (moradores.length === 0) {
      res.json({
        found: false,
        message: "Nenhum morador com WhatsApp cadastrado neste apartamento.",
        portaria_phone: hasPortaria && portariaPhone ? normalizePhoneForWaMe(portariaPhone) : null,
      });
      return;
    }

    // Security level: baixo → return phone directly
    if (securityLevel === "baixo") {
      // Return first morador's phone (or all if multiple)
      const results = moradores.map((m: any) => ({
        name: m.name.split(" ")[0], // First name only for privacy
        phone: normalizePhoneForWaMe(m.phone),
      }));
      res.json({ found: true, moradores: results });
      return;
    }

    // Security level: moderado → require name match
    if (!nome_morador || nome_morador.trim().length < 2) {
      res.status(400).json({ error: "Informe o nome do morador para este nível de segurança." });
      return;
    }

    const searchName = nome_morador.trim().toLowerCase();
    const matched = moradores.filter((m: any) => {
      const parts = m.name.toLowerCase().split(/\s+/);
      return parts.some((part: string) => part === searchName || m.name.toLowerCase().includes(searchName));
    });

    if (matched.length > 0) {
      const results = matched.map((m: any) => ({
        name: m.name.split(" ")[0],
        phone: normalizePhoneForWaMe(m.phone),
      }));
      res.json({ found: true, moradores: results });
    } else {
      // Name not matched
      const msg = hasPortaria && portariaPhone
        ? "Morador não localizado pelo nome informado. Tente outro nome ou entre em contato com a portaria."
        : "Morador não localizado pelo nome informado. Tente outro nome ou entre em contato diretamente com o morador.";
      res.json({
        found: false,
        message: msg,
        portaria_phone: hasPortaria && portariaPhone ? normalizePhoneForWaMe(portariaPhone) : null,
      });
    }
  } catch (err: any) {
    console.error("Erro em interfone whatsapp lookup:", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

export default router;

