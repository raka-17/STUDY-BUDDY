/* ═══════════════════════════════════════════════════
   CSE 2027 — Service Worker
   • Offline caching (cache-first for app shell)
   • Push-style notifications (scheduled via page)
   • Timer completion alerts in background
═══════════════════════════════════════════════════ */

const CACHE = 'cse2027-v2';
const SHELL  = ['./My_buddy.html', './manifest.json', './sw.js'];

/* ── INSTALL ──────────────────────────────────────── */
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .catch(() => {/* offline first run — skip */ })
  );
});

/* ── ACTIVATE ─────────────────────────────────────── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ── FETCH  (network-first, cache fallback) ─────────── */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Skip cross-origin requests (fonts, CDN, etc.)
  if (!e.request.url.startsWith(self.location.origin)) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

/* ── SCHEDULED NOTIFICATIONS ─────────────────────────
   The page sends messages like:
   { type:'SCHEDULE', id:'daily', title:'...', body:'...', delay: ms }
   { type:'CANCEL',   id:'daily' }
   { type:'NOTIFY_NOW', title:'...', body:'...' }
──────────────────────────────────────────────────── */
const timers = new Map();

self.addEventListener('message', e => {
  const d = e.data || {};

  if (d.type === 'SCHEDULE') {
    if (timers.has(d.id)) clearTimeout(timers.get(d.id));
    const tid = setTimeout(() => {
      self.registration.showNotification(d.title, {
        body       : d.body,
        icon       : './icon.svg',
        badge      : './icon.svg',
        tag        : d.id,
        renotify   : true,
        vibrate    : [250, 100, 250],
        requireInteraction: false,
        data       : { url: self.location.origin }
      });
      timers.delete(d.id);
    }, d.delay);
    timers.set(d.id, tid);
  }

  if (d.type === 'CANCEL') {
    if (timers.has(d.id)) { clearTimeout(timers.get(d.id)); timers.delete(d.id); }
  }

  if (d.type === 'NOTIFY_NOW') {
    self.registration.showNotification(d.title, {
      body       : d.body,
      icon       : './icon.svg',
      badge      : './icon.svg',
      tag        : d.id || 'cse-now',
      renotify   : true,
      vibrate    : [250, 100, 250],
      data       : { url: self.location.origin }
    });
  }
});

/* ── NOTIFICATION CLICK ───────────────────────────── */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        if (clients.length) return clients[0].focus();
        return self.clients.openWindow(e.notification.data?.url || './My_buddy.html');
      })
  );
});
