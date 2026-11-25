// Service Worker 登録スクリプト（PWA対応）
// タブレットでのインストールフリーズを防ぐため、
// アプリ本体の読み込みを絶対にブロックしない設計
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(function(reg) {
        console.log('[PWA] SW registered, scope:', reg.scope);
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        reg.addEventListener('updatefound', function() {
          var newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', function() {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          }
        });
      })
      .catch(function(err) {
        console.warn('[PWA] SW registration failed (app will still work online):', err);
      });
  });
}
