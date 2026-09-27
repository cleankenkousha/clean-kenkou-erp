import { createClient } from '@supabase/supabase-js'

// 環境変数から取得（フォールバック値をソースコードに含めない）
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[Clean KENKOU ERP] VITE_SUPABASE_URL および VITE_SUPABASE_ANON_KEY 環境変数が設定されていません。' +
    '.env ファイルまたはデプロイ先の環境変数設定を確認してください。'
  )
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')
