# Clean KENKOU ERP - 作業進捗および次回残課題ログ

**最終更新日時**: 2026-08-18  
**ステータス**: セキュリティ改修（Task C-1 および C-3）実装完了・ビルドパス済み

---

## 1. 本日完了した作業・進捗サマリー

### ① Task C-1: RLSポリシーを認証ユーザー限定に修正
- **Supabase DB Row Level Security の適正化**: [schema.sql](file:///c:/Users/有限会社山鹿健康社/Desktop/ちばG/AI/Clean%20KENKOU%20ERP/supabase/schema.sql) における全7テーブルの全アクセス可 `USING (true) WITH CHECK (true)` ポリシーを撤去。
- **認証ユーザーアクセス制限**: `profiles`, `customers`, `jobs`, `spot_collections`, `invoices`, `price_master` に `auth.role() = 'authenticated'` のポリシーを適用。
- **自社設定 (`company_settings`) の権限分離**: SELECT（参照）は全認証ユーザーに許可し、INSERT/UPDATE/DELETE（作成・更新・削除）は `admin` ロールを持つ認証ユーザー限定にアクセス制限。

### ② Task C-3: Gemini APIキーのサーバーサイドプロキシ化
- **Supabase Edge Function の新設**: [index.ts](file:///c:/Users/有限会社山鹿健康社/Desktop/ちばG/AI/Clean%20KENKOU%20ERP/supabase/functions/gemini-analyze/index.ts) を作成し、環境変数 `GEMINI_API_KEY` によるセキュア通信プロキシを構築。
- **クライアント側APIキー完全非表示・非保持化**: [gemini.ts](file:///c:/Users/有限会社山鹿健康社/Desktop/ちばG/AI/Clean%20KENKOU%20ERP/src/lib/gemini.ts) 内の `localStorage` 取得・保存処理を完全撤去し、`supabase.functions.invoke('gemini-analyze', ...)` 経由へ移行。
- **設定画面 UI の更新**: [Settings.tsx](file:///c:/Users/有限会社山鹿健康社/Desktop/ちばG/AI/Clean%20KENKOU%20ERP/src/pages/Settings.tsx) からブラウザ用 API キー入力フォームを撤去し、サーバー保護状況を示すステータス表示へ刷新。
- **二重フォールバック維持**: Edge Function 未配置時や接続障害時でも概算見積機能が中断しないよう、スマートAI画像認識エンジンへの自動フォールバック構造を確保。

### ③ 品質検証・ビルド確認
- **型チェック**: `npx tsc --noEmit` エラー 0 件（Exit Code: 0）。
- **プロダクションビルド**: `npm run build` による本番ビルドが正常完了（Exit Code: 0）。

---

## 2. 次回以降の残課題・今後の実装計画

### 1. セキュリティ改修（優先項目）
- **C-4: `handle_new_user()` 関数の SECURITY DEFINER 見直し**
  - 新規ユーザー登録トリガー関数の実行権限精査および安全化。
- **H-1: ロールベースアクセス制御 (RBAC) の強化**
  - `AuthContext` によるロール管理一元化、`ProtectedRoute` への権限判定追加、設定ページの権限制限。
- **H-2: ロール変更の admin 限定制限**
  - フロントエンドおよび DB RLS 側での自他ロール変更制限。
- **H-5 / H-8: Netlify セキュリティヘッダー設定**
  - `netlify.toml` に `X-Frame-Options`, `X-Content-Type-Options`, `HSTS`, `CSP` を設定。

### 2. 実環境・運用検証
- **Supabase Edge Function の本番デプロイと環境変数設定**: `supabase secrets set GEMINI_API_KEY=...` による実環境テスト。
- **実現場・複数端末での同期確認**: PC・モバイル間でのリアルタイム同期・新規受付動作テスト。
