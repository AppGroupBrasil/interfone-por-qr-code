/**
 * ═══════════════════════════════════════════════════════════
 * WHATSAPP SERVICE — Gupshup API
 * Centralized service for sending WhatsApp messages via
 * Gupshup Business Messaging API.
 * ═══════════════════════════════════════════════════════════
 */

import db from "./db.js";

// ─── Types ───
interface WhatsAppTemplate {
  id: string;
  /** Gupshup template name (pre-approved on Meta) */
  templateName: string;
  /** Parameters to fill template placeholders */
  params?: string[];
}

interface WhatsAppResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ─── Config helpers ───

/**
 * Global credentials are stored with condominio_id = 0.
 * Each condominium only stores whatsapp_enabled toggle.
 */
function getGlobalCredentials(): { apiKey: string; sourceNumber: string; appName: string } | null {
  const rows = db.prepare(
    `SELECT key, value FROM condominio_config WHERE condominio_id = 0 AND key IN (
      'whatsapp_gupshup_apikey', 'whatsapp_gupshup_source', 'whatsapp_gupshup_appname'
    )`
  ).all() as { key: string; value: string }[];

  const cfg: Record<string, string> = {};
  for (const r of rows) cfg[r.key] = r.value;

  if (!cfg.whatsapp_gupshup_apikey || !cfg.whatsapp_gupshup_source) return null;

  return {
    apiKey: cfg.whatsapp_gupshup_apikey,
    sourceNumber: cfg.whatsapp_gupshup_source,
    appName: cfg.whatsapp_gupshup_appname || "App Interfone",
  };
}

function getConfig(condominioId: number): { apiKey: string; sourceNumber: string; appName: string; enabled: boolean } | null {
  // Check if WhatsApp is enabled for this condominium
  const enabledRow = db.prepare(
    `SELECT value FROM condominio_config WHERE condominio_id = ? AND key = 'whatsapp_enabled'`
  ).get(condominioId) as { value: string } | undefined;

  if (enabledRow?.value !== "true") return null;

  // Get global credentials (shared across all condominiums)
  const global = getGlobalCredentials();
  if (!global) return null;

  return { ...global, enabled: true };
}

/**
 * Check if a specific notification type is enabled for a condominium.
 */
export function isNotifyEnabled(condominioId: number, notifyKey: string): boolean {
  const cfg = getConfig(condominioId);
  if (!cfg) return false; // WhatsApp not enabled at all
  const row = db.prepare(
    `SELECT value FROM condominio_config WHERE condominio_id = ? AND key = ?`
  ).get(condominioId, notifyKey) as { value: string } | undefined;
  return row?.value === "true";
}

/**
 * High-level: send a WhatsApp text notification if the notify type is enabled.
 * Non-blocking — returns immediately.
 */
export function notifyWhatsApp(
  condominioId: number,
  notifyKey: string,
  phone: string,
  message: string
): void {
  if (!isNotifyEnabled(condominioId, notifyKey)) return;
  sendWhatsAppText(condominioId, phone, message).catch(() => {});
}

/**
 * High-level: send WhatsApp text to portaria staff if notify type is enabled.
 */
export function notifyPortariaWhatsApp(
  condominioId: number,
  notifyKey: string,
  message: string
): void {
  if (!isNotifyEnabled(condominioId, notifyKey)) return;
  const cfg = getConfig(condominioId);
  if (!cfg) return;
  const users = db.prepare(
    `SELECT phone FROM users WHERE condominio_id = ? AND role IN ('funcionario', 'sindico', 'administradora') AND phone IS NOT NULL AND phone != ''`
  ).all(condominioId) as { phone: string }[];
  for (const u of users) {
    sendWhatsAppText(condominioId, u.phone, message).catch(() => {});
  }
}

/**
 * High-level: send WhatsApp text to a specific user by ID if notify type is enabled.
 */
