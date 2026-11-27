-- =================================================================
-- Clean KENKOU ERP: Supabase データベース最新スキーマ定義
-- 本番データベース（PostgreSQL / RLS / RPC）と完全同期済み
-- 最終更新: 2026-11-27 (v1.3.1)
-- =================================================================
-- ※ 本番 DB に同居する D日報用テーブル（daily_report_*）は
--    D日報アプリ側の管理対象のためここには含めない。
-- =================================================================

-- 1. 共通関数の作成 (updated_at 自動更新用トリガー関数)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------
-- 2. テーブル作成 (依存関係に配慮した作成順序)
-- -----------------------------------------------------------------

-- 2.1 profiles (ユーザー・社内担当スタッフ)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    display_name TEXT,
    role TEXT NOT NULL DEFAULT 'operator' CHECK (role IN ('admin', 'sales', 'dispatcher', 'operator', 'clerk')),
    email TEXT,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.2 customers (顧客マスター)
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- 2.3 jobs (案件マスター)
CREATE TABLE IF NOT EXISTS public.jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'received' CHECK (
        status IN ('received', 'quoting', 'arranged', 'scheduled', 'collected', 'billed', 'completed', 'pending', 'cancelled')
    ),
    received_at TIMESTAMPTZ DEFAULT now(),
    scheduled_date DATE,
    assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.4 spot_collections (スポット回収実績)
CREATE TABLE IF NOT EXISTS public.spot_collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    items_description TEXT,
    weight_kg NUMERIC(10, 2),
    photo_url TEXT,
    collected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.5 invoices (請求・入金データ)
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    billing_status TEXT NOT NULL DEFAULT 'unissued' CHECK (
        billing_status IN ('unissued', 'issued', 'paid')
    ),
    issued_at TIMESTAMPTZ,
    due_date TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    invoice_number TEXT,
    variance_reason TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT invoices_job_id_unique UNIQUE (job_id)
);

-- 2.6 company_settings (自社情報・帳票印字設定)
CREATE TABLE IF NOT EXISTS public.company_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    name TEXT NOT NULL DEFAULT '',
    postal_code TEXT DEFAULT '',
    address TEXT DEFAULT '',
    tel TEXT DEFAULT '',
    fax TEXT DEFAULT '',
    invoice_no TEXT DEFAULT '',
    bank_name TEXT DEFAULT '',
    bank_branch TEXT DEFAULT '',
    bank_account_type TEXT DEFAULT '普通',
    bank_account_number TEXT DEFAULT '',
    bank_account_name TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.7 price_master (回収品目・単価マスタ)
