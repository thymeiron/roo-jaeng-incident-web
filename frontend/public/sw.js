const CACHE_NAME = "roo-jaeng-pwa-v2";

self.addEventListener("install", (event) => {
  console.log("Roo-Jaeng service worker installed");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("Roo-Jaeng service worker activated");
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // pass-through for now
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    payload = {
      title: "Roo-Jaeng",
      body: event.data ? event.data.text() : "มีรายการแจ้งเตือนใหม่",
    };
  }

  const title =
    typeof payload.title === "string" && payload.title.trim()
      ? payload.title
      : "Roo-Jaeng";
  const body =
    typeof payload.body === "string" && payload.body.trim()
      ? payload.body
      : "มีรายการแจ้งเตือนใหม่";
  const data =
    payload.data && typeof payload.data === "object" ? payload.data : {};
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url;
  if (typeof url !== "string" || !url.trim()) {
    return;
  }

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (windowClients) => {
        const rooJaengClient = windowClients.find((client) => {
          try {
            return new URL(client.url).origin === self.location.origin;
          } catch (error) {
            return false;
          }
        });

        if (rooJaengClient) {
          await rooJaengClient.navigate(url);
          return rooJaengClient.focus();
        }

        return self.clients.openWindow(url);
      }),
  );
});
