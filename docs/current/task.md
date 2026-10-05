# Clean KENKOU ERP - 作業進捗および次回残課題ログ

**最終更新日時**: 2026-10-05 15:25

**現在のバージョン**: v1.1.2（コミット `fad065d` 以降）

**ステータス**: AI見積（現場写真 → Gemini解析 → 品目自動算定）が本番環境で動くことを確認済み（2026-10-05 15:15）。

---

## 1. 本日の作業サマリー（2026-10-05）

### 1-1. MobileQuoteModal の不要なAPIキーUIを削除【完了】

- `src/components/features/MobileQuoteModal.tsx` から「🔑 APIキーを更新・診断」ボタン、`localStorage` からのキー取得処理、`validateGeminiApiKey` の import を削除。
- AI解析は Edge Function 経由（APIキーはサーバー側で管理）だけで動く形に統一。

### 1-2. PDF帳票生成エンジン（MCP）の動作確認【完了】

- `clean-kenkou-report-pdf`（`generate_quote_pdf` / `generate_invoice_pdf`）で見積書・適格請求書のPDFが日本語で正しく出力されることを確認。
- `.gitignore` に `*.pdf` と `supabase/.temp/` を追加。

### 1-3. Supabase Secrets に GEMINI_API_KEY を登録【完了】

- ユーザー様が Supabase Studio（デスクトップアプリ）から登録。

### 1-4. バージョン管理の導入【完了】

- `src/version.ts` を新設。ヘッダー、AI見積モーダルのタイトル、「✨ AI自動抽出」ボタンにバージョン番号を表示。
- 更新のたびに次の3か所を必ず同時に上げるルール:
  - `src/version.ts`（`APP_VERSION` / `APP_BUILD_DATE` / `APP_DESCRIPTION`）
  - `package.json`（`version`）
  - `public/sw.js`（`CACHE_NAME`）

### 1-5. AI見積が動かなかった問題の調査と修正【完了】

複数の原因が重なっていたため、順番に修正した。

| # | 症状 | 原因 | 対処 | 版 |
| :--- | :--- | :--- | :--- | :--- |
| 1 | 404エラー | `gemini-2.0-flash` が Google 側で廃止 | 新しいモデルに変更 | Edge Fn v3〜 |
| 2 | 400エラー | ブラウザ内の `blob:` URL をサーバー側で取得しようとしていた | ブラウザ側でBase64化して送る方式に変更 | v1.1.0 |
| 3 | 送信データが大きすぎる | 写真を圧縮せずに送っていた | `createImageBitmap` で長辺1000px・JPEG品質0.7に圧縮 | v1.1.0 |
| 4 | エラーなのに「解析完了・0件」と表示 | エラー時に空配列を返していた | `{ items, error }` を返し、画面に警告を表示 | v1.1.0 |
| 5 | Googleの混雑（503） | 1つのモデルしか使っていなかった | `gemini-3.5-flash-lite` → `gemini-3.8-flash` → `gemini-2.5-flash` の順に自動で切り替え | Edge Fn v6 / v1.1.1 |
| 6 | **`Failed to fetch`（根本原因）** | `netlify.toml` のCSPで `connect-src` に `blob:` がなく、写真データの読み込みをブラウザがブロックしていた | `connect-src` に `blob:` と `data:` を追加 | v1.1.2 |

- 原因6が分かるまで、ブラウザからのリクエストは Edge Function に一度も届いていなかった（Supabase のログで確認）。
- v1.1.2 から、写真の読み込みで失敗したときは「写真の読み込みに失敗しました（端末内処理）」と表示し、サーバー通信のエラーとは分けて出すようにした。
- **動作確認**: 2026-10-05 15:15、ユーザー様の実際の操作で成功。Supabase のログでも `OPTIONS 200` → `POST 200`、`gemini-3.5-flash-lite` で約4秒で解析成功を確認。

> 注記: 13:55 時点のこのファイルには「完全稼働」「100%正確」と書いていたが、実際はその時点で本番では動いていなかった。上の表の内容が正しい経緯である。

---

## 2. システムの現状

| 機能・コンポーネント | 状況 | 備考 |
| :--- | :--- | :--- |
| データベース（Supabase PostgreSQL） | 稼働中 | RLS有効 |
| Edge Function `gemini-analyze` | 稼働中（Version 6） | 3モデル自動切り替え、`verify_jwt: false` |
| フロントエンド（Vite + React / Netlify） | v1.1.2 デプロイ済み | `https://unrivaled-dusk-7a7e01.netlify.app` |
| PDF帳票生成エンジン（MCP） | 動作確認済み | A4縦・インボイス対応 |
| 牛若丸連携 | 役割分離を維持 | 定期ルート配車との重複なし |

---

## 3. 次回やるべき残課題・未対応

### 優先度：高

1. **タブレットのカメラ撮影の確認**
   - `netlify.toml` の `Permissions-Policy = "camera=()"` でカメラ機能を止めている。
   - タブレットの「撮影」ボタンからカメラが起動するか実機で確認する。起動しない場合は `camera=(self)` に変更する。
2. **AI検出の精度確認**
   - 実際の現場写真で、品目・数量・体積・単価が現場の感覚と合っているか確認する。
   - ずれが大きい場合は、Edge Function のプロンプトや `matchMasterItem`（`MobileQuoteModal.tsx`）の照合ロジックを調整する。
3. **Edge Function の利用制限（セキュリティ）**
   - 現在 `verify_jwt: false` で、URLを知っていれば誰でも呼び出せる状態。Gemini の利用料金が不正に使われるおそれがある。
   - ログイン済みユーザーだけが呼べるように `verify_jwt: true` にするか、関数内で認証チェックを入れる。

### 優先度：中

1. **ローカルのソースと本番 Edge Function の差分**
   - 本番 Version 6 では、エラー時も HTTP 200 + `{ error, items: [] }` を返すようにした（ローカルの `supabase/functions/gemini-analyze/index.ts` も同じ内容でコミット済み）。
   - ただし、前半の入力チェック（画像なし・枚数超過・APIキー未設定）はローカル側がまだ 400 / 500 を返すコードのまま。次回デプロイ前にローカルを本番と揃える。
2. **混雑時の待ち時間**
   - 3モデルを順番に試すため、最悪の場合は数十秒かかる。画面に「切り替え中」と表示するか、タイムアウトを設けるか検討する。
3. **Gemini 2.5 系の廃止予定**
   - `gemini-2.5-flash` は 2026-10-20 に廃止予定。予備の候補から外すか、別のモデルに入れ替える。

### 優先度：低

1. 社内運用マニュアルの更新（電話受付 → AI見積 → PDF出力の流れ）。
2. Git のコミット者名・メールアドレスが自動設定のまま（`git config --global user.name / user.email` の設定を推奨）。

---

*記録者: Antigravity AI Assistant*
