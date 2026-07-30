# 04_Database Design

## 第1章：データベース設計思想 (Database Philosophy)

### 1.1 基本ルール

* **データベースエンジン** : Supabase (PostgreSQL) を利用する。
* **命名規則** : テーブル名およびカラム名は「スネークケース（小文字とアンダースコア）」で統一する（例：`customer_id`）。
* **タイムスタンプの必須化** : 全テーブルに `created_at`（作成日時）と `updated_at`（更新日時）を持たせ、データの履歴を追えるようにする。
* **論理削除 (Soft Delete)** : 誤操作によるデータ消失を防ぐため、物理的な削除は行わず、`deleted_at`（削除日時）カラムに日付を入れることで「削除扱い」とする。

### 1.2 セキュリティと認証 (Supabase Auth & RLS)

* ユーザーのログイン管理は、Supabase組み込みの `auth.users` テーブルを使用する。
* 業務上の権限（Admin / Operator）や表示名は、独自に作成する `profiles` テーブルで管理し、`auth.users` と連携させる。
* **RLS (Row Level Security)** を有効化し、「APIキーが漏れても、ログインしていないユーザーは一切データを読み書きできない」状態をデータベースレベルで担保する。

## 第2章：主要テーブル定義（Phase1対象）

### 2.1 profiles (ユーザー・担当者)

システムを利用する社員・オペレーターの情報を管理するテーブル。

* `id`: UUID (Primary Key, `auth.users.id` と連携)
* `display_name`: 表示名（例：山田太郎）
* `role`: 権限（`admin`, `operator`）
* `created_at`: 作成日時

### 2.2 customers (顧客マスター)

スポット回収などを依頼してくる顧客の情報を管理するテーブル。

* `id`: UUID (Primary Key)
* `name`: 顧客名（企業名・個人名）
* `phone`: 電話番号（検索用にハイフンなし等の正規化を検討）
* `address`: 住所
* `created_at`: 作成日時
* `updated_at`: 更新日時
* `deleted_at`: 削除日時（論理削除用）

### 2.3 jobs (案件 - 最重要テーブル)

システムの中核となる案件テーブル。「1回の依頼＝1レコード」として管理する。

* `id`: UUID (Primary Key)
* `customer_id`: UUID (Foreign Key -> `customers.id`)
* `title`: 案件の概要（例：本社オフィス粗大ゴミ回収）
* `status`: 案件の進行状態（`received`, `quoting`, `arranged`, `collected`, `billed`, `completed`, `pending`, `cancelled`）
* `received_at`: 受付日時
* `scheduled_date`: 回収予定日（未定の場合はNull許容）
* `assigned_to`: UUID (Foreign Key -> `profiles.id` / 担当者)
* `notes`: 備考・特記事項
* `created_at`: 作成日時
* `updated_at`: 更新日時

## 第3章：拡張テーブル定義（Phase2以降向け設計）

### 3.1 spot_collections (スポット回収実績)

現場で回収した実際の品目や重量、証拠写真を保存する。

* `id`: UUID (Primary Key)
* `job_id`: UUID (Foreign Key -> `jobs.id` / 案件に紐付け)
* `items_description`: 回収品目の詳細
* `weight_kg`: 重量（キログラム）
* `photo_url`: 現場写真のURL（Supabase Storageのパス）
* `collected_at`: 実際の回収日時

### 3.2 invoices (請求データ)

案件に対する請求状態を管理する。

* `id`: UUID (Primary Key)
* `job_id`: UUID (Foreign Key -> `jobs.id` / 案件に紐付け)
* `amount`: 請求金額
* `billing_status`: 請求ステータス（`unissued`未発行, `issued`発行済, `paid`入金済）
* `issued_at`: 請求書発行日時

## 第4章：ER図（エンティティ・リレーションシップ）コンセプト

テーブル間の関係性（リレーション）は以下の通り。すべて「案件（Job）」を中心に放射状に繋がる。

* **Customer 1 対 N Jobs** : 1つの顧客は、過去・現在を含め複数の案件（依頼）を持つ。
* **Job 1 対 1 (または N) Spot_Collections** : 1つの案件に対し、回収実績が紐づく。
* **Job 1 対 1 Invoices** : 1つの案件に対し、1つの請求データが紐づく。
