// Pages, scripts et données : réseau d'abord (dernière version dès l'ouverture), copie enregistrée sans réseau.
// Icônes et polices : copie enregistrée d'abord. GitHub (vérification des mises à jour) : jamais mis en cache.
const CACHE = 'celestial-lions-v6';
const FILES = ['./', './index.html', './css/app.css', './js/app.js', './js/bsdata.js',
  './data/rules.json', './data/detachments.json', './data/units.json', './data/official-rules.json', './data/detachments-all.json', './data/detachments-fr.json',
  './data/lists/index.json', './data/lists/celestial-lions-2000.json',
  './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)); }
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (/(^|\.)github(usercontent)?\.com$/.test(url.hostname)) return;   // vérification des mises à jour : toujours en direct
  const sameOrigin = url.origin === self.location.origin;
  const fresh = sameOrigin && (req.mode === 'navigate' || /\.(html|js|css|json)$/.test(url.pathname) || url.pathname.endsWith('/'));
  if (fresh) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const key = req.mode === 'navigate' ? './index.html' : req;
      try {
        const res = await Promise.race([fetch(req, {cache: 'no-store'}), timeout(4000)]);
        if (res && res.ok) { cache.put(key, res.clone()); return res; }
        throw new Error('bad');
      } catch (err) {
        return (await cache.match(key, {ignoreSearch: true})) || (await cache.match(req, {ignoreSearch: true})) || Response.error();
      }
    })());
    return;
  }
  e.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(req, {ignoreSearch: true});
    const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => cached);
    return cached || net;
  }));
});
