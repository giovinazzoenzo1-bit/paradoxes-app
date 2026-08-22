const CACHE_NAME = 'paradoxes-v16';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './bgmusic.mp3',
  './icons/memory.png',
  './icons/puzzle15.png',
  './icons/snake.png',
  './icons/bientot.png',
  './icons/quisuisje.png',
  './icons/nutsbolts.png',
  './icons/g2048.png',
  './icons/quiz_paradoxes.png',
  './icons/wordle.png',
  './icons/quiz_general.png',
  './icons/morpion.png',
  './icons/paradox_monty.png',
  './icons/paradox_bday.png',
  './icons/paradox_twokids.png',
  './icons/paradox_tuesday.png',
  './icons/paradox_simpson.png',
  './icons/paradox_stpete.png',
  './icons/paradox_parrondo.png',
  './icons/paradox_toscane.png',
  './icons/paradox_franccarreau.png',
  './icons/paradox_zenon.png',
  './icons/paradox_prisonniers.png',
  './icons/paradox_bus.png',
  './icons/paradox_ruine.png',
  './icons/paradox_braess.png',
  './icons/paradox_taxi.png',
  './icons/paradox_corde.png',
  './icons/paradox_benford.png',
  './icons/paradox_condorcet.png',
  './icons/paradox_hilbert.png',
  './icons/paradox_enveloppes.png'
];

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        // Cache new same-origin GET requests for offline use next time
        if (event.request.method === 'GET' && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
