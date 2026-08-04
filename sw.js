// Service worker — offline app shell + runtime cache. Bump CACHE on each release.
const CACHE = 'arcade-v28';
const SHELL = [
  './', './index.html', './app.css', './manifest.webmanifest',
  './icon.svg', './icon-192.png', './icon-512.png', './apple-touch-icon-180.png',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js',
  'https://unpkg.com/mqtt@5.7.0/dist/mqtt.min.js',
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {})))));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // Navigation -> serve cached index (offline fallback).
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('./index.html')));
    return;
  }
  // Cache-first with runtime caching (JS modules carry ?v=N so new deploys fetch fresh).
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
    return res;
  }).catch(() => hit)));
});
