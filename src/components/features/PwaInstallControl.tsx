import React, { useState, useEffect } from 'react'
import { Download, RefreshCw, HelpCircle, CheckCircle2, Smartphone, Monitor } from 'lucide-react'
import { APP_VERSION } from '../../version'

// register-sw.js で早期捕捉された beforeinstallprompt イベントの型定義
declare global {
  interface Window {
    __deferredPwaPrompt?: any
  }
}

interface PwaInstallControlProps {
  variant?: 'header' | 'login'
}

export const PwaInstallControl: React.FC<PwaInstallControlProps> = ({ variant = 'header' }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(() => window.__deferredPwaPrompt || null)
  const [isStandalone, setIsStandalone] = useState(false)
  const [isGuideOpen, setIsGuideOpen] = useState(false)
  const [isClearingCache, setIsClearingCache] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  useEffect(() => {
    // すでにインストール済みアプリ（standalone）として起動しているか判定
    const checkStandalone = () => {
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true
      setIsStandalone(standalone)
    }
    checkStandalone()

    // 早期捕捉済みのプロンプトがあれば反映
    if (window.__deferredPwaPrompt) {
      setDeferredPrompt(window.__deferredPwaPrompt)
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      window.__deferredPwaPrompt = e
      setDeferredPrompt(e)
    }

    const handlePwaReady = () => {
      if (window.__deferredPwaPrompt) {
        setDeferredPrompt(window.__deferredPwaPrompt)
      }
    }

    const handleAppInstalled = () => {
      window.__deferredPwaPrompt = null
      setDeferredPrompt(null)
      setStatusMessage('✅ インストール要求を受付ました！ホーム画面またはデスクトップに緑色のアイコンが作成されます（Androidでは1〜3分ほどかかる場合があります）。')
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('pwa-install-ready', handlePwaReady)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('pwa-install-ready', handlePwaReady)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  // ワンタップでインストールダイアログを起動（利用不可時はガイド＆キャッシュ更新モーダルを表示）
  const handleInstallClick = async () => {
    const promptEvent = deferredPrompt || window.__deferredPwaPrompt
    if (promptEvent) {
      try {
        await promptEvent.prompt()
        const choiceResult = await promptEvent.userChoice
        if (choiceResult?.outcome === 'accepted') {
          window.__deferredPwaPrompt = null
          setDeferredPrompt(null)
          setStatusMessage('✅ インストールを開始しました！Android端末ではホーム画面にアイコンが出るまで1〜3分ほどそのままお待ちください。')
          setIsGuideOpen(true)
        }
      } catch (err) {
        console.warn('PWA prompt error:', err)
        setIsGuideOpen(true)
      }
    } else {
      setIsGuideOpen(true)
    }
  }

  // 古いService Workerとブラウザキャッシュを完全消去して最新カラー・新アイコンを強制再読込
  const handleForceResetCache = async () => {
    setIsClearingCache(true)
    setStatusMessage('古いキャッシュとService Workerを完全消去しています...')
    try {
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((key) => caches.delete(key)))
      }
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        await Promise.all(registrations.map((reg) => reg.unregister()))
      }
      setStatusMessage('✅ キャッシュを完全消去しました！最新画面を再読み込みします...')
      setTimeout(() => {
        const url = new URL(window.location.href)
        url.searchParams.set('v', `${APP_VERSION}-${Date.now()}`)
        window.location.replace(url.toString())
      }, 600)
    } catch (err) {
      console.error('Cache reset error:', err)
      window.location.reload()
    }
  }

  return (
    <>
      {variant === 'header' ? (
        <button
          type="button"
          onClick={handleInstallClick}
          className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-brand-soft text-brand-text border border-brand-border hover:bg-brand-main hover:text-white transition-all shadow-xs min-h-[36px] cursor-pointer"
          title="アプリをホーム画面・デスクトップにインストール / アイコン・カラー最新化"
        >
          <Download className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="hidden xl:inline">
            {deferredPrompt ? 'アプリをインストール' : isStandalone ? 'アイコン・画面更新' : 'アプリ追加 / 更新'}
          </span>
        </button>
      ) : (
        <div className="pt-2 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleInstallClick}
            className="w-full sm:w-auto flex-1 flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-brand-soft text-brand-text border border-brand-border hover:bg-brand-main hover:text-white transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 flex-shrink-0" />
            <span>
              {deferredPrompt
                ? '📲 アプリをホーム画面・PCにインストール'
                : '📲 アプリのインストール / アイコンが出ない場合'}
            </span>
          </button>
          <button
            type="button"
            onClick={handleForceResetCache}
            disabled={isClearingCache}
            className="w-full sm:w-auto flex items-center justify-center space-x-1 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors cursor-pointer"
            title="古いキャッシュを消去して最新の緑テーマとアイコンを強制反映します"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isClearingCache ? 'animate-spin' : ''}`} />
            <span>キャッシュ強制更新</span>
          </button>
        </div>
      )}

      {/* インストール＆アイコン復活ガイドモーダル */}
      {isGuideOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
          onClick={() => setIsGuideOpen(false)}
        >
          <div
            className="bg-white w-full max-w-lg rounded-2xl border border-border border-t-4 border-t-brand-main shadow-2xl p-5 md:p-6 space-y-4 max-h-[90vh] overflow-y-auto text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div className="flex items-center space-x-2.5">
                <img
                  src="/icon-green-192.png?v=1.2.5"
                  alt="健康社ERP 新アイコン"
                  className="w-10 h-10 rounded-xl shadow-sm border border-brand-border"
                />
                <div>
                  <h3 className="text-sm md:text-base font-bold text-main">
                    アプリのインストール・緑アイコン復活ガイド
                  </h3>
                  <p className="text-[11px] text-sub">
                    クリーン健康社 公式カラー（緑 #059669）対応版 ({APP_VERSION})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGuideOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold px-1.5"
              >
                ✕
              </button>
            </div>

            {statusMessage && (
              <div className="p-3 rounded-xl bg-brand-soft border border-brand-border text-brand-text font-bold flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{statusMessage}</span>
              </div>
            )}

            {/* STEP 1: ワンタップ操作 */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <div className="font-bold text-main flex items-center gap-1.5">
                <span className="px-2 py-0.5 bg-brand-main text-white rounded text-[10px]">手順 1</span>
                <span>まずは古いキャッシュを消去して最新アイコンを読み込む</span>
              </div>
              <p className="text-sub leading-relaxed">
                以前インストールしていたアプリの情報がブラウザに残っていると、アンインストール直後に「インストール」ボタンが消えたり、古い色（紫の🗃️）のままになることがあります。下のボタンを押すと最新状態にリセットされます。
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {deferredPrompt && (
                  <button
                    type="button"
                    onClick={handleInstallClick}
                    className="flex-1 min-w-[180px] flex items-center justify-center space-x-1.5 py-2.5 px-4 bg-brand-main hover:bg-brand-hover text-white font-bold rounded-xl shadow-sm cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>今すぐアプリをインストール</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleForceResetCache}
                  disabled={isClearingCache}
                  className="flex-1 min-w-[180px] flex items-center justify-center space-x-1.5 py-2.5 px-4 bg-white hover:bg-brand-soft text-brand-text border-2 border-brand-main font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${isClearingCache ? 'animate-spin' : ''}`} />
                  <span>🔄 キャッシュ完全消去＆最新化</span>
                </button>
              </div>
            </div>

            {/* STEP 2: 端末別のアイコン復活手順 */}
            <div className="space-y-3">
              <div className="font-bold text-main flex items-center gap-1.5">
                <span className="px-2 py-0.5 bg-brand-main text-white rounded text-[10px]">手順 2</span>
                <span>端末別の再インストール・アイコン確認方法</span>
              </div>

              {/* Android タブレット・スマホ */}
              <div className="p-3 rounded-xl border border-border space-y-1.5">
                <div className="font-bold text-brand-text flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4" />
                  <span>📱 Android タブレット・スマホ（Chrome）の場合</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-slate-700 leading-relaxed">
                  <li>Chrome 右上の <strong>「⋮」</strong>（縦3点）をタップ → <strong>「ホーム画面に追加」</strong> → <strong>「インストール」</strong> を押します。</li>
                  <li>
                    <strong>【重要】アイコンが出るまで 1〜3分お待ちください</strong>：
                    Android では裏で Google サーバーが専用アプリ（緑色アイコン）を生成するため、<strong>完了してホーム画面にアイコンが現れるまで 1〜3分ほどタイムラグ</strong>があります。
                  </li>
                  <li>
                    <strong>ホーム画面に見当たらない場合</strong>：ホーム画面を左右にスワイプして<strong>2ページ目・3ページ目の空き枠</strong>を見るか、画面下から上にスワイプして<strong>「すべてのアプリ一覧（ドロワー）」</strong>を開くと「健康社ERP」が入っています（長押しでホーム画面へ移動できます）。
                  </li>
                </ol>
              </div>

              {/* Windows PC */}
              <div className="p-3 rounded-xl border border-border space-y-1.5">
                <div className="font-bold text-brand-text flex items-center gap-1.5">
                  <Monitor className="w-4 h-4" />
                  <span>💻 パソコン（Windows Chrome / Edge）の場合</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-slate-700 leading-relaxed">
                  <li>
                    アドレスバー右端の <strong>インストールアイコン（パソコンに下矢印）</strong> をクリックするか、右上 <strong>「⋮」</strong>（または「…」）＞ <strong>「キャスト、保存、共有（または アプリ）」</strong> ＞ <strong>「ページをアプリとしてインストール」</strong> をクリックします。
                  </li>
                  <li>
                    <strong>アンインストール直後にアイコンが出ない場合</strong>：上の「🔄 キャッシュ完全消去＆最新化」を押したあと、<strong>ブラウザ（Chrome/Edge）を一度すべて閉じてから開き直す</strong>とインストールボタンが復活します。
                  </li>
                </ol>
              </div>

              {/* iPhone / iPad */}
              <div className="p-3 rounded-xl border border-border space-y-1">
                <div className="font-bold text-brand-text flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4" />
                  <span>🍏 iPhone / iPad（Safari）の場合</span>
                </div>
                <p className="text-slate-700 leading-relaxed">
                  画面上部または下部の <strong>共有ボタン（四角から上矢印）</strong> をタップし、<strong>「ホーム画面に追加」</strong> を選ぶと緑色の新アイコンで追加されます。
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setIsGuideOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl cursor-pointer"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
