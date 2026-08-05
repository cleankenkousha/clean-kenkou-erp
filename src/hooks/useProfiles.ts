import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface Profile {
  id: string
  display_name: string | null
  role: 'admin' | 'operator'
  created_at?: string
  updated_at?: string
}

export interface UseProfilesReturn {
  profiles: Profile[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  updateProfile: (id: string, updates: Partial<Profile>) => Promise<boolean>
  addStaff: (displayName: string, role?: 'admin' | 'operator') => Promise<boolean>
}

export const useProfiles = (): UseProfilesReturn => {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProfiles = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true)
    setError(null)
    try {
      const { data, error: fetchErr } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true })

      if (fetchErr) throw new Error(fetchErr.message)

      setProfiles((data as Profile[]) || [])
    } catch (err: any) {
      console.error('Failed to fetch profiles:', err)
      setError(err.message || '担当者データの取得に失敗しました')
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }, [])

  const updateProfile = useCallback(
    async (id: string, updates: Partial<Profile>): Promise<boolean> => {
      try {
        const { error: updateErr } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', id)

        if (updateErr) throw new Error(updateErr.message)

        setProfiles((prev) =>
          prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
        )
        return true
      } catch (err: any) {
        console.error('Failed to update profile:', err)
        setError(err.message || '担当者情報の更新に失敗しました')
        return false
      }
    },
    []
  )

  const addStaff = useCallback(
    async (displayName: string, role: 'admin' | 'operator' = 'operator'): Promise<boolean> => {
      try {
        // スタッフのダミーUUIDまたはプロファイル追加
        const dummyId = crypto.randomUUID()
        const { error: insertErr } = await supabase
          .from('profiles')
          .insert([
            {
              id: dummyId,
              display_name: displayName.trim(),
              role,
            },
          ])

        if (insertErr) throw new Error(insertErr.message)

        fetchProfiles(false)
        return true
      } catch (err: any) {
        console.error('Failed to add staff:', err)
        setError(err.message || 'スタッフの追加に失敗しました')
        return false
      }
    },
    [fetchProfiles]
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
  }
}
