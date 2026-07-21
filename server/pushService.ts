/**
 * ═══════════════════════════════════════════════════════════
 * PUSH NOTIFICATION SERVICE — Firebase Cloud Messaging (FCM)
 * Centralized service for sending push notifications.
 * ═══════════════════════════════════════════════════════════
 */

import admin from "firebase-admin";
import webpush from "web-push";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import db from "./db.js";
import { log } from "./logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Initialize Firebase Admin SDK ───
let firebaseInitialized = false;

function initFirebase() {
  if (firebaseInitialized) return;

  // 0) Conta de serviço inline via env (recomendado em Coolify/PaaS — dispensa arquivo/volume)
  const inlineJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (inlineJson && inlineJson.trim().startsWith("{")) {
    try {
      admin.initializeApp({ credential: admin.credential.cert(JSON.parse(inlineJson)) });
      firebaseInitialized = true;
      console.log("  🔔 Firebase Admin SDK initialized (env JSON, push ready)");
      return;
    } catch (err) {
      log.error("Firebase init error (env JSON):", err);
    }
  }

  // Procura nesta ordem:
  //   1) FIREBASE_SERVICE_ACCOUNT_PATH (env, recomendado em Docker)
  //   2) ./server/firebase-service-account.json (dev local)
  //   3) ./firebase-service-account.json (mesmo diretório do bundle)
  const candidates = [
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
    path.join(__dirname, "..", "server", "firebase-service-account.json"),
    path.join(__dirname, "firebase-service-account.json"),
  ].filter((p): p is string => typeof p === "string" && p.length > 0);

  const credentialPath = candidates.find(p => fs.existsSync(p));
  if (!credentialPath) {
    log.warn("⚠️  Firebase service account não encontrado. Push notifications desativado.");
    return;
  }

  try {
    const serviceAccount = JSON.parse(fs.readFileSync(credentialPath, "utf-8"));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    firebaseInitialized = true;
    console.log("  🔔 Firebase Admin SDK initialized (push ready)");
  } catch (err) {
    log.error("Firebase init error:", err);
  }
}

// Initialize on module load
initFirebase();

// ─── Initialize Web Push (VAPID) ───
let webPushInitialized = false;

function initWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:contato@appinterfone.com.br";

  if (!publicKey || !privateKey) {
    log.warn("⚠️  VAPID keys not set. Web Push notifications disabled.");
    return;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    webPushInitialized = true;
    console.log("  🌐 Web Push (VAPID) initialized");
  } catch (err) {
    log.error("Web Push init error:", err);
  }
}

initWebPush();

// ─── Types ───
interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  /** Android channel ID */
  channelId?: string;
  /** Sound file name */
  sound?: string;
  /**
   * Quando true, o push do Android é enviado DATA-ONLY (sem bloco notification),
   * para que o FirebaseMessagingService nativo (IncomingCallService) sempre rode
   * onMessageReceived — inclusive com o app em segundo plano/morto — e monte uma
   * notificação de CHAMADA em tela cheia (full-screen intent). No iOS o alerta é
   * preservado via apns.payload.aps.alert. Usado só na chamada do interfone.
   */
  fullScreen?: boolean;
}

interface TokenRow {
  token: string;
  platform: string;
  web_push_keys: string | null;
  app_build?: number | null;
}

interface FcmToken {
  token: string;
  appBuild: number;
}

function toFcmToken(t: TokenRow): FcmToken {
  return { token: t.token, appBuild: Number(t.app_build) || 0 };
}

/**
 * versionCode nativo mínimo que traz o IncomingCallService (chamada em tela
 * cheia via data-only). Apps abaixo disso recebem a chamada como notification
 * message, exatamente como antes — sem regressão. O maior AAB publicado é
 * vc12/1.0.11 (sem o service), então o primeiro release com tela cheia é o 13.
 */
const FULLSCREEN_MIN_BUILD = Number(process.env.PUSH_FULLSCREEN_MIN_BUILD) || 13;

