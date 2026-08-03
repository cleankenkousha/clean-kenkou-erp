import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Job, JobStatus } from '../types'

export interface UseJobsReturn {
  jobs: Job[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  updateJobStatus: (jobId: string, newStatus: JobStatus) => Promise<boolean>
  updateJobDetails: (jobId: string, updates: Partial<Job>) => Promise<boolean>
}

export const useJobs = (): UseJobsReturn => {
  const [jobs, setJobs] = useState<Job[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchJobs = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true)
    setError(null)
    try {
      const { data, error: fetchError } = await supabase
        .from('jobs')
        .select('*, customers(name, phone, address)')
        .order('created_at', { ascending: false })

      if (fetchError) {
        throw new Error(fetchError.message)
      }

      setJobs((data as Job[]) || [])
    } catch (err: any) {
      console.error('Failed to fetch jobs from Supabase:', err)
      setError(err.message || '案件データの取得に失敗しました')
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }, [])

  const updateJobStatus = useCallback(
    async (jobId: string, newStatus: JobStatus): Promise<boolean> => {
      try {
        const { error: updateError } = await supabase
          .from('jobs')
          .update({ status: newStatus })
          .eq('id', jobId)

        if (updateError) {
          throw new Error(updateError.message)
        }

        // ローカルステートを直ちに更新
        setJobs((prevJobs) =>
          prevJobs.map((job) =>
            job.id === jobId ? { ...job, status: newStatus } : job
          )
        )
        return true
      } catch (err: any) {
        console.error('Failed to update job status:', err)
        setError(err.message || '案件ステータスの更新に失敗しました')
        return false
      }
    },
    []
  )

  const updateJobDetails = useCallback(
    async (jobId: string, updates: Partial<Job>): Promise<boolean> => {
      try {
        // jobs テーブルの有効な更新可能カラムのみを安全に抽出 (ホワイトリスト)
        const allowedKeys = ['title', 'status', 'scheduled_date', 'notes', 'assigned_to', 'received_at']
        const cleanUpdates: Record<string, any> = {}

        for (const key of Object.keys(updates)) {
          if (allowedKeys.includes(key)) {
            const val = (updates as any)[key]
            if (val === undefined) continue // undefined の項目は上書きスキップ

            // assigned_to が UUID パターンでない文字列の場合は null に設定して DB エラーを防止
            if (key === 'assigned_to') {
              if (val === null || val === '') {
                cleanUpdates[key] = null
              } else if (typeof val === 'string') {
                const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)
                cleanUpdates[key] = isUuid ? val : null
              }
            } else if (key === 'scheduled_date') {
              if (val === null || val === '') {
                cleanUpdates[key] = null
              } else if (typeof val === 'string') {
                const isDate = /^\d{4}-\d{2}-\d{2}$/.test(val.trim())
                cleanUpdates[key] = isDate ? val.trim() : null
              }
            } else {
              cleanUpdates[key] = val
            }
          }
        }

        const { error: updateError } = await supabase
          .from('jobs')
          .update(cleanUpdates)
          .eq('id', jobId)

        if (updateError) {
          throw new Error(updateError.message)
        }

        // ローカルステートを直ちに更新 (DB に送信した検証済みデータのみを適用)
        setJobs((prevJobs) =>
          prevJobs.map((job) => {
            if (job.id !== jobId) return job
            return {
              ...job,
              ...cleanUpdates,
              customers: job.customers, // リレーションの欠落を防止
            }
          })
        )
        return true
      } catch (err: any) {
        console.error('Failed to update job details:', err)
        setError(err.message || '案件詳細の更新に失敗しました')
        return false
      }
    },
    []
  )


  // Supabase Realtime 購読 (Realtime Subscriptions)
  useEffect(() => {
    let isMounted = true
    // 初回データ取得
    fetchJobs(true)

    // インスタンスごとにユニークなチャンネル名を設定し重複衝突を防止
    const channelId = `jobs_realtime_${Math.random().toString(36).substring(2, 9)}`
    let channel: ReturnType<typeof supabase.channel> | null = null

    try {
      channel = supabase
        .channel(channelId)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'jobs',
          },
          (payload) => {
            if (!isMounted) return
            try {
              if (payload.eventType === 'INSERT') {
                fetchJobs(false)
              } else if (payload.eventType === 'UPDATE') {
                // リレーションデータを含む完全なデータを再取得
                fetchJobs(false)
              } else if (payload.eventType === 'DELETE') {
                const oldRow = payload.old as { id: string }
                setJobs((prevJobs) =>
                  prevJobs.filter((job) => job.id !== oldRow.id)
                )
              }
            } catch (eventErr) {
              console.error('Realtime payload handling error:', eventErr)
            }
          }
        )
      channel.subscribe()
    } catch (subErr) {
      console.warn('Realtime subscription warning:', subErr)
    }

    return () => {
      isMounted = false
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [fetchJobs])

  return {
    jobs,
    isLoading,
    error,
    refetch: () => fetchJobs(true),
    updateJobStatus,
    updateJobDetails,
  }
}




