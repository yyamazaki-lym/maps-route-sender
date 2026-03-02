// Service Worker - Push通知を受信してGoogle Mapsを開く

self.addEventListener("push", (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const modeLabels = {
    transit: "🚃 電車",
    driving: "🚗 車",
    walking: "🚶 徒歩",
    bicycling: "🚲 自転車",
  };

  const options = {
    body: `${data.body}\n${modeLabels[data.travelMode] || ""}`,
    icon: "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="%234ecdc4"/><text x="32" y="44" font-size="36" text-anchor="middle" fill="white">📍</text></svg>'),
    badge: "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" fill="%234ecdc4"/></svg>'),
    data: { url: data.url },
    actions: [{ action: "open", title: "Google Mapsで開く" }],
    requireInteraction: true,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// 通知クリック → Google Mapsを開く
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url;
  if (url) {
    event.waitUntil(clients.openWindow(url));
  }
});
