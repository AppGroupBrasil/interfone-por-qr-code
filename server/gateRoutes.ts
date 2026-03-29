import { notifyPortariaWhatsApp } from "./whatsappService.js";

/**
 * Gate Control Routes — Controle do Portão via Smart Switch
 * 
 * Arquitetura:
 *   - Credenciais do serviço são GLOBAIS (system_config, somente Master)
 *   - Cada condomínio tem pontos de acesso configuráveis (gate_access_points)
 *   - O síndico/funcionário NUNCA vê detalhes internos — tudo é "App Interfone"
 * 
 * Endpoints:
 *   POST /api/gate/open             - Pulsa o portão (porteiro/funcionário)
 *   POST /api/gate/toggle           - Liga/desliga manual (sindico+)
 *   GET  /api/gate/status           - Status do dispositivo
 *   GET  /api/gate/logs             - Histórico de acionamentos
 *   GET  /api/gate/config           - Config do portão (sindico vê simplificado)
 *   PUT  /api/gate/config           - Atualiza config (sindico: nome/pulse; master: tudo)
 *   GET  /api/gate/devices          - Lista dispositivos (MASTER ONLY)
 *   POST /api/gate/test             - Testar conexão (MASTER ONLY)
 *   GET  /api/gate/master-config    - Config global (MASTER ONLY)
 *   PUT  /api/gate/master-config    - Salvar config global (MASTER ONLY)
 *   POST /api/gate/assign-device    - Atribuir device a condomínio (MASTER)
 *   GET  /api/gate/all-assignments  - Ver dispositivos atribuídos (MASTER)
 * 
 * Access Points (Portaria Virtual):
 *   GET    /api/gate/access-points         - Lista pontos de acesso
 *   POST   /api/gate/access-points         - Criar ponto de acesso (sindico+)
 *   PUT    /api/gate/access-points/:id     - Atualizar ponto de acesso (sindico+)
 *   DELETE /api/gate/access-points/:id     - Excluir ponto de acesso (sindico+)
 *   POST   /api/gate/access-points/:id/open - Abrir ponto de acesso
 *   POST   /api/gate/access-points/seed    - Criar pontos padrão (sindico+)
 */
import { Router, Request, Response } from "express";
import db from "./db.js";
import { authenticate, authorize } from "./middleware.js";
import {
  pulseDevice,
  toggleDevice,
  getDeviceStatus,
  listDevices,
  clearTokenCache,
  generateOAuthUrl,
  exchangeCodeForToken,
  isOAuthAuthorized,
} from "./ewelinkService.js";
import { extractDescriptor, compareFaces, isReady as faceModelsReady } from "./faceService.js";

const router = Router();

// ─── Rate Limiter: anti-spam de acionamento (máx 1 a cada 5s por user) ───
const openCooldowns = new Map<number, number>(); // userId → lastOpenTimestamp
const OPEN_COOLDOWN_MS = 5000; // 5 segundos entre acionamentos

function checkOpenCooldown(userId: number): boolean {
  const now = Date.now();
  const last = openCooldowns.get(userId) || 0;
  if (now - last < OPEN_COOLDOWN_MS) return false;
  openCooldowns.set(userId, now);
  // Clean old entries every 100 requests
  if (openCooldowns.size > 500) {
    for (const [uid, ts] of openCooldowns) {
      if (now - ts > 60000) openCooldowns.delete(uid);
    }
  }
  return true;
}

// ─── Config keys per-condominium (sindico configurable) ───
const SINDICO_CONFIG_KEYS = new Set([
  "gate_enabled",
  "gate_device_name",
  "gate_pulse_duration",
]);

// ─── Config keys master-only (global system_config) ───────
const MASTER_GLOBAL_KEYS = [
  "gate_ewelink_appid",
  "gate_ewelink_appsecret",
  "gate_ewelink_email",
  "gate_ewelink_password",
  "gate_ewelink_region",
];

// ─── Helpers ──────────────────────────────────────────────

function getCondoGateConfig(condominioId: number) {
  const rows = db
    .prepare(
      `SELECT key, value FROM condominio_config 
       WHERE condominio_id = ? AND key LIKE 'gate_%'`
    )
    .all(condominioId) as { key: string; value: string }[];

  const config: Record<string, string> = {};
  for (const row of rows) {
    config[row.key] = row.value;
  }
  return config;
}

function getGlobalCreds() {
  const rows = db
    .prepare(
      `SELECT key, value FROM system_config WHERE key LIKE 'gate_ewelink_%'`
    )
    .all() as { key: string; value: string }[];

  const creds: Record<string, string> = {};
  for (const row of rows) {
    creds[row.key] = row.value;
  }

  return {
    appId: creds.gate_ewelink_appid || "",
    appSecret: creds.gate_ewelink_appsecret || "",
    email: creds.gate_ewelink_email || "",
    password: creds.gate_ewelink_password || "",
    region: creds.gate_ewelink_region || "us",
  };
}

function logGateAction(
  condominioId: number,
  userId: number | null,
  userName: string,
  action: string,
  details?: string
) {
  db.prepare(
    `INSERT INTO gate_logs (condominio_id, user_id, user_name, action, details, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`
  ).run(condominioId, userId, userName, action, details || null);
}

// ─── POST /open — Pulsa o portão (ação principal) ────────
router.post(
  "/open",
  authenticate,
  authorize("master", "administradora", "sindico", "funcionario"),
  async (req: Request, res: Response) => {
    try {
      const condominioId = req.user.condominio_id;
      if (!condominioId) {
        res.status(400).json({ error: "Condomínio não configurado." });
        return;
      }

      // Rate limit
      if (!checkOpenCooldown(req.user.id)) {
        res.status(429).json({ error: "Aguarde alguns segundos antes de acionar novamente." });
        return;
      }

      const config = getCondoGateConfig(condominioId);

      if (config.gate_enabled !== "true") {
        res.status(400).json({ error: "Controle do portão não está habilitado." });
        return;
      }

      const deviceId = config.gate_device_id;
      if (!deviceId) {
        res.status(400).json({ error: "Dispositivo do portão não configurado. Contate o suporte App Interfone." });
        return;
      }

      const creds = getGlobalCreds();
      if (!creds.appId || !creds.email) {
        res.status(500).json({ error: "Sistema de portão não configurado. Contate o suporte App Interfone." });
        return;
      }

      const duration = Number.parseInt(config.gate_pulse_duration || "1000");
      const visitorName = req.body.visitorName || null;

      const result = await pulseDevice(condominioId, creds, deviceId, duration);

      if (result.success) {
        logGateAction(
          condominioId,
          req.user.id,
          req.user.name,
          "open",
          visitorName ? `Visitante: ${visitorName}` : undefined
        );

        // WhatsApp: notify portaria about gate opening
        const msgGate = visitorName
          ? `🚪 Portão aberto por ${req.user.name} — Visitante: ${visitorName}`
          : `🚪 Portão aberto por ${req.user.name}`;
        notifyPortariaWhatsApp(condominioId, "whatsapp_notify_gate_opened", msgGate);

        res.json({ success: true, message: "Portão aberto!" });
      } else {
        logGateAction(condominioId, req.user.id, req.user.name, "open_failed", result.error);
        res.status(500).json({ error: "Falha ao abrir o portão. Tente novamente." });
      }
    } catch (err: any) {
      console.error("Erro ao abrir portão:", err);
      res.status(500).json({ error: "Erro interno ao abrir o portão." });
    }
  }
);