// ─── Send push to a specific user ───
export async function sendPushToUser(userId: number, payload: PushPayload): Promise<number> {
  if (!firebaseInitialized && !webPushInitialized) return 0;

  let tokens = db.prepare(
    "SELECT token, platform, web_push_keys, app_build FROM device_tokens WHERE user_id = ? AND active = 1"
  ).all(userId) as TokenRow[];

  // Sem token ativo o interfone diz "morador indisponível" sem nem tocar o
  // celular. Antes de desistir, tenta os desativados recentemente (rejeição
  // transitória do FCM); o que entregar volta a ficar ativo.
  const fallback = tokens.length === 0;
  if (fallback) {
    tokens = db.prepare(
      "SELECT token, platform, web_push_keys, app_build FROM device_tokens WHERE user_id = ? AND active = 0 AND updated_at >= datetime('now', '-7 days')"
    ).all(userId) as TokenRow[];
  }

  if (tokens.length === 0) return 0;

  const fcmTokens = tokens.filter(t => t.platform !== "web").map(toFcmToken);
  const webTokens = tokens.filter(t => t.platform === "web" && t.web_push_keys);

  let sent = 0;
  if (fcmTokens.length > 0 && firebaseInitialized) {
    const result = await sendPushToTokens(fcmTokens, payload);
    sent += result.sent;
    if (fallback && result.delivered.length > 0) {
      const reactivate = db.prepare("UPDATE device_tokens SET active = 1 WHERE user_id = ? AND token = ?");
      for (const token of result.delivered) reactivate.run(userId, token);
      log.info("Push: token reativado após entrega em fallback", { userId, tokens: result.delivered.length });
    }
  }
  if (webTokens.length > 0 && webPushInitialized) {
    sent += await sendWebPush(webTokens, payload);
  }
  return sent;
}

// ─── Send push to all users with a specific role in a condominium ───
export async function sendPushToCondominioRole(
  condominioId: number,
  roles: string[],
  payload: PushPayload
): Promise<number> {
  if (!firebaseInitialized && !webPushInitialized) return 0;

  const placeholders = roles.map(() => "?").join(",");
  const tokens = db.prepare(`
    SELECT dt.token, dt.platform, dt.web_push_keys, dt.app_build
    FROM device_tokens dt
    INNER JOIN users u ON u.id = dt.user_id
    WHERE u.condominio_id = ?
      AND u.role IN (${placeholders})
      AND dt.active = 1
  `).all(condominioId, ...roles) as TokenRow[];

  if (tokens.length === 0) return 0;

  const fcmTokens = tokens.filter(t => t.platform !== "web").map(toFcmToken);
  const webTokens = tokens.filter(t => t.platform === "web" && t.web_push_keys);

  let sent = 0;
  if (fcmTokens.length > 0 && firebaseInitialized) {
    sent += (await sendPushToTokens(fcmTokens, payload)).sent;
  }
  if (webTokens.length > 0 && webPushInitialized) {
    sent += await sendWebPush(webTokens, payload);
  }
  return sent;
}

// ─── Send push to all portaria staff (funcionario + sindico) of a condominium ───
export async function sendPushToPortaria(condominioId: number, payload: PushPayload): Promise<number> {
  return sendPushToCondominioRole(condominioId, ["funcionario", "sindico", "administradora"], payload);
}

// ─── Send push to all moradores of a condominium ───
export async function sendPushToMoradores(condominioId: number, payload: PushPayload): Promise<number> {
  return sendPushToCondominioRole(condominioId, ["morador"], payload);
}

// ─── Monta a MulticastMessage (data-only para chamada em tela cheia, ou notification) ───
function buildFcmMessage(
  tokens: string[],
  payload: PushPayload,
  dataOnly: boolean
): admin.messaging.MulticastMessage {
  if (dataOnly) {
    // ─── CHAMADA (full-screen intent) ───
    // DATA-ONLY no Android: sem bloco `notification` (nem top-level nem em
    // android.notification), o FCM SDK entrega em onMessageReceived mesmo com o
    // app em background/morto, e o IncomingCallService nativo monta a chamada
    // em tela cheia. title/body vão no data para o service ler. iOS mantém o
    // alerta via apns.aps.alert.
    return {
      tokens,
      data: {
        ...(payload.data || {}),
        title: payload.title,
        body: payload.body,
        channelId: payload.channelId || "interfone_calls_v2",
      },
      android: {
        priority: "high",
      },
      apns: {
        payload: {
          aps: {
            alert: { title: payload.title, body: payload.body },
            sound: payload.sound === "ringtone" ? "default" : (payload.sound || "default"),
            "interruption-level": "time-sensitive",
          },
        },
      },
    };
  }

  return {
    tokens,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: payload.data || {},
    android: {
      priority: "high",
      notification: {
        channelId: payload.channelId || "appinterfone_default",
        sound: payload.sound || "default",
        priority: "max",
        defaultVibrateTimings: false,
        vibrateTimingsMillis: [0, 1000, 200, 1000, 3000, 1000, 200, 1000],
      },
    },
    apns: {
      payload: {
        aps: {
          sound: payload.sound === "ringtone" ? "default" : (payload.sound || "default"),
          "interruption-level": "time-sensitive",
        },
      },
    },
  };
}

