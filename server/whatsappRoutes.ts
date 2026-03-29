/**
 * ═══════════════════════════════════════════════════════════
 * WHATSAPP ROUTES — Gupshup Config & Management
 * Endpoints for síndico to configure WhatsApp integration.
 * ═══════════════════════════════════════════════════════════
 */

import { Router, Request, Response } from "express";
import db from "./db.js";
import { authenticate, authorize, getAccessibleCondominioIds } from "./middleware.js";
import { testWhatsAppConnection, getGlobalCredentials } from "./whatsappService.js";

const router = Router();

// ═══════════════════════════════════════════════════════════
// GLOBAL CONFIG (master only) — credentials shared by all condominiums
// ═══════════════════════════════════════════════════════════

// ─── GET global WhatsApp credentials ──────────────────────
router.get(
  "/global-config",
  authenticate,
  authorize("master"),
  (_req: Request, res: Response) => {
    try {
      const keys = [
        "whatsapp_gupshup_apikey",
        "whatsapp_gupshup_source",
        "whatsapp_gupshup_appname",
      ];
      const placeholders = keys.map(() => "?").join(",");
      const rows = db.prepare(
        `SELECT key, value FROM condominio_config WHERE condominio_id = 0 AND key IN (${placeholders})`
      ).all(...keys) as { key: string; value: string }[];

      const config: Record<string, string> = {};
      for (const r of rows) {
        if (r.key === "whatsapp_gupshup_apikey" && r.value) {
          config[r.key] = r.value.length > 4 ? "••••" + r.value.slice(-4) : r.value;
        } else {
          config[r.key] = r.value;
        }
      }
      // Also include a flag showing if credentials are configured
      const creds = getGlobalCredentials();
      config._configured = creds ? "true" : "false";

      res.json(config);
    } catch (err: any) {
      console.error("Erro ao buscar global config WhatsApp:", err);
      res.status(500).json({ error: "Erro interno" });
    }
  }
);

// ─── PUT save global WhatsApp credentials ─────────────────
router.put(
  "/global-config",
  authenticate,
  authorize("master"),
  (req: Request, res: Response) => {
    try {
      const allowedKeys = new Set([
        "whatsapp_gupshup_apikey",
        "whatsapp_gupshup_source",
        "whatsapp_gupshup_appname",
      ]);

      const updates: Record<string, string> = req.body;

      const upsert = db.prepare(`
        INSERT INTO condominio_config (condominio_id, key, value, updated_at)
        VALUES (0, ?, ?, datetime('now'))
        ON CONFLICT(condominio_id, key)
        DO UPDATE SET value = excluded.value, updated_at = datetime('now')
      `);

      const tx = db.transaction(() => {
        for (const [key, value] of Object.entries(updates)) {
          if (!allowedKeys.has(key)) continue;
          upsert.run(key, String(value));
        }
      });
      tx();

      res.json({ success: true });
    } catch (err: any) {
      console.error("Erro ao salvar global config WhatsApp:", err);
      res.status(500).json({ error: "Erro ao salvar" });
    }
  }
);

// ═══════════════════════════════════════════════════════════
// PER-CONDOMINIUM CONFIG (síndico / admin)
// ═══════════════════════════════════════════════════════════

