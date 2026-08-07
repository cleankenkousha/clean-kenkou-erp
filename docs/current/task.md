# Clean KENKOU ERP 開発進捗と次回残課題

最終更新日時: 2026-08-07

---

## 📅 本日の実施内容・進捗

### 1. Supabase データベーススキーマ (`schema.sql`) の完全検証・不足テーブルの補完
- [x] **未定義テーブル `company_settings` の新規追加**
  - アプリの `useCompanySettings.ts` がアクセスしている自社情報・帳票印字設定テーブル (`company_settings`) を `schema.sql` に定義追加。
- [x] **未定義テーブル `price_master` の新規追加**
  - アプリの `usePriceMaster.ts` がアクセスしている回収品目・単価マスタテーブル (`price_master`) を `schema.sql` に定義追加。
- [x] **`profiles.role` CHECK 制約の5ロール拡張**
  - `sales`（営業担当）, `dispatcher`（配車担当）, `clerk`（事務担当）を追加し、アプリ実装（`useProfiles.ts`）と完全一致させた。
- [x] **新テーブルのインフラ・セキュリティ設定**
  - 追加した全テーブルに対し `updated_at` 自動更新トリガー、RLS（Row Level Security）有効化、全アクセス許可ポリシーを定義。

### 2. ダッシュボード画面 UI/レイアウトの改善
- [x] **「新規受付」ボタンの配置調整 (`Dashboard.tsx`)**
  - 「臨時収集工程ダッシュボード」見出しタイトルのすぐ右隣に「＋ 新規受付」ボタンを直感的に配置。

### 3. 動作解説および開発サーバーサポート
- [x] **AI自動抽出機能の仕様明確化 (`MobileQuoteModal.tsx`)**
  - 概算見積モーダルにおける現場写真からの品目・数量・体積・単価のAI自動抽出・展開および概算算定の動作仕様を解説。
- [x] **開発サーバー起動対応**
  - `npm.cmd run dev` による Vite 開発サーバーの復旧および `開発サーバー起動.bat` の利用手順案内。

---

### 4. 過去の完了項目（引き継ぎアーカイブ）
- [x] ユーザープロフィール（社内スタッフ管理）の役割5区分拡張と画面統合
- [x] Googleマップ・ナビゲーション（ルート案内）連携機能の全画面実装 (`MapLink.tsx`)
- [x] GitHub リポジトリ連携 & ワンクリック送信ツール (`GitHubへ送信.bat`) の構築
- [x] Netlify デプロイ環境の初期構築 (`netlify.toml`, `public/_redirects`)
- [x] Supabase Auth ログイン認証 & 認証ガード (`Login.tsx`, `ProtectedRoute.tsx`)
- [x] 臨時収集工程アプリの 100% 完全移植（カンバンボード, A4両面指示書印刷 `PrintArea.tsx`）
- [x] 各種マスター管理（顧客管理, 単価マスタ, Excelインポート）

---

## 📌 次回やるべき残課題

- [ ] **1. Supabase 側への更新版 `schema.sql` の反映・接続テスト**:
  - 更新した `schema.sql` を Supabase ダッシュボードの SQL Editor に適用し、`company_settings`, `price_master` テーブルおよび権限設定の反映確認。
- [ ] **2. Netlify / 本番環境デプロイ状態の最終動作確認**:
  - `GitHubへ送信.bat` または `git push` 後の GitHub 連携および Netlify 本番サーバーでの自動デプロイ成果物の最終検証・疎通テスト。
- [ ] **3. スポット回収実績 (`spot_collections`) & 現場写真アップロード機能の拡張**:
  - 現場での写真撮影・写真保存機能と Supabase Storage（ストレージバケット）連携の検討・実装。
- [ ] **4. 請求データ (`invoices`) および集計・請求書発行機能**:
  - `invoices` テーブルと連携した請求ステータス管理、売上集計グラフ、PDF/印刷フォーマットの強化。
