/**
 * ═══════════════════════════════════════════════════════════
 * EMAIL SERVICE — Amazon SES (Simple Email Service)
 * Centralized service for sending transactional emails.
 * ═══════════════════════════════════════════════════════════
 */

import { SESClient, SendEmailCommand, SendRawEmailCommand } from "@aws-sdk/client-ses";
import db from "./db.js";
import crypto from "crypto";

// ─── Configuration ───
const AWS_REGION = process.env.AWS_SES_REGION || "sa-east-1";
const FROM_EMAIL = process.env.SES_FROM_EMAIL || "naoresponda@appinterfone.com.br";
const FROM_NAME = process.env.SES_FROM_NAME || "App Interfone";
const APP_URL = process.env.APP_URL || "https://appinterfone.com.br";

let sesClient: SESClient | null = null;
let sesInitialized = false;

function initSES() {
  if (sesInitialized) return;

  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    console.warn("⚠️  AWS SES credentials not found. Email sending disabled.");
    console.warn("   Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env");
    sesInitialized = true;
    return;
  }

  try {
    sesClient = new SESClient({
      region: AWS_REGION,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
    sesInitialized = true;
    console.log(`  📧 Amazon SES initialized (region: ${AWS_REGION}, from: ${FROM_EMAIL})`);
  } catch (err) {
    console.error("SES init error:", err);
    sesInitialized = true;
  }
}

// Initialize on module load
initSES();

// ─── Base HTML Layout ───
function emailLayout(title: string, bodyContent: string): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:24px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);padding:24px 32px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;letter-spacing:0.5px;">
                🏢 App Interfone
              </h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:32px;">
              <h2 style="color:#1e293b;margin:0 0 16px 0;font-size:20px;">${title}</h2>
              ${bodyContent}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="color:#94a3b8;font-size:12px;margin:0;">
                Este é um email automático do sistema App Interfone.<br>
                Por favor, não responda a este email.<br>
                <a href="${APP_URL}" style="color:#3b82f6;text-decoration:none;">appinterfone.com.br</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Info row helper ───
function infoRow(label: string, value: string | null | undefined): string {
  if (!value) return "";
  return `
    <tr>
      <td style="padding:6px 12px;color:#64748b;font-size:14px;white-space:nowrap;vertical-align:top;">${label}</td>
      <td style="padding:6px 12px;color:#1e293b;font-size:14px;font-weight:500;">${value}</td>
    </tr>`;
}

function infoTable(rows: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">${rows}</table>`;
}

