# Clean KENKOU ERP - 作業進捗および次回残課題ログ

**最終更新日時**: 2026-09-27 13:00  
**ステータス**: 全体バグ・セキュリティ監査およびコード側セキュリティ修正（全8ファイル、TypeScript型チェック通過）完了。SQLマイグレーションスクリプト作成完了。次回手動作業（3点）およびNetlify月次プッシュ待ち。

---

## 1. 本日完了した作業・進捗サマリー（2026-09-27）

### 🛡️ 【完了✅】 システム全体のバグ・セキュリティ監査および脆弱性修正

システム全体の網羅的な監査（クライアントコード、Supabase設定、API連携、認証・認可）を実施し、発見された脆弱性・不具合に対するコード改修を完了しました。

#### ① 【Critical】 Gemini APIキー漏洩リスクの解消（C-1）
- **対象**: `src/lib/gemini.ts`, `supabase/functions/gemini-analyze/index.ts`
- **内容**: 
  - フロントエンド側から直接 `GEMINI_API_KEY` を参照・実行する処理を廃止。
  - Supabase Edge Function (`gemini-analyze`) を介したサーバーサイド経由でのみ Gemini AI 画像解析を実行する構造に一本化。
  - クライアント側 JS バンドルへの API キー混入・漏洩リスクを完全に遮断。

#### ② 【Critical】 Supabase Anon Key / URL のハードコード除去（C-3）
- **対象**: `src/lib/supabase.ts`
- **内容**:
  - コード内にフォールバック値としてハードコードされていた Supabase URL および Anon Key を完全除去。
  - `import.meta.env.VITE_SUPABASE_URL` および `import.meta.env.VITE_SUPABASE_ANON_KEY` から安全に取得し、未設定時の明確なエラーハンドリングを追加。

#### ③ 【High / Medium】 マスアサインメント（過剰データ更新）防止（H-2, M-5）
- **対象**: `src/hooks/useJobs.ts`, `src/hooks/useStaffSchedules.ts`
- **内容**:
  - `updateJobDetails` および `updateSchedule` において、オブジェクト全体をそのまま DB 更新へ流し込んでいた実装を改修。
  - 許可されたテーブルカラムのみを抽出するホワイトリストフィルタリングを実装し、クライアントからの不正・意図しないカラム書き換えを防止。

#### ④ 【Medium】 CSP（コンテンツセキュリティポリシー）の強化とインラインスクリプト分離（M-4）
- **対象**: `index.html`, `public/register-sw.js`, `netlify.toml`
- **内容**:
  - `index.html` 内にあった Service Worker 登録インラインスクリプトを `public/register-sw.js` へ安全に外部ファイル化。
  - `netlify.toml` の `Content-Security-Policy` ヘッダーから `script-src 'unsafe-inline'` を除去し、XSS攻撃に対する堅牢性を向上。

#### ⑤ 【Database】 RLSポリシー強化・整合性制約 SQL マイグレーションスクリプト作成（C-2, B-4, H-1）
- **対象**: `supabase/security_rls_and_constraints.sql`（新規作成）
- **内容**:
  - 全テーブルの RLS ポリシーを `USING(true)`（未認証含む全開放）から `TO authenticated`（認証済みユーザー限定）に安全に移行する SQL を策定。
  - `invoices.job_id` の UNIQUE 制約を追加し、請求書・領収書の重複発行バグを防止。
  - `handle_new_user` トリガー関数の `SECURITY DEFINER` 統一と権限制限。

#### ⑥ 【検証】 TypeScript 型チェック検証
- `npx tsc --noEmit --skipLibCheck` を実行し、全コードで型エラー 0 件であることを確認完了。

---

## 2. 次回やるべきタスク（残りの手動作業3点 ＋ 今後の予定）

次回作業開始時に、以下の **手動作業3点** を最優先で実施してください。