// ─── POST /toggle — Liga/desliga manual (sindico+) ──────
router.post(
  "/toggle",
  authenticate,
  authorize("master", "administradora", "sindico"),
  async (req: Request, res: Response) => {
    try {
      const condominioId = req.user.condominio_id;
      if (!condominioId) {
        res.status(400).json({ error: "Condomínio não configurado." });
        return;
      }

      const config = getCondoGateConfig(condominioId);
      const deviceId = config.gate_device_id;
      if (!deviceId) {
        res.status(400).json({ error: "Dispositivo não configurado." });
        return;
      }

      const state = req.body.state === "off" ? "off" : "on";
      const channel = req.body.channel === undefined ? undefined : Number(req.body.channel);
      const creds = getGlobalCreds();

      const result = await toggleDevice(condominioId, creds, deviceId, state, channel);

      if (result.success) {
        logGateAction(condominioId, req.user.id, req.user.name, `toggle_${state}`);
        res.json({ success: true, state });
      } else {
        res.status(500).json({ error: "Falha ao controlar dispositivo." });
      }
    } catch (err: any) {
      console.error("Erro toggle portão:", err);
      res.status(500).json({ error: "Erro interno." });
    }
  }
);

// ─── GET /status — Status do dispositivo ─────────────────
router.get(
  "/status",
  authenticate,
  authorize("master", "administradora", "sindico", "funcionario"),
  async (req: Request, res: Response) => {
    try {
      const condominioId = req.user.condominio_id;
      if (!condominioId) {
        res.status(400).json({ error: "Condomínio não configurado." });
        return;
      }

      const config = getCondoGateConfig(condominioId);
      const deviceId = config.gate_device_id;

      if (config.gate_enabled !== "true" || !deviceId) {
        res.json({ enabled: false, configured: false });
        return;
      }

      const creds = getGlobalCreds();
      if (!creds.appId) {
        res.json({ enabled: true, configured: false, online: false });
        return;
      }

      const status = await getDeviceStatus(condominioId, creds, deviceId);

      res.json({
        enabled: true,
        configured: true,
        online: status.online,
        switchState: status.switch,
        deviceName: config.gate_device_name || "Portão",
      });
    } catch (err: any) {
      console.error("Erro status portão:", err);
      res.status(500).json({ error: "Erro ao verificar status." });
    }
  }
);

// ─── GET /logs — Histórico de acionamentos ───────────────
router.get(
  "/logs",
  authenticate,
  authorize("master", "administradora", "sindico", "funcionario"),
  (req: Request, res: Response) => {
    try {
      const condominioId = req.user.condominio_id;
      if (!condominioId) {
        res.status(400).json({ error: "Condomínio não configurado." });
        return;
      }

      const limit = Math.min(Number.parseInt(req.query.limit as string) || 50, 200);
      const offset = Number.parseInt(req.query.offset as string) || 0;

      const logs = db
        .prepare(
          `SELECT * FROM gate_logs 
           WHERE condominio_id = ? 
           ORDER BY created_at DESC 
           LIMIT ? OFFSET ?`
        )
        .all(condominioId, limit, offset);

      const total = (
        db
          .prepare("SELECT COUNT(*) as count FROM gate_logs WHERE condominio_id = ?")
          .get(condominioId) as any
      ).count;

      res.json({ logs, total });
    } catch (err: any) {
      console.error("Erro logs portão:", err);
      res.status(500).json({ error: "Erro ao buscar logs." });
    }
  }
);

// ─── GET /config — Config do portão (sindico vê simples) ─
router.get(
  "/config",
  authenticate,
  authorize("master", "administradora", "sindico"),
  (req: Request, res: Response) => {
    try {
      const condominioId = req.user.condominio_id;
      if (!condominioId) {
        res.status(400).json({ error: "Condomínio não configurado." });
        return;
      }

      const config = getCondoGateConfig(condominioId);

      // Síndico vê apenas o básico — ZERO menção a serviços internos
      res.json({
        gate_enabled: config.gate_enabled || "false",
        gate_device_name: config.gate_device_name || "",
        gate_pulse_duration: config.gate_pulse_duration || "1000",
        gate_device_configured: !!config.gate_device_id,
      });
    } catch (err: any) {
      console.error("Erro config portão:", err);
      res.status(500).json({ error: "Erro ao buscar configuração." });
    }
  }
);

// ─── PUT /config — Atualiza config (sindico: nome/pulse) ─
router.put(
  "/config",
  authenticate,
  authorize("master", "administradora", "sindico"),
  (req: Request, res: Response) => {
    try {
      const condominioId = req.user.condominio_id;
      if (!condominioId) {
        res.status(400).json({ error: "Condomínio não configurado." });
        return;
      }

      const updates = req.body as Record<string, string>;
      const isMaster = req.user.role === "master";

      const upsert = db.prepare(`
        INSERT INTO condominio_config (condominio_id, key, value, updated_at)
        VALUES (?, ?, ?, datetime('now'))
        ON CONFLICT(condominio_id, key)
        DO UPDATE SET value = excluded.value, updated_at = datetime('now')
      `);

      const tx = db.transaction(() => {
        for (const [key, value] of Object.entries(updates)) {
          // Síndico só pode alterar keys permitidas
          if (!isMaster && !SINDICO_CONFIG_KEYS.has(key)) continue;
          // Master pode alterar tudo per-condo (incluindo gate_device_id)
          if (key.startsWith("gate_")) {
            upsert.run(condominioId, key, value);
          }
        }
      });
      tx();

      logGateAction(condominioId, req.user.id, req.user.name, "config_updated");

      res.json({ success: true, message: "Configuração atualizada." });
    } catch (err: any) {
      console.error("Erro atualizar config portão:", err);
      res.status(500).json({ error: "Erro ao atualizar configuração." });
    }
  }
);

