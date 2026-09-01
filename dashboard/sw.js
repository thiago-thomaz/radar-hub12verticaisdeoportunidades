/**
 * ==============================================================================
 * RADAR_HUB — SERVICE WORKER (PWA & WEB PUSH NOTIFICATIONS)
 * ==============================================================================
 * Estratégia de Cache:
 * - Stale-While-Revalidate para UI estática, CSS e scripts.
 * - Network-First para APIs (/api/evaluate, /api/health).
 * - Suporte a Push Notifications com botões de ação (Comprar / Analisar).
 */

const CACHE_NAME = 'radar-hub-cache-v1.0.0';
const STATIC_ASSETS = [
  '/dashboard/',
  '/dashboard/index.html',
  '/dashboard/styles.css',
  '/dashboard/app.js',
  '/dashboard/manifest.json',
  '/dashboard/icons/icon-192.png',
  '/dashboard/icons/icon-512.png',
  '/dashboard/icons/icon.svg'
];

// 1. Instalação e Pré-cache de Recursos Essenciais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pré-armazenando assets essenciais no cache...');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Aviso no pre-cache de alguns assets:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// 2. Ativação e Limpeza de Caches Obsoletos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Estratégia de Roteamento de Fetch
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignora WebSockets e chamadas não-GET
  if (request.method !== 'GET' || url.protocol === 'ws:' || url.protocol === 'wss:') {
    return;
  }

  // API Requests: Network-First com Fallback para Cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Static Assets: Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse.clone()));
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// 4. Tratamento de Notificações Web Push Nativas
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: '🚨 Alerta RADAR_HUB', body: event.data.text() };
    }
  }

  const title = data.title || '🚨 RADAR_HUB: Nova Oportunidade Crítica!';
  const options = {
    body: data.body || 'Desconto excepcional detectado pelos algoritmos de arbitragem.',
    icon: data.icon || '/dashboard/icons/icon-192.png',
    badge: data.badge || '/dashboard/icons/icon-192.png',
    vibrate: [200, 100, 200, 100, 400],
    tag: data.tag || 'radar-alert',
    renotify: true,
    requireInteraction: true,
    data: {
      url: data.url || '/dashboard/index.html',
      opportunityId: data.opportunityId,
      sourceUrl: data.sourceUrl,
      price: data.price
    },
    actions: [
      {
        action: 'buy',
        title: '🛒 Comprar Agora'
      },
      {
        action: 'view',
        title: '📊 Ver Análise'
      }
    ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// 5. Clique na Notificação Push
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notificationData = event.notification.data || {};
  let targetUrl = notificationData.url || '/dashboard/index.html';

  if (event.action === 'buy' && notificationData.sourceUrl) {
    targetUrl = notificationData.sourceUrl;
  } else if (event.action === 'view' && notificationData.opportunityId) {
    targetUrl = `/dashboard/index.html#opp=${notificationData.opportunityId}`;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/dashboard/') && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
