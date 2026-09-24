-- Clean KENKOU ERP: 営業スケジュール ＆ 見積訪問枠予約カレンダー用テーブル
-- Supabase SQL Editorで実行してください。

CREATE TABLE IF NOT EXISTS public.staff_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL, -- 案件と連動する場合
    title TEXT NOT NULL,
    schedule_type TEXT NOT NULL DEFAULT 'appointment' 
        CHECK (schedule_type IN ('appointment', 'meeting', 'away', 'work', 'private', 'other')),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    is_all_day BOOLEAN NOT NULL DEFAULT false,
    location TEXT,
    customer_name TEXT,
    customer_phone TEXT,
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_staff_schedules_profile_id ON public.staff_schedules(profile_id);
CREATE INDEX IF NOT EXISTS idx_staff_schedules_job_id ON public.staff_schedules(job_id);
CREATE INDEX IF NOT EXISTS idx_staff_schedules_time ON public.staff_schedules(start_time, end_time);

-- RLS設定（全社で共有・閲覧・更新可能）
ALTER TABLE public.staff_schedules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'staff_schedules' AND policyname = 'Enable all access for authenticated users'
    ) THEN
        CREATE POLICY "Enable all access for authenticated users" 
        ON public.staff_schedules 
        FOR ALL 
        USING (true) 
        WITH CHECK (true);
    END IF;
END $$;