// ═══════════════════════════════════════════════════════════
// MASTER-ONLY: Configuração global de smart switches
// ═══════════════════════════════════════════════════════════

// ─── GET /master-config — Config global ──────────────────
router.get(
  "/master-config",
  authenticate,
  authorize("master"),
  (req: Request, res: Response) => {
    try {
      const rows = db
        .prepare(`SELECT key, value FROM system_config WHERE key LIKE 'gate_ewelink_%'`)
        .all() as { key: string; value: string }[];

      const config: Record<string, string> = {};
      for (const row of rows) {
        config[row.key] = row.value;
      }

      res.json({
        gate_ewelink_appid: config.gate_ewelink_appid || "",
        gate_ewelink_appsecret: config.gate_ewelink_appsecret ? "••••••••" : "",
        gate_ewelink_email: config.gate_ewelink_email || "",
        gate_ewelink_password: config.gate_ewelink_password ? "••••••••" : "",
        gate_ewelink_region: config.gate_ewelink_region || "us",
      });
    } catch (err: any) {
      console.error("Erro master config portão:", err);
      res.status(500).json({ error: "Erro ao buscar configuração." });
    }
  }
);

// ─── PUT /master-config — Salvar config global ───────────
router.put(
  "/master-config",
  authenticate,
  authorize("master"),
  (req: Request, res: Response) => {
    try {
      const updates = req.body as Record<string, string>;

      const upsert = db.prepare(`
        INSERT INTO system_config (key, value, updated_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(key)
        DO UPDATE SET value = excluded.value, updated_at = datetime('now')
      `);

      const tx = db.transaction(() => {
        for (const key of MASTER_GLOBAL_KEYS) {
          if (key in updates) {
            const value = updates[key];
            if (value === "••••••••") continue;
            upsert.run(key, value);
          }
        }
      });
      tx();

      clearTokenCache(0);

      res.json({ success: true, message: "Configuração global atualizada." });
    } catch (err: any) {
      console.error("Erro salvar master config:", err);
      res.status(500).json({ error: "Erro ao salvar configuração." });
    }
  }
);

// ─── GET /oauth-url — Gera URL de autorização OAuth (MASTER ONLY) ─
router.get(
  "/oauth-url",
  authenticate,
  authorize("master"),
  (req: Request, res: Response) => {
    try {
      const creds = getGlobalCreds();

      if (!creds.appId || !creds.appSecret) {
        res.status(400).json({ error: "AppID e AppSecret são obrigatórios. Configure primeiro." });
        return;
      }

      // Extract just the origin (scheme + host + port) from Origin or Referer header
      let origin = req.get("origin") || "";
      if (!origin) {
        const referer = req.get("referer");
        if (referer) {
          try { origin = new URL(referer).origin; } catch { origin = ""; }
        }
      }
      if (!origin) origin = `${req.protocol}://${req.get("host")}`;
      const redirectUrl = `${origin}/callback`;
      const url = generateOAuthUrl(creds, redirectUrl, "ewelink_auth");

      res.json({ url, redirectUrl });
    } catch (err: any) {
      console.error("Erro gerar OAuth URL:", err);
      res.status(500).json({ error: "Erro ao gerar URL de autorização." });
    }
  }
);

// ─── POST /oauth-exchange — Troca code por token (chamado pelo frontend callback) ─
router.post(
  "/oauth-exchange",
  async (req: Request, res: Response) => {
    try {
      const { code, redirectUrl, region } = req.body;

      if (!code || typeof code !== "string") {
        res.status(400).json({ success: false, error: "Código de autorização não recebido." });
        return;
      }

      const creds = getGlobalCreds();
      const result = await exchangeCodeForToken(creds, code, redirectUrl || "", region);

      res.json(result);
    } catch (err: any) {
      console.error("Erro OAuth exchange:", err);
      res.json({ success: false, error: err.message });
    }
  }
);

// ─── GET /oauth-callback — Fallback: Recebe o code do eWeLink (server-side) ──────
router.get(
  "/oauth-callback",
  async (req: Request, res: Response) => {
    try {
      const { code, state: _state, region } = req.query;

      if (!code || typeof code !== "string") {
        res.status(400).send("Código de autorização não recebido. Tente novamente.");
        return;
      }

      const creds = getGlobalCreds();
      const redirectUrl = `${req.protocol}://${req.get("host")}/api/gate/oauth-callback`;

      const result = await exchangeCodeForToken(creds, code, redirectUrl, typeof region === "string" ? region : undefined);

      if (result.success) {
        // Redirect to the master gate config page with success flag
        res.redirect("/master/portao?oauth=success");
      } else {
        res.redirect(`/master/portao?oauth=error&msg=${encodeURIComponent(result.error || "Erro desconhecido")}`);
      }
    } catch (err: any) {
      console.error("Erro OAuth callback:", err);
      res.redirect(`/master/portao?oauth=error&msg=${encodeURIComponent(err.message)}`);
    }
  }
);

// ─── GET /oauth-status — Verifica se está autorizado (MASTER ONLY)
router.get(
  "/oauth-status",
  authenticate,
  authorize("master"),
  (_req: Request, res: Response) => {
    try {
      const authorized = isOAuthAuthorized();
      res.json({ authorized });
    } catch (err) {
      console.error("OAuth status check failed:", err);
      res.json({ authorized: false });
    }
  }
);

// ─── GET /devices — Lista dispositivos (MASTER + SINDICO) ─────
router.get(
  "/devices",
  authenticate,
  authorize("master", "administradora", "sindico"),
  async (req: Request, res: Response) => {
    try {
      const creds = getGlobalCreds();

      if (!creds.appId || !creds.email) {
        res.status(400).json({ error: "Credenciais não configuradas. Configure primeiro na aba Credenciais." });
        return;
      }

      const result = await listDevices(0, creds);
      res.json(result);
    } catch (err: any) {
      console.error("Erro listar dispositivos:", err);
      res.status(500).json({ error: "Erro ao listar dispositivos." });
    }
  }
);

