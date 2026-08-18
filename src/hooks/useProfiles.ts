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
  { id: '00000000-0000-4000-8000-000000000001', display_name: '千葉正和', role: 'admin' },
  { id: '00000000-0000-4000-8000-000000000002', display_name: '川上大輝', role: 'dispatcher' },
  { id: '00000000-0000-4000-8000-000000000003', display_name: '廣田龍之介', role: 'sales' },
  { id: '00000000-0000-4000-8000-000000000004', display_name: '原口真治', role: 'sales' },
  { id: '00000000-0000-4000-8000-000000000005', display_name: '古川有佐', role: 'clerk' },
  { id: '00000000-0000-4000-8000-000000000006', display_name: '木下りな', role: 'clerk' },
  { id: '00000000-0000-4000-8000-000000000007', display_name: '矢部川麻衣子', role: 'clerk' },
  { id: '00000000-0000-4000-8000-000000000008', display_name: '中原知美', role: 'operator' },
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

      // デフォルト8名 + ローカル保存 + Supabase DB の完全統合 Map
      const profileMap = new Map<string, Profile>()

      // 1. 社内基本8名をまず登録
      for (const p of DEFAULT_PROFILES) {
        profileMap.set(p.display_name!, p)
      }

      // 2. ローカルに保存されているカスタムプロファイルで上書き・追加
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

      // 3. Supabase DB のプロファイル（中原知美 など）で最新化・統合
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

      const combined = Array.from(profileMap.values())
      setProfiles(combined)
      saveLocalProfiles(combined)

      // 全8名以上のプロファイルを Supabase DB へ自動保存・同期(upsert)
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
          console.warn('Supabase profile auto-sync notice:', upsertErr.message)
        } else {
          console.log(`✅ Auto-synced ${toUpsert.length} company profiles to Supabase DB!`)
        }
      }
    } catch (err: any) {
      console.warn('Supabase profiles fetch warning, using default/local state:', err)
      const fallbackMap = new Map<string, Profile>()
      for (const p of DEFAULT_PROFILES) {
        fallbackMap.set(p.display_name!, p)
      }
      for (const p of localSaved) {
        if (p.display_name) fallbackMap.set(p.display_name, p)
      }
      setProfiles(Array.from(fallbackMap.values()))
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }, [])

  const syncAllProfiles = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    try {
      // 1. 社内基本8名をベースにプロファイルマップを構築
      const profileMap = new Map<string, Profile>()

      for (const p of DEFAULT_PROFILES) {
        profileMap.set(p.display_name!, { ...p })
      }

      // 2. 現在の profiles ステートに存在するプロファイルで上書き・追加
      for (const p of profiles) {
        if (p.display_name) {
          const existing = profileMap.get(p.display_name)
          const validId = isUuid(p.id) ? p.id : existing?.id || crypto.randomUUID()
          const validRole = VALID_ROLES.includes(p.role) ? p.role : 'operator'
          profileMap.set(p.display_name, {
            id: validId,
            display_name: p.display_name,
            role: validRole,
          })
        }
      }

      // 3. Supabase DB に既に存在するデータ（中原知美の既存ID等）があれば優先統合
      try {
        const { data: dbData } = await supabase.from('profiles').select('*')
        const dbList = (dbData as Profile[]) || []
        for (const item of dbList) {
          if (item.display_name && item.id) {
            const current = profileMap.get(item.display_name)
            if (current) {
              current.id = isUuid(item.id) ? item.id : current.id
            } else {
              profileMap.set(item.display_name, {
                id: item.id,
                display_name: item.display_name,
                role: VALID_ROLES.includes(item.role) ? item.role : 'operator',
              })
            }
          }
        }
      } catch (e) {
        // ignore
      }

      const targetProfiles = Array.from(profileMap.values())

      const toUpsert = targetProfiles.map((p) => ({
        id: isUuid(p.id) ? p.id : crypto.randomUUID(),
        display_name: p.display_name || '名前未設定',
        role: VALID_ROLES.includes(p.role) ? p.role : 'operator',
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
        setProfiles(targetProfiles)
        saveLocalProfiles(targetProfiles)
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
  }, [profiles])

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

