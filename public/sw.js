/**
 * Service Worker — RIDA SUPREME SYSTEM
 *
 * Maneja notificaciones push en background y foreground.
 * Se registra desde el layout principal de la app.
 */

const CACHE_NAME = 'rida-v1';
const STATIC_ASSETS = ['/logo.svg'];

// ============================================
// INSTALL — Pre-cache assets
// ============================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// ============================================
// ACTIVATE — Limpiar caches viejas
// ============================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// ============================================
// PUSH — Mostrar notificacion cuando llega un push
// ============================================
self.addEventListener('push', (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'RIDA', body: 'Nueva notificacion' };
  }

  const title = data.title || 'RIDA SUPREME';
  const body = data.body || data.message || '';
  const notifData = data.data || {};

  const options = {
    body: body,
    icon: data.icon || '/logo.svg',
    badge: data.badge || '/logo.svg',
    vibrate: data.vibrate || [200, 100, 200],
    data: notifData,
    tag: data.tag || `rida-${Date.now()}`,
    renotify: true,
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || [
      { action: 'view', title: 'Ver' },
      { action: 'dismiss', title: 'Cerrar' },
    ],
    timestamp: Date.now(),
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ============================================
// NOTIFICATION CLICK — Abrir la app en la pagina correcta
// ============================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const action = event.action;

  // Si cierra, no hacer nada
  if (action === 'dismiss') return;

  // Determinar URL basada en los datos de la notificacion
  const url = getNotificationUrl(data);

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Intentar enfocar una ventana existente
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        // Si no hay ventana abierta, abrir una nueva
        return self.clients.openWindow(url);
      })
  );
});

// ============================================
// NOTIFICATION CLOSE — Para tracking futuro
// ============================================
self.addEventListener('notificationclose', (event) => {
  // Aqui se podria trackear cuando el usuario cierra una notificacion
});

// ============================================
// PUSH SUBSCRIPTION CHANGE — Manejar cambios
// ============================================
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager.subscribe(event.oldSubscription.options)
      .then((subscription) => {
        // Enviar nueva suscripcion al servidor
        return fetch('/api/push/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('rida-auth-token') || ''}`,
          },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            keys: {
              p256dh: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('p256dh')))),
              auth: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('auth')))),
            },
          }),
        });
      })
      .catch((err) => {
        console.error('[SW] Push subscription change failed:', err);
      })
  );
});

// ============================================
// FETCH — Basic cache-first strategy para assets estaticos
// ============================================
self.addEventListener('fetch', (event) => {
  // Solo cachear assets estaticos
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // No cachear APIs
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Stale-while-revalidate
        fetch(event.request).then((response) => {
          if (response.ok) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, response);
            });
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});

// ============================================
// HELPERS
// ============================================
function getNotificationUrl(data) {
  // Priorizar rutas basadas en tipo y datos
  const type = data.type || '';
  const rideId = data.ride_id;
  const deliveryId = data.delivery_id;

  if (type === 'ride' && rideId) {
    if (data.new_status === 'completed') return `/client/ride/${rideId}`;
    if (data.status === 'assigned') return `/client/ride/${rideId}`;
    return `/client/ride/${rideId}`;
  }

  if (type === 'payment' || type === 'wallet') {
    return '/client/wallet';
  }

  if (type === 'sos') {
    return '/admin';
  }

  if (type === 'verification') {
    return '/client/verification';
  }

  if (type === 'delivery' && deliveryId) {
    return '/courier/deliveries';
  }

  if (type === 'marketplace' || type === 'order') {
    return '/marketplace/orders';
  }

  // Por defecto, ir al inicio
  return '/';
}