CREATE TABLE IF NOT EXISTS public.price_master (
    id TEXT PRIMARY KEY DEFAULT (gen_random_uuid())::TEXT,
    category TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL DEFAULT '',
    unit TEXT NOT NULL DEFAULT 'kg',
    price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    volume NUMERIC,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.8 staff_schedules (営業・スタッフスケジュール)
CREATE TABLE IF NOT EXISTS public.staff_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    schedule_type TEXT NOT NULL DEFAULT 'appointment' CHECK (
        schedule_type IN ('appointment', 'away', 'meeting', 'work', 'private', 'other')
    ),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    is_all_day BOOLEAN NOT NULL DEFAULT false,
    location TEXT,
    customer_name TEXT,
    customer_phone TEXT,
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.9 activity_logs (ログイン・操作監査ログ)
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    staff_name TEXT NOT NULL DEFAULT '不明',
    staff_email TEXT,
    action_type TEXT NOT NULL,
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------
-- 3. updated_at 自動更新トリガーの設定
-- -----------------------------------------------------------------

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_customers_updated_at ON public.customers;
CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON public.customers
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_jobs_updated_at ON public.jobs;
CREATE TRIGGER update_jobs_updated_at
    BEFORE UPDATE ON public.jobs
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_spot_collections_updated_at ON public.spot_collections;
CREATE TRIGGER update_spot_collections_updated_at
    BEFORE UPDATE ON public.spot_collections
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_invoices_updated_at ON public.invoices;
CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON public.invoices
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_company_settings_updated_at ON public.company_settings;
CREATE TRIGGER update_company_settings_updated_at
    BEFORE UPDATE ON public.company_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_price_master_updated_at ON public.price_master;
CREATE TRIGGER update_price_master_updated_at
    BEFORE UPDATE ON public.price_master
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_staff_schedules_updated_at ON public.staff_schedules;
CREATE TRIGGER update_staff_schedules_updated_at
    BEFORE UPDATE ON public.staff_schedules
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------------------
-- 4. RLS (Row Level Security) の有効化（認証済みユーザー限定）
-- -----------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spot_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated access profiles" ON public.profiles;
CREATE POLICY "Authenticated access profiles"
    ON public.profiles FOR ALL TO authenticated
    USING ((SELECT auth.role()) = 'authenticated')
    WITH CHECK ((SELECT auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Authenticated access customers" ON public.customers;
CREATE POLICY "Authenticated access customers"
    ON public.customers FOR ALL TO authenticated
    USING ((SELECT auth.role()) = 'authenticated')
    WITH CHECK ((SELECT auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Authenticated access jobs" ON public.jobs;
CREATE POLICY "Authenticated access jobs"
    ON public.jobs FOR ALL TO authenticated
    USING ((SELECT auth.role()) = 'authenticated')
    WITH CHECK ((SELECT auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Authenticated access spot_collections" ON public.spot_collections;
CREATE POLICY "Authenticated access spot_collections"
    ON public.spot_collections FOR ALL TO authenticated
    USING ((SELECT auth.role()) = 'authenticated')
    WITH CHECK ((SELECT auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Authenticated access invoices" ON public.invoices;
CREATE POLICY "Authenticated access invoices"
    ON public.invoices FOR ALL TO authenticated
    USING ((SELECT auth.role()) = 'authenticated')
    WITH CHECK ((SELECT auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Authenticated access company_settings" ON public.company_settings;
CREATE POLICY "Authenticated access company_settings"
    ON public.company_settings FOR ALL TO authenticated
    USING ((SELECT auth.role()) = 'authenticated')
    WITH CHECK ((SELECT auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Authenticated access price_master" ON public.price_master;
CREATE POLICY "Authenticated access price_master"
    ON public.price_master FOR ALL TO authenticated
    USING ((SELECT auth.role()) = 'authenticated')
    WITH CHECK ((SELECT auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Authenticated access staff_schedules" ON public.staff_schedules;
CREATE POLICY "Authenticated access staff_schedules"
    ON public.staff_schedules FOR ALL TO authenticated
    USING ((SELECT auth.role()) = 'authenticated')
    WITH CHECK ((SELECT auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Authenticated access activity_logs" ON public.activity_logs;
CREATE POLICY "Authenticated access activity_logs"
    ON public.activity_logs FOR ALL TO authenticated
    USING ((SELECT auth.role()) = 'authenticated')
    WITH CHECK ((SELECT auth.role()) = 'authenticated');

-- -----------------------------------------------------------------
-- 5. 認証連携トリガー & ログイン画面用 RPC
-- -----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, auth_user_id, display_name, email, role)
    VALUES (
        NEW.id,
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1), 'ユーザー'),
        NEW.email,
        'operator'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ログイン画面のワンタップID選択用（表示名・メールのみ公開、role/auth_user_id等は非公開）
CREATE OR REPLACE FUNCTION public.get_login_staff_list()
RETURNS TABLE (
    id UUID,
    display_name TEXT,
    email TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT p.id, p.display_name, p.email
    FROM public.profiles p
    WHERE p.display_name IS NOT NULL
      AND btrim(p.display_name) <> ''
      AND p.email IS NOT NULL
      AND btrim(p.email) <> ''
    ORDER BY p.created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_login_staff_list() TO anon, authenticated;