// ─── Envia uma leva de tokens FCM com o formato escolhido ───
async function sendMulticast(
  tokens: string[],
  payload: PushPayload,
  dataOnly: boolean
): Promise<{ sent: number; delivered: string[] }> {
  if (tokens.length === 0) return { sent: 0, delivered: [] };
  const message = buildFcmMessage(tokens, payload, dataOnly);

  try {
    const response = await admin.messaging().sendEachForMulticast(message);

    const delivered: string[] = [];
    response.responses.forEach((resp, idx) => {
      if (resp.success) {
        delivered.push(tokens[idx]);
        return;
      }
      const code = resp.error?.code;
      if (
        code === "messaging/invalid-registration-token" ||
        code === "messaging/registration-token-not-registered"
      ) {
        // Logo depois de um force-stop o Android devolve token-not-registered
        // para um token que continua válido. Desativar na primeira falha mata a
        // campainha até o morador reabrir o app — só derruba token antigo.
        const info = db.prepare(
          "UPDATE device_tokens SET active = 0 WHERE token = ? AND updated_at <= datetime('now', '-24 hours')"
        ).run(tokens[idx]);
        if (info.changes === 0) {
          log.warn("FCM rejeitou token registrado há pouco — mantendo ativo", { code });
        }
      }
    });

    return { sent: response.successCount, delivered };
  } catch (err) {
    log.error("FCM send error:", err);
    return { sent: 0, delivered: [] };
  }
}

// ─── Core: send to FCM tokens ───
async function sendPushToTokens(
  tokens: FcmToken[],
  payload: PushPayload
): Promise<{ sent: number; delivered: string[] }> {
  if (!firebaseInitialized || tokens.length === 0) return { sent: 0, delivered: [] };

  if (payload.fullScreen === true) {
    // Chamada do interfone: apps novos (>= FULLSCREEN_MIN_BUILD) recebem DATA-ONLY
    // e mostram a chamada em tela cheia; apps antigos recebem notification message
    // (comportamento atual), pois não têm o IncomingCallService para montá-la.
    const modern = tokens.filter(t => t.appBuild >= FULLSCREEN_MIN_BUILD).map(t => t.token);
    const legacy = tokens.filter(t => t.appBuild < FULLSCREEN_MIN_BUILD).map(t => t.token);
    const [a, b] = await Promise.all([
      sendMulticast(modern, payload, true),
      sendMulticast(legacy, payload, false),
    ]);
    return { sent: a.sent + b.sent, delivered: [...a.delivered, ...b.delivered] };
  }

  return sendMulticast(tokens.map(t => t.token), payload, false);
}

// ─── Web Push: send to browser subscriptions ───
async function sendWebPush(
  tokens: { token: string; web_push_keys: string | null }[],
  payload: PushPayload
): Promise<number> {
  if (!webPushInitialized) return 0;

  const webPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    data: payload.data || {},
  });

  let successCount = 0;

  for (const t of tokens) {
    if (!t.web_push_keys) continue;
    try {
      const keys = JSON.parse(t.web_push_keys);
      const subscription = {
        endpoint: t.token,
        keys: { p256dh: keys.p256dh, auth: keys.auth },
      };
      await webpush.sendNotification(subscription, webPayload);
      successCount++;
    } catch (err: any) {
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        // Subscription expired or invalid — deactivate
        db.prepare("UPDATE device_tokens SET active = 0 WHERE token = ?").run(t.token);
      }
      log.error("Web Push send error:", err?.statusCode || err);
    }
  }

  return successCount;
}

export { firebaseInitialized, webPushInitialized };
