const CACHE_VERSION = 'webdesks-v29.0';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/life.js',
  '/account.js',
  '/extras.js',
  '/town.js',
  '/sound.js',
  '/shell.js',
  '/desks.js',
  '/ads.js',
  '/tool-routes.js',
  '/growth.js',
  '/desk-badges.js',
  '/embed/mini-tools.js',
  '/tools/',
  '/survey-logic.js',
  '/login.html',
  '/family-feud.html',
  '/survey.html',
  '/games/',
  '/games/survey-says.html',
  '/games/games.css',
  '/manifest.json',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/favicon-32.png',
  '/about.html',
  '/privacy.html',
  '/terms.html',
  '/contact.html',
  '/pdf-merger.html',
  '/screen-recorder.html',
  '/pomodoro-timer.html',
  '/white-noise.html',
  '/breathing-guide.html',
  '/blog/',
  '/blog/index.html'
];

self.addEventListener('install', (e) => {
  // Cache what we can; one missing file must not block the install.
  e.waitUntil(
    caches.open(CACHE_VERSION).then(cache => Promise.all(STATIC_ASSETS.map(u => cache.add(u).catch(() => {}))))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network first, cache as the offline fallback — so a deploy is live on the
// next load and nobody gets stuck on an old cached copy.
const networkFirst = (e, fallbacks = []) => e.respondWith(
  fetch(e.request).then(res => {
    if (res && (res.ok || res.type === 'opaque')) {
      const clone = res.clone();
      caches.open(CACHE_VERSION).then(c => c.put(e.request, clone));
    }
    return res;
  }).catch(async () => {
    for (const key of [e.request, ...fallbacks]) {
      const hit = await caches.match(key, { ignoreSearch: key !== e.request });
      if (hit) return hit;
    }
    return Response.error();
  })
);

const CDN = ['cdn.tailwindcss.com', 'unpkg.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);

  // Sign-in, Desk sync, live radio and everything else third-party (ads,
  // weather, quotes) always go straight to the network.
  if (url.origin === self.location.origin) {
    // Functions (the private calendar feed fetcher) are never cached.
    if (url.pathname === '/sw.js' || url.pathname.startsWith('/.netlify/')) return;
    if (req.mode !== 'navigate') return networkFirst(e);
    // Offline pages: the pretty URL, its .html / index.html file, then the app.
    const p = url.pathname;
    return networkFirst(e, [p.endsWith('/') ? p + 'index.html' : p + '.html', '/index.html']);
  }
  // CDN libraries (jsdelivr serves the lazily-loaded bundles) are cached so
  // the tools keep working offline after the first visit.
  if (CDN.includes(url.hostname)) return networkFirst(e);
});
