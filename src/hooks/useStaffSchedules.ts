import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { StaffSchedule, ScheduleType, Job } from '../types'
export type { ScheduleType }

const LOCAL_STORAGE_KEY = 'clean_kenkou_erp_staff_schedules'

// デモ初期データ（直近の日時で表示されるサンプル予定）
const generateInitialSchedules = (): StaffSchedule[] => {
  const today = new Date()
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  const d = String(today.getDate()).padStart(2, '0')
  const dateStr = `${y}-${m}-${d}`

  return [
    {
      id: 'demo-sch-001',
      profile_id: '00000000-0000-4000-8000-000000000003', // 廣田龍之介
      title: '山田様 見積訪問（遺品整理・家具）',
      schedule_type: 'appointment',
      start_time: `${dateStr}T09:30:00+09:00`,
      end_time: `${dateStr}T11:00:00+09:00`,
      location: '山鹿市鹿校通2-1-10',
      customer_name: '山田 太郎',
      customer_phone: '090-1234-5678',
      notes: '電話受付済み。タンス3点、家電製品の見積希望。駐車場あり。',
      profiles: { display_name: '廣田龍之介', role: 'sales' },
    },
    {
      id: 'demo-sch-002',
      profile_id: '00000000-0000-4000-8000-000000000003', // 廣田龍之介
      title: '山鹿市役所 資源循環課 打合せ',
      schedule_type: 'away',
      start_time: `${dateStr}T14:00:00+09:00`,
      end_time: `${dateStr}T15:30:00+09:00`,
      location: '山鹿市役所 本庁舎',
      notes: '一般廃棄物収集運搬関連の申請書類提出と協議。',
      profiles: { display_name: '廣田龍之介', role: 'sales' },
    },
    {
      id: 'demo-sch-003',
      profile_id: '00000000-0000-4000-8000-000000000004', // 原口真治
      title: '高森物産様 定期回収見積・契約更新',
      schedule_type: 'appointment',
      start_time: `${dateStr}T10:00:00+09:00`,
      end_time: `${dateStr}T11:30:00+09:00`,
      location: '熊本市北区植木町123',
      customer_name: '高森物産 株式会社',
      customer_phone: '096-272-1111',
      notes: '段ボール・古紙月極契約の単価見直し見積もり。',
      profiles: { display_name: '原口真治', role: 'sales' },
    },
    {
      id: 'demo-sch-004',
      profile_id: '00000000-0000-4000-8000-000000000004', // 原口真治
      title: '社内営業ミーティング',
      schedule_type: 'meeting',
      start_time: `${dateStr}T16:00:00+09:00`,
      end_time: `${dateStr}T17:00:00+09:00`,
      location: '本社 2F会議室',
      notes: '今週の案件進捗および大型粗大ごみ回収の配車確認。',
      profiles: { display_name: '原口真治', role: 'sales' },
    },
  ]
}

export interface CreateAppointmentParams {
  profileId: string
  title: string
  startTime: string
  endTime: string
  customerName: string
  customerPhone?: string
  customerAddress?: string
  notes?: string
  createJob?: boolean
}

