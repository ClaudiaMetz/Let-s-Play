const CACHE_NAME = 'lets-play-v1.2.9';
const APP_FILES = [
  './', './index.html', './games.html', './offline.html', './manifest.webmanifest',
  './css/landing.css', './css/games.css', './js/app/landing.js', './js/app/menu-glow.js', './js/app/menu-music.js', './js/config.js',
  './js/services/ranking.js', './js/services/service-worker.js', './js/compatibility/polyfills.js',
  './js/games/wordle-words.js', './js/games/core-puzzles.js', './js/games/arkanoid.js', './js/games/tetris.js',
  './js/games/kapo-letras.js', './js/games/capitan-beto.js', './js/games/clave-7.js',
  './games/clave-7.html', './assets/pablis-games-icon.svg', './assets/pablis-games-loop.mp4'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => (key.startsWith('pablis-games-') || key.startsWith('lets-play-')) && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then(hit => hit || caches.match('./games.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(hit => {
      const fresh = fetch(request).then(response => {
        if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
        return response;
      }).catch(() => hit);
      return hit || fresh;
    })
  );
});
