/**
 * ═══════════════════════════════════════════════════════════
 * PUSH NOTIFICATIONS — Client-side registration
 * Handles Capacitor (native) and Web Push (browser).
 * Registers device token / subscription with the server.
 * ═══════════════════════════════════════════════════════════
 */

import { apiFetch } from "./api";
import { isNative } from "./config";
import { startCallRing, stopCallRing } from "./callRing";
import { abrirNoApp, abrirSeChamadaNaoAparecer, revalidarChamada } from "./appNav";

let pushInitialized = false;
let currentToken: string | null = null;
let nativeListenersRegistered = false;

const ANDROID_CALLS_CHANNEL_ID = "interfone_calls";

// Espelha PUSH_FULLSCREEN_MIN_BUILD do servidor (server/pushService.ts).
const FULLSCREEN_MIN_BUILD_FALLBACK = 13;

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

        // versionCode nativo → servidor decide se manda a chamada em tela cheia
        // (data-only). Se a leitura falhar, 0 faria o servidor tratar o aparelho
        // como APK antigo e a chamada perderia a tela cheia — por isso o fallback
        // é "moderno": todo APK em campo já traz o IncomingCallService.
        let appBuild = 0;
        try {
          const { App } = await import("@capacitor/app");
          appBuild = parseInt((await App.getInfo()).build, 10) || 0;
        } catch {}
        if (!appBuild) appBuild = FULLSCREEN_MIN_BUILD_FALLBACK;

        try {
          await apiFetch("/api/device-tokens", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              token: token.value,
              platform: "android",
              deviceInfo: navigator.userAgent,
              appBuild,
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
          // Chegou push de chamada: conferir com o servidor se o aviso global
          // recebeu mesmo (socket pode estar zumbi). Não toca nada por si só.
          revalidarChamada();
          // App em 1º plano com WS ativo: a chamada chega (ou já chegou) pelo WebSocket
          // com o toque próprio — ignorar o push pra não tocar em dobro
          if ((globalThis as any).__interfoneWsOpen) return;
          startCallRing();
          setTimeout(stopCallRing, 30000);
        }
      });

      PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
        console.log("Push action:", action);
        const data = action.notification.data;
        if (data?.type === "interfone-call") {
          // destino=portaria: a chamada é para o porteiro, não para o morador.
          const rota = data.destino === "portaria" ? "/portaria/interfone" : "/morador/interfone";
          revalidarChamada();
          // Não navegar agora: o aviso global monta em qualquer rota e, assim que
          // o app volta ao 1º plano, reconecta e recebe a chamada de volta do
          // servidor (pendingPushCalls) já tocando, com o Atender que faz o
          // handoff. Ir para a tela do interfone aqui derrubaria justamente o
          // aviso que segura a chamada. Só abre a tela se em 6s não veio nada —
          // chamada perdida/desistida — pra não deixar o toque sem resposta.
          abrirSeChamadaNaoAparecer(rota);
        } else if (data?.type === "correspondencia") {
          abrirNoApp("/portaria/correspondencias");
        } else if (data?.type === "visitor") {
          abrirNoApp("/portaria/visitantes");
        }
      });

      // Ao atender/recusar pelo painel: tirar a chamada da bandeja. O som em si
      // é do CallRinger nativo, parado por stopCallRing() em quem atende.
      globalThis.addEventListener("stop-push-ringtone", () => {
        PushNotifications.removeAllDeliveredNotifications().catch(() => {});
      });

      nativeListenersRegistered = true;
    }

    try {
      // Canais Android são imutáveis após criados: o toque longo exige um canal novo (v2),
      // que só pode existir em builds que trazem res/raw/ringtone.wav (versionCode >= 12)
      // A chamada é montada pelo IncomingCallService nativo (canal
      // interfone_calls_v4, criado no Java). Canais de versões antigas só
      // duplicariam a entrada nas configurações do Android — some com eles.
      for (const id of [ANDROID_CALLS_CHANNEL_ID, "interfone_calls_v2", "interfone_calls_v3"]) {
        try {
          await PushNotifications.deleteChannel({ id });
        } catch {}
      }

      // Avisos gerais (não-chamada): canal próprio, senão o FCM joga tudo no
      // "Diversos" do sistema. É o mesmo id usado em server/pushService.ts e
      // no default_notification_channel_id do AndroidManifest.
      await PushNotifications.createChannel({
        id: "appinterfone_default",
        name: "Avisos do condomínio",
        description: "Comunicados e avisos do AppInterfone",
        importance: 4,
        visibility: 1,
        vibration: true,
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
