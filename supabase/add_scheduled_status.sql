-- =================================================================
-- Clean KENKOU ERP: jobs テーブルに 'scheduled' (日程確定) ステータスを追加するスクリプト
-- =================================================================

-- 1. 既存の status チェック制約を安全に削除
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.jobs'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) LIKE '%status%'
    ) LOOP
        EXECUTE 'ALTER TABLE public.jobs DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END $$;

-- 2. 新しい CHECK 制約を追加 ('scheduled' を含む)
ALTER TABLE public.jobs
    ADD CONSTRAINT jobs_status_check
    CHECK (status IN (
        'received',
        'quoting',
        'arranged',
        'scheduled',
        'collected',
        'billed',
        'completed',
        'pending',
        'cancelled'
    ));

COMMENT ON COLUMN public.jobs.status IS '案件ステータス: received(新規受付), quoting(見積中), arranged(作業日程調整), scheduled(日程確定), collected(作業実施), billed(請求済), completed(完了済), pending(保留), cancelled(キャンセル)';
