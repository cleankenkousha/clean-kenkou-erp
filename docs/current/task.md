# Clean KENKOU ERP - 作業進捗および次回残課題ログ

**最終更新日時**: 2026-11-27 16:50

**現在のバージョン**: v1.3.0

**ステータス**:
全システムのソースコードおよび本番 Supabase DB の網羅監査を実施し、ユーザー報告の不具合 **C-1（案件詳細モーダル内での電子サイン・請求入力クリック時に親モーダルごと閉じる問題）** を含む全 **Critical バグ（C-1〜C-12）** および業務影響の大きい **High バグ** を一括修正し、本番ビルド・DBマイグレーションを完了（v1.3.0）。

---

## 1. 本日の作業サマリー（2026-11-27 / v1.3.0）

### 1-1. Critical バグ一括解消（C-1〜C-12）【完了】

1. **C-1（親モーダル強制終了バグ）**:
   * `TaskDetailModal.tsx` 内の `SignaturePadModal` と `InvoiceModal` を親の `.modal-overlay` (`onClick={onClose}`) の外側の兄弟要素へ移動し、両子モーダルにも `stopPropagation()` を追加。サインパッドや請求入力内でのクリック・入力で案件詳細が閉じる不具合を完全解消。
2. **C-2・C-3（`jobs.notes` 相互破壊 ＆ 電子サイン未保存・未印字）**:
   * 共通ヘルパー `src/lib/jobNotes.ts`（`parseJobNotes` / `mergeJobNotes`）を新設し、受付メモ・工程進捗（`stepsData`）・電子サイン（`signature`）・概算見積JSON（`quoteData`）を互いに破壊せずマージ保存するよう `Dashboard.tsx`・`Jobs.tsx`・`Schedule.tsx`・`MobileQuoteModal.tsx` を全面改修。
   * 保存時・印刷時の `signature` 欠落（`Dashboard` / `Jobs` / `Schedule` / `MobileQuoteModal`）を解消。
3. **C-4・C-5・C-6（スケジュール画面の9時間ズレ・連動詳細破綻・架空デモ混入）**:
   * `Schedule.tsx` の `TIMESTAMPTZ` 文字列分割（UTC）による9時間ズレを、ローカル時刻変換ヘルパー（`getLocalDateStr` / `getLocalTimeStr`）へ統一。
   * スケジュールから開く `TaskDetailModal` の読込・保存・論理キャンセル（物理削除の誤爆廃止）・指示書印刷（`PrintArea` 配置）を修正。
   * `useStaffSchedules.ts` の初期デモ予定（山田太郎・高森物産）自動生成と `localStorage` 和集合マージを廃止し、DB を唯一の正に統一。
4. **C-7・C-8（React 18 バッチ更新による DB 保存スキップ）**:
   * `usePriceMaster.ts`（`updateItemPrice`, `moveItemUp`, `moveItemDown`）および `Dashboard.tsx`（`handleTaskMove` カンバン D&D）において、`setState` updater 内で値を代入して直後に同期参照していた不具合を解消。あわせて `price_master` に `volume` / `sort_order` 列を追加マイグレーション。
5. **C-9・C-11（請求保存エラー握り潰し・詳細画面からの乖離欠落・キャンセル状態保存不能）**:
   * `InvoiceModal.tsx` で `invoices.upsert`・`jobs.update` のエラーを厳格に検証し、「未請求 (`unissued`)」で勝手に `billed` へ進む不具合を修正（日付の UTC 1日ズレ・`¥0` 入力・メモ空更新も修正）。
   * `TaskDetailModal.tsx` から `InvoiceModal` へ `rawNotes` を引き渡して事前見積乖離を有効化し、入金完了時の親画面リフェッチを連携。また「失注・キャンセル」選択時の履歴消去・保存巻き戻りを解消。
6. **C-10（スタッフ削除時の外部キー制約エラー・ロールバック欠如）**:
   * `staff_schedules_created_by_fkey` に `ON DELETE SET NULL` を適用する DB マイグレーションを実施し、`useProfiles.ts` の `deleteStaff` で全FK整理と失敗時ロールバックを実装。
7. **C-12（`QuotePrintModal.tsx` Hooks順序違反＆非表示）**:
   * `useEffect` を early return の前に移動し、通常画面でモーダルが正常表示されるよう出力先・クラス構成を修正。

### 1-2. 主要 High バグ解消【完了】

