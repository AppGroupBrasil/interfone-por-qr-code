/**
 * ═══════════════════════════════════════════════════════════
 * PUSH NOTIFICATIONS — Client-side registration
 * Handles Capacitor (native) and Web Push (browser).
 * Registers device token / subscription with the server.
 * ═══════════════════════════════════════════════════════════
 */

import { apiFetch } from "./api";
import { isNative } from "./config";

let pushInitialized = false;
let currentToken: string | null = null;
let nativeListenersRegistered = false;

const ANDROID_CALLS_CHANNEL_ID = "interfone_calls";

type PushPermissionStatus = "prompt" | "blocked" | "enabled";

function emitPushPermissionStatus(status: PushPermissionStatus) {
  globalThis.dispatchEvent(new CustomEvent("appinterfone:push-permission", { detail: { status } }));
}

// ─── Helper: convert URL-safe base64 to Uint8Array (for VAPID applicationServerKey) ───
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = globalThis.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.codePointAt(i) ?? 0;
  return outputArray;
}

/**
 * Initialize push notifications (call after login).
 * Native → Capacitor FCM | Web → Service Worker + Web Push API
 */
export async function initPushNotifications(): Promise<void> {
  if (pushInitialized) return;

  if (isNative) {
    await initNativePush();
  } else {
    await initWebPush(false);
  }
}

export async function enablePushNotifications(): Promise<void> {
  if (isNative) {
    await initNativePush();
    return;
  }

  await initWebPush(true);
}

// ─── Native (Capacitor) ───
async function initNativePush(): Promise<void> {
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    if (!nativeListenersRegistered) {
      PushNotifications.addListener("registration", async (token) => {
        console.log("Push token:", token.value);
        currentToken = token.value;
        pushInitialized = true;
        emitPushPermissionStatus("enabled");

        try {
          await apiFetch("/api/device-tokens", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              token: token.value,
              platform: "android",
              deviceInfo: navigator.userAgent,
            }),
          });
        } catch (err) {
          console.error("Failed to register push token:", err);
        }
      });

      PushNotifications.addListener("registrationError", (error) => {
        console.error("Push registration error:", error);
      });

      PushNotifications.addListener("pushNotificationReceived", (notification) => {
        console.log("Push received (foreground):", notification);
        if (notification.data?.type === "interfone-call") {
          try {
            const audio = new Audio("/sounds/ringtone-call.wav");
            audio.loop = true;
            audio.volume = 0.8;
            audio.play().catch(() => {});
            (globalThis as any).__pushCallAudio = audio;
            setTimeout(() => { audio.pause(); audio.currentTime = 0; }, 30000);
          } catch {}
        }
      });

      PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
        console.log("Push action:", action);
        try {
          const fgAudio = (globalThis as any).__pushCallAudio;
          if (fgAudio) { fgAudio.pause(); fgAudio.currentTime = 0; (globalThis as any).__pushCallAudio = null; }
        } catch {}
        const data = action.notification.data;
        if (data?.type === "interfone-call") {
          globalThis.location.href = "/morador/interfone";
        } else if (data?.type === "correspondencia") {
          globalThis.location.href = "/portaria/correspondencias";
        } else if (data?.type === "visitor") {
          globalThis.location.href = "/portaria/visitantes";
        }
      });

      nativeListenersRegistered = true;
    }

    try {
      await PushNotifications.createChannel({
        id: ANDROID_CALLS_CHANNEL_ID,
        name: "Chamadas do Interfone",
        description: "Chamadas e alertas importantes do interfone digital",
        importance: 5,
        visibility: 1,
        vibration: true,
        lights: true,
      });
    } catch (channelError) {
      console.warn("Failed to ensure Android notification channel:", channelError);
    }

    let permResult = await PushNotifications.checkPermissions();

    if (permResult.receive === "prompt") {
      permResult = await PushNotifications.requestPermissions();
    }

    if (permResult.receive !== "granted") {
      console.warn("Push notification permission denied");
      emitPushPermissionStatus("blocked");
      return;
    }

    await PushNotifications.register();
  } catch (err) {
    console.error("Push notification init error:", err);
  }
}

// ─── Web Push (Service Worker + Push API) ───
async function initWebPush(requestFromUserGesture: boolean): Promise<void> {
  if (!("serviceWorker" in navigator) || !("PushManager" in globalThis)) {
    console.warn("Web Push not supported in this browser");
    return;
  }

  try {
    // Register service worker
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const currentPermission = Notification.permission;

      if (currentPermission === "denied") {
        emitPushPermissionStatus("blocked");
        console.warn("Notification permission denied");
        return;
      }

      if (!requestFromUserGesture && currentPermission !== "granted") {
        emitPushPermissionStatus("prompt");
        return;
      }

      // Request permission
      const permission = currentPermission === "granted"
        ? "granted"
        : await Notification.requestPermission();

      if (permission !== "granted") {
        emitPushPermissionStatus("blocked");
        console.warn("Notification permission denied");
        return;
      }

      // Get VAPID public key from server
      const vapidRes = await apiFetch("/api/device-tokens/vapid-public-key");
      if (!vapidRes.ok) {
        console.error("Failed to get VAPID key");
        return;
      }
      const { publicKey } = await vapidRes.json();

      // Subscribe
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    // Send subscription to server
    const subJson = subscription.toJSON();
    currentToken = subJson.endpoint!;
    pushInitialized = true;
    emitPushPermissionStatus("enabled");

    await apiFetch("/api/device-tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: subJson.endpoint,
        platform: "web",
        deviceInfo: navigator.userAgent,
        webPushKeys: {
          p256dh: subJson.keys?.p256dh,
          auth: subJson.keys?.auth,
        },
      }),
    });

    console.log("Web Push registered:", subJson.endpoint?.slice(0, 60) + "...");
  } catch (err) {
    console.error("Web Push init error:", err);
    emitPushPermissionStatus(Notification.permission === "denied" ? "blocked" : "prompt");
  }
}

/**
 * Unregister push token (call on logout).
 */
export async function unregisterPushToken(): Promise<void> {
  if (!currentToken) return;

  try {
    await apiFetch("/api/device-tokens", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: currentToken }),
    });

    // Unsubscribe Web Push
    if (!isNative && "serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) await subscription.unsubscribe();
    }

    currentToken = null;
    pushInitialized = false;
  } catch (err) {
    console.error("Failed to unregister push token:", err);
  }
}

/**
 * Get the current push token (if registered).
 */
export function getPushToken(): string | null {
  return currentToken;
}