### 🚨 1. 【手動作業①】Supabase SQLスクリプトの実行（DBセキュリティ反映）
- **場所**: Supabase Dashboard > **SQL Editor**
- **実行ファイル**: [`supabase/security_rls_and_constraints.sql`](file:///c:/Users/有限会社山鹿健康社/Desktop/ちばG/AI/Clean%20KENKOU%20ERP/supabase/security_rls_and_constraints.sql)
- **手順**:
  1. Supabase 管理画面にログインし、プロジェクトの「SQL Editor」を開く。
  2. `supabase/security_rls_and_constraints.sql` の内容をコピー＆ペーストして「Run」を実行。
  3. 全テーブルの RLS ポリシーが `authenticated` 限定に切り替わり、`invoices` の UNIQUE 制約が適用されたことを確認。

### 🚨 2. 【手動作業②】Netlify 環境変数設定（本番環境用）
- **場所**: Netlify Dashboard > **Site configuration** > **Environment variables**
- **背景**: `src/lib/supabase.ts` のフォールバック除去に伴い、Netlify 本番デプロイ時に環境変数設定が必須となりました。
- **手順**:
  以下の2つの環境変数を Netlify の環境変数設定に追加：
  - `VITE_SUPABASE_URL`: Supabase プロジェクトの URL
  - `VITE_SUPABASE_ANON_KEY`: Supabase プロジェクトの anon (public) key

### 🚨 3. 【手動作業③】Supabase Edge Function の再デプロイ
- **場所**: ターミナル または Supabase CLI / Dashboard
- **手順**:
  Supabase CLI が利用可能な環境で以下を実行し、改修後の `gemini-analyze` 関数をデプロイ：
  ```bash
  supabase functions deploy gemini-analyze
  ```
  ※または Supabase Dashboard > Edge Functions からコードを更新・デプロイ。

---

### 🟡 4. 【来月月初】Netlifyビルド枠リセットに伴うリモートプッシュ
- **手順**:
  Netlifyの月間ビルドクレジットがリセットされたタイミングで、以下のコマンドで GitHub へプッシュ：
  ```bash
  git push origin main
  ```

### 🟢 5. 【社内実機テスト・運用検証】
- **内容**:
  - 事務所PCおよび現場スマホ・タブレットにて、ログイン、新規受付、スケジュール連携、AIカメラ見積・手書きサイン受領が正常に機能するか動作確認。

---

## 3. 本日変更したファイル一覧（2026-09-27）

| ファイル | 区分 | 変更概要 |
|---|---|---|
| `src/lib/gemini.ts` | 変更 | Gemini APIのクライアント直呼びを廃止し、Supabase Edge Function (`gemini-analyze`) 経由に統一 |
| `src/lib/supabase.ts` | 変更 | ハードコードされていた Supabase URL / Anon Key のフォールバックを除去し安全化 |
| `src/hooks/useJobs.ts` | 変更 | `updateJobDetails` に許可カラムのみ受け付けるホワイトリスト検証を追加 |
| `src/hooks/useStaffSchedules.ts` | 変更 | `updateSchedule` に許可カラムのみ受け付けるホワイトリスト検証を追加 |
| `index.html` | 変更 | インラインの Service Worker スクリプトを外部ファイルへ切り出し |
| `public/register-sw.js` | 新規 | PWA用 Service Worker 登録スクリプト（外部スクリプト化） |
| `netlify.toml` | 変更 | CSP から `script-src 'unsafe-inline'` を除去 |
| `supabase/functions/gemini-analyze/index.ts` | 変更 | Edge Function のリクエスト受付・Gemini 呼び出しロジックの改善 |
| `supabase/security_rls_and_constraints.sql` | 新規 | RLS ポリシー強化（認証必須化）、invoices.job_id UNIQUE制約付与 SQL スクリプト |
| `docs/current/task.md` | 更新 | 本日のセキュリティ改修進捗および次回やるべき手動タスク3点の記録 |

---

*記録者: Antigravity AI Assistant*
