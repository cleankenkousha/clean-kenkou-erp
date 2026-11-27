# Clean KENKOU ERP - 作業進捗および次回残課題ログ

**最終更新日時**: 2026-11-27 17:35

**現在のバージョン**: v1.4.0

**ステータス**:
**実施日ベースの月別見積金額 vs 売上金額ダッシュボード**（作業実施日 `scheduled_date`・予想見積 `estimated_amount` の入力対応、実施日ベース月別比較グラフ・月別サマリー表・案件別クイック編集）を実装・ビルド・反映済み（v1.4.0）。

---

## 1. 本日の機能拡張サマリー（2026-11-27 / v1.4.0）

1. **実施日ベース集計ロジック（`useSalesData.ts`）**:
   * `jobs.scheduled_date`（作業実施日 `YYYY-MM`）を基準月に、キャンセル案件を除外した月別の見積金額（作業実施済 / 実施日確定）と確定売上金額（入金済 / 請求済）を集計。
   * 見積金額は正式見積（`notes.quoteData.grandTotal`）を優先し、見積不要案件や正式見積未作成案件では新規追加した `jobs.estimated_amount`（予想見積金額）を採用。
   * 作業実施日を翌月へ延期・変更した場合は旧月から外れて変更先の月へ自動移動。
2. **作業実施日・予想見積金額の入力機能（DB / モーダル / 各画面）**:
   * DB マイグレーション `add_jobs_estimated_amount_column` により `jobs.estimated_amount` (`NUMERIC(12, 2)`) を追加し、`docs/03_Business_Rules_Book.md` / `docs/04_Database_Design.md` / `supabase/schema.sql` を同期。
   * `TaskDetailModal.tsx` に「作業実施日（売上・見積 基準月）」（作業実施ステータス変更時に当日を自動補完、「今日」「クリア」付）と「予想見積金額（見積不要案件向け）」入力欄を追加。`Dashboard.tsx`・`Jobs.tsx`・`Schedule.tsx`・`InvoiceModal.tsx` に連携。
3. **売上管理画面ダッシュボード刷新（`SalesAnalytics.tsx`）**:
   * 月別「見積金額（実施済＋実施日確定） vs 確定売上（入金済＋請求済）」比較棒グラフ（クリックで月絞り込み可）と「実施日確定＋実施済／作業実施済のみ」切替ピルを実装。
   * 選択月の確定売上・見積金額・達成率プログレスバー・未請求残（売上化待ち）・累計回収率の KPI カード、月別サマリー一覧、実施日未設定アラートバナーを実装。
   * 案件明細一覧から「実施日・予想」クイック編集モーダルおよび「請求（`InvoiceModal`）」を直接呼び出し可能。

---

## 2. 過去の作業（2026-11-27 / v1.3.0〜v1.3.1）

* **v1.3.1 (Phase 2)**: AI見積 `gemini-analyze` (Version 12) モデル順・思考除外・スキーマ検証、スタッフ設定 `manage-staff-auth` (Version 3) 自己削除/最終管理者保護・アカウント削除、ログインスタッフRPC `get_login_staff_list()`、電話受付・新規受付・スケジュール・PWA改善。
* **v1.3.0 (Phase 1)**: Critical 12件（C-1〜C-12）および主要 High バグ一括解消。

---

## 3. システムの現状・確認事項

| 機能・コンポーネント | 状況 | 備考 |
| :--- | :--- | :--- |
| データベース（Supabase PostgreSQL） | 稼働中（最新） | `jobs.estimated_amount` 追加済、`get_login_staff_list()` RPC 稼働中 |
| Edge Function `manage-staff-auth` | Version 3 稼働中 | `verify_jwt: true` |
| Edge Function `gemini-analyze` | Version 12 稼働中 | `verify_jwt: true` |
| フロントエンド（Netlify 本番環境） | **v1.4.0 反映対象** | 実施日ベース 見積・売上ダッシュボード搭載 |

### 今後の確認・運用タスク
1. **D日報用 `daily_report_*` テーブルの RLS 方針確認**: `{anon, authenticated}` 許可のまま維持中。D日報側で認証化が完了したタイミングで制限を検討。
2. **未設定スタッフの個別パスワード発行**: `設定 ＞ 担当者・スタッフ管理`。

---

*記録者: Antigravity AI Assistant*
