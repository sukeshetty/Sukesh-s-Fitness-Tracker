const CACHE_NAME = 'sukeshfit-v1';
const RUNTIME_CACHE = 'sukeshfit-runtime-v1';

// Assets to cache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/index.tsx',
  '/App.tsx',
  '/manifest.json'
];

// Install - precache critical assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Precaching assets');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => self.skipWaiting())
      .catch(err => console.error('[Service Worker] Precache failed:', err))
  );
});

// Activate - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map(name => {
            console.log('[Service Worker] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests except for API CDN
  if (url.origin !== location.origin &&
      !url.hostname.includes('aistudiocdn.com') &&
      !url.hostname.includes('cdn.tailwindcss.com')) {
    return;
  }

  // Network-first strategy for API calls
  if (url.hostname.includes('generativelanguage.googleapis.com')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Don't cache API responses (they're dynamic)
          return response;
        })
        .catch(err => {
          console.error('[Service Worker] API request failed:', err);
          return new Response(
            JSON.stringify({ error: 'You are offline. Please check your internet connection.' }),
            {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({ 'Content-Type': 'application/json' })
            }
          );
        })
    );
    return;
  }

  // Cache-first strategy for assets
  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then(response => {
          // Cache successful responses
          if (response.status === 200 && request.method === 'GET') {
            const responseToCache = response.clone();
            caches.open(RUNTIME_CACHE).then(cache => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        }).catch(err => {
          console.error('[Service Worker] Fetch failed:', err);
          // Return offline page if available
          return caches.match('/index.html');
        });
      })
  );
});
