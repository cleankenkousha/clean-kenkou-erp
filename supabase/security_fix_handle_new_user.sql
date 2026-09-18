-- =================================================================
-- Clean KENKOU ERP: セキュリティ改修マイグレーション
-- 対象: handle_new_user() 関数の SECURITY DEFINER → SECURITY INVOKER
-- 実施日: 2026-09-18
-- 参照: task.md C-4 セキュリティ課題
-- =================================================================
-- 【注意】Supabase SQL Editor で実行してください。
-- auth.users テーブルへのトリガー定義を含むため、
-- Service Role（SQL Editor）での実行が必要です。
-- =================================================================

-- 1. 既存トリガーを一時削除
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. handle_new_user() 関数を SECURITY INVOKER で再定義
--    SECURITY INVOKER = 関数を呼び出したユーザーの権限で実行（安全）
--    SECURITY DEFINER = 関数の所有者権限で実行（危険：権限昇格リスクあり）
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER        -- ← SECURITY DEFINER から変更
SET search_path = public
AS $$
BEGIN
    -- 新規認証ユーザーに対応する profiles レコードを自動生成
    INSERT INTO public.profiles (user_id, display_name, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1), 'ユーザー'),
        'operator'
    )
    ON CONFLICT (user_id) DO NOTHING;  -- 重複登録防止
    RETURN NEW;
END;
$$;

-- 3. トリガーを再登録
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. (任意) profiles テーブルに user_id の UNIQUE 制約がない場合は追加
--    ON CONFLICT (user_id) を使う場合に必要
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.profiles'::regclass
          AND conname = 'profiles_user_id_key'
    ) THEN
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
    END IF;
END
$$;

-- =================================================================
-- 実行後確認クエリ（期待値: security = 'invoker'）
-- =================================================================
-- SELECT proname, prosecdef
-- FROM pg_proc
-- WHERE proname = 'handle_new_user';
-- prosecdef = false → SECURITY INVOKER (正常)
-- prosecdef = true  → SECURITY DEFINER (変更されていない)
-- =================================================================
