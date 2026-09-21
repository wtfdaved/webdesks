const CACHE_VERSION = 'webdesks-v21.0';
const STATIC_ASSETS = [
  '/',
  '/index.html',
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

  // CDN resources: network first, fall back to cache
  if (
    url.includes('cdn.tailwindcss.com') ||
    url.includes('unpkg.com') ||
    // jsdelivr serves marked, highlight.js and the lazily-loaded
    // qrcode + tesseract.js bundles — cache them so the Dev Toolkit
    // and OCR keep working offline after the first visit.
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
