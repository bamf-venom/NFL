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

// CACHE_NAME an APP_VERSION gekoppelt statt einer festen Zahl - vorher blieb
// der Name über Updates hinweg immer 'nflpoints-v1', wodurch der
// activate-Handler unten (löscht alle Caches AUSSER dem aktuellen Namen) nie
// wirklich etwas zu tun hatte und alte, bereits gecachte Dateien liegen
// bleiben konnten. Jetzt erzwingt jeder APP_VERSION-Bump (ohnehin Konvention
// bei jedem sichtbaren Deploy, siehe js/config.js) automatisch einen
// komplett frischen Cache.
importScripts('./js/config.js');
const CACHE_NAME = 'nflpoints-' + APP_VERSION;

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

// ==================== PUSH-BENACHRICHTIGUNGEN ====================
// Wett-Erinnerung 1h vor Anpfiff (siehe automation/send-bet-reminders.js) -
// der Server schickt nur { title, body, url }, kein sensibler Payload.
self.addEventListener('push', (event) => {
  let data = { title: 'NFL POINTS', body: 'Du hast noch Zeit, deine Wette zu platzieren.' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (e) {
    // Payload war kein JSON - Fallback-Text oben wird verwendet
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      data: { url: data.url || './pages/games.html' },
    })
  );
});

// Klick auf die Benachrichtigung öffnet die App (bzw. fokussiert einen schon
// offenen Tab statt einen neuen zu öffnen)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || './pages/games.html';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Nur eigene GET-Requests auf statische Dateien behandeln
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // WICHTIG (2026-09-23): fetch(event.request) allein reicht nicht für
  // echtes "Network first" - GitHub Pages schickt Cache-Control: max-age=600
  // für diese Dateien, wodurch der Browser die Anfrage bis zu 10 Minuten
  // lang aus seinem EIGENEN HTTP-Cache beantwortet, komplett unabhängig vom
  // Service Worker/CacheStorage oben. Der "Jetzt aktualisieren"-Button hat
  // dadurch bei einem Nutzer nichts bewirkt, obwohl Caches/Service-Worker
  // korrekt zurückgesetzt wurden. { cache: 'no-store' } erzwingt einen
  // echten Netzwerk-Request, der den Browser-HTTP-Cache umgeht - nur so
  // kommt bei einem neuen Deploy auch wirklich sofort die neue Version an,
  // nicht erst nach bis zu 10 Minuten.
  event.respondWith(
    fetch(event.request.url, { cache: 'no-store' })
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