// ─── POST /test — Testar conexão (MASTER ONLY) ──────────
router.post(
  "/test",
  authenticate,
  authorize("master"),
  async (req: Request, res: Response) => {
    try {
      const creds = getGlobalCreds();

      if (!creds.appId || !creds.appSecret) {
        res.status(400).json({
          success: false,
          error: "Preencha AppID e AppSecret antes de testar.",
        });
        return;
      }

      if (!isOAuthAuthorized()) {
        res.json({
          success: false,
          error: "Autorização OAuth não realizada. Clique em 'Autorizar com eWeLink' primeiro.",
        });
        return;
      }

      clearTokenCache(0);

      const result = await listDevices(0, creds);

      if (result.error) {
        res.json({ success: false, error: result.error });
      } else {
        res.json({
          success: true,
          message: `Conectado! ${result.devices.length} dispositivo(s) encontrado(s).`,
          devices: result.devices,
        });
      }
    } catch (err: any) {
      console.error("Erro teste conexão:", err);
      res.json({ success: false, error: err.message });
    }
  }
);

// ─── POST /assign-device — Atribuir device a condomínio (MASTER) ─
router.post(
  "/assign-device",
  authenticate,
  authorize("master"),
  (req: Request, res: Response) => {
    try {
      const { condominio_id, device_id, device_name } = req.body;

      if (!condominio_id || !device_id) {
        res.status(400).json({ error: "condominio_id e device_id são obrigatórios." });
        return;
      }

      const upsert = db.prepare(`
        INSERT INTO condominio_config (condominio_id, key, value, updated_at)
        VALUES (?, ?, ?, datetime('now'))
        ON CONFLICT(condominio_id, key)
        DO UPDATE SET value = excluded.value, updated_at = datetime('now')
      `);

      const tx = db.transaction(() => {
        upsert.run(condominio_id, "gate_device_id", device_id);
        if (device_name) {
          upsert.run(condominio_id, "gate_device_name", device_name);
        }
        upsert.run(condominio_id, "gate_enabled", "true");
        if (!db.prepare(`SELECT value FROM condominio_config WHERE condominio_id = ? AND key = 'gate_pulse_duration'`).get(condominio_id)) {
          upsert.run(condominio_id, "gate_pulse_duration", "1000");
        }
      });
      tx();

      res.json({
        success: true,
        message: `Dispositivo atribuído ao condomínio com sucesso.`,
      });
    } catch (err: any) {
      console.error("Erro assign device:", err);
      res.status(500).json({ error: "Erro ao atribuir dispositivo." });
    }
  }
);

// ─── GET /all-assignments — Ver todos os dispositivos atribuídos (MASTER) ─
router.get(
  "/all-assignments",
  authenticate,
  authorize("master"),
  (req: Request, res: Response) => {
    try {
      const rows = db.prepare(`
        SELECT 
          cc.condominio_id,
          c.name as condominio_name,
          MAX(CASE WHEN cc.key = 'gate_device_id' THEN cc.value END) as device_id,
          MAX(CASE WHEN cc.key = 'gate_device_name' THEN cc.value END) as device_name,
          MAX(CASE WHEN cc.key = 'gate_enabled' THEN cc.value END) as enabled,
          MAX(CASE WHEN cc.key = 'gate_pulse_duration' THEN cc.value END) as pulse_duration
        FROM condominio_config cc
        JOIN condominios c ON c.id = cc.condominio_id
        WHERE cc.key LIKE 'gate_%'
        GROUP BY cc.condominio_id
        HAVING device_id IS NOT NULL
      `).all();

      res.json(rows);
    } catch (err: any) {
      console.error("Erro all assignments:", err);
      res.status(500).json({ error: "Erro ao buscar atribuições." });
    }
  }
);

// ═══════════════════════════════════════════════════════════
// ACCESS POINTS — Portaria Virtual (multi-access per condo)
// ═══════════════════════════════════════════════════════════

const DEFAULT_ACCESS_POINTS = [
  { name: "Portão Veicular", icon: "Car", order_index: 0 },
  { name: "Portão de Pedestre", icon: "PersonStanding", order_index: 1 },
  { name: "Acesso ao Bloco", icon: "Building", order_index: 2 },
  { name: "Acesso à Academia", icon: "Dumbbell", order_index: 3 },
  { name: "Acesso à Piscina", icon: "Waves", order_index: 4 },
];

// ─── POST /access-points/seed — Criar pontos de acesso padrão ─
router.post(
  "/access-points/seed",
  authenticate,
  authorize("master", "administradora", "sindico"),
  (req: Request, res: Response) => {
    try {
      const condominioId = req.user.condominio_id;
      if (!condominioId) {
        res.status(400).json({ error: "Condomínio não configurado." });
        return;
      }

      // Check if already has access points
      const existing = db
        .prepare("SELECT COUNT(*) as count FROM gate_access_points WHERE condominio_id = ?")
        .get(condominioId) as { count: number };

      if (existing.count > 0) {
        res.json({ success: true, message: "Pontos de acesso já existem.", seeded: false });
        return;
      }

      const insert = db.prepare(`
        INSERT INTO gate_access_points (condominio_id, name, icon, enabled, pulse_duration, allowed_roles, order_index, is_custom, allow_manual_open, allow_botoeira_morador, allow_botoeira_portaria)
        VALUES (?, ?, ?, 0, 1000, '["morador","funcionario","sindico"]', ?, 0, 1, 1, 1)
      `);

      const tx = db.transaction(() => {
        for (const ap of DEFAULT_ACCESS_POINTS) {
          insert.run(condominioId, ap.name, ap.icon, ap.order_index);
        }
      });
      tx();

      res.json({ success: true, message: "Pontos de acesso padrão criados.", seeded: true });
    } catch (err: any) {
      console.error("Erro seed access points:", err);
      res.status(500).json({ error: "Erro ao criar pontos de acesso." });
    }
  }
);

// ─── GET /access-points — Lista pontos de acesso ─────────
router.get(
  "/access-points",
  authenticate,
  authorize("master", "administradora", "sindico", "funcionario", "morador"),
  (req: Request, res: Response) => {
    try {
      const condominioId = req.user.condominio_id;
      if (!condominioId) {
        res.status(400).json({ error: "Condomínio não configurado." });
        return;
      }

      const userRole = req.user.role;
      const isSindico = ["master", "administradora", "sindico"].includes(userRole);

      let rows;
      if (isSindico) {
        // Síndico vê tudo (enabled + disabled)
        rows = db
          .prepare("SELECT * FROM gate_access_points WHERE condominio_id = ? ORDER BY order_index ASC, id ASC")
          .all(condominioId);
      } else {
        // Morador/funcionário vê apenas habilitados e que ele pode acessar
        rows = db
          .prepare("SELECT * FROM gate_access_points WHERE condominio_id = ? AND enabled = 1 ORDER BY order_index ASC, id ASC")
          .all(condominioId);

        // Filter by allowed_roles
        rows = (rows as any[]).filter((ap: any) => {
          try {
            const roles = JSON.parse(ap.allowed_roles || "[]");
            return roles.includes(userRole);
          } catch {
            return false;
          }
        });
      }

      res.json(rows);
    } catch (err: any) {
      console.error("Erro listar access points:", err);
      res.status(500).json({ error: "Erro ao listar pontos de acesso." });
    }
  }
);

