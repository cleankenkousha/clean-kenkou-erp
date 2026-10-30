# Clean KENKOU ERP - 作業進捗および次回残課題ログ

**最終更新日時**: 2026-10-30 15:46

**現在のバージョン**: v1.1.9

**ステータス**:
Supabase 一時停止（Paused）からの復旧後、スタッフ個別のログインアカウント直接発行・パスワード管理機能、ログイン画面のスタッフ名ワンタップ選択・ID補完機能、電話受付画面でのログイン担当者自動紐付け、およびログイン・操作履歴管理機能（`activity_logs`）を実装（v1.1.8）。
続けてシステム全体のセキュリティ監査・システムチェックを実施し、全テーブルの未ログイン（`anon`）許可ポリシーの完全撤廃、Edge Functions（`manage-staff-auth` / `gemini-analyze`）の JWT 認証必須化＆管理者（`admin`）権限ガード、DB 関数権限引き締めおよび外部キーインデックス最適化を完了し、本番デプロイ（v1.1.9）および管理者（千葉正和様）の初期パスワード設定まで完了。

---

## 1. 本日の作業サマリー（2026-10-30）

### 1-1. Supabase プロジェクト一時停止（Paused）の原因特定と復旧【完了】

* **事象**: 久々にアプリを開いた際、ログイン画面で `Failed to fetch` が表示されログインできない事象が発生。
* **原因**: Supabase 無料プランの仕様（7日間アクセスがない場合の自動一時停止）により、`cnwlcxfhxaugqtatibav.supabase.co` が停止状態になっていた。
* **対応**: Supabase Dashboard からプロジェクトを Restore（再起動）し、データ欠損なく正常稼働へ復旧。

### 1-2. スタッフ別ログインアカウント直接設定・履歴管理機能の実装（v1.1.8）【完了】

* **データベース拡張（Migration `add_staff_auth_and_activity_logs`）**:
  * `public.profiles` テーブルに `email`、`auth_user_id`、`last_login_at` カラムを追加し、社内スタッフの基本メールアドレス（`〇〇@kenkou.co.jp`）を初期設定。
  * ログイン・ログアウト・案件新規受付・アカウント設定の履歴を記録する `public.activity_logs` テーブルを新設。
  * `handle_new_user` トリガーを更新し、既存スタッフのプロフィールと Auth ユーザーが重複せず自動紐付けされるよう改善。
* **Edge Function `manage-staff-auth` の新規作成・デプロイ**:
  * 実在しない社内用アドレス（例: `chiba@kenkou.co.jp`）でも確認メール不要（`email_confirm: true`）で即座にパスワードを発行・更新できる管理用 Edge Function を構築・配備。
* **フロントエンド機能追加**:
  * `src/pages/Settings.tsx`: 「担当者・スタッフ管理」タブから各スタッフのパスワードを直接設定・変更できるモーダルと、「ログイン・操作履歴」タブを新設。
  * `src/pages/Login.tsx`: スタッフ名ボタンのワンタップ選択と、`@` 以前のIDのみ（例: `chiba`）でも `@kenkou.co.jp` を自動補完してログインできる機能を実装。
  * `src/components/ui/Layout.tsx` & `src/components/features/JobReceptionForm.tsx`: ヘッダーにログイン中スタッフ名を表示し、電話受付時に担当スタッフとして自動セット・記録する連携を実装。

### 1-3. セキュリティ監査・システムチェックと緊急セキュリティ強化（v1.1.9）【完了】

* **セキュリティ・システム監査の実施**:
  * ソースコードの秘密鍵漏えい・XSS・CSPヘッダー・依存パッケージ脆弱性・Supabase Security / Performance Advisors・RLS ポリシーを網羅的に監査。
* **実施したセキュリティ強化対策（Migration `harden_rls_and_security_advisors` & Edge Functions 更新）**:
  1. **Edge Function `manage-staff-auth` の認証＆管理者権限ロック（C-1・H-2 対応）**:
     * `verify_jwt: true` を有効化するとともに、関数内で呼び出し元の JWT トークンと `profiles.role === 'admin'` を厳格に検証。
     * 管理者（千葉正和様）のパスワード設定完了後は、管理者のみがスタッフのパスワード発行・役割変更・削除を行えるようサーバー側・UI側の双方で保護。
  2. **全テーブルの `anon`（未ログイン）全許可ポリシー撤廃（C-2 対応）**:
     * 開発段階から残存していた `Dev allow anon all ...` や `public` ロール向けの全許可・重複ポリシー（計72件の重複警告）をすべて削除し、`authenticated`（ログイン済みユーザー）のみアクセス可能に統一。
     * 旧プロジェクトの残存テーブル（`course_records` / `course_photos`）についても `anon` ポリシーを削除し保護。
  3. **Edge Function `gemini-analyze` の JWT 認証必須化（H-1 対応）**:
     * 前回からの課題であった `gemini-analyze` を `verify_jwt: true`（Version 11）で再デプロイし、未ログインの第三者による AI API 不正利用を遮断。
  4. **DB 関数セキュリティとインデックスの最適化（M-2・M-3・Performance 対応）**:
     * `handle_new_user()` / `rls_auto_enable()` の `PUBLIC, anon, authenticated` からの直接 RPC 実行権限を剥奪（`REVOKE EXECUTE`）。
     * `update_updated_at_column()` に `SET search_path = public` を設定。
     * 外部キーカラム（`jobs.customer_id`, `jobs.assigned_to`, `spot_collections.job_id`, `staff_schedules.profile_id` 等）にインデックスを作成し、Supabase Advisor の DB セキュリティ・パフォーマンス警告をすべて解消。

