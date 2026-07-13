importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

const CACHE = 'remisgest-v2';
const SHELL = ['/', '/index.html'];

firebase.initializeApp({
  apiKey: "AIzaSyDEv6YW_iTL_X4Vdsk0rdHSpBhoLUMKcC0",
  authDomain: "remisgest.firebaseapp.com",
  projectId: "remisgest",
  storageBucket: "remisgest.firebasestorage.app",
  messagingSenderId: "398145762684",
  appId: "1:398145762684:web:8b0b9566e163319e2ee0f9"
});

const messaging = firebase.messaging();

// Notificaciones cuando la app está en segundo plano
messaging.onBackgroundMessage(payload => {
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || 'Gestión de Remises', {
    body: body || '',
    icon: icon || '/logo-pp.png',
    badge: '/logo-pp.png',
    data: payload.data || {}
  });
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow('/'));
});

self.addEventListener('install', e =>
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()))
);

self.addEventListener('activate', e =>
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
);

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  // No cachear requests de Firebase
  if (e.request.url.includes('firestore.googleapis.com') ||
      e.request.url.includes('firebase') ||
      e.request.url.includes('gstatic.com')) return;
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
