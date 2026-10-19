// Notifications (backend internal/push): a Gbairai message, a bet over. Added
// to the service worker vite-plugin-pwa makes (workbox.importScripts).
self.addEventListener('push', (event) => {
  let m = {}
  try {
    m = event.data ? event.data.json() : {}
  } catch {
    m = { body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(m.title || 'Babi Life', {
      body: m.body || '',
      icon: '/pin-192.png',
      badge: '/pin-favicon-48.png',
      tag: m.tag || undefined,
      renotify: !!m.tag,
      data: { url: m.url || '/jeu' },
    }),
  )
})

// A tap opens the game (the tab already open if there is one) where the notification says.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL((event.notification.data && event.notification.data.url) || '/jeu', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((tabs) => {
      for (const t of tabs) {
        if (new URL(t.url).origin === self.location.origin && 'focus' in t) {
          t.navigate(url).catch(() => undefined)
          return t.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