function actionButton(text: string, url: string, color: string = "#3b82f6"): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr>
        <td align="center">
          <a href="${url}" style="display:inline-block;background-color:${color};color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">
            ${text}
          </a>
        </td>
      </tr>
    </table>`;
}

function alertBox(text: string, type: "info" | "warning" | "success" | "danger" = "info"): string {
  const colors = {
    info: { bg: "#eff6ff", border: "#3b82f6", text: "#1e40af" },
    warning: { bg: "#fffbeb", border: "#f59e0b", text: "#92400e" },
    success: { bg: "#f0fdf4", border: "#22c55e", text: "#166534" },
    danger: { bg: "#fef2f2", border: "#ef4444", text: "#991b1b" },
  };
  const c = colors[type];
  return `<div style="background:${c.bg};border-left:4px solid ${c.border};padding:12px 16px;border-radius:4px;margin:16px 0;color:${c.text};font-size:14px;">${text}</div>`;
}

// ─── Core send function (with anti-spam headers) ───
async function sendEmail(to: string | string[], subject: string, htmlBody: string): Promise<boolean> {
  if (!sesClient) return false;

  const toAddresses = Array.isArray(to) ? to : [to];

  // Filter out invalid emails
  const validEmails = toAddresses.filter((e) => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  if (validEmails.length === 0) return false;

  // Generate unique Message-ID for deliverability
  const messageId = `${crypto.randomUUID()}@appinterfone.com.br`;

  // Build raw email with anti-spam headers
  const boundary = `----=_Part_${crypto.randomUUID().replace(/-/g, "")}`;
  const rawEmail = [
    `From: ${FROM_NAME} <${FROM_EMAIL}>`,
    `To: ${validEmails.join(", ")}`,
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
    Buffer.from(htmlToPlainText(subject, htmlBody)).toString("base64"),
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    Buffer.from(htmlBody).toString("base64"),
    ``,
    `--${boundary}--`,
  ].join("\r\n");

  try {
    await sesClient.send(
      new SendRawEmailCommand({
        Source: `${FROM_NAME} <${FROM_EMAIL}>`,
        Destinations: validEmails,
        RawMessage: { Data: new TextEncoder().encode(rawEmail) },
      })
    );
    return true;
  } catch (err: any) {
    console.error(`[EMAIL] Erro ao enviar para ${validEmails.join(", ")}:`, err.message || err);
    return false;
  }
}

// ─── Convert HTML email to plain text (needed for multipart/alternative) ───
function htmlToPlainText(subject: string, html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<a[^>]*href="([^"]*)"[^>]*>[^<]*<\/a>/gi, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── Helper: get morador email by id ───
function getMoradorEmail(moradorId: number): string | null {
  const user = db.prepare("SELECT email FROM users WHERE id = ?").get(moradorId) as { email: string } | undefined;
  return user?.email || null;
}

// ─── Helper: get morador email by bloco/apartamento ───
function getMoradorEmailByUnit(condominioId: number, bloco: string, apartamento: string): string | null {
  const user = db.prepare(
    "SELECT email FROM users WHERE condominio_id = ? AND block = ? AND unit = ? AND role = 'morador' LIMIT 1"
  ).get(condominioId, bloco, apartamento) as { email: string } | undefined;
  return user?.email || null;
}

// ─── Helper: get sindico email for condominio ───
function getSindicoEmail(condominioId: number): string | null {
  const user = db.prepare(
    "SELECT email FROM users WHERE condominio_id = ? AND role = 'sindico' LIMIT 1"
  ).get(condominioId) as { email: string } | undefined;
  return user?.email || null;
}

// ─── Helper: get all morador emails for condominio ───
function getAllMoradorEmails(condominioId: number): string[] {
  const users = db.prepare(
    "SELECT email FROM users WHERE condominio_id = ? AND role = 'morador'"
  ).all(condominioId) as { email: string }[];
  return users.map((u) => u.email).filter(Boolean);
}

// ─── Helper: get condominio name ───
function getCondominioName(condominioId: number): string {
  const condo = db.prepare("SELECT name FROM condominios WHERE id = ?").get(condominioId) as { name: string } | undefined;
  return condo?.name || "Condomínio";
}

// ═══════════════════════════════════════════════════════════
// EMAIL FUNCTIONS — By Module
// ═══════════════════════════════════════════════════════════

// ──────────────────────────────────────────
// 1. CORRESPONDÊNCIAS
// ──────────────────────────────────────────

/** Notify morador: package/mail arrived */
export async function emailCorrespondenciaChegou(data: {
  condominioId: number;
  moradorId?: number;
  moradorName: string;
  bloco: string;
  apartamento: string;
  protocolo: string;
  tipo: string;
  remetente?: string;
  descricao?: string;
}): Promise<void> {
  const email = data.moradorId
    ? getMoradorEmail(data.moradorId)
    : getMoradorEmailByUnit(data.condominioId, data.bloco, data.apartamento);
  if (!email) return;

  const condo = getCondominioName(data.condominioId);
  const tipoLabel = data.tipo === "carta" ? "📬 Carta" : data.tipo === "encomenda" ? "📦 Encomenda" : `📮 ${data.tipo}`;

  const body = `
    <p style="color:#475569;font-size:15px;">Olá <strong>${data.moradorName}</strong>,</p>
    <p style="color:#475569;font-size:15px;">Uma nova correspondência foi registrada na portaria do <strong>${condo}</strong>.</p>
    ${infoTable(
      infoRow("Tipo", tipoLabel) +
      infoRow("Protocolo", data.protocolo) +
      infoRow("Bloco/Apto", `${data.bloco} - ${data.apartamento}`) +
      infoRow("Remetente", data.remetente) +
      infoRow("Descrição", data.descricao)
    )}
    ${alertBox("Por favor, retire sua correspondência na portaria o mais breve possível.", "info")}
    ${actionButton("Abrir App Interfone", APP_URL)}
  `;

  await sendEmail(email, `📦 Correspondência chegou — ${condo}`, emailLayout("Nova Correspondência", body));
}

/** Remind morador: uncollected package */
export async function emailCorrespondenciaNaoRetirada(data: {
  condominioId: number;
  moradorId?: number;
  moradorName: string;
  bloco: string;
  apartamento: string;
  protocolo: string;
  tipo: string;
  diasPendente: number;
}): Promise<void> {
  const email = data.moradorId
    ? getMoradorEmail(data.moradorId)
    : getMoradorEmailByUnit(data.condominioId, data.bloco, data.apartamento);
  if (!email) return;

  const condo = getCondominioName(data.condominioId);

  const body = `
    <p style="color:#475569;font-size:15px;">Olá <strong>${data.moradorName}</strong>,</p>
    <p style="color:#475569;font-size:15px;">Você tem uma correspondência na portaria há <strong>${data.diasPendente} dia(s)</strong> aguardando retirada.</p>
    ${infoTable(
      infoRow("Protocolo", data.protocolo) +
      infoRow("Tipo", data.tipo) +
      infoRow("Bloco/Apto", `${data.bloco} - ${data.apartamento}`) +
      infoRow("Dias pendente", `${data.diasPendente} dia(s)`)
    )}
    ${alertBox("⚠️ Por favor, retire sua correspondência na portaria.", "warning")}
    ${actionButton("Abrir App Interfone", APP_URL)}
  `;

  await sendEmail(email, `⚠️ Correspondência pendente há ${data.diasPendente} dias — ${condo}`, emailLayout("Correspondência Pendente", body));
}

// ──────────────────────────────────────────
// 2. VISITANTES
// ──────────────────────────────────────────

/** Notify morador: visitor waiting for authorization */
export async function emailVisitantePendente(data: {
  condominioId: number;
  bloco: string;
  apartamento: string;
  visitanteNome: string;
  visitanteDocumento?: string;
  token: string;
}): Promise<void> {
  const email = getMoradorEmailByUnit(data.condominioId, data.bloco, data.apartamento);
  if (!email) return;

  const condo = getCondominioName(data.condominioId);

  const body = `
    <p style="color:#475569;font-size:15px;">Há um visitante na portaria do <strong>${condo}</strong> aguardando sua autorização.</p>
    ${infoTable(
      infoRow("Visitante", data.visitanteNome) +
      infoRow("Documento", data.visitanteDocumento) +
      infoRow("Destino", `Bloco ${data.bloco} - Apto ${data.apartamento}`)
    )}
    ${actionButton("✅ Autorizar / ❌ Recusar", `${APP_URL}/autorizar-visitante/${data.token}`, "#16a34a")}
    ${alertBox("Clique no botão acima para autorizar ou recusar a entrada do visitante.", "info")}
  `;

  await sendEmail(email, `👤 Visitante aguardando autorização — ${condo}`, emailLayout("Visitante na Portaria", body));
}

/** Notify morador: visitor authorized/rejected */
export async function emailVisitanteRespondido(data: {
  condominioId: number;
  bloco: string;
  apartamento: string;
  visitanteNome: string;
  status: "liberado" | "recusado";
}): Promise<void> {
  const email = getMoradorEmailByUnit(data.condominioId, data.bloco, data.apartamento);
  if (!email) return;

  const condo = getCondominioName(data.condominioId);
  const isApproved = data.status === "liberado";

  const body = `
    <p style="color:#475569;font-size:15px;">O visitante <strong>${data.visitanteNome}</strong> foi <strong>${isApproved ? "autorizado" : "recusado"}</strong>.</p>
    ${alertBox(
      isApproved
        ? "✅ O visitante foi liberado para entrar no condomínio."
        : "❌ A entrada do visitante foi negada.",
      isApproved ? "success" : "danger"
    )}
  `;

  const emoji = isApproved ? "✅" : "❌";
  await sendEmail(email, `${emoji} Visitante ${data.status} — ${condo}`, emailLayout("Status do Visitante", body));
}

// ──────────────────────────────────────────
// 3. DELIVERIES (Entregas iFood, etc.)
// ──────────────────────────────────────────

/** Notify morador: delivery received at portaria */
export async function emailDeliveryRecebido(data: {
  condominioId: number;
  moradorId: number;
  moradorName: string;
  servico: string;
  numeroPedido?: string;
  bloco: string;
  apartamento: string;
}): Promise<void> {
  const email = getMoradorEmail(data.moradorId);
  if (!email) return;

  const condo = getCondominioName(data.condominioId);

  const body = `
    <p style="color:#475569;font-size:15px;">Olá <strong>${data.moradorName}</strong>,</p>
    <p style="color:#475569;font-size:15px;">Seu delivery foi recebido na portaria do <strong>${condo}</strong>!</p>
    ${infoTable(
      infoRow("Serviço", data.servico) +
      infoRow("Pedido", data.numeroPedido) +
      infoRow("Bloco/Apto", `${data.bloco} - ${data.apartamento}`)
    )}
    ${alertBox("🛵 Seu pedido está na portaria aguardando retirada!", "success")}
    ${actionButton("Abrir App Interfone", APP_URL)}
  `;

  await sendEmail(email, `🛵 Delivery recebido na portaria — ${condo}`, emailLayout("Delivery Recebido", body));
}

// ──────────────────────────────────────────
// 4. VEÍCULOS
// ──────────────────────────────────────────

/** Notify morador: vehicle needs approval (registered by porteiro) */
export async function emailVeiculoPendenteAprovacao(data: {
  condominioId: number;
  moradorId?: number;
  bloco: string;
  apartamento: string;
  placa: string;
  modelo?: string;
  cor?: string;
  motoristaNome?: string;
  token: string;
}): Promise<void> {
  const email = data.moradorId
    ? getMoradorEmail(data.moradorId)
    : getMoradorEmailByUnit(data.condominioId, data.bloco, data.apartamento);
  if (!email) return;

  const condo = getCondominioName(data.condominioId);

  const body = `
    <p style="color:#475569;font-size:15px;">A portaria do <strong>${condo}</strong> registrou um veículo que precisa da sua aprovação.</p>
    ${infoTable(
      infoRow("Placa", data.placa) +
      infoRow("Modelo", data.modelo) +
      infoRow("Cor", data.cor) +
      infoRow("Motorista", data.motoristaNome) +
      infoRow("Destino", `Bloco ${data.bloco} - Apto ${data.apartamento}`)
    )}
    ${actionButton("✅ Aprovar / ❌ Negar", `${APP_URL}/aprovar-veiculo/${data.token}`, "#16a34a")}
  `;

  await sendEmail(email, `🚗 Veículo aguardando aprovação — ${condo}`, emailLayout("Veículo na Portaria", body));
}

/** Notify morador: vehicle approved/denied */
export async function emailVeiculoRespondido(data: {
  condominioId: number;
  moradorId?: number;
  bloco: string;
  apartamento: string;
  placa: string;
  status: "ativa" | "negada";
}): Promise<void> {
  const email = data.moradorId
    ? getMoradorEmail(data.moradorId)
    : getMoradorEmailByUnit(data.condominioId, data.bloco, data.apartamento);
  if (!email) return;

  const condo = getCondominioName(data.condominioId);
  const isApproved = data.status === "ativa";

  const body = `
    <p style="color:#475569;font-size:15px;">O veículo de placa <strong>${data.placa}</strong> foi <strong>${isApproved ? "aprovado" : "negado"}</strong>.</p>
    ${alertBox(
      isApproved
        ? "✅ O veículo foi autorizado a entrar no condomínio."
        : "❌ A entrada do veículo foi negada.",
      isApproved ? "success" : "danger"
    )}
  `;

  const emoji = isApproved ? "✅" : "❌";
  await sendEmail(email, `${emoji} Veículo ${isApproved ? "aprovado" : "negado"} — ${condo}`, emailLayout("Status do Veículo", body));
}

/** Notify morador: vehicle authorization was closed/cancelled */
export async function emailVeiculoEncerrado(data: {
  condominioId: number;
  moradorId?: number;
  bloco: string;
  apartamento: string;
  placa: string;
  motivo?: string;
}): Promise<void> {
  const email = data.moradorId
    ? getMoradorEmail(data.moradorId)
    : getMoradorEmailByUnit(data.condominioId, data.bloco, data.apartamento);
  if (!email) return;

  const condo = getCondominioName(data.condominioId);
  const motivo = data.motivo || "encerrada pela portaria";

  const body = `
    <p style="color:#475569;font-size:15px;">A autorização do veículo de placa <strong>${data.placa}</strong> para o <strong>Bloco ${data.bloco} - Apto ${data.apartamento}</strong> foi <strong>${motivo}</strong>.</p>
    ${alertBox("⚠️ Se precisar, refaça sua liberação pelo aplicativo.", "warning")}
    ${infoTable(
      infoRow("Placa", data.placa) +
      infoRow("Destino", `Bloco ${data.bloco} - Apto ${data.apartamento}`) +
      infoRow("Motivo", motivo)
    )}
    ${actionButton("Acessar App Interfone", APP_URL, "#3b82f6")}
  `;

  await sendEmail(email, `⚠️ Liberação de veículo encerrada — ${condo}`, emailLayout("Liberação de Veículo Encerrada", body));
}

// ──────────────────────────────────────────
// 5. AUTH — Boas-vindas
// ──────────────────────────────────────────

/** Welcome email on morador registration */
export async function emailBoasVindasMorador(data: {
  email: string;
  nome: string;
  condominioNome: string;
  bloco?: string;
  apartamento?: string;
}): Promise<void> {
  const body = `
    <p style="color:#475569;font-size:15px;">Olá <strong>${data.nome}</strong>,</p>
    <p style="color:#475569;font-size:15px;">Bem-vindo(a) ao <strong>App Interfone</strong>! Sua conta foi criada com sucesso no condomínio <strong>${data.condominioNome}</strong>.</p>
    ${infoTable(
      infoRow("Condomínio", data.condominioNome) +
      infoRow("Bloco", data.bloco) +
      infoRow("Apartamento", data.apartamento)
    )}
    <p style="color:#475569;font-size:15px;">Com o App Interfone você pode:</p>
    <ul style="color:#475569;font-size:14px;line-height:1.8;">
      <li>📦 Receber notificações de correspondências</li>
      <li>👤 Autorizar visitantes remotamente</li>
      <li>🛵 Gerenciar entregas de delivery</li>
      <li>🚗 Autorizar veículos</li>
      <li>📞 Usar o interfone digital</li>
    </ul>
    ${actionButton("Acessar App Interfone", APP_URL)}
  `;

  await sendEmail(data.email, `🏢 Bem-vindo ao App Interfone — ${data.condominioNome}`, emailLayout("Bem-vindo!", body));
}

/** Welcome email on condominio/sindico registration */
export async function emailBoasVindasSindico(data: {
  email: string;
  nome: string;
  condominioNome: string;
}): Promise<void> {
  const body = `
    <p style="color:#475569;font-size:15px;">Olá <strong>${data.nome}</strong>,</p>
    <p style="color:#475569;font-size:15px;">O condomínio <strong>${data.condominioNome}</strong> foi cadastrado com sucesso no <strong>App Interfone</strong>!</p>
    <p style="color:#475569;font-size:15px;">Como síndico, você tem acesso a:</p>
    <ul style="color:#475569;font-size:14px;line-height:1.8;">
      <li>👥 Cadastro de moradores e funcionários</li>
      <li>🏗️ Gestão de blocos e apartamentos</li>
      <li>📹 Configuração de câmeras</li>
      <li>🔄 Controle de rondas</li>
      <li>📞 Interfone digital</li>
      <li>📊 Relatórios e métricas</li>
    </ul>
    ${actionButton("Acessar Painel do Síndico", APP_URL)}
    ${alertBox("Comece cadastrando seus blocos e moradores para ativar todas as funcionalidades.", "info")}
  `;

  await sendEmail(data.email, `🏢 Condomínio cadastrado — ${data.condominioNome}`, emailLayout("Condomínio Cadastrado!", body));
}

// ──────────────────────────────────────────
// 6. PRÉ-AUTORIZAÇÕES
// ──────────────────────────────────────────

/** Notify morador: pre-authorized visitor arrived (entry confirmed) */
export async function emailPreAuthEntradaConfirmada(data: {
  condominioId: number;
  moradorId: number;
  moradorName: string;
  visitanteNome: string;
  bloco: string;
  apartamento: string;
}): Promise<void> {
  const email = getMoradorEmail(data.moradorId);
  if (!email) return;

  const condo = getCondominioName(data.condominioId);

  const body = `
    <p style="color:#475569;font-size:15px;">Olá <strong>${data.moradorName}</strong>,</p>
    <p style="color:#475569;font-size:15px;">Seu visitante pré-autorizado chegou ao <strong>${condo}</strong>.</p>
    ${infoTable(
      infoRow("Visitante", data.visitanteNome) +
      infoRow("Destino", `Bloco ${data.bloco} - Apto ${data.apartamento}`) +
      infoRow("Horário", new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }))
    )}
    ${alertBox("✅ A entrada foi confirmada pela portaria.", "success")}
  `;

  await sendEmail(email, `✅ Visitante pré-autorizado chegou — ${condo}`, emailLayout("Visitante Chegou", body));
}

/** Notify morador: visitor completed self-registration */
export async function emailPreAuthAutoCadastro(data: {
  condominioId: number;
  moradorId: number;
  moradorName: string;
  visitanteNome: string;
  bloco: string;
  apartamento: string;
}): Promise<void> {
  const email = getMoradorEmail(data.moradorId);
  if (!email) return;

  const condo = getCondominioName(data.condominioId);

  const body = `
    <p style="color:#475569;font-size:15px;">Olá <strong>${data.moradorName}</strong>,</p>
    <p style="color:#475569;font-size:15px;">O visitante <strong>${data.visitanteNome}</strong> completou o auto-cadastro da pré-autorização no <strong>${condo}</strong>.</p>
    ${infoTable(
      infoRow("Visitante", data.visitanteNome) +
      infoRow("Destino", `Bloco ${data.bloco} - Apto ${data.apartamento}`)
    )}
    ${alertBox("O visitante preencheu seus dados e estará pronto para entrada quando chegar.", "info")}
    ${actionButton("Ver Autorizações", APP_URL)}
  `;

  await sendEmail(email, `📋 Visitante completou auto-cadastro — ${condo}`, emailLayout("Auto-Cadastro Completo", body));
}

// ──────────────────────────────────────────
// 7. INTERFONE — Chamada perdida
// ──────────────────────────────────────────

/** Notify morador: missed intercom call */
export async function emailChamadaPerdida(data: {
  condominioId: number;
  moradorId: number;
  moradorName: string;
  visitorName: string;
  bloco: string;
  apartamento: string;
  horario: string;
}): Promise<void> {
  const email = getMoradorEmail(data.moradorId);
  if (!email) return;

  const condo = getCondominioName(data.condominioId);

  const body = `
    <p style="color:#475569;font-size:15px;">Olá <strong>${data.moradorName}</strong>,</p>
    <p style="color:#475569;font-size:15px;">Você recebeu uma chamada no interfone digital do <strong>${condo}</strong>, mas não foi atendida.</p>
    ${infoTable(
      infoRow("Visitante", data.visitorName) +
      infoRow("Destino", `Bloco ${data.bloco} - Apto ${data.apartamento}`) +
      infoRow("Horário", data.horario)
    )}
    ${alertBox("📞 Chamada não atendida. Verifique se precisa retornar contato.", "warning")}
    ${actionButton("Abrir App Interfone", APP_URL)}
  `;

  await sendEmail(email, `📞 Chamada perdida no interfone — ${condo}`, emailLayout("Chamada Perdida", body));
}

// ──────────────────────────────────────────
// 8. RONDAS
// ──────────────────────────────────────────

/** Notify sindico: round was missed */
export async function emailRondaNaoRealizada(data: {
  condominioId: number;
  agendaNome: string;
  horarioPrevisto: string;
  checkpointsFaltando: string[];
}): Promise<void> {
  const email = getSindicoEmail(data.condominioId);
  if (!email) return;

  const condo = getCondominioName(data.condominioId);
  const checkpoints = data.checkpointsFaltando.map((c) => `<li>${c}</li>`).join("");

  const body = `
    <p style="color:#475569;font-size:15px;">Uma ronda programada não foi realizada no <strong>${condo}</strong>.</p>
    ${infoTable(
      infoRow("Agenda", data.agendaNome) +
      infoRow("Horário previsto", data.horarioPrevisto)
    )}
    <p style="color:#475569;font-size:14px;"><strong>Checkpoints não visitados:</strong></p>
    <ul style="color:#ef4444;font-size:14px;">${checkpoints}</ul>
    ${alertBox("⚠️ Verifique o motivo da ronda não ter sido realizada.", "danger")}
    ${actionButton("Ver Painel de Rondas", APP_URL)}
  `;

  await sendEmail(email, `⚠️ Ronda não realizada — ${condo}`, emailLayout("Alerta de Ronda", body));
}

/** Send sindico: daily/weekly round report */
export async function emailRelatorioRondas(data: {
  condominioId: number;
  periodo: string;
  totalRondas: number;
  rondasCompletas: number;
  rondasIncompletas: number;
  rondasPerdidas: number;
}): Promise<void> {
  const email = getSindicoEmail(data.condominioId);
  if (!email) return;

  const condo = getCondominioName(data.condominioId);
  const taxa = data.totalRondas > 0 ? Math.round((data.rondasCompletas / data.totalRondas) * 100) : 0;

  const body = `
    <p style="color:#475569;font-size:15px;">Relatório de rondas do <strong>${condo}</strong>.</p>
    ${infoTable(
      infoRow("Período", data.periodo) +
      infoRow("Total de rondas", String(data.totalRondas)) +
      infoRow("✅ Completas", String(data.rondasCompletas)) +
      infoRow("⚠️ Incompletas", String(data.rondasIncompletas)) +
      infoRow("❌ Perdidas", String(data.rondasPerdidas)) +
      infoRow("Taxa de cumprimento", `${taxa}%`)
    )}
    ${actionButton("Ver Detalhes", APP_URL)}
  `;

  await sendEmail(email, `📊 Relatório de Rondas — ${condo} (${data.periodo})`, emailLayout("Relatório de Rondas", body));
}

// ──────────────────────────────────────────
// 9. MASTER — Condomínio bloqueado
// ──────────────────────────────────────────

/** Notify sindico: condominium blocked */
export async function emailCondominioBloqueado(data: {
  condominioId: number;
  condominioNome: string;
  motivo: string;
}): Promise<void> {
  const email = getSindicoEmail(data.condominioId);
  if (!email) return;

  const body = `
    <p style="color:#475569;font-size:15px;">O condomínio <strong>${data.condominioNome}</strong> foi <strong style="color:#ef4444;">bloqueado</strong> no sistema App Interfone.</p>
    ${infoTable(
      infoRow("Condomínio", data.condominioNome) +
      infoRow("Motivo", data.motivo)
    )}
    ${alertBox("🚫 O acesso ao sistema está temporariamente suspenso. Entre em contato com o suporte para regularizar a situação.", "danger")}
  `;

  await sendEmail(email, `🚫 Condomínio bloqueado — ${data.condominioNome}`, emailLayout("Condomínio Bloqueado", body));
}

/** Notify sindico: condominium unblocked */
export async function emailCondominioDesbloqueado(data: {
  condominioId: number;
  condominioNome: string;
}): Promise<void> {
  const email = getSindicoEmail(data.condominioId);
  if (!email) return;

  const body = `
    <p style="color:#475569;font-size:15px;">O condomínio <strong>${data.condominioNome}</strong> foi <strong style="color:#22c55e;">desbloqueado</strong> no sistema App Interfone.</p>
    ${alertBox("✅ O acesso ao sistema foi restabelecido. Todas as funcionalidades estão disponíveis.", "success")}
    ${actionButton("Acessar App Interfone", APP_URL)}
  `;

  await sendEmail(email, `✅ Condomínio desbloqueado — ${data.condominioNome}`, emailLayout("Condomínio Desbloqueado", body));
}

// ──────────────────────────────────────────
// 10. MORADORES — Conta criada pelo admin
// ──────────────────────────────────────────

/** Notify morador: account created by sindico */
export async function emailContaCriada(data: {
  email: string;
  nome: string;
  condominioNome: string;
  bloco?: string;
  apartamento?: string;
  senhaProvisoria?: string;
}): Promise<void> {
  const body = `
    <p style="color:#475569;font-size:15px;">Olá <strong>${data.nome}</strong>,</p>
    <p style="color:#475569;font-size:15px;">Uma conta foi criada para você no sistema <strong>App Interfone</strong> do condomínio <strong>${data.condominioNome}</strong>.</p>
    ${infoTable(
      infoRow("Condomínio", data.condominioNome) +
      infoRow("Bloco", data.bloco) +
      infoRow("Apartamento", data.apartamento) +
      infoRow("Email de acesso", data.email) +
      (data.senhaProvisoria ? infoRow("Senha provisória", data.senhaProvisoria) : "")
    )}
    ${data.senhaProvisoria ? alertBox("⚠️ Recomendamos alterar sua senha no primeiro acesso.", "warning") : ""}
    ${actionButton("Acessar App Interfone", APP_URL)}
  `;

  await sendEmail(data.email, `🏢 Sua conta no App Interfone — ${data.condominioNome}`, emailLayout("Conta Criada", body));
}

// ──────────────────────────────────────────
// 11. CÂMERAS — Offline alert
// ──────────────────────────────────────────

/** Notify sindico: camera went offline */
export async function emailCameraOffline(data: {
  condominioId: number;
  cameraNome: string;
  cameraSetor: string;
}): Promise<void> {
  const email = getSindicoEmail(data.condominioId);
  if (!email) return;

  const condo = getCondominioName(data.condominioId);

  const body = `
    <p style="color:#475569;font-size:15px;">Uma câmera do <strong>${condo}</strong> está <strong style="color:#ef4444;">offline</strong>.</p>
    ${infoTable(
      infoRow("Câmera", data.cameraNome) +
      infoRow("Setor", data.cameraSetor) +
      infoRow("Horário", new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }))
    )}
    ${alertBox("📹 Verifique a conexão e o estado da câmera.", "danger")}
    ${actionButton("Ver Câmeras", APP_URL)}
  `;

  await sendEmail(email, `📹 Câmera offline — ${condo}`, emailLayout("Câmera Offline", body));
}

// ──────────────────────────────────────────
// 12. AUTH — Troca de senha
// ──────────────────────────────────────────

/** Notify user: password changed */
export async function emailSenhaAlterada(data: {
  email: string;
  nome: string;
}): Promise<void> {
  const body = `
    <p style="color:#475569;font-size:15px;">Olá <strong>${data.nome}</strong>,</p>
    <p style="color:#475569;font-size:15px;">Sua senha no <strong>App Interfone</strong> foi alterada com sucesso.</p>
    ${alertBox("Se você não realizou esta alteração, entre em contato imediatamente com o suporte.", "warning")}
  `;

  await sendEmail(data.email, `🔒 Senha alterada — App Interfone`, emailLayout("Senha Alterada", body));
}

// ──────────────────────────────────────────
// Export utility for direct use
// ──────────────────────────────────────────
export { sendEmail, emailLayout, getMoradorEmail, getSindicoEmail, getCondominioName };
