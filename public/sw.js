// Clean KENKOU ERP - Service Worker (最軽量版)
// 方針: install を絶対にブロックしない
//       キャッシュはすべて「後から」lazily 行う
// これにより「インストールしています」フリーズを解消します

const CACHE_NAME = 'kenkou-erp-v3';

// ============================================================
// install: 即座に完了させる（キャッシュ処理は一切しない）
// ============================================================
self.addEventListener('install', () => {
  // event.waitUntil() を使わないことで install が瞬時に完了する
  self.skipWaiting();
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
// fetch: ネットワークファースト、失敗時のみキャッシュから返す
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

  // SPA ナビゲーション（画面遷移）: キャッシュの index.html を優先
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // 静的アセット: ネットワークファースト → キャッシュフォールバック
  event.respondWith(
    fetch(request)
      .then((response) => {
        // 正常レスポンスだけキャッシュに保存（エラーや外部レスポンスは保存しない）
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
      .catch(() =>
        // オフライン時はキャッシュから返す
        caches.match(request)
      )
  );
});
