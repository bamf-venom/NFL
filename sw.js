// Service Worker fuer NFL POINTS - macht die App als PWA installierbar und
// sorgt fuer ein Offline-Grundgeruest. Bewusst zurueckhaltend: nur eigene,
// statische Assets (HTML/CSS/JS/Bilder) werden behandelt, alles andere
// (Firebase/Firestore-Verbindungen, externe CDNs wie Fonts/Font Awesome)
// wird nicht angefasst, damit Live-Daten nie veraltet aus dem Cache kommen.
//
// Strategie: "Network first, fall back to cache" - im Vorfeld gab es schon
// Verwirrung durch GitHub-Pages-Caching (Nutzer sah alte Version nach einem
// Update), das soll sich mit einem Service Worker nicht wiederholen. Wer
// online ist, bekommt also immer die aktuelle Version; nur ganz ohne
// Verbindung greift der Cache als Fallback.

const CACHE_NAME = 'nflpoints-v1';

const PRECACHE_URLS = [
  'index.html',
  'manifest.json',
  'css/colors.css',
  'css/base.css',
  'js/config.js',
  'js/main.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch(() => {}) // Precache ist ein Bonus, darf die Installation nicht blockieren
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Nur eigene GET-Requests auf statische Dateien behandeln
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
