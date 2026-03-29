/**
 * Service Worker — Web Push Notifications
 * Handles push events, plays ringtone via client postMessage,
 * and routes notification clicks to the correct page.
 */

// Phone-like vibration: 2s ring, 3s pause, repeated 5x
const PHONE_VIBRATE = [];
for (let i = 0; i < 5; i++) {
  PHONE_VIBRATE.push(1000, 200, 1000, 3000); // ring-pause-ring-silence
}

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "App Interfone", body: event.data.text() };
  }

  const isCall = payload.data?.type === "interfone-call";
  const title = payload.title || "App Interfone";
  const options = {
    body: payload.body || "",
    icon: "/logo.png",
    badge: "/logo.png",
    tag: payload.data?.callId || "general",
    renotify: true,
    requireInteraction: isCall,
    vibrate: isCall ? PHONE_VIBRATE : [200, 100, 200],
    data: payload.data || {},
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      // Tell any open client windows to play the ringtone audio
      isCall
        ? self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
            for (const client of clients) {
              client.postMessage({
                type: "play-ringtone",
                callType: "interfone-call",
                callId: payload.data?.callId,
              });
            }
          })
        : Promise.resolve(),
    ])
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  let targetUrl = "/";

  if (data.type === "interfone-call") {
    targetUrl = "/morador/interfone";
  } else if (data.type === "correspondencia") {
    targetUrl = "/portaria/correspondencias";
  } else if (data.type === "visitor") {
    targetUrl = "/portaria/visitantes";
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Tell all clients to stop ringtone
      for (const client of clientList) {
        client.postMessage({ type: "stop-ringtone" });
      }

      // Focus existing window if found
      for (const client of clientList) {
        if (new URL(client.url).pathname === targetUrl && "focus" in client) {
          return client.focus();
        }
      }
      // Focus any open window and navigate
      for (const client of clientList) {
        if ("focus" in client && "navigate" in client) {
          return client.focus().then(() => client.navigate(targetUrl));
        }
      }
      // Open new window
      return self.clients.openWindow(targetUrl);
    })
  );
});
