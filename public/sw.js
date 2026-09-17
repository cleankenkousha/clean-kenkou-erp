// Clean KENKOU ERP - Service Worker for PWA
// v2: インストール時に主要アセットを事前キャッシュし、
//     タブレットでの「インストールしています」フリーズを解消

const CACHE_NAME = 'kenkou-erp-cache-v2';

// インストール時に必ずキャッシュするアセット（オフライン起動のため）
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/favicon.ico',
  '/icon-192.png',
  '/icon-192-maskable.png',
  '/icon-512.png',
  '/icon-512-maskable.png',
  '/apple-touch-icon.png',
];

// ============================================================
// install: 事前キャッシュを完了させてからアクティベート
// ============================================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // 各アセットを個別に試みる（1つ失敗しても全体を止めない）
      return Promise.allSettled(
        PRECACHE_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[SW] precache miss:', url, err);
          })
        )
      );
    }).then(() => {
      // 待機中の SW をすぐに有効化
      return self.skipWaiting();
    })
  );
});

// ============================================================
// activate: 古いキャッシュを削除してクライアントを掌握
// ============================================================
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

// ============================================================
// fetch: キャッシュファースト（オフライン優先）
//        ナビゲーションリクエストは必ず /index.html を返す
// ============================================================
self.addEventListener('fetch', (event) => {
  // GET 以外は SW でハンドルしない
  if (event.request.method !== 'GET') return;
  // http/https 以外（chrome-extension など）は無視
  if (!event.request.url.startsWith('http')) return;
  // Supabase API など外部 API はキャッシュしない（常にネットワーク）
  if (event.request.url.includes('supabase.co')) return;
  if (event.request.url.includes('googleapis.com')) return;
  if (event.request.url.includes('gstatic.com')) return;

  const isNavigation =
    event.request.mode === 'navigate' ||
    event.request.destination === 'document';

  if (isNavigation) {
    // SPA ナビゲーション: キャッシュの /index.html を優先して返す
    event.respondWith(
      caches.match('/index.html').then((cached) => {
        if (cached) return cached;
        return fetch(event.request).catch(() => caches.match('/index.html'));
      })
    );
    return;
  }

  // 静的アセット: キャッシュファースト → ネットワークでフォールバック
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          if (
            response &&
            response.status === 200 &&
            response.type === 'basic'
          ) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // オフライン時: アセットが見つからない場合は空レスポンス
          return new Response('', { status: 408, statusText: 'Offline' });
        });
    })
  );
});
