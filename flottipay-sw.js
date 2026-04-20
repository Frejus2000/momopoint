/* ============================================================
   FlottiPay — Service Worker v1.0
   Permet l'utilisation hors ligne de l'application
   ============================================================ */

const CACHE_NAME = 'flottipay-v1';
const OFFLINE_PAGE = '/flottipay-app.html';

// Fichiers à mettre en cache lors de l'installation
const PRECACHE_URLS = [
  '/flottipay-app.html',
  'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=JetBrains+Mono:wght@400;500;700&display=swap',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
];

// Installation : mise en cache des ressources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS).catch(() => {
        // Si certaines ressources échouent, continuer quand même
        return cache.add(OFFLINE_PAGE);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activation : suppression des anciens caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch : stratégie Network First avec fallback cache
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Ne pas intercepter les requêtes Supabase (API) — elles gèrent leur propre offline
  if (url.hostname.includes('supabase.co')) return;

  // Pour les requêtes GET uniquement
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Mettre en cache les réponses réussies
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Hors ligne : retourner depuis le cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Si c'est une navigation, retourner la page principale
          if (event.request.mode === 'navigate') {
            return caches.match(OFFLINE_PAGE);
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});
