/**
 * ═══════════════════════════════════════════════════════════
 * TEST ROUTES — Push Notification & Email Testing
 * Development-only endpoints for testing notifications.
 * ═══════════════════════════════════════════════════════════
 */

import { Router, Request, Response } from "express";
import { authenticate, authorize } from "./middleware.js";
import { sendPushToUser, firebaseInitialized } from "./pushService.js";
import db from "./db.js";

const router = Router();

// ────────────────────────────────────────────────────────────
// GET /api/test/status — Check push & email service status
// ────────────────────────────────────────────────────────────
router.get("/status", authenticate, (_req: Request, res: Response) => {
  const hasSES = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

  res.json({
    push: {
      enabled: firebaseInitialized,
      provider: "Firebase Cloud Messaging (FCM)",
    },
    email: {
      enabled: hasSES,
      provider: "Amazon SES",
      region: process.env.AWS_SES_REGION || "sa-east-1",
      from: process.env.SES_FROM_EMAIL || "naoresponda@appinterfone.com.br",
    },
  });
});

// ────────────────────────────────────────────────────────────
// POST /api/test/push — Send a test push notification to self
// ────────────────────────────────────────────────────────────
router.post("/push", authenticate, async (req: Request, res: Response) => {
  try {
    const user = req.user!;

    if (!firebaseInitialized) {
      res.status(503).json({
        error: "Firebase não está inicializado. Verifique o firebase-service-account.json.",
      });
      return;
    }

    // Check if user has registered device tokens
    const tokens = db.prepare(
      "SELECT token, platform, device_info, updated_at FROM device_tokens WHERE user_id = ? AND active = 1"
    ).all(user.id) as { token: string; platform: string; device_info: string; updated_at: string }[];

    if (tokens.length === 0) {
      res.status(400).json({
        error: "Nenhum device token registrado para este usuário.",
        hint: "Faça login no app mobile (Android/Capacitor) para registrar o token.",
        tokens: [],
      });
      return;
    }

    const title = req.body.title || "🔔 Teste Push — App Interfone";
    const body = req.body.body || `Notificação de teste enviada às ${new Date().toLocaleTimeString("pt-BR")}`;

    const sent = await sendPushToUser(user.id, {
      title,
      body,
      data: { type: "test", timestamp: new Date().toISOString() },
    });

    res.json({
      success: sent > 0,
      sent,
      totalTokens: tokens.length,
      tokens: tokens.map((t) => ({
        platform: t.platform,
        tokenPreview: t.token.slice(0, 20) + "...",
        updatedAt: t.updated_at,
      })),
    });
  } catch (err: any) {
    console.error("Test push error:", err);
    res.status(500).json({ error: "Erro ao enviar push de teste.", details: err.message });
  }
});

// ────────────────────────────────────────────────────────────
// POST /api/test/email — Send a test email
// ────────────────────────────────────────────────────────────
router.post("/email", authenticate, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const targetEmail = req.body.email || user.email;

    if (!targetEmail) {
      res.status(400).json({ error: "Email de destino não fornecido." });
      return;
    }

    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      res.status(503).json({
        error: "AWS SES não configurado.",
        hint: "Configure AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY no .env",
      });
      return;
    }

    const { SESClient, SendRawEmailCommand } = await import("@aws-sdk/client-ses");
    const crypto = await import("crypto");

    const sesClient = new SESClient({
      region: process.env.AWS_SES_REGION || "sa-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    const fromEmail = process.env.SES_FROM_EMAIL || "naoresponda@appinterfone.com.br";
    const fromName = process.env.SES_FROM_NAME || "App Interfone";
    const subject = req.body.subject || "Teste de Email - App Interfone";
    const timestamp = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    const htmlBody = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);padding:24px 32px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:24px;">App Interfone</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="color:#1e293b;margin:0 0 16px;">Email de Teste</h2>
          <p style="color:#475569;font-size:15px;">Este e um email de teste do sistema <strong>App Interfone</strong>.</p>
          <div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:12px 16px;border-radius:4px;margin:16px 0;color:#166534;font-size:14px;">
            Se voce esta vendo este email, o servico de envio esta funcionando corretamente.
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
            <tr>
              <td style="padding:6px 12px;color:#64748b;font-size:14px;">Enviado em</td>
              <td style="padding:6px 12px;color:#1e293b;font-size:14px;font-weight:500;">${timestamp}</td>
            </tr>
            <tr>
              <td style="padding:6px 12px;color:#64748b;font-size:14px;">Destinatario</td>
              <td style="padding:6px 12px;color:#1e293b;font-size:14px;font-weight:500;">${targetEmail}</td>
            </tr>
            <tr>
              <td style="padding:6px 12px;color:#64748b;font-size:14px;">Remetente</td>
              <td style="padding:6px 12px;color:#1e293b;font-size:14px;font-weight:500;">${fromName} &lt;${fromEmail}&gt;</td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="background-color:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="color:#94a3b8;font-size:12px;margin:0;">App Interfone - Sistema de gestao condominial</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const plainText = `App Interfone - Email de Teste\n\nEste e um email de teste do sistema App Interfone.\nSe voce esta vendo este email, o servico de envio esta funcionando corretamente.\n\nEnviado em: ${timestamp}\nDestinatario: ${targetEmail}\nRemetente: ${fromName} <${fromEmail}>`;

    const messageId = `${crypto.randomUUID()}@appinterfone.com.br`;
    const boundary = `----=_Part_${crypto.randomUUID().replace(/-/g, "")}`;
    const rawEmail = [
      `From: ${fromName} <${fromEmail}>`,
      `To: ${targetEmail}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
      `Message-ID: <${messageId}>`,
      `Date: ${new Date().toUTCString()}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      `X-Mailer: AppInterfone/1.0`,
      `X-Priority: 3`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
      ``,
      Buffer.from(plainText).toString("base64"),
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
      ``,
      Buffer.from(htmlBody).toString("base64"),
      ``,
      `--${boundary}--`,
    ].join("\r\n");

    await sesClient.send(
      new SendRawEmailCommand({
        Source: `${fromName} <${fromEmail}>`,
        Destinations: [targetEmail],
        RawMessage: { Data: new TextEncoder().encode(rawEmail) },
      })
    );

    res.json({
      success: true,
      message: `Email de teste enviado para ${targetEmail}`,
      to: targetEmail,
      from: `${fromName} <${fromEmail}>`,
      region: process.env.AWS_SES_REGION || "sa-east-1",
    });
  } catch (err: any) {
    console.error("Test email error:", err);
    res.status(500).json({
      error: "Erro ao enviar email de teste.",
      details: err.message,
      code: err.Code || err.name,
    });
  }
});

// ────────────────────────────────────────────────────────────
// GET /api/test/tokens — List registered device tokens for current user
// ────────────────────────────────────────────────────────────
router.get("/tokens", authenticate, (req: Request, res: Response) => {
  const user = req.user!;
  const tokens = db.prepare(
    "SELECT id, token, platform, device_info, active, created_at, updated_at FROM device_tokens WHERE user_id = ?"
  ).all(user.id) as any[];

  res.json({
    userId: user.id,
    userName: user.name,
    totalTokens: tokens.length,
    activeTokens: tokens.filter((t: any) => t.active).length,
    tokens: tokens.map((t: any) => ({
      id: t.id,
      tokenPreview: t.token.slice(0, 25) + "...",
      platform: t.platform,
      deviceInfo: t.device_info,
      active: !!t.active,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    })),
  });
});

export default router;
