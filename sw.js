const CACHE_VERSION = 'v3'
const ASSET_CACHE = `assets-${CACHE_VERSION}`
const IMAGE_CACHE = `images-${CACHE_VERSION}`
const CATALOG_CACHE = `catalogs-${CACHE_VERSION}`

const IMMUTABLE_PATTERNS = [/\/assets\/.+-[a-f0-9]{8}\.(js|css)$/]
const IMAGE_PATTERNS = [/\.(png|svg|webp|ico|jpg|jpeg)$/]
const CATALOG_PATTERNS = [/\/catalogs\//]

self.addEventListener('install', (event) => {
  void self.skipWaiting()
  event.waitUntil(
    caches.open(IMAGE_CACHE).then((cache) =>
      cache.addAll(['/retro-vault-elite-logo.png', '/icon-192.png', '/favicon-32.png'])
        .catch(() => {})
    )
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== ASSET_CACHE && k !== IMAGE_CACHE && k !== CATALOG_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Skip cross-origin requests (API, fonts, analytics)
  if (url.origin !== self.location.origin) return

  const path = url.pathname

  if (IMMUTABLE_PATTERNS.some((p) => p.test(path))) {
    event.respondWith(cacheFirst(request, ASSET_CACHE, { immutable: true }))
    return
  }

  if (IMAGE_PATTERNS.some((p) => p.test(path))) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE, { maxAgeMs: 30 * 24 * 60 * 60 * 1000 }))
    return
  }

  if (CATALOG_PATTERNS.some((p) => p.test(path))) {
    event.respondWith(staleWhileRevalidate(request, CATALOG_CACHE))
    return
  }
})

async function cacheFirst(request, cacheName, { immutable = false, maxAgeMs = Infinity } = {}) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) {
    if (immutable) return cached
    const date = cached.headers.get('date')
    if (!date || Date.now() - new Date(date).getTime() < maxAgeMs) return cached
  }
  const fresh = await fetch(request)
  if (fresh.ok) void cache.put(request, fresh.clone())
  return fresh
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  const fetchPromise = fetch(request).then((fresh) => {
    if (fresh.ok) void cache.put(request, fresh.clone())
    return fresh
  })
  return cached ?? fetchPromise
}
