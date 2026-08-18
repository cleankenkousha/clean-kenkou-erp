import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export type StaffRole = 'admin' | 'sales' | 'dispatcher' | 'operator' | 'clerk' | string

export interface Profile {
  id: string
  display_name: string | null
  role: StaffRole
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
  addStaff: (displayName: string, role?: StaffRole) => Promise<Profile | null>
  deleteStaff: (id: string) => Promise<boolean>
  syncAllProfiles: () => Promise<{ success: boolean; message: string }>
}

const LOCAL_STORAGE_KEY = 'clean_kenkou_erp_custom_profiles'
const INITIALIZED_KEY = 'clean_kenkou_erp_profiles_initialized'

const isUuid = (str: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)

const VALID_ROLES = ['admin', 'sales', 'dispatcher', 'operator', 'clerk']

const DEFAULT_PROFILES: Profile[] = [
  { id: '00000000-0000-4000-8000-000000000001', display_name: '山田 太郎', role: 'admin' },
  { id: '00000000-0000-4000-8000-000000000002', display_name: '田中 次郎', role: 'dispatcher' },
  { id: '00000000-0000-4000-8000-000000000003', display_name: '佐藤 花子', role: 'sales' },
  { id: '00000000-0000-4000-8000-000000000004', display_name: '鈴木 一郎', role: 'operator' },
  { id: '00000000-0000-4000-8000-000000000005', display_name: '高橋 美咲', role: 'clerk' },
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

    const isInitialized = localStorage.getItem(INITIALIZED_KEY) === 'true'

    // ローカルストレージの保存済みプロファイル
    let localSaved: Profile[] = []
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (stored) {
        const raw = JSON.parse(stored) as Profile[]
        localSaved = raw.map((p) => {
          const validRole = VALID_ROLES.includes(p.role) ? p.role : 'operator'
          if (!isUuid(p.id)) {
            const defMatch = DEFAULT_PROFILES.find((dp) => dp.display_name === p.display_name)
            return {
              ...p,
              id: defMatch ? defMatch.id : crypto.randomUUID(),
              role: validRole,
            }
          }
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

      // ローカルプロファイルと Supabase DB プロファイルの統合 Map
      const profileMap = new Map<string, Profile>()

      // 1. ローカルに存在するプロファイル（千葉正和、川上大輝など8名）を登録
      for (const p of localSaved) {
        if (p.display_name) {
          const validId = isUuid(p.id) ? p.id : crypto.randomUUID()
          const validRole = VALID_ROLES.includes(p.role) ? p.role : 'operator'
          profileMap.set(p.display_name, {
            id: validId,
            display_name: p.display_name,
            role: validRole,
          })
        }
      }

      // 2. Supabase DB のプロファイル（中原知美 など）を上書き・統合
      for (const p of dbProfiles) {
        if (p.display_name) {
          const validId = isUuid(p.id) ? p.id : crypto.randomUUID()
          const validRole = VALID_ROLES.includes(p.role) ? p.role : 'operator'
          profileMap.set(p.display_name, {
            id: validId,
            display_name: p.display_name,
            role: validRole,
          })
        }
      }

      // 3. 一度も初期化されたことがない場合のみデフォルトサンプル
      if (profileMap.size === 0 && !isInitialized) {
        for (const p of DEFAULT_PROFILES) {
          profileMap.set(p.display_name!, p)
        }
      }

      const combined = Array.from(profileMap.values())
      setProfiles(combined)
      saveLocalProfiles(combined)

      // 全プロファイルを Supabase DB へ確実に一括 upsert 保存
      if (combined.length > 0) {
        const toUpsert = combined.map((p) => ({
          id: p.id,
          display_name: p.display_name,
          role: VALID_ROLES.includes(p.role) ? p.role : 'operator',
          updated_at: new Date().toISOString(),
        }))

        const { error: upsertErr } = await supabase
          .from('profiles')
          .upsert(toUpsert, { onConflict: 'id' })

        if (upsertErr) {
          console.warn('Supabase profile sync warning:', upsertErr.message)
        } else {
          console.log(`✅ Successfully synced ${toUpsert.length} profiles to Supabase DB!`)
        }
      }
    } catch (err: any) {
      console.warn('Supabase profiles fetch warning, using local state:', err)
      setProfiles(localSaved)
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }, [])

  const syncAllProfiles = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    try {
      if (profiles.length === 0) return { success: true, message: '同期対象のスタッフがいません。' }

      // DB の既存プロファイルを全件取得して ID の競合を回避
      const { data: dbData } = await supabase.from('profiles').select('*')
      const dbList = (dbData as Profile[]) || []

      const dbIdMap = new Map<string, string>()
      for (const item of dbList) {
        if (item.display_name && item.id) {
          dbIdMap.set(item.display_name, item.id)
        }
      }

      const toUpsert = profiles.map((p) => {
        const existingDbId = p.display_name ? dbIdMap.get(p.display_name) : null
        const targetId = existingDbId || (isUuid(p.id) ? p.id : crypto.randomUUID())
        const validRole = VALID_ROLES.includes(p.role) ? p.role : 'operator'
        return {
          id: targetId,
          display_name: p.display_name || '名前未設定',
          role: validRole,
          updated_at: new Date().toISOString(),
        }
      })

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
        fetchProfiles(false)
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
      let targetToSave: Profile | null = null

      setProfiles((prev) => {
        const next = prev.map((p) => {
          if (p.id === id) {
            targetToSave = { ...p, ...updates }
            return targetToSave
          }
          return p
        })
        saveLocalProfiles(next)
        return next
      })

      if (targetToSave) {
        const profileToSave = targetToSave as Profile
        const validId = isUuid(profileToSave.id) ? profileToSave.id : crypto.randomUUID()
        const validRole = VALID_ROLES.includes(profileToSave.role) ? profileToSave.role : 'operator'

        try {
          const { error: upsertErr } = await supabase
            .from('profiles')
            .upsert([
              {
                id: validId,
                display_name: profileToSave.display_name,
                role: validRole,
                updated_at: new Date().toISOString(),
              },
            ])

          if (upsertErr) {
            console.warn('Supabase upsert profile warning:', upsertErr.message)
          } else {
            console.log(`✅ Profile updated on Supabase: ${profileToSave.display_name}`)
          }
        } catch (err: any) {
          console.error('Failed to update profile on Supabase:', err)
        }
      }
      return true
    },
    []
  )

  const addStaff = useCallback(
    async (displayName: string, role: StaffRole = 'operator'): Promise<Profile | null> => {
      const trimmedName = displayName.trim()
      if (!trimmedName) return null

      const newId = crypto.randomUUID()
      const validRole = VALID_ROLES.includes(role) ? role : 'operator'
      const newStaff: Profile = {
        id: newId,
        display_name: trimmedName,
        role: validRole,
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
              updated_at: new Date().toISOString(),
            },
          ])

        if (insertErr) {
          console.warn('Supabase insert profile warning:', insertErr.message)
        } else {
          console.log(`✅ Staff added to Supabase: ${trimmedName}`)
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
          const { error: deleteErr } = await supabase.from('profiles').delete().eq('id', id)
          if (deleteErr) {
            console.warn('Supabase delete profile warning:', deleteErr.message)
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

