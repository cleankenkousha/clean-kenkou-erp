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
}

const LOCAL_STORAGE_KEY = 'clean_kenkou_erp_custom_profiles'
const INITIALIZED_KEY = 'clean_kenkou_erp_profiles_initialized'

const isUuid = (str: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)

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
    let localSaved: Profile[] | null = null
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (stored) {
        const raw = JSON.parse(stored) as Profile[]
        localSaved = raw.map((p) => {
          if (!isUuid(p.id)) {
            const defMatch = DEFAULT_PROFILES.find((dp) => dp.display_name === p.display_name)
            return {
              ...p,
              id: defMatch ? defMatch.id : crypto.randomUUID(),
            }
          }
          return p
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

      // ローカル保存プロファイルと Supabase DB プロファイルの安全な統合
      const profileMap = new Map<string, Profile>()

      // 1. ローカルに保存されているカスタムプロファイルを追加
      if (localSaved && localSaved.length > 0) {
        for (const p of localSaved) {
          if (p.id && isUuid(p.id) && p.display_name) {
            profileMap.set(p.id, p)
          }
        }
      }

      // 2. Supabase DB のプロファイル（中原 等）で最新化・追加
      for (const p of dbProfiles) {
        if (p.id && isUuid(p.id) && p.display_name) {
          // 同名でIDが異なるローカルプロファイルがある場合はDB側を優先統合
          const existingLocal = Array.from(profileMap.values()).find(
            (lp) => lp.display_name === p.display_name
          )
          if (existingLocal) {
            profileMap.delete(existingLocal.id)
          }
          profileMap.set(p.id, p)
        }
      }

      // 3. 一度も初期化されておらず全プロファイルが完全に空の場合のみ初期データ
      if (profileMap.size === 0 && !isInitialized) {
        for (const p of DEFAULT_PROFILES) {
          profileMap.set(p.id, p)
        }
      }

      const combined = Array.from(profileMap.values())
      setProfiles(combined)
      saveLocalProfiles(combined)

      // ローカルにあったが DB 未反映のプロファイルがあれば Supabase へ一括同期(upsert)
      if (combined.length > 0) {
        const toUpsert = combined.map((p) => ({
          id: p.id,
          display_name: p.display_name,
          role: p.role,
        }))
        supabase
          .from('profiles')
          .upsert(toUpsert)
          .then(({ error: syncErr }) => {
            if (syncErr) {
              console.warn('Background sync profiles to Supabase notice:', syncErr.message)
            }
          })
      }
    } catch (err: any) {
      console.warn('Supabase profiles fetch warning, using local state:', err)
      if (localSaved !== null && localSaved.length > 0) {
        setProfiles(localSaved)
      } else if (!isInitialized) {
        setProfiles(DEFAULT_PROFILES)
      } else {
        setProfiles([])
      }
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }, [])

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
        if (isUuid(profileToSave.id)) {
          try {
            const { error: upsertErr } = await supabase
              .from('profiles')
              .upsert([
                {
                  id: profileToSave.id,
                  display_name: profileToSave.display_name,
                  role: profileToSave.role,
                  updated_at: new Date().toISOString(),
                },
              ])

            if (upsertErr) {
              console.warn('Supabase upsert profile warning:', upsertErr.message)
            }
          } catch (err: any) {
            console.error('Failed to update profile on Supabase:', err)
          }
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
      const newStaff: Profile = {
        id: newId,
        display_name: trimmedName,
        role,
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
          .insert([
            {
              id: newId,
              display_name: trimmedName,
              role,
            },
          ])

        if (insertErr) {
          console.warn('Supabase insert profile warning (saved locally):', insertErr.message)
        }
        return newStaff
      } catch (err: any) {
        console.warn('Supabase addStaff network fallback (saved locally):', err)
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
          await supabase.from('profiles').delete().eq('id', id)
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
  }
}

