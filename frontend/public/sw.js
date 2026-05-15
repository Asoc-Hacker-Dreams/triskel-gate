const CACHE_NAME = 'triskelgate-dashboard-v1.0.0';
const STATIC_CACHE = 'static-v1.0.0';
const DYNAMIC_CACHE = 'dynamic-v1.0.0';

// Archivos estáticos para cachear
const STATIC_FILES = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// URLs de API para cache dinámico
const API_URLS = [
  '/api/validate',
  '/api/search',
  '/api/events',
  '/auth/login'
];

// Instalar service worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static files');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('[SW] Static files cached successfully');
        return self.skipWaiting(); // Activar inmediatamente
      })
      .catch((error) => {
        console.error('[SW] Error caching static files:', error);
      })
  );
});

// Activar service worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    // Limpiar caches antiguos
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim(); // Tomar control inmediatamente
      })
  );
});

// Interceptar fetch requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Solo manejar requests del mismo origen
  if (url.origin !== self.location.origin) {
    return;
  }
  
  // Estrategia para archivos estáticos: Cache First
  if (STATIC_FILES.some(file => url.pathname.includes(file))) {
    event.respondWith(cacheFirst(request));
    return;
  }
  
  // Estrategia para API: Network First con fallback
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) {
    event.respondWith(networkFirstWithOfflineSupport(request));
    return;
  }
  
  // Para todo lo demás: Network First
  event.respondWith(networkFirst(request));
});

// Cache First Strategy (para archivos estáticos)
async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[SW] Serving from cache:', request.url);
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('[SW] Cache first error:', error);
    return new Response('Error de red', { status: 503 });
  }
}

// Network First Strategy (para contenido dinámico)
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fallback para páginas HTML
    if (request.destination === 'document') {
      const fallbackResponse = await caches.match('/');
      if (fallbackResponse) {
        return fallbackResponse;
      }
    }
    
    return new Response('Sin conexión', { status: 503 });
  }
}

// Network First con soporte offline específico para API
async function networkFirstWithOfflineSupport(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cachear respuestas exitosas de la API
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] API request failed, checking cache:', request.url);
    
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // Agregar header para indicar que viene del cache
      const response = cachedResponse.clone();
      response.headers.set('X-Cache-Status', 'offline');
      return response;
    }
    
    // Respuesta offline específica para cada endpoint
    return createOfflineResponse(request);
  }
}

// Crear respuestas offline específicas
function createOfflineResponse(request) {
  const url = new URL(request.url);
  
  if (url.pathname.includes('/api/validate')) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Sin conexión. No se puede validar el ticket.',
      offline: true
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  if (url.pathname.includes('/api/search')) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Sin conexión. Búsqueda no disponible.',
      offline: true,
      tickets: []
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  if (url.pathname.includes('/api/events')) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Sin conexión. Información de eventos no disponible.',
      offline: true,
      events: []
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return new Response(JSON.stringify({
    success: false,
    error: 'Sin conexión a internet',
    offline: true
  }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Escuchar mensajes del cliente para sincronización
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CACHE_UPDATE':
      updateCache(data);
      break;
      
    case 'GET_CACHE_STATUS':
      getCacheStatus().then(status => {
        event.ports[0].postMessage(status);
      });
      break;
  }
});

// Actualizar cache manualmente
async function updateCache(urls = STATIC_FILES) {
  try {
    const cache = await caches.open(STATIC_CACHE);
    await cache.addAll(urls);
    console.log('[SW] Cache updated manually');
  } catch (error) {
    console.error('[SW] Error updating cache:', error);
  }
}

// Obtener estado del cache
async function getCacheStatus() {
  const cacheNames = await caches.keys();
  const status = {
    caches: cacheNames,
    staticCacheExists: cacheNames.includes(STATIC_CACHE),
    dynamicCacheExists: cacheNames.includes(DYNAMIC_CACHE),
    version: CACHE_NAME
  };
  
  return status;
}

// Background sync para validaciones offline
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'ticket-validation-sync') {
    event.waitUntil(syncPendingValidations());
  }
});

// Sincronizar validaciones pendientes
async function syncPendingValidations() {
  try {
    // Aquí implementarías la lógica para sincronizar
    // validaciones que se hicieron offline
    console.log('[SW] Syncing pending validations...');
    
    // Notificar al cliente que la sincronización terminó
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        data: { validations: 'synced' }
      });
    });
  } catch (error) {
    console.error('[SW] Error syncing validations:', error);
  }
}

// Push notifications (opcional para futuras funcionalidades)
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  if (!event.data) return;
  
  const data = event.data.json();
  const options = {
    body: data.body || 'Nueva notificación',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    vibrate: [200, 100, 200],
    data: data.data || {},
    actions: [
      {
        action: 'view',
        title: 'Ver',
        icon: '/icons/icon-96x96.png'
      },
      {
        action: 'dismiss',
        title: 'Descartar'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'TriskelGate Validator', options)
  );
});

// Manejar clics en notificaciones
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});
