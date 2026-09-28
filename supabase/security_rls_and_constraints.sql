-- =================================================================
-- Clean KENKOU ERP: セキュリティ改修マイグレーション
-- 対象: RLS ポリシーの強化 + invoices.job_id UNIQUE 制約追加
-- 実施日: 2026-09-27
-- 参照: セキュリティ監査レポート C-2, B-4
-- =================================================================
-- 【注意】Supabase SQL Editor で実行してください。
-- =================================================================

-- -----------------------------------------------------------------
-- 1. RLS ポリシーの修正: USING(true) → 認証済みユーザーのみ許可
-- -----------------------------------------------------------------

-- 1.1 profiles テーブル
DROP POLICY IF EXISTS "Allow access to profiles" ON public.profiles;
CREATE POLICY "Authenticated users can read profiles"
    ON public.profiles FOR SELECT
    USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert profiles"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update profiles"
    ON public.profiles FOR UPDATE
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete profiles"
    ON public.profiles FOR DELETE
    USING (auth.role() = 'authenticated');

-- 1.2 customers テーブル
DROP POLICY IF EXISTS "Allow access to customers" ON public.customers;
CREATE POLICY "Authenticated users can read customers"
    ON public.customers FOR SELECT
    USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert customers"
    ON public.customers FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update customers"
    ON public.customers FOR UPDATE
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete customers"
    ON public.customers FOR DELETE
    USING (auth.role() = 'authenticated');

-- 1.3 jobs テーブル
DROP POLICY IF EXISTS "Allow access to jobs" ON public.jobs;
CREATE POLICY "Authenticated users can read jobs"
    ON public.jobs FOR SELECT
    USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert jobs"
    ON public.jobs FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update jobs"
    ON public.jobs FOR UPDATE
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete jobs"
    ON public.jobs FOR DELETE
    USING (auth.role() = 'authenticated');

-- 1.4 spot_collections テーブル
DROP POLICY IF EXISTS "Allow access to spot_collections" ON public.spot_collections;
CREATE POLICY "Authenticated users can read spot_collections"
    ON public.spot_collections FOR SELECT
    USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert spot_collections"
    ON public.spot_collections FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update spot_collections"
    ON public.spot_collections FOR UPDATE
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete spot_collections"
    ON public.spot_collections FOR DELETE
    USING (auth.role() = 'authenticated');

-- 1.5 invoices テーブル
DROP POLICY IF EXISTS "Allow access to invoices" ON public.invoices;
CREATE POLICY "Authenticated users can read invoices"
    ON public.invoices FOR SELECT
    USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert invoices"
    ON public.invoices FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update invoices"
    ON public.invoices FOR UPDATE
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete invoices"
    ON public.invoices FOR DELETE
    USING (auth.role() = 'authenticated');

-- 1.6 company_settings テーブル（読み取りは全認証ユーザー、書き込みは管理者のみ推奨）
DROP POLICY IF EXISTS "Allow access to company_settings" ON public.company_settings;
CREATE POLICY "Authenticated users can read company_settings"
    ON public.company_settings FOR SELECT
    USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert company_settings"
    ON public.company_settings FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update company_settings"
    ON public.company_settings FOR UPDATE
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- 1.7 price_master テーブル
DROP POLICY IF EXISTS "Allow access to price_master" ON public.price_master;
CREATE POLICY "Authenticated users can read price_master"
    ON public.price_master FOR SELECT
    USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert price_master"
    ON public.price_master FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update price_master"
    ON public.price_master FOR UPDATE
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete price_master"
    ON public.price_master FOR DELETE
    USING (auth.role() = 'authenticated');

-- 1.8 staff_schedules テーブル（存在する場合）
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'staff_schedules') THEN
        -- 既存の全開放ポリシーを削除
        EXECUTE 'DROP POLICY IF EXISTS "Allow access to staff_schedules" ON public.staff_schedules';
        EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated access to staff_schedules" ON public.staff_schedules';

        -- 認証済みユーザーのみ許可するポリシーを作成
        EXECUTE 'CREATE POLICY "Authenticated users can read staff_schedules" ON public.staff_schedules FOR SELECT USING (auth.role() = ''authenticated'')';
        EXECUTE 'CREATE POLICY "Authenticated users can insert staff_schedules" ON public.staff_schedules FOR INSERT WITH CHECK (auth.role() = ''authenticated'')';
        EXECUTE 'CREATE POLICY "Authenticated users can update staff_schedules" ON public.staff_schedules FOR UPDATE USING (auth.role() = ''authenticated'') WITH CHECK (auth.role() = ''authenticated'')';
        EXECUTE 'CREATE POLICY "Authenticated users can delete staff_schedules" ON public.staff_schedules FOR DELETE USING (auth.role() = ''authenticated'')';
    END IF;
END
$$;

-- -----------------------------------------------------------------
-- 2. handle_new_user() 関数: SECURITY DEFINER のまま維持（正しい設計）
--    ※ auth.users テーブルのトリガーは SECURITY DEFINER が必要
--    ※ search_path の固定で安全性を確保済み
-- -----------------------------------------------------------------
-- 注意: security_fix_handle_new_user.sql で SECURITY INVOKER に変更済みの場合、
-- 以下を実行して SECURITY DEFINER に戻してください（新規ユーザー登録が動作するため必須）。

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1), 'ユーザー'),
        'operator'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------
-- 3. invoices.job_id に UNIQUE 制約を追加 (B-4 修正)
--    ※ upsert の onConflict: 'job_id' が正しく動作するために必要
-- -----------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.invoices'::regclass
          AND conname = 'invoices_job_id_unique'
    ) THEN
        ALTER TABLE public.invoices ADD CONSTRAINT invoices_job_id_unique UNIQUE (job_id);
    END IF;
END
$$;



-- =================================================================
-- 実行後の確認クエリ
-- =================================================================

-- RLS ポリシーの確認
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;

-- UNIQUE 制約の確認
-- SELECT conname, conrelid::regclass, contype
-- FROM pg_constraint
-- WHERE conrelid IN ('public.invoices'::regclass, 'public.profiles'::regclass)
-- ORDER BY conrelid, conname;