// ─── POST /access-points — Criar ponto de acesso ─────────
router.post(
  "/access-points",
  authenticate,
  authorize("master", "administradora", "sindico"),
  (req: Request, res: Response) => {
    try {
      const condominioId = req.user.condominio_id;
      if (!condominioId) {
        res.status(400).json({ error: "Condomínio não configurado." });
        return;
      }

      const { name, icon, device_id, enabled, pulse_duration, allowed_roles, order_index } = req.body;

      if (!name?.trim()) {
        res.status(400).json({ error: "Nome é obrigatório." });
        return;
      }

      // Get next order_index if not provided
      const maxOrder = db
        .prepare("SELECT MAX(order_index) as max_order FROM gate_access_points WHERE condominio_id = ?")
        .get(condominioId) as { max_order: number | null };

      const result = db.prepare(`
        INSERT INTO gate_access_points (condominio_id, name, icon, device_id, enabled, pulse_duration, allowed_roles, order_index, is_custom)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(
        condominioId,
        name.trim(),
        icon || "DoorOpen",
        device_id || null,
        enabled !== undefined ? (enabled ? 1 : 0) : 0,
        pulse_duration || 1000,
        JSON.stringify(allowed_roles || ["morador", "funcionario", "sindico"]),
        order_index ?? ((maxOrder.max_order ?? -1) + 1)
      );

      res.json({ success: true, id: result.lastInsertRowid });
    } catch (err: any) {
      console.error("Erro criar access point:", err);
      res.status(500).json({ error: "Erro ao criar ponto de acesso." });
    }
  }
);

// ─── PUT /access-points/:id — Atualizar ponto de acesso ──
router.put(
  "/access-points/:id",
  authenticate,
  authorize("master", "administradora", "sindico"),
  (req: Request, res: Response) => {
    try {
      const condominioId = req.user.condominio_id;
      if (!condominioId) {
        res.status(400).json({ error: "Condomínio não configurado." });
        return;
      }

      const apId = parseInt(req.params.id as string);
      const existing = db
        .prepare("SELECT * FROM gate_access_points WHERE id = ? AND condominio_id = ?")
        .get(apId, condominioId) as any;

      if (!existing) {
        res.status(404).json({ error: "Ponto de acesso não encontrado." });
        return;
      }

      const { name, icon, device_id, enabled, pulse_duration, allowed_roles, order_index, channel, allow_manual_open, allow_botoeira_morador, allow_botoeira_portaria } = req.body;

      db.prepare(`
        UPDATE gate_access_points SET
          name = COALESCE(?, name),
          icon = COALESCE(?, icon),
          device_id = ?,
          enabled = COALESCE(?, enabled),
          pulse_duration = COALESCE(?, pulse_duration),
          allowed_roles = COALESCE(?, allowed_roles),
          order_index = COALESCE(?, order_index),
          channel = ?,
          allow_manual_open = COALESCE(?, allow_manual_open),
          allow_botoeira_morador = COALESCE(?, allow_botoeira_morador),
          allow_botoeira_portaria = COALESCE(?, allow_botoeira_portaria)
        WHERE id = ? AND condominio_id = ?
      `).run(
        name || null,
        icon || null,
        device_id !== undefined ? (device_id || null) : existing.device_id,
        enabled !== undefined ? (enabled ? 1 : 0) : null,
        pulse_duration || null,
        allowed_roles ? JSON.stringify(allowed_roles) : null,
        order_index !== undefined ? order_index : null,
        channel !== undefined ? channel : existing.channel,
        allow_manual_open !== undefined ? (allow_manual_open ? 1 : 0) : null,
        allow_botoeira_morador !== undefined ? (allow_botoeira_morador ? 1 : 0) : null,
        allow_botoeira_portaria !== undefined ? (allow_botoeira_portaria ? 1 : 0) : null,
        apId,
        condominioId
      );

      res.json({ success: true });
    } catch (err: any) {
      console.error("Erro atualizar access point:", err);
      res.status(500).json({ error: "Erro ao atualizar ponto de acesso." });
    }
  }
);

// ─── DELETE /access-points/:id — Excluir ponto de acesso ─
router.delete(
  "/access-points/:id",
  authenticate,
  authorize("master", "administradora", "sindico"),
  (req: Request, res: Response) => {
    try {
      const condominioId = req.user.condominio_id;
      if (!condominioId) {
        res.status(400).json({ error: "Condomínio não configurado." });
        return;
      }

      const apId = parseInt(req.params.id as string);
      const existing = db
        .prepare("SELECT * FROM gate_access_points WHERE id = ? AND condominio_id = ?")
        .get(apId, condominioId) as any;

      if (!existing) {
        res.status(404).json({ error: "Ponto de acesso não encontrado." });
        return;
      }

      db.prepare("DELETE FROM gate_access_points WHERE id = ? AND condominio_id = ?")
        .run(apId, condominioId);

      res.json({ success: true });
    } catch (err: any) {
      console.error("Erro excluir access point:", err);
      res.status(500).json({ error: "Erro ao excluir ponto de acesso." });
    }
  }
);

// ─── POST /access-points/:id/open — Abrir ponto de acesso ─
router.post(
  "/access-points/:id/open",
  authenticate,
  authorize("master", "administradora", "sindico", "funcionario", "morador"),
  async (req: Request, res: Response) => {
    try {
      const condominioId = req.user.condominio_id;
      if (!condominioId) {
        res.status(400).json({ error: "Condomínio não configurado." });
        return;
      }

      // Rate limit — impede acionamentos rápidos demais (5s cooldown)
      if (!checkOpenCooldown(req.user.id)) {
        res.status(429).json({ error: "Aguarde alguns segundos antes de acionar novamente." });
        return;
      }

      const apId = parseInt(req.params.id as string);
      const ap = db
        .prepare("SELECT * FROM gate_access_points WHERE id = ? AND condominio_id = ? AND enabled = 1")
        .get(apId, condominioId) as any;

      if (!ap) {
        res.status(404).json({ error: "Ponto de acesso não encontrado ou desabilitado." });
        return;
      }

      // For moradores using manual/biometric open, check allow_manual_open
      const userRole = req.user.role;
      const openMethod = req.body?.method || "button";

      // Botoeira permission check — separate for morador vs portaria
      if (openMethod === "botoeira") {
        if (userRole === "morador" && !ap.allow_botoeira_morador) {
          res.status(403).json({ error: "Botoeira não habilitada para moradores. Use o reconhecimento facial." });
          return;
        }
        if (["funcionario", "sindico"].includes(userRole) && !ap.allow_botoeira_portaria) {
          res.status(403).json({ error: "Botoeira não habilitada para a portaria." });
          return;
        }
      } else if (openMethod === "manual_biometric") {
        if (userRole === "morador" && !ap.allow_manual_open) {
          res.status(403).json({ error: "Abertura manual não habilitada pelo síndico. Use o reconhecimento facial." });
          return;
        }
      }

      // Check role permission
      try {
        const roles = JSON.parse(ap.allowed_roles || "[]");
        if (!roles.includes(userRole) && userRole !== "master" && userRole !== "administradora") {
          res.status(403).json({ error: "Você não tem permissão para abrir este acesso." });
          return;
        }
      } catch {
        // If parse fails, deny non-admin
        if (!["master", "administradora", "sindico"].includes(userRole)) {
          res.status(403).json({ error: "Permissão negada." });
          return;
        }
      }

      if (!ap.device_id) {
        res.status(400).json({ error: "Dispositivo não configurado para este acesso. Contate o síndico." });
        return;
      }

      const creds = getGlobalCreds();
      if (!creds.appId || !creds.email) {
        res.status(500).json({ error: "Sistema não configurado. Contate o suporte App Interfone." });
        return;
      }

      const duration = ap.pulse_duration || 1000;
      const result = await pulseDevice(condominioId, creds, ap.device_id, duration, ap.channel);

      const actionType =
          openMethod === "manual_biometric"
            ? "manual_biometric_open"
            : openMethod === "botoeira"
            ? "botoeira_open"
            : "access_point_open";

      if (result.success) {
        logGateAction(
          condominioId,
          req.user.id,
          req.user.name,
          actionType,
          `Acesso: ${ap.name} (${openMethod})`
        );

        // WhatsApp: notify portaria about access point opening
        notifyPortariaWhatsApp(condominioId, "whatsapp_notify_gate_opened", `🚪 ${ap.name} aberto por ${req.user.name} (${openMethod})`);

        res.json({ success: true, message: `${ap.name} aberto!` });
      } else {
        logGateAction(
          condominioId,
          req.user.id,
          req.user.name,
          "access_point_open_failed",
          `Acesso: ${ap.name} — ${result.error}`
        );
        res.status(500).json({ error: `Falha ao abrir ${ap.name}. Tente novamente.` });
      }
    } catch (err: any) {
      console.error("Erro abrir access point:", err);
      res.status(500).json({ error: "Erro interno ao abrir acesso." });
    }
  }
);

// ─── POST /access-points/:id/toggle — Liga/desliga ponto de acesso ─
router.post(
  "/access-points/:id/toggle",
  authenticate,
  authorize("master", "administradora", "sindico", "funcionario", "morador"),
  async (req: Request, res: Response) => {
    try {
      const condominioId = req.user.condominio_id;
      if (!condominioId) {
        res.status(400).json({ error: "Condomínio não configurado." });
        return;
      }

      // Rate limit — impede acionamentos rápidos demais (5s cooldown)
      if (!checkOpenCooldown(req.user.id)) {
        res.status(429).json({ error: "Aguarde alguns segundos antes de acionar novamente." });
        return;
      }

      const apId = parseInt(req.params.id as string);
      const ap = db
        .prepare("SELECT * FROM gate_access_points WHERE id = ? AND condominio_id = ? AND enabled = 1")
        .get(apId, condominioId) as any;

      if (!ap) {
        res.status(404).json({ error: "Ponto de acesso não encontrado ou desabilitado." });
        return;
      }

      const userRole = req.user.role;
      try {
        const roles = JSON.parse(ap.allowed_roles || "[]");
        if (!roles.includes(userRole) && userRole !== "master" && userRole !== "administradora") {
          res.status(403).json({ error: "Você não tem permissão para controlar este acesso." });
          return;
        }
      } catch {
        if (!["master", "administradora", "sindico"].includes(userRole)) {
          res.status(403).json({ error: "Permissão negada." });
          return;
        }
      }

      if (!ap.device_id) {
        res.status(400).json({ error: "Dispositivo não configurado para este acesso." });
        return;
      }

      const state = req.body.state === "off" ? "off" : "on";
      const creds = getGlobalCreds();
      if (!creds.appId || !creds.email) {
        res.status(500).json({ error: "Sistema não configurado." });
        return;
      }

      const result = await toggleDevice(condominioId, creds, ap.device_id, state, ap.channel);

      if (result.success) {
        logGateAction(
          condominioId,
          req.user.id,
          req.user.name,
          `toggle_${state}`,
          `Acesso: ${ap.name}`
        );
        res.json({ success: true, state, message: state === "on" ? `${ap.name} ligado!` : `${ap.name} desligado!` });
      } else {
        res.status(500).json({ error: `Falha ao ${state === "on" ? "ligar" : "desligar"} ${ap.name}.` });
      }
    } catch (err: any) {
      console.error("Erro toggle access point:", err);
      res.status(500).json({ error: "Erro interno." });
    }
  }
);

// ─── POST /face-open — Reconhecimento facial → abre portão de pedestre ─
router.post(
  "/face-open",
  authenticate,
  authorize("master", "administradora", "sindico", "funcionario"),
  async (req: Request, res: Response) => {
    try {
      const condominioId = req.user.condominio_id;
      if (!condominioId) {
        res.status(400).json({ error: "Condomínio não configurado." });
        return;
      }

      // Rate limit
      if (!checkOpenCooldown(req.user.id)) {
        res.status(429).json({ error: "Aguarde alguns segundos entre leituras." });
        return;
      }

      if (!faceModelsReady()) {
        res.status(503).json({ error: "Modelos de reconhecimento facial carregando. Tente novamente." });
        return;
      }

      const { photo } = req.body;
      if (!photo) {
        res.status(400).json({ error: "Campo 'photo' (base64) é obrigatório." });
        return;
      }

      // 1. Extract face descriptor
      const descriptor = await extractDescriptor(photo);
      if (!descriptor) {
        res.json({ matched: false, opened: false, error: "Nenhum rosto detectado na foto." });
        return;
      }

      // 2. Compare against visitors
      const visitors = db.prepare(
        "SELECT id, nome, face_descriptor FROM visitors WHERE (condominio_id = ? OR condominio_id IS NULL) AND face_descriptor IS NOT NULL ORDER BY created_at DESC"
      ).all(condominioId) as any[];

      const knownVisitors = visitors
        .map((v: any) => ({ id: v.id, nome: v.nome, face_descriptor: JSON.parse(v.face_descriptor) }))
        .filter((v: any) => v.face_descriptor && Array.isArray(v.face_descriptor));

      let matchResult = compareFaces(descriptor, knownVisitors, 0.6);
      let matchSource = "visitor";
      let matchName = matchResult.visitorName;

      // 3. If no visitor match, try pre-authorizations
      if (!matchResult.matched) {
        const preAuths = db.prepare(
          "SELECT id, visitante_nome as nome, face_descriptor FROM pre_authorizations WHERE condominio_id = ? AND status = 'ativa' AND face_descriptor IS NOT NULL"
        ).all(condominioId) as any[];

        const knownPreAuths = preAuths
          .map((r: any) => ({ id: r.id, nome: r.nome, face_descriptor: JSON.parse(r.face_descriptor) }))
          .filter((r: any) => r.face_descriptor && Array.isArray(r.face_descriptor));

        const preAuthResult = compareFaces(descriptor, knownPreAuths, 0.5);
        if (preAuthResult.matched) {
          matchResult = preAuthResult;
          matchSource = "pre_authorization";
          matchName = preAuthResult.visitorName;
        }
      }

      if (!matchResult.matched) {
        res.json({ matched: false, opened: false, message: "Pessoa não reconhecida." });
        return;
      }

      // 4. Find pedestrian gate access point (icon = PersonStanding or name contains "Pedestre")
      const pedestrianAp = db.prepare(
        `SELECT * FROM gate_access_points 
         WHERE condominio_id = ? AND enabled = 1 AND device_id IS NOT NULL
         AND (icon = 'PersonStanding' OR LOWER(name) LIKE '%pedestre%')
         ORDER BY order_index ASC LIMIT 1`
      ).get(condominioId) as any;

      // Fallback: any enabled access point
      const ap = pedestrianAp || db.prepare(
        `SELECT * FROM gate_access_points 
         WHERE condominio_id = ? AND enabled = 1 AND device_id IS NOT NULL
         ORDER BY order_index ASC LIMIT 1`
      ).get(condominioId) as any;

      if (!ap) {
        res.json({
          matched: true, opened: false,
          person: matchName,
          similarity: matchResult.similarity,
          source: matchSource,
          error: "Nenhum ponto de acesso configurado para abrir."
        });
        return;
      }

      // 5. Pulse the gate
      const creds = getGlobalCreds();
      if (!creds.appId || !creds.email) {
        res.json({ matched: true, opened: false, person: matchName, error: "Sistema de portão não configurado." });
        return;
      }

      const duration = ap.pulse_duration || 1000;
      const result = await pulseDevice(condominioId, creds, ap.device_id, duration, ap.channel);

      if (result.success) {
        logGateAction(
          condominioId, req.user.id, req.user.name,
          "face_open",
          `Reconhecimento facial: ${matchName} (${matchSource}) → ${ap.name}`
        );
        res.json({
          matched: true, opened: true,
          person: matchName,
          similarity: matchResult.similarity,
          source: matchSource,
          accessPoint: ap.name,
          message: `${matchName} reconhecido(a)! ${ap.name} aberto.`
        });
      } else {
        logGateAction(condominioId, req.user.id, req.user.name, "face_open_failed", `${matchName} → ${ap.name}: ${result.error}`);
        res.json({ matched: true, opened: false, person: matchName, error: `Falha ao abrir ${ap.name}.` });
      }
    } catch (err: any) {
      console.error("Erro face-open:", err);
      res.status(500).json({ error: "Erro interno no reconhecimento facial." });
    }
  }
);

// ─── POST /lpr-open — Leitura de placa → abre portão veicular ─
router.post(
  "/lpr-open",
  authenticate,
  authorize("master", "administradora", "sindico", "funcionario"),
  async (req: Request, res: Response) => {
    try {
      const condominioId = req.user.condominio_id;
      if (!condominioId) {
        res.status(400).json({ error: "Condomínio não configurado." });
        return;
      }

      // Rate limit
      if (!checkOpenCooldown(req.user.id)) {
        res.status(429).json({ error: "Aguarde alguns segundos entre leituras." });
        return;
      }

      const { placa } = req.body;
      if (!placa) {
        res.status(400).json({ error: "Campo 'placa' é obrigatório." });
        return;
      }

      const cleanPlaca = String(placa).toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (cleanPlaca.length < 6) {
        res.json({ found: false, opened: false, message: "Placa inválida." });
        return;
      }

      // 1. Look up vehicle authorization
      const vehicle = db.prepare(
        `SELECT placa, modelo, cor, motorista_nome, bloco, apartamento,
                morador_name, morador_phone, status, data_inicio, data_fim
         FROM vehicle_authorizations
         WHERE condominio_id = ? AND placa = ? AND status = 'ativa'
         ORDER BY created_at DESC LIMIT 1`
      ).get(condominioId, cleanPlaca) as any;

      if (!vehicle) {
        // Check if plate exists but not authorized
        const anyVehicle = db.prepare(
          "SELECT placa, status FROM vehicle_authorizations WHERE condominio_id = ? AND placa = ? ORDER BY created_at DESC LIMIT 1"
        ).get(condominioId, cleanPlaca) as any;

        if (anyVehicle) {
          res.json({
            found: true, authorized: false, opened: false,
            placa: cleanPlaca,
            status: anyVehicle.status,
            message: `Veículo encontrado mas não autorizado (status: ${anyVehicle.status}).`
          });
        } else {
          res.json({ found: false, authorized: false, opened: false, placa: cleanPlaca, message: "Veículo não cadastrado." });
        }
        return;
      }

      // 2. Check date validity
      const today = new Date().toISOString().split("T")[0];
      if (vehicle.data_fim && vehicle.data_fim < today) {
        res.json({
          found: true, authorized: false, opened: false,
          placa: cleanPlaca, vehicle,
          message: "Autorização expirada."
        });
        return;
      }

      // 3. Find vehicular gate access point (icon = Car or name contains "Veicular"/"Veículo")
      const vehicularAp = db.prepare(
        `SELECT * FROM gate_access_points 
         WHERE condominio_id = ? AND enabled = 1 AND device_id IS NOT NULL
         AND (icon = 'Car' OR LOWER(name) LIKE '%veicular%' OR LOWER(name) LIKE '%veículo%' OR LOWER(name) LIKE '%veiculo%')
         ORDER BY order_index ASC LIMIT 1`
      ).get(condominioId) as any;

      // Fallback: any enabled access point
      const ap = vehicularAp || db.prepare(
        `SELECT * FROM gate_access_points 
         WHERE condominio_id = ? AND enabled = 1 AND device_id IS NOT NULL
         ORDER BY order_index ASC LIMIT 1`
      ).get(condominioId) as any;

      if (!ap) {
        res.json({
          found: true, authorized: true, opened: false,
          placa: cleanPlaca, vehicle,
          error: "Nenhum ponto de acesso configurado para abrir."
        });
        return;
      }

      // 4. Pulse the gate
      const creds = getGlobalCreds();
      if (!creds.appId || !creds.email) {
        res.json({ found: true, authorized: true, opened: false, vehicle, error: "Sistema de portão não configurado." });
        return;
      }

      const duration = ap.pulse_duration || 1000;
      const result = await pulseDevice(condominioId, creds, ap.device_id, duration, ap.channel);

      if (result.success) {
        logGateAction(
          condominioId, req.user.id, req.user.name,
          "lpr_open",
          `LPR: ${cleanPlaca} (${vehicle.motorista_nome || vehicle.morador_name}) → ${ap.name}`
        );
        res.json({
          found: true, authorized: true, opened: true,
          placa: cleanPlaca, vehicle,
          accessPoint: ap.name,
          message: `Placa ${cleanPlaca} autorizada! ${ap.name} aberto.`
        });
      } else {
        logGateAction(condominioId, req.user.id, req.user.name, "lpr_open_failed", `${cleanPlaca} → ${ap.name}: ${result.error}`);
        res.json({ found: true, authorized: true, opened: false, vehicle, error: `Falha ao abrir ${ap.name}.` });
      }
    } catch (err: any) {
      console.error("Erro lpr-open:", err);
      res.status(500).json({ error: "Erro interno na leitura de placa." });
    }
  }
);

// ─── POST /selfie-open/:apId — Morador abre portão via selfie ─
router.post(
  "/selfie-open/:apId",
  authenticate,
  authorize("master", "administradora", "sindico", "funcionario", "morador"),
  async (req: Request, res: Response) => {
    try {
      const condominioId = req.user.condominio_id;
      if (!condominioId) {
        res.status(400).json({ error: "Condomínio não configurado." });
        return;
      }

      // Rate limit
      if (!checkOpenCooldown(req.user.id)) {
        res.status(429).json({ error: "Aguarde alguns segundos antes de acionar novamente." });
        return;
      }

      const { photo } = req.body;
      if (!photo) {
        res.status(400).json({ error: "Campo 'photo' (base64) é obrigatório." });
        return;
      }

      // Validate access point
      const apId = parseInt(req.params.apId as string);
      const ap = db
        .prepare("SELECT * FROM gate_access_points WHERE id = ? AND condominio_id = ? AND enabled = 1")
        .get(apId, condominioId) as any;

      if (!ap) {
        res.status(404).json({ error: "Ponto de acesso não encontrado ou desabilitado." });
        return;
      }

      // Check role permission
      const userRole = req.user.role;
      try {
        const roles = JSON.parse(ap.allowed_roles || "[]");
        if (!roles.includes(userRole) && userRole !== "master" && userRole !== "administradora") {
          res.status(403).json({ error: "Você não tem permissão para abrir este acesso." });
          return;
        }
      } catch {
        if (!["master", "administradora", "sindico"].includes(userRole)) {
          res.status(403).json({ error: "Permissão negada." });
          return;
        }
      }

      if (!ap.device_id) {
        res.status(400).json({ error: "Dispositivo não configurado para este acesso." });
        return;
      }

      // Check face models
      if (!faceModelsReady()) {
        res.status(503).json({ error: "Serviço de reconhecimento facial ainda carregando. Tente novamente." });
        return;
      }

      // Get user's stored face descriptor
      const userRow = db.prepare("SELECT face_descriptor FROM users WHERE id = ?").get(req.user.id) as any;
      if (!userRow || !userRow.face_descriptor) {
        res.json({ matched: false, opened: false, error: "Você precisa cadastrar seu rosto primeiro. Acesse 'Cadastrar Rosto' na Portaria Virtual." });
        return;
      }

      // Extract descriptor from selfie
      const selfieDescriptor = await extractDescriptor(photo);
      if (!selfieDescriptor) {
        res.json({ matched: false, opened: false, error: "Nenhum rosto detectado na selfie. Posicione seu rosto no centro." });
        return;
      }

      // Compare
      const storedDescriptor = JSON.parse(userRow.face_descriptor) as number[];
      const result = compareFaces(selfieDescriptor, [
        { id: req.user.id, nome: req.user.name, face_descriptor: storedDescriptor }
      ], 0.55);

      if (!result.matched) {
        logGateAction(condominioId, req.user.id, req.user.name, "selfie_open_denied",
          `Selfie não correspondeu → ${ap.name} (similarity: ${result.similarity?.toFixed(2)})`);
        res.json({ matched: false, opened: false, similarity: result.similarity, error: "Rosto não corresponde ao cadastrado." });
        return;
      }

      // Face matched — open gate
      const creds = getGlobalCreds();
      if (!creds.appId || !creds.email) {
        res.status(500).json({ error: "Sistema não configurado. Contate o suporte." });
        return;
      }

      const duration = ap.pulse_duration || 1000;
      const openResult = await pulseDevice(condominioId, creds, ap.device_id, duration, ap.channel);

      if (openResult.success) {
        logGateAction(condominioId, req.user.id, req.user.name, "selfie_open",
          `Selfie verificada → ${ap.name} aberto (similarity: ${result.similarity?.toFixed(2)})`);
        res.json({ matched: true, opened: true, similarity: result.similarity, message: `Identidade confirmada! ${ap.name} aberto.` });
      } else {
        logGateAction(condominioId, req.user.id, req.user.name, "selfie_open_device_fail",
          `Selfie OK mas dispositivo falhou → ${ap.name}: ${openResult.error}`);
        res.json({ matched: true, opened: false, error: `Identidade confirmada, mas falha ao abrir ${ap.name}.` });
      }
    } catch (err: any) {
      console.error("Erro selfie-open:", err);
      res.status(500).json({ error: "Erro interno na autenticação facial." });
    }
  }
);

export default router;
