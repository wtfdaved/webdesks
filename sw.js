const CACHE_VERSION = 'webdesks-v26.0';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/life.js',
  '/account.js',
  '/extras.js',
  '/town.js',
  '/sound.js',
  '/survey-logic.js',
  '/login.html',
  '/manifest.json',
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
  e.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(STATIC_ASSETS))
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

self.addEventListener('fetch', (e) => {
  const url = e.request.url;

  // Sign-in and Desk sync must always hit the network, never a cache.
  if (e.request.method !== 'GET' || url.includes('.supabase.co') || url.includes('.supabase.in')) return;

  // Live radio streams (and their now-playing lookups) go straight to the network.
  if (url.includes('somafm.com') || e.request.headers.has('range')) return;

  // Public Supabase settings: network first so key changes apply immediately.
  if (new URL(url).pathname === '/supabase-config.js') {
    e.respondWith(
      fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_VERSION).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // CDN resources: network first, fall back to cache
  if (
    url.includes('cdn.tailwindcss.com') ||
    url.includes('unpkg.com') ||
    // jsdelivr serves marked, highlight.js and the lazily-loaded
    // qrcode, tesseract.js, FullCalendar and Editor.js bundles — cache
    // them so the Dev Toolkit, OCR, Calendar and Pages keep working
    // offline after the first visit.
    url.includes('cdn.jsdelivr.net') ||
    url.includes('fonts.googleapis.com') ||
    url.includes('fonts.gstatic.com')
  ) {
    e.respondWith(
      fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_VERSION).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Static assets: cache first, fall back to network
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});
