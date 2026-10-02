# Clean KENKOU ERP - 作業進捗および次回残課題ログ

**最終更新日時**: 2026-10-02 19:05  
**ステータス**: Supabase MCP、設計ガードスキル、およびPDF帳票生成エンジンの導入が完了。次回はNetlifyプッシュと実務帳票テスト。

---

## 1. 本日完了した作業・進捗サマリー（2026-10-02）

本日は、開発基盤の強化、設計品質の自動ガード、および実務向け帳票エンジンの3大ツール・環境を導入・検証しました。

### 🚨 【完了✅】 1. Supabase MCP の導入と直接接続の確立
- **内容**: Antigravity IDE と Supabase データベースを直接連携させる公式 MCP サーバー（`@supabase/mcp-server-supabase`）をセットアップ。
- **設定場所**: `C:\Users\有限会社山鹿健康社\.gemini\config\mcp_config.json`
- **検証実績**: AntigravityからSupabaseプロジェクト（`cnwlcxfhxaugqtatibav`）へ直接接続し、全8テーブル（`customers`, `jobs`, `profiles` 等）の取得および全テーブルでのRLS（Row Level Security）有効化状態をリアルタイム確認完了。
- **効果**: 今後は「SQLをコピーしてSupabase Studioに貼り付ける」作業が不要となり、チャット上で「テーブル作成」「カラム追加」「スキーマ検証」が即時完結可能に。

### 🚨 【完了✅】 2. 設計ガードスキル (`kenkou-erp-design-guard`) の導入
- **内容**: プロジェクト憲章（00〜08設計書）のルールをAIが自動で守り、仕様の形骸化を防ぐカスタムスキルを作成。
- **配置場所**: `.agents/skills/kenkou-erp-design-guard/SKILL.md`
- **保護ルール**:
  1. **牛若丸との完全分離**: 定期ルート配車・日常収集は牛若丸の管轄とし、当システムに重複実装しない。
  2. **設計ファースト**: 仕様変更時は必ず「設計書（Markdown） → コード」の順序で更新。
  3. **UI/UX原則の遵守**: 電話受付30秒以内、3クリック以内の操作完了、視線移動最小化。

### 🚨 【完了✅】 3. PDF帳票生成エンジン / MCP (`clean-kenkou-report-pdf`) の構築
- **内容**: 実務用の見積書・適格請求書（インボイス制度対応）を自動出力する軽量PDFエンジンをMCPサーバーとして実装。
- **配置場所**: `tools/report-pdf-mcp/index.js`
- **機能**:
  - Windows環境の日本語フォント（Google Noto Sans JP）を自動利用し、文字化けせず綺麗なA4帳票を出力。
  - 自社情報（有限会社 山鹿健康社、住所、TEL/FAX、登録番号 `T1330...`、振込先口座）と税率内訳を自動印字。
  - AIに対して「〇〇様宛ての見積書PDFを作成して」と指示するだけで直接PDFを書き出し可能。

---

## 2. 過去の完了作業サマリー

### 【2026-09-28 完了分】
- **Supabase DBセキュリティ反映**: `supabase/security_rls_and_constraints.sql` を実行し、全テーブルRLSおよび `invoices.job_id` UNIQUE制約を適用。
- **Netlify環境変数設定**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` を設定。
- **Edge Function デプロイ**: `gemini-analyze` をセキュリティ対応版としてデプロイ完了。

### 【2026-09-27 完了分】
- **Gemini APIキー漏洩リスク解消**: `src/lib/gemini.ts` を修正し、直接API呼び出しを廃止（Edge Function経由に移行）。
- **Supabaseキーのハードコード除去**: 環境変数からの取得に統一。
- **マスアサインメント防止**: `useJobs.ts`, `useStaffSchedules.ts` にホワイトリストを追加。

---

## 3. 次回やるべきタスク（今後の予定）

### 🟡 1. 【月初】Netlifyビルド枠リセットに伴うリモートプッシュ
- **手順**:
  Netlifyの月間ビルド枠がリセットされたタイミングで、ローカルの変更を GitHub へプッシュ：
  ```bash
  git push origin main
  # またはデスクトップの「GitHubへ送信.bat」を実行
  ```

### 🔴 2. 【プッシュ後】AI画像解析機能（Gemini）の動作確認
- **背景**: Edge Function（`gemini-analyze`）側のSecretsに `GEMINI_API_KEY`（Google AI Studio発行）が設定されているか確認し、本番サイトでAIカメラ見積が正常動作するかテスト。
- **確認手順**:
  1. Supabase Studio > 「**Edge Functions**」> `gemini-analyze` を選択
  2. 「**Secrets**」タブに `GEMINI_API_KEY` が設定されているか確認（未設定時は追加）
  3. スマホ・実機等でAIカメラ見積を実行

### 🟢 3. 【実務運用テスト】見積書・請求書PDFの生成検証
- **内容**:
  今回導入した帳票エンジンやアプリ内の印刷モーダルを用いて、実際のスポット回収案件の見積書・請求書が綺麗に出力されるかテスト。

### 🟠 4. 【推奨】MobileQuoteModal の不要なAPIキー入力UI削除
- **内容**: `src/components/features/MobileQuoteModal.tsx` に残存している「🔑 APIキーを更新・診断」ボタン等のクリーンアップ。

---

*記録者: Antigravity AI Assistant*