export interface UseStaffSchedulesReturn {
  schedules: StaffSchedule[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  addSchedule: (schedule: Omit<StaffSchedule, 'id' | 'created_at' | 'updated_at'>) => Promise<StaffSchedule | null>
  updateSchedule: (id: string, updates: Partial<StaffSchedule>) => Promise<boolean>
  deleteSchedule: (id: string) => Promise<boolean>
  createAppointmentWithJob: (params: CreateAppointmentParams) => Promise<{ schedule: StaffSchedule; job?: Job } | null>
}

export const useStaffSchedules = (): UseStaffSchedulesReturn => {
  const [schedules, setSchedules] = useState<StaffSchedule[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // ローカル保存ヘルパー
  const saveToLocal = (data: StaffSchedule[]) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data))
    } catch (e) {
      console.error('Failed to save staff schedules to localStorage:', e)
    }
  }

  // スケジュール一覧の取得
  const fetchSchedules = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    // 1. ローカルストレージからの既存データ復元
    let localData: StaffSchedule[] = []
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (stored) {
        localData = JSON.parse(stored)
      } else {
        localData = generateInitialSchedules()
        saveToLocal(localData)
      }
    } catch (e) {
      localData = generateInitialSchedules()
    }

    try {
      // 2. Supabase DB から取得（staff_schedules テーブルが存在する場合）
      const { data, error: dbError } = await supabase
        .from('staff_schedules')
        .select(`
          *,
          profiles:profile_id (display_name, role),
          jobs:job_id (id, title, status, customer_id, customers:customer_id (name, phone, address))
        `)
        .order('start_time', { ascending: true })

      if (dbError) {
        console.warn('Supabase staff_schedules fetch warning (using local data):', dbError.message)
        setSchedules(localData)
      } else if (data && data.length > 0) {
        // DBデータとローカルデータをIDで統合
        const map = new Map<string, StaffSchedule>()
        localData.forEach((s) => map.set(s.id, s))
        data.forEach((s) => map.set(s.id, s as StaffSchedule))
        const merged = Array.from(map.values()).sort(
          (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        )
        setSchedules(merged)
        saveToLocal(merged)
      } else {
        setSchedules(localData)
      }
    } catch (err: any) {
      console.warn('Network or schema error fetching staff schedules:', err)
      setSchedules(localData)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSchedules()
  }, [fetchSchedules])

  // スケジュール追加
  const addSchedule = useCallback(
    async (scheduleData: Omit<StaffSchedule, 'id' | 'created_at' | 'updated_at'>): Promise<StaffSchedule | null> => {
      const newId = crypto.randomUUID()
      const newSchedule: StaffSchedule = {
        ...scheduleData,
        id: newId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      setSchedules((prev) => {
        const next = [...prev, newSchedule].sort(
          (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        )
        saveToLocal(next)
        return next
      })

      // Supabase へ保存試行
      try {
        const { error: insertErr } = await supabase.from('staff_schedules').insert({
          id: newId,
          profile_id: newSchedule.profile_id,
          job_id: newSchedule.job_id || null,
          title: newSchedule.title,
          schedule_type: newSchedule.schedule_type,
          start_time: newSchedule.start_time,
          end_time: newSchedule.end_time,
          is_all_day: newSchedule.is_all_day || false,
          location: newSchedule.location || null,
          customer_name: newSchedule.customer_name || null,
          customer_phone: newSchedule.customer_phone || null,
          notes: newSchedule.notes || null,
          created_at: newSchedule.created_at,
          updated_at: newSchedule.updated_at,
        })
        if (insertErr) {
          console.warn('Supabase staff_schedules insert notice (saved locally):', insertErr.message)
        }
      } catch (e) {
        console.warn('Supabase staff_schedules insert exception (saved locally):', e)
      }

      return newSchedule
    },
    []
  )

  // スケジュール更新
  const updateSchedule = useCallback(async (id: string, updates: Partial<StaffSchedule>): Promise<boolean> => {
    setSchedules((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, ...updates, updated_at: new Date().toISOString() } : s))
      saveToLocal(next)
      return next
    })

    try {
      const { error: updateErr } = await supabase
        .from('staff_schedules')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (updateErr) {
        console.warn('Supabase staff_schedules update notice:', updateErr.message)
      }
    } catch (e) {
      console.warn('Supabase staff_schedules update exception:', e)
    }

    return true
  }, [])

  // スケジュール削除
  const deleteSchedule = useCallback(async (id: string): Promise<boolean> => {
    setSchedules((prev) => {
      const next = prev.filter((s) => s.id !== id)
      saveToLocal(next)
      return next
    })

    try {
      const { error: delErr } = await supabase.from('staff_schedules').delete().eq('id', id)
      if (delErr) {
        console.warn('Supabase staff_schedules delete notice:', delErr.message)
      }
    } catch (e) {
      console.warn('Supabase staff_schedules delete exception:', e)
    }

    return true
  }, [])

  // 見積訪問予約 ＆ 新規案件（jobs）一括自動作成
  const createAppointmentWithJob = useCallback(
    async (params: CreateAppointmentParams) => {
      const {
        profileId,
        title,
        startTime,
        endTime,
        customerName,
        customerPhone,
        customerAddress,
        notes,
        createJob = true,
      } = params

      let createdJobId: string | null = null
      let newJob: Job | undefined

      // 1. 案件を同時作成する場合
      if (createJob) {
        try {
          // 既存顧客チェックまたは新規顧客作成
          let customerId = crypto.randomUUID()
          const { data: existingCust } = await supabase
            .from('customers')
            .select('id')
            .eq('name', customerName.trim())
            .maybeSingle()

          if (existingCust?.id) {
            customerId = existingCust.id
          } else {
            // 新規顧客
            const { error: custErr } = await supabase.from('customers').insert({
              id: customerId,
              name: customerName.trim(),
              phone: customerPhone?.trim() || null,
              address: customerAddress?.trim() || null,
            })
            if (custErr) {
              console.warn('Customer auto-create note:', custErr.message)
            }
          }

          // 新規案件 (quoting: 見積対応中)
          const jobId = crypto.randomUUID()
          createdJobId = jobId
          const dateOnly = startTime.split('T')[0]

          const jobPayload: any = {
            id: jobId,
            customer_id: customerId,
            title: title || `${customerName}様 見積訪問`,
            status: 'quoting',
            scheduled_date: dateOnly,
            assigned_to: profileId,
            notes: notes ? `【見積訪問予約】\n${notes}` : '【見積訪問予約】',
            created_at: new Date().toISOString(),
          }

          const { error: jobErr } = await supabase.from('jobs').insert(jobPayload)
          if (jobErr) {
            console.warn('Job auto-create notice:', jobErr.message)
          }

          newJob = {
            ...jobPayload,
            customers: {
              name: customerName,
              phone: customerPhone || null,
              address: customerAddress || null,
            },
          }
        } catch (e) {
          console.warn('Failed to auto-create job alongside appointment:', e)
        }
      }

      // 2. スケジュール枠の登録
      const newSchedule = await addSchedule({
        profile_id: profileId,
        job_id: createdJobId,
        title: title || `${customerName}様 見積訪問`,
        schedule_type: 'appointment',
        start_time: startTime,
        end_time: endTime,
        location: customerAddress || '',
        customer_name: customerName,
        customer_phone: customerPhone || '',
        notes: notes || '',
      })

      if (!newSchedule) return null

      return {
        schedule: newSchedule,
        job: newJob,
      }
    },
    [addSchedule]
  )

  return {
    schedules,
    isLoading,
    error,
    refetch: fetchSchedules,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    createAppointmentWithJob,
  }
}
