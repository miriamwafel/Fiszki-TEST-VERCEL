const CACHE_NAME = 'fiszki-v1';
const STATIC_CACHE = 'fiszki-static-v1';
const DATA_CACHE = 'fiszki-data-v1';

// Statyczne zasoby do cache'owania przy instalacji
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// API routes do cache'owania (stale-while-revalidate)
const API_CACHE_ROUTES = [
  '/api/sets',
  '/api/stories',
];

// Instalacja - cache statycznych zasobów
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Aktywacja - usunięcie starych cache'ów
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            return name.startsWith('fiszki-') &&
                   name !== STATIC_CACHE &&
                   name !== DATA_CACHE;
          })
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// Strategia: Network First dla API, Cache First dla statycznych
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignoruj non-GET requests
  if (request.method !== 'GET') return;

  // Ignoruj chrome-extension i inne
  if (!url.protocol.startsWith('http')) return;

  // API requests - Stale While Revalidate
  if (url.pathname.startsWith('/api/')) {
    // Nie cache'uj API auth i translate (te są dynamiczne)
    if (url.pathname.includes('/auth/') ||
        url.pathname.includes('/translate') ||
        url.pathname.includes('/tutor') ||
        url.pathname.includes('/exercises')) {
      return;
    }

    event.respondWith(staleWhileRevalidate(request, DATA_CACHE));
    return;
  }

  // Next.js _next/static - Cache First (immutable)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Next.js _next/data - Network First
  if (url.pathname.startsWith('/_next/data/')) {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  // Statyczne zasoby - Cache First
  if (url.pathname.match(/\.(png|jpg|jpeg|svg|gif|ico|woff2?|ttf|css|js)$/)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // HTML pages - Network First
  event.respondWith(networkFirst(request, STATIC_CACHE));
});

// Cache First - zwróć z cache, jeśli nie ma to z sieci
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('[SW] Cache first fetch failed:', error);
    return new Response('Offline', { status: 503 });
  }
}

// Network First - najpierw sieć, jeśli offline to cache
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    return new Response('Offline', { status: 503 });
  }
}

// Stale While Revalidate - zwróć cache od razu, odśwież w tle
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached);

  return cached || fetchPromise;
}

// Background Sync dla offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-flashcards') {
    event.waitUntil(syncFlashcards());
  }
});

async function syncFlashcards() {
  // Synchronizacja offline zmian - będzie implementowane z IndexedDB
  console.log('[SW] Syncing flashcards...');
}

// Push notifications (na przyszłość)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
    });
  }
});
