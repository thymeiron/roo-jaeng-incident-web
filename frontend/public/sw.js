const CACHE_NAME = "roo-jaeng-pwa-v1";

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