* **見積・印刷 (`MobileQuoteModal`, `PrintQuoteArea`, `index.css`, `Jobs`)**: `kg` 品目の体積 `0.5m³` 張り付き解消（動的重量連動）、印刷見積の英語パックキー表記（`light` 等）修正・諸経費＆割引表示追加、印刷時黒背景ボックスの白地黒文字化、見積未作成案件での架空 ¥18,000 印刷をブロック。
* **ステータス・集計・UI (`statusMapping`, `useSalesData`, `SalesAnalytics`, `Jobs`, `Dashboard`, `KanbanBoard`, `CustomerModal`, `SignaturePadModal`, `ExcelImportModal`, `ExportModal`)**:
  * `completed`/`pending` の詳細保存時先祖返り防止。
  * `useSalesData` からキャンセル案件を除外・未請求完了案件を算入・`quoteAmount === 0` の差額ソート＆負数表記修正。
  * `Jobs` の KPI・タブ二重計上（`collected`/`billed`）解消。
  * `Dashboard` のフィルタータブ CSS クラス修正・`KanbanBoard` の `<DragOverlay>` ID 二重登録解消＆カード短縮番号表示。
  * `CustomerModal` の空欄保存＆顧客名欠落修正。
  * `SignaturePadModal` の1タップ白紙署名防止＆文字列渡り時の404防止。
  * `ExcelImportModal` の2回目再利用リセット＆1行ファイル/日程確定/`備考`列対応、`ExportModal` の `scheduled` 追加＆JST基準年月判定。

---

## 2. システムの現状

| 機能・コンポーネント | 状況 | 備考 |
| :--- | :--- | :--- |
| データベース（Supabase PostgreSQL） | 稼働中（更新済） | `staff_schedules_created_by_fkey` (`ON DELETE SET NULL`)、`price_master.volume/sort_order` 追加済 |
| Edge Function `manage-staff-auth` | Version 2 稼働中 | `verify_jwt: true` ＋ 管理者検証済 |
| Edge Function `gemini-analyze` | Version 11 稼働中 | ※Phase 2 でモデルリスト・応答検証の改修予定 |
| フロントエンド（Netlify 本番環境） | **v1.3.0 ビルド・デプロイ済** | C-1〜C-12 および主要 High バグ修正反映済 |

---

## 3. 次回（Phase 2）で対応予定の残課題・検証項目

### 優先度：高（Phase 2 バグ修正予定）

1. **AI見積 Edge Function (`gemini-analyze/index.ts`) & クライアント (`gemini.ts`) の修正（H-4）**
   * 存在しない先頭2モデル名（`gemini-3.5-flash-lite` 等）を実在モデル（`gemini-2.5-flash` 等）へ修正し404遅延・フォールバック不全を解消。
   * 思考パート (`thought: true`) スキップ・要素スキーマ検証・`!response.ok` チェック・21枚以上時の警告表示を追加。
2. **設定画面（`Settings.tsx`）の管理者アカウント・スタッフ管理強化（H-14）**
   * `handleAddStaff` の Edge Function エラー・6文字未満パスワード検証、`handleSaveStaffAccount` の詳細エラー抽出＆タイマー整理、最後の管理者の降格・削除ガード、削除スタッフの `auth.users` 無効化、管理者の初期タブ遷移競合対策。
   * 単価編集 `prompt` のカンマ付き数値対応（`3,500` → `¥3` 防止）。
3. **受付・ログイン・PWA・スケジュール細部の改善（H-10, H-16 等）**
   * `JobReceptionForm.tsx` / `NewTaskModal.tsx`: 法人名括弧（`（株）` 等）欠損防止、未割当保存許可、顧客サジェスト再選択時の旧電話・住所残留解消、非同期完了前の即閉じ防止、`NewTaskModal` 担当者欄の改善。
   * `Login.tsx`: ハードコードの `DEFAULT_PROFILES` ではなく `useProfiles` / DB と連携して新規登録スタッフ（田中淳様等）も選択可能にする。
   * `PwaInstallControl.tsx` / `register-sw.js`: `beforeinstallprompt` の早期捕捉復元・キャンセル後再クリック時の破棄処理・`?v=1.2.5` 古い参照除去。
   * `Schedule.tsx`: モーダル内の日付入力欄追加・送信中フラグ・開始/終了時刻逆転検証・`19時以降`予定表示改善。

### 優先度：中（DB・ドキュメント・保守）

1. **Supabase リポジトリ SQL 群（`schema.sql` 等）の最新化と `daily_report_*` テーブルのアクセス方針確認**
   * 本番 DB に同居している D日報用 `daily_report_*` 6テーブルの `{anon, authenticated}` RLS 方針を D日報側と確認する。
2. **運用タスク**: 未設定スタッフの個別パスワード発行（`設定 ＞ 担当者・スタッフ管理`）。

---

*記録者: Antigravity AI Assistant*
