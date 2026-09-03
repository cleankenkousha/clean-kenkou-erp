import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://cnwlcxfhxaugqtatibav.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_PSK5mj-C1gUN6hzJBv2YJA_MIIRgDM5'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
