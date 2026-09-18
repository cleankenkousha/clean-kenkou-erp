-- =================================================================
-- Clean KENKOU ERP: invoices テーブル カラム追加マイグレーション
-- 実施日: 2026-09-18
-- 問題: invoices テーブルに due_date, paid_at, invoice_number,
--       variance_reason, notes が存在しないため /sales ページでエラー発生
-- =================================================================
-- 【手順】Supabase SQL Editor でこのファイルの内容を実行してください
-- =================================================================

-- due_date (支払期日)
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;

-- paid_at (入金確認日)
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- invoice_number (請求書番号)
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS invoice_number TEXT;

-- variance_reason (見積との差異・理由メモ)
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS variance_reason TEXT;

-- notes (社内メモ・特記事項)
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- =================================================================
-- 実行後確認クエリ（invoices テーブルの列一覧を確認）
-- =================================================================
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'invoices'
-- ORDER BY ordinal_position;
-- =================================================================
