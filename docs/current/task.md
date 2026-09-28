# Clean KENKOU ERP - 作業進捗および次回残課題ログ

**最終更新日時**: 2026-09-28 13:00  
**ステータス**: 全体バグ・セキュリティ監査、コード修正、およびすべての手動設定タスク（SQL適用・環境変数・Edge Functionデプロイ）が完了。次回はNetlify月次プッシュ待ち。

---

## 1. 本日完了した作業・進捗サマリー（2026-09-28）

前回までのコード修正に引き続き、本日は以下の**手動設定タスクをすべて完了**しました。

### 🚨 【完了✅】 1. Supabase SQLスクリプトの実行（DBセキュリティ反映）
- `supabase/security_rls_and_constraints.sql` を実行完了。
- 全テーブルの RLS ポリシーが `authenticated` 限定に切り替わり、`invoices.job_id` に UNIQUE 制約が適用されました。
- **課題対応済**: 実行時に発生した `profiles` テーブルのカラム違いエラー（`user_id` -> `id`）も修正して反映完了。

### 🚨 【完了✅】 2. Netlify 環境変数設定（本番環境用）
- Netlify ダッシュボードにて以下の環境変数を設定完了。
  - `VITE_SUPABASE_URL`: `https://cnwlcxfhxaugqtatibav.supabase.co`
  - `VITE_SUPABASE_ANON_KEY`: （設定済）

### 🚨 【完了✅】 3. Supabase Edge Function の再デプロイ
- `npx supabase functions deploy gemini-analyze --use-api` コマンドを使用し、新しいセキュリティ対応済みの Edge Function をデプロイ完了。

---

## 2. 過去に完了したコード修正（2026-09-27）

- **Gemini APIキー漏洩リスクの解消**: `src/lib/gemini.ts` を修正し、直接のAPI呼び出しを廃止。
- **Supabaseキーのハードコード除去**: `src/lib/supabase.ts` を修正し、環境変数からの取得に統一。
- **マスアサインメント防止**: `src/hooks/useJobs.ts`, `src/hooks/useStaffSchedules.ts` にホワイトリストを追加。
- **CSP強化**: Service Workerスクリプトを外部ファイル化し、`netlify.toml` の設定を強化。
- **TypeScript型チェック**: エラー0件を確認。

---

## 3. 次回やるべきタスク（今後の予定）

今回のコード修正はローカル環境に保存されています。これらを本番環境に反映するためのタスクです。

### 🟡 1. 【来月月初】Netlifyビルド枠リセットに伴うリモートプッシュ
- **手順**:
  Netlifyの月間ビルドクレジットがリセットされたタイミングで、以下のコマンドで GitHub へプッシュ：
  ```bash
  git push origin main
  ```

### 🔴 2. 【プッシュ後】AI画像解析機能（Gemini）の動作確認
- **背景**: AI機能はGoogle AI Studio発行のAPIキーを使い、Supabase Edge Function（`gemini-analyze`）経由でGemini APIに画像を送って解析する仕組み。Edge Functionは本日デプロイ済みだが、フロントエンドコードはまだプッシュされていないため、プッシュ後に正常動作するか確認が必要。
- **確認手順**:
  1. Supabase Dashboard > 左メニュー「**Edge Functions**」> `gemini-analyze` を選択
  2. 「**Secrets**」タブに `GEMINI_API_KEY` が設定されているか確認
  3. 未設定の場合、Google AI Studio（https://aistudio.google.com/app/apikey）で発行したAPIキーを登録
  4. 本番サイトでAIカメラ見積を実行し、画像解析が正常に動作するかテスト

### 🟠 3. 【推奨】MobileQuoteModal の不要なAPIキー入力UI削除
- **内容**: `src/components/features/MobileQuoteModal.tsx` に「🔑 APIキーを更新・診断」ボタンが残存している。Edge Function経由に移行済みのため不要。セキュリティ上の実害はないがユーザーの混乱を招く可能性がある。
- **対象箇所**: 368行目の `localStorage.getItem('clean_kenkou_gemini_api_key')` および790〜816行目のAPIキー入力ダイアログ

### 🟢 4. 【社内実機テスト・運用検証】
- **内容**:
  - 事務所PCおよび現場スマホ・タブレットにて、ログイン、新規受付、スケジュール連携、AIカメラ見積・手書きサイン受領が正常に機能するか動作確認。

---

*記録者: Antigravity AI Assistant*
