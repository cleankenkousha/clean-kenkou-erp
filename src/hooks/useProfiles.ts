import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export type StaffRole = 'admin' | 'sales' | 'dispatcher' | 'operator' | 'clerk' | string

export interface Profile {
  id: string
  auth_user_id?: string | null
  display_name: string | null
  role: StaffRole
  email?: string | null
  last_login_at?: string | null
  created_at?: string
  updated_at?: string
}

export const ROLE_LABELS: Record<string, { label: string; style: string }> = {
  admin: { label: '管理者', style: 'bg-purple-100 text-purple-800 border-purple-200' },
  sales: { label: '営業担当', style: 'bg-blue-100 text-blue-800 border-blue-200' },
  dispatcher: { label: '配車担当', style: 'bg-amber-100 text-amber-800 border-amber-200' },
  operator: { label: '現場作業員', style: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  clerk: { label: '事務担当', style: 'bg-teal-100 text-teal-800 border-teal-200' },
}

export function getRoleInfo(roleStr: string) {
  return ROLE_LABELS[roleStr] || { label: roleStr || '一般スタッフ', style: 'bg-slate-100 text-slate-700 border-slate-200' }
}

export interface UseProfilesReturn {
  profiles: Profile[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  updateProfile: (id: string, updates: Partial<Profile>) => Promise<boolean>
  addStaff: (displayName: string, role?: StaffRole, email?: string) => Promise<Profile | null>
  deleteStaff: (id: string) => Promise<boolean>
  syncAllProfiles: () => Promise<{ success: boolean; message: string }>
}

const LOCAL_STORAGE_KEY = 'clean_kenkou_erp_custom_profiles'
const INITIALIZED_KEY = 'clean_kenkou_erp_profiles_initialized'

const isUuid = (str: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)

const VALID_ROLES = ['admin', 'sales', 'dispatcher', 'operator', 'clerk']

export const DEFAULT_PROFILES: Profile[] = [
  { id: '00000000-0000-4000-8000-000000000001', display_name: '千葉正和', role: 'admin', email: 'chiba@kenkou.co.jp' },
  { id: '00000000-0000-4000-8000-000000000002', display_name: '川上大輝', role: 'dispatcher', email: 'kawakami@kenkou.co.jp' },
  { id: '00000000-0000-4000-8000-000000000003', display_name: '廣田龍之介', role: 'sales', email: 'hirota@kenkou.co.jp' },
  { id: '00000000-0000-4000-8000-000000000004', display_name: '原口真治', role: 'sales', email: 'haraguchi@kenkou.co.jp' },
  { id: '00000000-0000-4000-8000-000000000005', display_name: '古川有佐', role: 'clerk', email: 'furukawa@kenkou.co.jp' },
  { id: 'cae97ae6-d819-42b7-b3b9-12918c67957e', display_name: '桑村りな', role: 'clerk', email: 'kuwamura@kenkou.co.jp' },
  { id: '00000000-0000-4000-8000-000000000007', display_name: '矢部川麻衣子', role: 'clerk', email: 'yabegawa@kenkou.co.jp' },
  { id: '00000000-0000-4000-8000-000000000008', display_name: '中原知美', role: 'operator', email: 'nakahara@kenkou.co.jp' },
]

export const useProfiles = (): UseProfilesReturn => {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const saveLocalProfiles = (updatedProfiles: Profile[]) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedProfiles))
      localStorage.setItem(INITIALIZED_KEY, 'true')
    } catch (e) {
      console.error('Failed to save profiles to localStorage:', e)
    }
  }

  const fetchProfiles = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true)
    setError(null)

    let localSaved: Profile[] = []
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (stored) {
        const raw = JSON.parse(stored) as Profile[]
        localSaved = raw
          .filter((p) => p.display_name !== '木下りな')
          .map((p) => {
            const validRole = VALID_ROLES.includes(p.role) ? p.role : 'operator'
            return { ...p, role: validRole }
          })
      }
    } catch (e) {
      // ignore
    }

    try {
      const { data, error: fetchErr } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true })

      if (fetchErr) throw new Error(fetchErr.message)

      const dbProfiles = (data as Profile[]) || []

      // Supabase DB にデータが存在する場合は、DB のデータを正（Single Source of Truth）とする
      // これにより、スタッフの氏名変更や削除を行った際に旧名が復活することを完全に防ぐ
      if (dbProfiles.length > 0) {
        const cleanedDbProfiles = dbProfiles.map((p) => ({
          ...p,
          role: VALID_ROLES.includes(p.role) ? p.role : 'operator',
        }))
        setProfiles(cleanedDbProfiles)
        saveLocalProfiles(cleanedDbProfiles)
      } else {
        // DB が空の場合のみ初期8名を投入
        setProfiles(DEFAULT_PROFILES)
        saveLocalProfiles(DEFAULT_PROFILES)
        const toUpsert = DEFAULT_PROFILES.map((p) => ({
          id: p.id,
          display_name: p.display_name,
          role: p.role,
          email: p.email || null,
          updated_at: new Date().toISOString(),
        }))
        await supabase.from('profiles').upsert(toUpsert, { onConflict: 'id' })
      }
    } catch (err: any) {
      console.warn('Supabase profiles fetch warning, using local/default state:', err)
      if (localSaved.length > 0) {
        setProfiles(localSaved)
      } else {
        setProfiles(DEFAULT_PROFILES)
      }
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }, [])

  const syncAllProfiles = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    try {
      // 現在画面に表示されている profiles をそのまま Supabase DB と同期する
      const targetProfiles = profiles.filter((p) => p.display_name && p.display_name !== '木下りな')

      const toUpsert = targetProfiles.map((p) => ({
        id: isUuid(p.id) ? p.id : crypto.randomUUID(),
        display_name: p.display_name || '名前未設定',
        role: VALID_ROLES.includes(p.role) ? p.role : 'operator',
        email: p.email || null,
        updated_at: new Date().toISOString(),
      }))

      let successCount = 0
      let lastErr = ''

      for (const item of toUpsert) {
        const { error: upsertErr } = await supabase
          .from('profiles')
          .upsert([item])

        if (upsertErr) {
          console.warn(`Profile upsert notice for ${item.display_name}:`, upsertErr.message)
          lastErr = upsertErr.message
        } else {
          successCount++
        }
      }

      if (successCount > 0) {
        await fetchProfiles(false)
        return {
          success: true,
          message: `✅ ${successCount}名のスタッフ情報をSupabaseへ同期保存しました！`,
        }
      } else {
        return {
          success: false,
          message: `Supabaseへの書き込みエラー: ${lastErr || '不明なエラー'}`,
        }
      }
    } catch (err: any) {
      console.error('Error syncing all profiles:', err)
      return { success: false, message: `同期例外エラー: ${err.message || String(err)}` }
    }
  }, [profiles, fetchProfiles])

  const updateProfile = useCallback(
    async (id: string, updates: Partial<Profile>): Promise<boolean> => {
      // まず画面ステートとローカルキャッシュを即時更新
      setProfiles((prev) => {
        const next = prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
        saveLocalProfiles(next)
        return next
      })

      try {
        const dbUpdates: Record<string, any> = {
          updated_at: new Date().toISOString(),
        }
        if (updates.display_name !== undefined) dbUpdates.display_name = updates.display_name
        if (updates.role !== undefined) {
          dbUpdates.role = VALID_ROLES.includes(updates.role) ? updates.role : 'operator'
        }
        if (updates.email !== undefined) dbUpdates.email = updates.email
        if (updates.auth_user_id !== undefined) dbUpdates.auth_user_id = updates.auth_user_id

        const { error: updateErr } = await supabase
          .from('profiles')
          .update(dbUpdates)
          .eq('id', id)

        if (updateErr) {
          console.warn('Supabase update profile warning:', updateErr.message)
          return false
        }
      } catch (err: any) {
        console.error('Failed to update profile on Supabase:', err)
        return false
      }
      return true
    },
    []
  )

  const addStaff = useCallback(
    async (displayName: string, role: StaffRole = 'operator', email?: string): Promise<Profile | null> => {
      const trimmedName = displayName.trim()
      if (!trimmedName) return null

      const newId = crypto.randomUUID()
      const validRole = VALID_ROLES.includes(role) ? role : 'operator'
      const cleanEmail = email?.trim()
        ? email.trim().includes('@')
          ? email.trim().toLowerCase()
          : `${email.trim().toLowerCase()}@kenkou.co.jp`
        : null

      const newStaff: Profile = {
        id: newId,
        display_name: trimmedName,
        role: validRole,
        email: cleanEmail,
        created_at: new Date().toISOString(),
      }

      setProfiles((prev) => {
        const next = [...prev, newStaff]
        saveLocalProfiles(next)
        return next
      })

      try {
        const { error: insertErr } = await supabase
          .from('profiles')
          .upsert([
            {
              id: newId,
              display_name: trimmedName,
              role: validRole,
              email: cleanEmail,
              updated_at: new Date().toISOString(),
            },
          ])

        if (insertErr) {
          console.warn('Supabase insert profile warning:', insertErr.message)
        }
        return newStaff
      } catch (err: any) {
        console.warn('Supabase addStaff network error:', err)
        return newStaff
      }
    },
    []
  )

  const deleteStaff = useCallback(
    async (id: string): Promise<boolean> => {
      setProfiles((prev) => {
        const next = prev.filter((p) => p.id !== id)
        saveLocalProfiles(next)
        return next
      })

      try {
        if (isUuid(id)) {
          // 外部キー参照（jobs.assigned_to 等）がある場合は先に null に解除してから削除
          await supabase.from('jobs').update({ assigned_to: null }).eq('assigned_to', id)
          await supabase.from('staff_schedules').delete().eq('profile_id', id)

          const { error: deleteErr } = await supabase.from('profiles').delete().eq('id', id)
          if (deleteErr) {
            console.warn('Supabase delete profile warning:', deleteErr.message)
            return false
          }
        }
        return true
      } catch (err: any) {
        return true
      }
    },
    []
  )

  useEffect(() => {
    fetchProfiles(true)
  }, [fetchProfiles])

  return {
    profiles,
    isLoading,
    error,
    refetch: () => fetchProfiles(true),
    updateProfile,
    addStaff,
    deleteStaff,
    syncAllProfiles,
  }
}
