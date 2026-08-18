-- =================================================================
-- Clean KENKOU ERP: Supabase データベース作成スクリプト
-- ドキュメント: docs/04_Database_Design.md に準拠
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
-- 自由なスタッフ登録に対応 (user_id で Supabase auth.users と任意連携)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'operator' CHECK (role IN ('admin', 'sales', 'dispatcher', 'operator', 'clerk')),
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
    deleted_at TIMESTAMPTZ -- 論理削除用
);

-- 2.3 jobs (案件マスター)
CREATE TABLE IF NOT EXISTS public.jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'received' CHECK (
        status IN ('received', 'quoting', 'arranged', 'collected', 'billed', 'completed', 'pending', 'cancelled')
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

-- 2.5 invoices (請求データ)
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    billing_status TEXT NOT NULL DEFAULT 'unissued' CHECK (
        billing_status IN ('unissued', 'issued', 'paid')
    ),
    issued_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
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
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    category TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL DEFAULT '',
    unit TEXT NOT NULL DEFAULT 'kg',
    price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
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

-- -----------------------------------------------------------------
-- 4. RLS (Row Level Security) の有効化
-- -----------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spot_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_master ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------
-- 5. RLS ポリシーの作成 (全アクセス・更新可の安全運用ポリシー)
-- -----------------------------------------------------------------

-- profiles ポリシー (担当スタッフの即時同期を許可)
DROP POLICY IF EXISTS "Allow authenticated users to select profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow authenticated access to profiles" ON public.profiles;

CREATE POLICY "Allow access to profiles"
    ON public.profiles FOR ALL USING (true) WITH CHECK (true);

-- customers ポリシー
DROP POLICY IF EXISTS "Allow authenticated access to customers" ON public.customers;
DROP POLICY IF EXISTS "Allow access to customers" ON public.customers;
CREATE POLICY "Allow access to customers"
    ON public.customers FOR ALL USING (true) WITH CHECK (true);

-- jobs ポリシー
DROP POLICY IF EXISTS "Allow authenticated access to jobs" ON public.jobs;
DROP POLICY IF EXISTS "Allow access to jobs" ON public.jobs;
CREATE POLICY "Allow access to jobs"
    ON public.jobs FOR ALL USING (true) WITH CHECK (true);

-- spot_collections ポリシー
DROP POLICY IF EXISTS "Allow authenticated access to spot_collections" ON public.spot_collections;
DROP POLICY IF EXISTS "Allow access to spot_collections" ON public.spot_collections;
CREATE POLICY "Allow access to spot_collections"
    ON public.spot_collections FOR ALL USING (true) WITH CHECK (true);

-- invoices ポリシー
DROP POLICY IF EXISTS "Allow authenticated access to invoices" ON public.invoices;
DROP POLICY IF EXISTS "Allow access to invoices" ON public.invoices;
CREATE POLICY "Allow access to invoices"
    ON public.invoices FOR ALL USING (true) WITH CHECK (true);

-- company_settings ポリシー
DROP POLICY IF EXISTS "Allow authenticated access to company_settings" ON public.company_settings;
DROP POLICY IF EXISTS "Allow authenticated select company_settings" ON public.company_settings;
DROP POLICY IF EXISTS "Allow admin modify company_settings" ON public.company_settings;
DROP POLICY IF EXISTS "Allow access to company_settings" ON public.company_settings;

CREATE POLICY "Allow access to company_settings"
    ON public.company_settings FOR ALL USING (true) WITH CHECK (true);

-- price_master ポリシー
DROP POLICY IF EXISTS "Allow authenticated access to price_master" ON public.price_master;
DROP POLICY IF EXISTS "Allow access to price_master" ON public.price_master;
CREATE POLICY "Allow access to price_master"
    ON public.price_master FOR ALL USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------
-- 6. 新規ユーザー登録時に profiles テーブルへ自動同期するトリガー関数
-- -----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, display_name, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1), 'ユーザー'),
        'operator'
    );
    RETURN NEW;
END;
$$;

-- トリガーの登録
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