// ─── GET current WhatsApp config for condominium ──────────
router.get(
  "/config",
  authenticate,
  authorize("master", "administradora", "sindico"),
  (req: Request, res: Response) => {
    try {
      const condominioId = req.user!.condominio_id;
      if (!condominioId) return res.status(400).json({ error: "Sem condomínio associado" });

      // Get the per-condominium toggle + notification preferences
      const configKeys = [
        'whatsapp_enabled',
        'whatsapp_notify_visitor_arrival',
        'whatsapp_notify_delivery',
        'whatsapp_notify_security_alert',
        'whatsapp_notify_gate_opened',
        'whatsapp_notify_pre_authorization',
        'whatsapp_notify_vehicle_access',
        'whatsapp_notify_ronda',
        'whatsapp_notify_livro_protocolo',
      ];
      const placeholders = configKeys.map(() => '?').join(',');
      const rows = db.prepare(
        `SELECT key, value FROM condominio_config WHERE condominio_id = ? AND key IN (${placeholders})`
      ).all(condominioId, ...configKeys) as { key: string; value: string }[];

      const cfgMap: Record<string, string> = {};
      for (const r of rows) cfgMap[r.key] = r.value;

      // Check if global credentials are configured
      const creds = getGlobalCredentials();

      // Ensure whatsapp_enabled has default
      if (!cfgMap.whatsapp_enabled) cfgMap.whatsapp_enabled = "false";
      cfgMap._global_configured = creds ? "true" : "false";

      res.json(cfgMap);
    } catch (err: any) {
      console.error("Erro ao buscar config WhatsApp:", err);
      res.status(500).json({ error: "Erro interno" });
    }
  }
);

// ─── PUT update WhatsApp enabled toggle for condominium ───
router.put(
  "/config",
  authenticate,
  authorize("master", "administradora", "sindico"),
  (req: Request, res: Response) => {
    try {
      const condominioId = req.user!.condominio_id;
      if (!condominioId) return res.status(400).json({ error: "Sem condomínio associado" });

      const allowedKeys = new Set([
        "whatsapp_enabled",
        "whatsapp_notify_visitor_arrival",
        "whatsapp_notify_delivery",
        "whatsapp_notify_security_alert",
        "whatsapp_notify_gate_opened",
        "whatsapp_notify_pre_authorization",
        "whatsapp_notify_vehicle_access",
        "whatsapp_notify_ronda",
        "whatsapp_notify_livro_protocolo",
      ]);

      const updates: Record<string, string> = req.body;

      const upsert = db.prepare(`
        INSERT INTO condominio_config (condominio_id, key, value, updated_at)
        VALUES (?, ?, ?, datetime('now'))
        ON CONFLICT(condominio_id, key)
        DO UPDATE SET value = excluded.value, updated_at = datetime('now')
      `);

      const tx = db.transaction(() => {
        for (const [key, value] of Object.entries(updates)) {
          if (!allowedKeys.has(key)) continue;
          upsert.run(condominioId, key, String(value));
        }
      });
      tx();

      res.json({ success: true });
    } catch (err: any) {
      console.error("Erro ao salvar config WhatsApp:", err);
      res.status(500).json({ error: "Erro ao salvar configuração" });
    }
  }
);