export function notifyUserWhatsApp(
  condominioId: number,
  notifyKey: string,
  userId: number,
  message: string
): void {
  if (!isNotifyEnabled(condominioId, notifyKey)) return;
  const user = db.prepare("SELECT phone FROM users WHERE id = ?").get(userId) as { phone: string } | undefined;
  if (!user?.phone) return;
  sendWhatsAppText(condominioId, user.phone, message).catch(() => {});
}

function normalizePhone(phone: string): string {
  // Remove tudo que não é dígito
  let digits = phone.replace(/\D/g, "");
  // Se começa com 0, remove
  if (digits.startsWith("0")) digits = digits.slice(1);
  // Se não tem código do país (menos de 12 dígitos), assume Brasil +55
  if (digits.length <= 11) digits = "55" + digits;
  return digits;
}

// ─── Log helper ───
function logMessage(condominioId: number, phone: string, templateName: string, status: string, messageId?: string, error?: string) {
  try {
    db.prepare(`
      INSERT INTO whatsapp_log (condominio_id, phone, template_name, status, message_id, error, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(condominioId, phone, templateName, status, messageId || null, error || null);
  } catch (e) {
    // table might not exist yet, ignore
  }
}

// ─── Core: send template message via Gupshup ───

async function sendTemplateMessage(
  apiKey: string,
  sourceNumber: string,
  appName: string,
  destinationPhone: string,
  templateName: string,
  params: string[] = []
): Promise<WhatsAppResult> {
  const body = new URLSearchParams();
  body.append("channel", "whatsapp");
  body.append("source", sourceNumber);
  body.append("destination", destinationPhone);
  body.append("src.name", appName);

  // Template message payload
  const templatePayload: any = {
    id: crypto.randomUUID(),
    type: "template",
    template: {
      name: templateName,
      language: { code: "pt_BR", policy: "deterministic" },
      components: [] as any[],
    },
  };

  if (params.length > 0) {
    templatePayload.template.components.push({
      type: "body",
      parameters: params.map(p => ({ type: "text", text: p })),
    });
  }

  body.append("message", JSON.stringify(templatePayload));

  try {
    const response = await fetch("https://api.gupshup.io/wa/api/v1/template/msg", {
      method: "POST",
      headers: {
        "apikey": apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const data = await response.json();

    if (response.ok && data.status === "submitted") {
      return { success: true, messageId: data.messageId };
    }

    return { success: false, error: data.message || JSON.stringify(data) };
  } catch (err: any) {
    return { success: false, error: err.message || "Erro de rede" };
  }
}

// ─── Send text message (session/free-form — only within 24h window) ───

async function sendTextMessage(
  apiKey: string,
  sourceNumber: string,
  appName: string,
  destinationPhone: string,
  text: string
): Promise<WhatsAppResult> {
  const body = new URLSearchParams();
  body.append("channel", "whatsapp");
  body.append("source", sourceNumber);
  body.append("destination", destinationPhone);
  body.append("src.name", appName);
  body.append("message", JSON.stringify({ type: "text", text }));

  try {
    const response = await fetch("https://api.gupshup.io/wa/api/v1/msg", {
      method: "POST",
      headers: {
        "apikey": apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const data = await response.json();

    if (response.ok && data.status === "submitted") {
      return { success: true, messageId: data.messageId };
    }

    return { success: false, error: data.message || JSON.stringify(data) };
  } catch (err: any) {
    return { success: false, error: err.message || "Erro de rede" };
  }
}

// ═══════════════════════════════════════════════════════════
// PUBLIC API — used by other modules
// ═══════════════════════════════════════════════════════════

/**
 * Send a WhatsApp template message to a specific phone number.
 */
/** Expose global credentials check for routes */
export { getGlobalCredentials };

/**
 * Send a WhatsApp template message to a specific phone number.
 */
export async function sendWhatsApp(
  condominioId: number,
  phone: string,
  templateName: string,
  params: string[] = []
): Promise<WhatsAppResult> {
  const cfg = getConfig(condominioId);
  if (!cfg) return { success: false, error: "WhatsApp não configurado para este condomínio" };

  const dest = normalizePhone(phone);
  const result = await sendTemplateMessage(cfg.apiKey, cfg.sourceNumber, cfg.appName, dest, templateName, params);

  logMessage(condominioId, dest, templateName, result.success ? "sent" : "failed", result.messageId, result.error);

  if (!result.success) {
    console.warn(`⚠️ WhatsApp send failed [${templateName}] → ${dest}:`, result.error);
  }

  return result;
}

/**
 * Send WhatsApp to a user by user ID (looks up phone from DB).
 */
export async function sendWhatsAppToUser(
  userId: number,
  templateName: string,
  params: string[] = []
): Promise<WhatsAppResult> {
  const user = db.prepare("SELECT phone, condominio_id FROM users WHERE id = ?").get(userId) as { phone: string; condominio_id: number } | undefined;
  if (!user || !user.phone) return { success: false, error: "Usuário sem telefone cadastrado" };

  return sendWhatsApp(user.condominio_id, user.phone, templateName, params);
}

/**
 * Send WhatsApp to all portaria staff (funcionario + sindico) of a condominium.
 */
export async function sendWhatsAppToPortaria(
  condominioId: number,
  templateName: string,
  params: string[] = []
): Promise<number> {
  const cfg = getConfig(condominioId);
  if (!cfg) return 0;

  const users = db.prepare(`
    SELECT phone FROM users
    WHERE condominio_id = ? AND role IN ('funcionario', 'sindico', 'administradora') AND phone IS NOT NULL AND phone != ''
  `).all(condominioId) as { phone: string }[];

  let sent = 0;
  for (const u of users) {
    const result = await sendWhatsApp(condominioId, u.phone, templateName, params);
    if (result.success) sent++;
  }
  return sent;
}

/**
 * Send WhatsApp to all moradores of a condominium.
 */
export async function sendWhatsAppToMoradores(
  condominioId: number,
  templateName: string,
  params: string[] = []
): Promise<number> {
  const cfg = getConfig(condominioId);
  if (!cfg) return 0;

  const users = db.prepare(`
    SELECT phone FROM users
    WHERE condominio_id = ? AND role = 'morador' AND phone IS NOT NULL AND phone != ''
  `).all(condominioId) as { phone: string }[];

  let sent = 0;
  for (const u of users) {
    const result = await sendWhatsApp(condominioId, u.phone, templateName, params);
    if (result.success) sent++;
  }
  return sent;
}

/**
 * Send a free-form text WhatsApp message (only works within 24h session window).
 */
export async function sendWhatsAppText(
  condominioId: number,
  phone: string,
  text: string
): Promise<WhatsAppResult> {
  const cfg = getConfig(condominioId);
  if (!cfg) return { success: false, error: "WhatsApp não configurado para este condomínio" };

  const dest = normalizePhone(phone);
  const result = await sendTextMessage(cfg.apiKey, cfg.sourceNumber, cfg.appName, dest, text);

  logMessage(condominioId, dest, "text_message", result.success ? "sent" : "failed", result.messageId, result.error);

  return result;
}

/**
 * Test connection — sends a test template message.
 */
export async function testWhatsAppConnection(
  condominioId: number,
  testPhone: string
): Promise<WhatsAppResult> {
  // If condominioId is 0, test with global credentials directly (master test)
  let apiKey: string, sourceNumber: string, appName: string;
  if (condominioId === 0) {
    const global = getGlobalCredentials();
    if (!global) return { success: false, error: "Credenciais globais não configuradas" };
    apiKey = global.apiKey;
    sourceNumber = global.sourceNumber;
    appName = global.appName;
  } else {
    const cfg = getConfig(condominioId);
    if (!cfg) return { success: false, error: "WhatsApp não configurado" };
    apiKey = cfg.apiKey;
    sourceNumber = cfg.sourceNumber;
    appName = cfg.appName;
  }

  const dest = normalizePhone(testPhone);

  // Try sending a simple text (within session window for testing)
  const result = await sendTextMessage(apiKey, sourceNumber, appName, dest, "✅ Teste App Interfone — WhatsApp configurado com sucesso!");

  logMessage(condominioId, dest, "test_connection", result.success ? "sent" : "failed", result.messageId, result.error);

  return result;
}
