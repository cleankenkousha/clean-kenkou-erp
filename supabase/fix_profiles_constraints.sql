-- =================================================================
-- Clean KENKOU ERP: profiles テーブル完全修正スクリプト
-- 実行場所: Supabase Dashboard > SQL Editor
-- =================================================================

-- 1. 外部キー制約を削除（スタッフ登録に auth.users 不要にする）
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- 2. role CHECK 制約を修正
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('admin', 'sales', 'dispatcher', 'operator', 'clerk'));

-- 3. 既存の RLS ポリシーを全て削除
DROP POLICY IF EXISTS "Allow authenticated users to select profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow authenticated access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.profiles;
DROP POLICY IF EXISTS "Enable update for all users" ON public.profiles;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.profiles;

-- 4. RLS を一度無効にしてから再度有効化し、全アクセス許可ポリシーを作成
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 全操作を全ロール（anon 含む）に許可
CREATE POLICY "Allow full access to profiles"
  ON public.profiles
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- 5. 確認: 現在のポリシー一覧を表示
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'profiles';
