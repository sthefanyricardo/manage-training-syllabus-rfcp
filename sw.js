/**
 * Service Worker para RFCP Tracker PWA
 * Implementa cache de recursos e funcionalidades offline
 * @version 1.0.0
 */

const CACHE_NAME = 'rfcp-tracker-v1.1.0';
const urlsToCache = [
  './',
  './index.html',
  './sync-settings.html',
  './src/assets/styles.css',
  './src/assets/sync-styles.css',
  './src/js/main.js',
  './src/js/sync-manager.js',
  './src/js/sync-manager-aux.js',
  './src/js/confetti.js',
  './src/data/syllabus_rfcp.json'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  console.log('📦 Service Worker: Instalando...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Service Worker: Cache aberto');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('✅ Service Worker: Recursos em cache');
        return self.skipWaiting();
      })
  );
});

// Ativação do Service Worker
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker: Ativando...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Service Worker: Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Service Worker: Ativo');
      return self.clients.claim();
    })
  );
});

// Interceptação de requisições
self.addEventListener('fetch', (event) => {
  // Estratégia: Cache First para recursos estáticos, Network First para APIs
  const isApiRequest = event.request.url.includes('api.github.com');
  
  if (isApiRequest) {
    // Network First para APIs
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // Se a rede falhar, retornar uma resposta offline
          return new Response(
            JSON.stringify({ error: 'Offline - API indisponível' }),
            {
              headers: { 'Content-Type': 'application/json' },
              status: 503
            }
          );
        })
    );
  } else {
    // Cache First para recursos estáticos
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          // Retorna do cache se encontrado, senão busca na rede
          if (response) {
            return response;
          }
          
          return fetch(event.request).then((response) => {
            // Não cachear se não for uma resposta válida
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clonar a resposta para cachear
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          });
        })
    );
  }
});

// Mensagens do cliente
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

console.log('🎯 Service Worker: Configurado e pronto');
