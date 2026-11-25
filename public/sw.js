// Clean KENKOU ERP - Service Worker (最軽量・キャッシュ即時刷新版)
// 方針: install を絶対にブロックしない
//       マニフェスト・アイコン・HTMLは常にネットワークから最新を取得する

const CACHE_NAME = 'kenkou-erp-v1.2.5';

// ============================================================
// install: 即座に完了させる
// ============================================================
self.addEventListener('install', () => {
  self.skipWaiting();
});

// ============================================================
// message: SKIP_WAITING 等に即応
// ============================================================
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ============================================================
// activate: 古いキャッシュ削除 → クライアント掌握
// ============================================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ============================================================
// fetch: ネットワークファースト、アイコン・manifestは常に最新取得
// ============================================================
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // GET 以外はスルー
  if (request.method !== 'GET') return;
  // http/https 以外はスルー
  if (!request.url.startsWith('http')) return;
  // 外部 API はキャッシュしない（常にネットワーク直結）
  const BYPASS_HOSTS = [
    'supabase.co',
    'googleapis.com',
    'gstatic.com',
    'fonts.gstatic.com',
  ];
  if (BYPASS_HOSTS.some((h) => request.url.includes(h))) return;

  const url = new URL(request.url);

  // マニフェストやアイコン類はブラウザキャッシュをバイパスして最新を取得
  if (
    url.pathname.endsWith('manifest.json') ||
    url.pathname.includes('icon-') ||
    url.pathname.includes('apple-touch-icon') ||
    url.pathname.includes('favicon')
  ) {
    event.respondWith(
      fetch(request, { cache: 'no-cache' }).catch(() => caches.match(request))
    );
    return;
  }

  // SPA ナビゲーション（画面遷移）: 常に最新の index.html をネットワーク優先で取得
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-cache' })
        .then((response) => {
          if (response.ok && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', clone));
          }
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // 静的アセット: ネットワークファースト → キャッシュフォールバック
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (
          response.ok &&
          response.type === 'basic' &&
          response.status === 200
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
