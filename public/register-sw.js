// Service Worker 登録 & PWA インストールプロンプト早期捕捉スクリプト
window.__deferredPwaPrompt = null;

window.addEventListener('beforeinstallprompt', function(e) {
  // Chrome標準のミニバー自動消滅を防ぎ、画面内の「アプリをインストール」ボタンから確実に呼べるよう保持
  e.preventDefault();
  window.__deferredPwaPrompt = e;
  window.dispatchEvent(new Event('pwa-install-ready'));
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js?v=1.2.5', { scope: '/', updateViaCache: 'none' })
      .then(function(reg) {
        console.log('[PWA] SW registered, scope:', reg.scope);
        // 起動時に毎回SWの更新チェックを実行
        reg.update().catch(function() {});

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
