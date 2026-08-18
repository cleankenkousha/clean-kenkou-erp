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

  const fetchProfiles = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true)
    setError(null)

    // ローカルストレージの保存済みカスタムスタッフ
    let localSaved: Profile[] = []
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (stored) {
        const raw = JSON.parse(stored) as Profile[]
        // 旧 profile-default-X 形式のIDを新しい有効UUIDにマイグレーション
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

      // DBプロファイル + ローカル保存プロファイル + デフォルトプロファイルの統合
      const profileMap = new Map<string, Profile>()

      // 1. デフォルトプロファイルをまず登録
      for (const p of DEFAULT_PROFILES) {
        profileMap.set(p.id, p)
      }

      // 2. ローカル保存プロファイルで上書き・追加
      for (const p of localSaved) {
        profileMap.set(p.id, p)
      }

      // 3. Supabase DB のプロファイルで最新化・追加
      for (const p of dbProfiles) {
        if (p.id && isUuid(p.id)) {
          profileMap.set(p.id, p)
        }
      }

      const combined = Array.from(profileMap.values())
      setProfiles(combined)
      saveLocalProfiles(combined)
    } catch (err: any) {
      console.warn('Supabase profiles fetch warning, using local/default profiles:', err)
      if (localSaved.length > 0) {
        setProfiles(localSaved)
      } else {
        setProfiles(DEFAULT_PROFILES)
      }
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }, [])

  const saveLocalProfiles = (updatedProfiles: Profile[]) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedProfiles))
    } catch (e) {
      console.error('Failed to save profiles to localStorage:', e)
    }
  }

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

