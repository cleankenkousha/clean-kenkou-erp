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
  addStaff: (displayName: string, role?: StaffRole) => Promise<boolean>
  deleteStaff: (id: string) => Promise<boolean>
}

const LOCAL_STORAGE_KEY = 'clean_kenkou_erp_custom_profiles'

const DEFAULT_PROFILES: Profile[] = [
  { id: 'profile-default-1', display_name: '山田 太郎', role: 'admin' },
  { id: 'profile-default-2', display_name: '田中 次郎', role: 'dispatcher' },
  { id: 'profile-default-3', display_name: '佐藤 花子', role: 'sales' },
  { id: 'profile-default-4', display_name: '鈴木 一郎', role: 'operator' },
  { id: 'profile-default-5', display_name: '高橋 美咲', role: 'clerk' },
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
      if (stored) localSaved = JSON.parse(stored)
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

      // DBプロファイル + ローカルプロファイル（重複除外）の統合
      const combined = [...dbProfiles]
      const existingIds = new Set(dbProfiles.map((p) => p.id))
      const existingNames = new Set(dbProfiles.map((p) => (p.display_name || '').trim()))

      // デフォルトおよびローカル保存プロファイルをマージ
      for (const p of [...localSaved, ...DEFAULT_PROFILES]) {
        if (!existingIds.has(p.id) && !existingNames.has((p.display_name || '').trim())) {
          combined.push(p)
          existingIds.add(p.id)
          if (p.display_name) existingNames.add(p.display_name.trim())
        }
      }

      setProfiles(combined)
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
      try {
        const { error: updateErr } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', id)

        if (updateErr) console.warn('Supabase update warning:', updateErr.message)

        setProfiles((prev) => {
          const next = prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
          saveLocalProfiles(next)
          return next
        })
        return true
      } catch (err: any) {
        console.error('Failed to update profile:', err)
        setProfiles((prev) => {
          const next = prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
          saveLocalProfiles(next)
          return next
        })
        return true
      }
    },
    []
  )

  const addStaff = useCallback(
    async (displayName: string, role: StaffRole = 'operator'): Promise<boolean> => {
      const trimmedName = displayName.trim()
      if (!trimmedName) return false

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
        return true
      } catch (err: any) {
        console.warn('Supabase addStaff network fallback (saved locally):', err)
        return true
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
        await supabase.from('profiles').delete().eq('id', id)
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
