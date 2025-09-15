// Service Worker - 離線功能支援

const CACHE_NAME = 'bell-scheduler-v1.0.2';
const DATA_CACHE_NAME = 'bell-scheduler-data-v1.0.2';

// 需要快取的核心檔案
const CORE_FILES = [
  './',
  'index.html',
  'css/styles.css',
  'js/app.js',
  'js/audio.js',
  'js/api.js',
  'js/offline.js',
  'audio/bell.mp3',
  'manifest.json',
  // 常用 icons，避免安裝後離線載入不到
  'icons/icon-192.png',
  'icons/icon-512.png'
];

// 安裝事件 - 快取核心檔案
self.addEventListener('install', event => {
  console.log('[SW] Installing...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching core files');
        return cache.addAll(CORE_FILES);
      })
      .then(() => {
        console.log('[SW] Core files cached successfully');
        // 強制新 Service Worker 立即啟用
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[SW] Failed to cache core files:', error);
      })
  );
});

// 啟用事件 - 清理舊快取
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');

  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            // 刪除舊版本的快取
            if (cacheName !== CACHE_NAME && cacheName !== DATA_CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Old caches cleaned');
        // 立即接管所有頁面
        return self.clients.claim();
      })
  );
});

// Fetch 事件 - 網路請求攔截
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 忽略非 HTTP(S) 請求
  if (!request.url.startsWith('http')) {
    return;
  }

  // 導航/HTML 請求使用網路優先，避免一般 Reload 仍拿舊快取
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(handleDocumentRequest(request));
    return;
  }

  // Google Apps Script API 請求的特殊處理
  if (isGASApiRequest(url)) {
    event.respondWith(handleGASApiRequest(request));
    return;
  }

  // 靜態資源請求
  if (isStaticAsset(url)) {
    event.respondWith(handleStaticAssetRequest(request));
    return;
  }

  // 其他請求使用網路優先策略
  event.respondWith(handleOtherRequest(request));
});

// 檢查是否為 GAS API 請求
function isGASApiRequest(url) {
  return url.hostname === 'script.google.com' && url.pathname.includes('/macros/s/');
}

// 檢查是否為靜態資源
function isStaticAsset(url) {
  // 同域的靜態資源
  return url.origin === self.location.origin;
}

// 處理 GAS API 請求（網路優先，快取作為備用）
async function handleGASApiRequest(request) {
  try {
    console.log('[SW] GAS API request:', request.url);

    // 嘗試網路請求
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      // 成功時快取回應（僅快取 GET 請求）
      if (request.method === 'GET') {
        const cache = await caches.open(DATA_CACHE_NAME);
        cache.put(request, networkResponse.clone());
      }

      return networkResponse;
    } else {
      throw new Error(`Network request failed: ${networkResponse.status}`);
    }
  } catch (error) {
    console.warn('[SW] GAS API network request failed:', error);

    // 網路失敗時嘗試從快取回應
    const dataCache = await caches.open(DATA_CACHE_NAME);
    const cachedResponse = await dataCache.match(request);
    if (cachedResponse) {
      console.log('[SW] Serving cached GAS API response');
      return cachedResponse;
    }

    // 無快取時回傳錯誤
    return new Response(
      JSON.stringify({
        error: 'Network unavailable',
        message: 'Unable to connect to server and no cached data available',
        offline: true
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// 處理靜態資源請求（快取優先）
async function handleStaticAssetRequest(request) {
  try {
    const cache = await caches.open(CACHE_NAME);

    // 對 JS/CSS 採用 stale-while-revalidate：先回快取，背景更新
    if (request.destination === 'script' || request.destination === 'style' || request.destination === 'worker') {
      const cached = await cache.match(request);
      const fetchPromise = fetch(request).then(networkResponse => {
        if (networkResponse && networkResponse.ok) {
          cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      }).catch(() => null);

      return cached || fetchPromise || new Response('Network error', { status: 408 });
    }

    // 其他靜態資源維持快取優先
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      console.log('[SW] Serving cached asset:', request.url);
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('[SW] Failed to handle static asset request:', error);

    // 如果是 HTML 頁面請求且失敗，回傳主頁面
    if (request.destination === 'document') {
      const cache = await caches.open(CACHE_NAME);
      const cachedIndex = await cache.match('index.html');
      if (cachedIndex) {
        return cachedIndex;
      }
    }

    // 其他情況回傳網路錯誤
    return new Response('Network error', {
      status: 408,
      statusText: 'Request Timeout'
    });
  }
}

// 處理其他請求（網路優先）
async function handleOtherRequest(request) {
  try {
    return await fetch(request);
  } catch (error) {
    console.warn('[SW] Other request failed:', error);

    // 檢查是否有快取的回應
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    return new Response('Network error', {
      status: 408,
      statusText: 'Request Timeout'
    });
  }
}

// 訊息處理 - 與主頁面通信
self.addEventListener('message', event => {
  const { data } = event;

  switch (data.type) {
    case 'SKIP_WAITING':
      console.log('[SW] Skipping waiting...');
      self.skipWaiting();
      break;

    case 'GET_VERSION':
      event.ports[0].postMessage({
        type: 'VERSION',
        version: CACHE_NAME
      });
      break;

    case 'CLEAR_CACHE':
      clearAllCaches()
        .then(() => {
          event.ports[0].postMessage({
            type: 'CACHE_CLEARED',
            success: true
          });
        })
        .catch(error => {
          event.ports[0].postMessage({
            type: 'CACHE_CLEARED',
            success: false,
            error: error.message
          });
        });
      break;

    default:
      console.log('[SW] Unknown message type:', data.type);
  }
});

// 清除所有快取
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  const deletePromises = cacheNames.map(name => caches.delete(name));
  await Promise.all(deletePromises);
  console.log('[SW] All caches cleared');
}

// 後台同步（如果支援）
if ('sync' in self.registration) {
  self.addEventListener('sync', event => {
    if (event.tag === 'background-sync') {
      console.log('[SW] Background sync triggered');
      event.waitUntil(performBackgroundSync());
    }
  });
}

// 執行後台同步
async function performBackgroundSync() {
  try {
    // 向所有客戶端發送同步請求
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'BACKGROUND_SYNC',
        timestamp: Date.now()
      });
    });

    console.log('[SW] Background sync completed');
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
  }
}

// 通知處理（預留給未來功能）
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification clicked');
  event.notification.close();

  // 開啟或聚焦應用程式
  event.waitUntil(
    self.clients.matchAll().then(clients => {
      if (clients.length > 0) {
        return clients[0].focus();
      } else {
        return self.clients.openWindow('/');
      }
    })
  );
});

console.log('[SW] Service Worker script loaded');