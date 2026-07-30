# 07_Development Guide

## 第1章：ディレクトリ構成 (Directory Structure)

プロジェクト（`src`フォルダ内）は、役割ごとに整理し、どこに何があるか一目でわかる構成とする。

* `src/components/`: 再利用可能なUI部品。
  * `ui/`: ボタン、入力フォーム、カードなど（UIUX Design Bookに準拠した基本部品）。
  * `features/`: 案件カンバン、顧客検索ドロップダウンなど、特定の業務に紐づく部品。
* `src/pages/`: 画面単位のコンポーネント（ダッシュボード画面、顧客一覧画面など）。
* `src/hooks/`: データの取得や更新など、複雑なロジックをまとめたカスタムフック。
* `src/lib/`: Supabaseの初期化設定や、共通の便利関数（日付計算など）。
* `src/types/`: TypeScriptの型定義ファイル（DBのテーブル構造など）。

## 第2章：コーディング規約 (Coding Standards)

### 2.1 React & TypeScript

* **TypeScriptを厳格に使用** : データの形（型）を必ず定義する。特にSupabaseから取得するデータ（`Job`や `Customer`）の型は `src/types/` で一元管理し、バグを未然に防ぐ。
* **関数コンポーネント (Functional Components)** : 全てのコンポーネントは関数で書き、状態管理にはHooks（`useState`, `useEffect`など）を使用する。
* **早期リターン (Early Return)** : コードのネスト（インデントが深くなること）を防ぐため、エラーやデータがない場合は先に関数の処理を終わらせる。

### 2.2 Tailwind CSSのルール

* **クラスの並び順** : 統一感を持たせるため、以下の順序でクラスを記述する。

1. レイアウト（`flex`, `grid`, `absolute`）
2. 余白（`p-4`, `m-2`）
3. サイズ（`w-full`, `h-10`）
4. タイポグラフィ（`text-sm`, `font-bold`）
5. 見た目・色（`bg-white`, `text-slate-900`, `rounded-md`）

* **デザインルールの順守** : 色やサイズは必ず `01_UIUX_Design_Book` で定義した「デザイントークン」を使用し、勝手な色（例：`#ff0000` のような直接指定）を使わない。

## 第3章：命名規則 (Naming Conventions)

AIが自動生成する際にもブレないよう、名前の付け方を統一する。

* **ファイル名** :
* Reactコンポーネント（画面やUI部品）: `PascalCase.tsx`（例：`KanbanBoard.tsx`, `PrimaryButton.tsx`）
* 関数・フック・設定ファイル: `camelCase.ts`（例：`useJobs.ts`, `supabaseClient.ts`）
* **変数名・関数名** : `camelCase` を使用する（例：`fetchCustomerData`, `isModalOpen`）。
* **真偽値 (Boolean)** : 必ず `is`, `has`, `should` などを頭につけ、Yes/Noで答えられる名前にする（例：`isLoading`, `hasError`）。
* **定数** : `UPPER_SNAKE_CASE` を使用する（例：`MAX_FILE_SIZE`）。

## 第4章：状態管理とデータ取得 (State & Data Fetching)

* **データの取得** : Supabaseからのデータ取得処理は、画面コンポーネントに直接書かず、必ずカスタムフック（例：`useJobs()`）に分離する。これにより、画面のコードがスッキリし、再利用しやすくなる。
* **グローバルステート（全体状態）の最小化** : ログインユーザー情報など、アプリ全体で必要なもの以外は、無闇にグローバルステート（ContextやZustand等）を使わず、必要な画面内だけで状態を管理する。

## 第5章：AI・IDEを活用した開発フロー

Antigravity IDEやClaude Code等にコード生成を依頼する際の絶対ルール。

1. **設計書を読ませる** : プロンプトの最初に「`docs/` フォルダ内の設計書を読んでから実装してください」と必ず指示を出す。
2. **小さく作る** : 「ダッシュボード全体を作って」ではなく、「まずヘッダーを作って」「次にKPIカードを作って」と、コンポーネント単位で細かく指示を出す。
3. **仕様変更時の徹底** : もしコードを書いていて「やっぱりこのルールを変えたい」となったら、コードを直す前に**必ず `docs/` の設計書から修正する**こと（ドキュメントの形骸化を防ぐ）。
