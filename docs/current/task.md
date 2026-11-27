# Clean KENKOU ERP - 作業進捗および次回残課題ログ

**最終更新日時**: 2026-11-27 17:15

**現在のバージョン**: v1.3.1

**ステータス**:
全システム監査に基づく **Phase 1（C-1〜C-12・主要 High バグ）** および **Phase 2（H-4, H-10, H-14, H-16 等・Edge Function 更新・RPC追加・スキーマ同期）** の修正をすべて完了し、ビルド検証・本番反映済み（v1.3.1）。

---

## 1. Phase 2 修正サマリー（2026-11-27 / v1.3.1）

1. **AI見積 Edge Function & クライアント強化（H-4）**:
   * `supabase/functions/gemini-analyze/index.ts` (Version 12 デプロイ済): 実在モデル順（`gemini-2.5-flash` / `gemini-2.5-flash-lite` / `gemini-2.0-flash`）へ修正し、思考パート (`thought: true`) 除外・要素スキーマ検証・`kg` 品目のマスタ体積出力適正化を実装。
   * `src/lib/gemini.ts` & `MobileQuoteModal.tsx`: 画像 `fetch` HTTP エラー検証、21枚以上選択時の警告表示、クライアント側要素サニタイズを追加。
2. **設定画面・スタッフ認証管理強化（H-14）**:
   * `supabase/functions/manage-staff-auth/index.ts` (Version 3 デプロイ済): 削除スタッフの Supabase Auth アカウント削除 (`delete_staff_account`)、自己削除禁止、最後の管理者アカウント削除防止、`activity_logs` (`account_delete`) 記録を追加。
   * `src/hooks/useProfiles.ts` & `src/pages/Settings.tsx`: `addStaff` 失敗時のロールバック、初期タブ自動切替の認証完了待ち (`isAuthResolved`)、スタッフ追加時の初期パスワード設定バリデーションと Edge Function エラー表示、最後の管理者降格・削除ガード、カンマ/全角数値対応の単価編集、モーダルクローズタイマー整理を実装。
3. **受付・ログイン・PWA・スケジュール細部改善（H-10, H-16 等）**:
   * `src/pages/Login.tsx` & `public.get_login_staff_list()` RPC: DB の最新登録スタッフを含めたワンタップ入力に対応。
   * `JobReceptionForm.tsx`: 法人名括弧（`（株）` 等）保護、顧客サジェスト切替時の旧住所クリア、初回のみログインスタッフ自動セット（未割当保存許可）、`.is('deleted_at', null).limit(1)` 照合、時刻逆転チェック＆スケジュール連携警告表示を実装。
   * `NewTaskModal.tsx` & `Dashboard.tsx`: 送信中二重クリック防止、非同期保存成功後クローズ、ログインスタッフ自動セット＋ `<datalist>` 選択、旧電話・住所クリア、UUID スタッフ誤作成防止、`schErr` 通知を実装。
   * `public/register-sw.js` & `PwaInstallControl.tsx`: `beforeinstallprompt` 早期捕捉復元、消費済みプロンプト破棄、古いアイコンクエリ除去。
   * `Schedule.tsx`: タイムライン表示を 8:00〜21:00 へ拡張、予約・予定モーダルへ日付入力欄追加、開始/終了時刻逆転チェック、送信中フラグ、`addSchedule` 失敗時エラー通知、`new Date(\`${date}T00:00:00\`)` ローカル解釈統一を実装。
4. **SQL スキーマ最新化**:
   * `supabase/schema.sql` を本番 DB の最新スキーマ・FK・UNIQUE制約・RLS・RPC と同期。

---

## 2. Phase 1 修正サマリー（2026-11-27 / v1.3.0）

* **Critical 全12件（C-1〜C-12）**: 親モーダル強制終了バグ (`TaskDetailModal` + `SignaturePadModal` / `InvoiceModal`)、`jobs.notes` 相互破壊＆電子サイン欠落、`Schedule` 9時間ズレ＆連動詳細・論理キャンセル、`useStaffSchedules` デモ混入、`usePriceMaster` / `Dashboard` の React 18 バッチ更新、請求保存エラー・詳細画面乖離、`staff_schedules` 外部キー制約、スタッフ削除ロールバック、`QuotePrintModal` Hooks順序・非表示を解消。
* **主要 High バグ**: `kg` 体積連動・印刷表記/黒背景修正・見積未作成印刷ブロック・ステータス保持・売上集計・KPI二重計上・D&Dオーバーレイ・顧客更新・署名Canvas安全化・Excel取込/出力を解消。

---

## 3. システムの現状・確認事項

| 機能・コンポーネント | 状況 | 備考 |
| :--- | :--- | :--- |
| データベース（Supabase PostgreSQL） | 稼働中（最新） | `get_login_staff_list()` RPC、`staff_schedules_created_by_fkey`、`price_master.volume/sort_order` 反映済 |
| Edge Function `manage-staff-auth` | Version 3 稼働中 | `verify_jwt: true`、アカウント設定・削除保護対応 |
| Edge Function `gemini-analyze` | Version 12 稼働中 | `verify_jwt: true`、実在モデル・思考除外・スキーマ検証対応 |
| フロントエンド（Netlify 本番環境） | **v1.3.1 反映対象** | Phase 1 + Phase 2 全修正反映済 |

### 今後の確認・運用タスク
1. **D日報用 `daily_report_*` テーブルの RLS 方針確認**: 本番 DB に同居している `daily_report_*` 6テーブルは `{anon, authenticated}` 許可のまま維持しています（D日報アプリへの影響を避けるため未変更）。D日報側で認証化が完了した後に制限を検討してください。
2. **未設定スタッフの個別パスワード発行**: `設定 ＞ 担当者・スタッフ管理` から必要なスタッフのログインID・パスワードを設定してください。

---

*記録者: Antigravity AI Assistant*