// ─── POST test WhatsApp connection ────────────────────────
router.post(
  "/test",
  authenticate,
  authorize("master", "administradora", "sindico"),
  async (req: Request, res: Response) => {
    try {
      // Master can test with condominioId=0 (global credentials only)
      const condominioId = req.user!.role === "master"
        ? 0
        : req.user!.condominio_id;
      if (condominioId === undefined || condominioId === null) return res.status(400).json({ error: "Sem condomínio associado" });

      const { phone } = req.body;
      if (!phone) return res.status(400).json({ error: "Informe o número de telefone para teste" });

      const result = await testWhatsAppConnection(condominioId, phone);

      if (result.success) {
        res.json({ success: true, messageId: result.messageId });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (err: any) {
      console.error("Erro ao testar WhatsApp:", err);
      res.status(500).json({ error: "Erro interno" });
    }
  }
);

// ─── GET WhatsApp message logs ────────────────────────────
router.get(
  "/logs",
  authenticate,
  authorize("master", "administradora", "sindico"),
  (req: Request, res: Response) => {
    try {
      const condominioId = req.user!.condominio_id;
      if (!condominioId) return res.status(400).json({ error: "Sem condomínio associado" });

      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const offset = Number(req.query.offset) || 0;

      const logs = db.prepare(`
        SELECT id, phone, template_name, status, message_id, error, created_at
        FROM whatsapp_log
        WHERE condominio_id = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `).all(condominioId, limit, offset);

      const total = (db.prepare(
        "SELECT COUNT(*) as count FROM whatsapp_log WHERE condominio_id = ?"
      ).get(condominioId) as { count: number }).count;

      res.json({ logs, total });
    } catch (err: any) {
      console.error("Erro ao buscar logs WhatsApp:", err);
      res.status(500).json({ error: "Erro interno" });
    }
  }
);

// ─── GET WhatsApp usage stats for current condominio ──────
router.get(
  "/stats",
  authenticate,
  authorize("master", "administradora", "sindico"),
  (req: Request, res: Response) => {
    try {
      const condominioId = req.query.condominio_id
        ? Number(req.query.condominio_id)
        : req.user!.condominio_id;
      if (!condominioId) return res.status(400).json({ error: "Sem condomínio" });

      const costPerMsg = Number(
        (db.prepare(
          "SELECT value FROM condominio_config WHERE condominio_id = ? AND key = 'whatsapp_cost_per_msg'"
        ).get(condominioId) as { value: string } | undefined)?.value || "0.09"
      );

      const monthlyLimit = Number(
        (db.prepare(
          "SELECT value FROM condominio_config WHERE condominio_id = ? AND key = 'whatsapp_monthly_limit'"
        ).get(condominioId) as { value: string } | undefined)?.value || "0"
      );

      const countQuery = (period: string) => {
        const sent = (db.prepare(
          `SELECT COUNT(*) as c FROM whatsapp_log WHERE condominio_id = ? AND status = 'sent' AND created_at >= datetime('now', '${period}')`
        ).get(condominioId) as { c: number }).c;
        const failed = (db.prepare(
          `SELECT COUNT(*) as c FROM whatsapp_log WHERE condominio_id = ? AND status = 'failed' AND created_at >= datetime('now', '${period}')`
        ).get(condominioId) as { c: number }).c;
        return { sent, failed, total: sent + failed };
      };

      const today = countQuery("-1 day");
      const week = countQuery("-7 days");
      const month = countQuery("-30 days");

      res.json({
        today,
        week,
        month,
        costPerMsg,
        monthlyLimit,
        estimatedCostMonth: +(month.sent * costPerMsg).toFixed(2),
        estimatedCostWeek: +(week.sent * costPerMsg).toFixed(2),
        estimatedCostToday: +(today.sent * costPerMsg).toFixed(2),
      });
    } catch (err: any) {
      console.error("Erro stats WhatsApp:", err);
      res.status(500).json({ error: "Erro interno" });
    }
  }
);

// ─── GET WhatsApp stats for ALL condominios (master/admin) ─
router.get(
  "/stats/all",
  authenticate,
  authorize("master", "administradora"),
  (_req: Request, res: Response) => {
    try {
      const user = _req.user!;
      let condominioFilter = "";
      let filterParams: number[] = [];

      if (user.role !== "master") {
        const ids = getAccessibleCondominioIds(user);
        if (ids && ids.length > 0) {
          condominioFilter = `AND wl.condominio_id IN (${ids.map(() => "?").join(",")})`;
          filterParams = ids;
        } else if (ids !== null) {
          return res.json([]);
        }
      }

      const rows = db.prepare(`
        SELECT
          c.id,
          c.name,
          COALESCE(cfg_en.value, 'false') as whatsapp_enabled,
          COALESCE(cfg_lim.value, '0') as monthly_limit,
          COALESCE(cfg_cost.value, '0.09') as cost_per_msg,
          COALESCE(s_today.cnt, 0) as sent_today,
          COALESCE(s_week.cnt, 0) as sent_week,
          COALESCE(s_month.cnt, 0) as sent_month,
          COALESCE(f_month.cnt, 0) as failed_month
        FROM condominios c
        LEFT JOIN condominio_config cfg_en ON cfg_en.condominio_id = c.id AND cfg_en.key = 'whatsapp_enabled'
        LEFT JOIN condominio_config cfg_lim ON cfg_lim.condominio_id = c.id AND cfg_lim.key = 'whatsapp_monthly_limit'
        LEFT JOIN condominio_config cfg_cost ON cfg_cost.condominio_id = c.id AND cfg_cost.key = 'whatsapp_cost_per_msg'
        LEFT JOIN (
          SELECT condominio_id, COUNT(*) as cnt FROM whatsapp_log
          WHERE status = 'sent' AND created_at >= datetime('now', '-1 day')
          GROUP BY condominio_id
        ) s_today ON s_today.condominio_id = c.id
        LEFT JOIN (
          SELECT condominio_id, COUNT(*) as cnt FROM whatsapp_log
          WHERE status = 'sent' AND created_at >= datetime('now', '-7 days')
          GROUP BY condominio_id
        ) s_week ON s_week.condominio_id = c.id
        LEFT JOIN (
          SELECT condominio_id, COUNT(*) as cnt FROM whatsapp_log
          WHERE status = 'sent' AND created_at >= datetime('now', '-30 days')
          GROUP BY condominio_id
        ) s_month ON s_month.condominio_id = c.id
        LEFT JOIN (
          SELECT condominio_id, COUNT(*) as cnt FROM whatsapp_log
          WHERE status = 'failed' AND created_at >= datetime('now', '-30 days')
          GROUP BY condominio_id
        ) f_month ON f_month.condominio_id = c.id
        WHERE 1=1 ${condominioFilter}
        ORDER BY c.name
      `).all(...filterParams) as any[];

      // Totals
      let totalSentMonth = 0, totalCostMonth = 0, totalEnabled = 0;
      const condominios = rows.map(r => {
        const cost = +(r.sent_month * Number(r.cost_per_msg)).toFixed(2);
        totalSentMonth += r.sent_month;
        totalCostMonth += cost;
        if (r.whatsapp_enabled === "true") totalEnabled++;
        return {
          id: r.id,
          name: r.name,
          enabled: r.whatsapp_enabled === "true",
          monthlyLimit: Number(r.monthly_limit),
          costPerMsg: Number(r.cost_per_msg),
          sentToday: r.sent_today,
          sentWeek: r.sent_week,
          sentMonth: r.sent_month,
          failedMonth: r.failed_month,
          costMonth: cost,
        };
      });

      res.json({
        condominios,
        totals: {
          condominios: condominios.length,
          enabled: totalEnabled,
          sentMonth: totalSentMonth,
          costMonth: +totalCostMonth.toFixed(2),
        },
      });
    } catch (err: any) {
      console.error("Erro stats/all WhatsApp:", err);
      res.status(500).json({ error: "Erro interno" });
    }
  }
);

// ─── PUT toggle/config WhatsApp for a specific condominio (master/admin) ─
router.put(
  "/config/:condominioId",
  authenticate,
  authorize("master", "administradora"),
  (req: Request, res: Response) => {
    try {
      const condominioId = Number(req.params.condominioId);
      if (!condominioId) return res.status(400).json({ error: "ID inválido" });

      const allowedKeys = new Set([
        "whatsapp_enabled",
        "whatsapp_monthly_limit",
        "whatsapp_cost_per_msg",
        "whatsapp_gupshup_apikey",
        "whatsapp_gupshup_source",
        "whatsapp_gupshup_appname",
      ]);

      const updates: Record<string, string> = req.body;

      const upsert = db.prepare(`
        INSERT INTO condominio_config (condominio_id, key, value, updated_at)
        VALUES (?, ?, ?, datetime('now'))
        ON CONFLICT(condominio_id, key)
        DO UPDATE SET value = excluded.value, updated_at = datetime('now')
      `);

      const tx = db.transaction(() => {
        for (const [key, value] of Object.entries(updates)) {
          if (!allowedKeys.has(key)) continue;
          upsert.run(condominioId, key, String(value));
        }
      });
      tx();

      res.json({ success: true });
    } catch (err: any) {
      console.error("Erro ao salvar config WhatsApp condomínio:", err);
      res.status(500).json({ error: "Erro ao salvar" });
    }
  }
);

export default router;
