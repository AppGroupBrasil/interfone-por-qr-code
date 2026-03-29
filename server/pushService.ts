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

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Initialize Firebase Admin SDK ───
let firebaseInitialized = false;

function initFirebase() {
  if (firebaseInitialized) return;

  const serviceAccountPath = path.join(__dirname, "..", "server", "firebase-service-account.json");
  // In production (Docker), try /app/server/
  const altPath = path.join(__dirname, "firebase-service-account.json");

  let credentialPath = "";
  if (fs.existsSync(serviceAccountPath)) {
    credentialPath = serviceAccountPath;
  } else if (fs.existsSync(altPath)) {
    credentialPath = altPath;
  } else {
    console.warn("⚠️  Firebase service account not found. Push notifications disabled.");
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
    console.error("Firebase init error:", err);
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
    console.warn("⚠️  VAPID keys not set. Web Push notifications disabled.");
    return;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    webPushInitialized = true;
    console.log("  🌐 Web Push (VAPID) initialized");
  } catch (err) {
    console.error("Web Push init error:", err);
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
}

// ─── Send push to a specific user ───
export async function sendPushToUser(userId: number, payload: PushPayload): Promise<number> {
  if (!firebaseInitialized && !webPushInitialized) return 0;

  const tokens = db.prepare(
    "SELECT token, platform, web_push_keys FROM device_tokens WHERE user_id = ? AND active = 1"
  ).all(userId) as { token: string; platform: string; web_push_keys: string | null }[];

  if (tokens.length === 0) return 0;

  const fcmTokens = tokens.filter(t => t.platform !== "web").map(t => t.token);
  const webTokens = tokens.filter(t => t.platform === "web" && t.web_push_keys);

  let sent = 0;
  if (fcmTokens.length > 0 && firebaseInitialized) {
    sent += await sendPushToTokens(fcmTokens, payload);
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
    SELECT dt.token, dt.platform, dt.web_push_keys
    FROM device_tokens dt
    INNER JOIN users u ON u.id = dt.user_id
    WHERE u.condominio_id = ? 
      AND u.role IN (${placeholders})
      AND dt.active = 1
  `).all(condominioId, ...roles) as { token: string; platform: string; web_push_keys: string | null }[];

  if (tokens.length === 0) return 0;

  const fcmTokens = tokens.filter(t => t.platform !== "web").map(t => t.token);
  const webTokens = tokens.filter(t => t.platform === "web" && t.web_push_keys);

  let sent = 0;
  if (fcmTokens.length > 0 && firebaseInitialized) {
    sent += await sendPushToTokens(fcmTokens, payload);
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

// ─── Core: send to FCM tokens ───
async function sendPushToTokens(tokens: string[], payload: PushPayload): Promise<number> {
  if (!firebaseInitialized || tokens.length === 0) return 0;

  const message: admin.messaging.MulticastMessage = {
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
        vibrateTimingsMillis: ["0", "1000", "200", "1000", "3000", "1000", "200", "1000"],
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

  try {
    const response = await admin.messaging().sendEachForMulticast(message);

    // Deactivate invalid tokens
    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (resp.error) {
          const code = resp.error.code;
          if (
            code === "messaging/invalid-registration-token" ||
            code === "messaging/registration-token-not-registered"
          ) {
            db.prepare("UPDATE device_tokens SET active = 0 WHERE token = ?").run(tokens[idx]);
          }
        }
      });
    }

    return response.successCount;
  } catch (err) {
    console.error("FCM send error:", err);
    return 0;
  }
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
      console.error("Web Push send error:", err?.statusCode || err);
    }
  }

  return successCount;
}

export { firebaseInitialized, webPushInitialized };
