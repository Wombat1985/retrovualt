// Service worker disabled — unregisters itself and clears all caches
self.addEventListener('install', () => { void self.skipWaiting() })
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.registration.unregister())
  )
})
