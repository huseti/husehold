// Web Push service worker -- only handles incoming push events and clicks on
// the resulting notification. No offline caching/PWA behavior here, that's a
// separate concern from notifications and not something this app has asked for.

self.addEventListener('push', (event) => {
  let payload = { title: 'HUSEHOLD', body: '' };
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload.body = event.data.text();
    }
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || 'HUSEHOLD', {
      body: payload.body || '',
      icon: '/favicon-32x32.png',
      badge: '/favicon-32x32.png',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});