---

## 2. システムの現状

| 機能・コンポーネント | 状況 | 備考 |
| :--- | :--- | :--- |
| データベース（Supabase PostgreSQL） | 稼働中（保護済） | 全テーブル `authenticated` 限定 RLS、外部キーインデックス適用済 |
| Edge Function `manage-staff-auth` | **Version 2 稼働中** | `verify_jwt: true` ＋ 管理者（`admin`）ロール検証適用済 |
| Edge Function `gemini-analyze` | **Version 11 稼働中** | `verify_jwt: true`、最大20枚対応、複数部屋重複制御 |
| フロントエンド（Netlify本番環境） | **v1.1.9 ビルド・デプロイ済** | スタッフ個別認証・ログイン/操作履歴・管理者権限UIガード適用 |
| 管理者アカウント初期設定 | **設定完了** | `千葉正和` 様（`chiba@kenkou.co.jp` / `admin`）のパスワード設定・紐付け確認済 |

---

## 3. 次回やるべき残課題・未対応

### 優先度：高（業務運用・AI精度改善）

1. **各スタッフの個別パスワード発行と実運用開始**
   * **内容**: 管理者（`chiba@kenkou.co.jp`）でログインし、「設定 ＞ 担当者・スタッフ管理」から他スタッフ（川上様、廣田様、原口様、古川様、木下様、矢部川様、中原様、宮本様）の個別パスワードを設定して配布する。
   * **補足**: 全員が設定完了後、テスト用共通アカウント（`test@example.com`）の削除または無効化を検討する。
2. **同一部屋・複数アングル撮影時における特定品目（テレビ、座卓等）の重複カウント抑制**
   * **現状の課題**: 同一の部屋を別アングルから撮影した複数枚の写真において、同一のテレビや座卓を複数台として重複カウントしてしまうケースがある。
   * **対策方針**: プロンプトにおける「同一部屋判定ロジック（壁・床・配置の特徴一致による空間一意性ルール）」の微調整。

### 優先度：中（セキュリティ・保守）

1. **単価マスタ・自社基本情報の DB レベルでの更新権限分離（必要に応じた検討）**
   * **内容**: 現在 `company_settings` / `price_master` はログイン済みスタッフ全員が更新可能（現場からの単価調整等を考慮）。もし管理者のみに限定したい場合は、RLS の `UPDATE / DELETE` 条件を `admin` ロールのみに絞る。
2. **案件ステータス変更・見積保存・請求発行時の操作履歴（`activity_logs`）記録対象の拡大**
   * **内容**: 現在は「ログイン」「ログアウト」「新規受付登録」「アカウント設定」を自動記録中。必要に応じて「見積確定」「回収完了」「請求書発行」なども履歴タブに記録するよう拡張する。
3. **不要テーブル（`course_records` / `course_photos`）の整理確認**
   * **内容**: 現在は RLS でロック済み（実害なし）。以前のプロジェクトで今後一切使用しないことが確定すれば、バックアップ確認のうえテーブル削除（DROP）を検討。
4. **Supabase Auth の漏えいパスワード保護（Leaked Password Protection）**
   * **内容**: Supabase Pro プラン以上へ移行する機会があれば、Dashboard ＞ Auth ＞ Password Security から有効化する。

### 優先度：低

1. **依存パッケージ `xlsx`（SheetJS）の整理**
   * CSV 出力がメインで Excel 読み込みを行っていない場合、不要であれば `xlsx` パッケージの削除または代替ライブラリへの置き換えで `npm audit` 警告をゼロにする。
2. **Gemini 予備モデルリストの定期メンテナンス**
   * `supabase/functions/gemini-analyze/index.ts` 内のフォールバック候補モデルリストを最新の安定稼働モデルに保つ。

---

*記録者: Antigravity AI Assistant*
