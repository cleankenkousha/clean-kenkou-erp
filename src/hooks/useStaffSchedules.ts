import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { StaffSchedule, ScheduleType, Job } from '../types'
export type { ScheduleType }

const LOCAL_STORAGE_KEY = 'clean_kenkou_erp_staff_schedules_v2'

const isUuid = (str: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)

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

  // スケジュール一覧の取得（DBを唯一の正とし、デモ予定混入や削除済み復活を防止）
  const fetchSchedules = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    let localBackup: StaffSchedule[] = []
    try {
      // 旧キーのデモデータを掃除
      localStorage.removeItem('clean_kenkou_erp_staff_schedules')
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          localBackup = parsed.filter((s: StaffSchedule) => s?.id && isUuid(s.id))
        }
      }
    } catch {
      localBackup = []
    }

    try {
      const { data, error: dbError } = await supabase
        .from('staff_schedules')
        .select(`
          *,
          profiles:profile_id (display_name, role),
          jobs:job_id (id, title, status, customer_id, customers:customer_id (name, phone, address))
        `)
        .order('start_time', { ascending: true })

      if (dbError) {
        console.warn('Supabase staff_schedules fetch warning:', dbError.message)
        setError(dbError.message)
        setSchedules(localBackup)
      } else {
        const dbRows = ((data || []) as StaffSchedule[]).sort(
          (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        )
        setSchedules(dbRows)
        saveToLocal(dbRows)
      }
    } catch (err: any) {
      console.warn('Network or schema error fetching staff schedules:', err)
      setError(err.message || 'スケジュールの取得に失敗しました')
      setSchedules(localBackup)
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
      setError(null)
      const newId = crypto.randomUUID()
      const newSchedule: StaffSchedule = {
        ...scheduleData,
        id: newId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const previousSchedules = schedules
      const next = [...schedules, newSchedule].sort(
        (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      )
      setSchedules(next)
      saveToLocal(next)

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
          throw new Error(insertErr.message)
        }
        return newSchedule
      } catch (e: any) {
        console.warn('Supabase staff_schedules insert failed:', e)
        setSchedules(previousSchedules)
        saveToLocal(previousSchedules)
        setError(e.message || 'スケジュールの登録に失敗しました')
        return null
      }
    },
    [schedules]
  )

  // スケジュール更新（ホワイトリストによるカラム制限）
  const updateSchedule = useCallback(async (id: string, updates: Partial<StaffSchedule>): Promise<boolean> => {
    setError(null)
    const allowedKeys = [
      'profile_id', 'job_id', 'title', 'schedule_type',
      'start_time', 'end_time', 'is_all_day',
      'location', 'customer_name', 'customer_phone', 'notes',
    ]
    const cleanUpdates: Record<string, any> = {}
    for (const key of Object.keys(updates)) {
      if (allowedKeys.includes(key)) {
        const val = (updates as any)[key]
        if (val !== undefined) {
          cleanUpdates[key] = val
        }
      }
    }

    const previousSchedules = schedules
    const next = schedules
      .map((s) => (s.id === id ? { ...s, ...cleanUpdates, updated_at: new Date().toISOString() } : s))
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    setSchedules(next)
    saveToLocal(next)

    try {
      const { error: updateErr } = await supabase
        .from('staff_schedules')
        .update({
          ...cleanUpdates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (updateErr) {
        throw new Error(updateErr.message)
      }
      return true
    } catch (e: any) {
      console.warn('Supabase staff_schedules update failed:', e)
      setSchedules(previousSchedules)
      saveToLocal(previousSchedules)
      setError(e.message || 'スケジュールの更新に失敗しました')
      return false
    }
  }, [schedules])

  // スケジュール削除
  const deleteSchedule = useCallback(async (id: string): Promise<boolean> => {
    setError(null)
    const previousSchedules = schedules
    const next = schedules.filter((s) => s.id !== id)
    setSchedules(next)
    saveToLocal(next)

    try {
      const { error: delErr } = await supabase.from('staff_schedules').delete().eq('id', id)
      if (delErr) {
        throw new Error(delErr.message)
      }
      return true
    } catch (e: any) {
      console.warn('Supabase staff_schedules delete failed:', e)
      setSchedules(previousSchedules)
      saveToLocal(previousSchedules)
      setError(e.message || 'スケジュールの削除に失敗しました')
      return false
    }
  }, [schedules])

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

      setError(null)
      let createdJobId: string | null = null
      let newJob: Job | undefined

      // 1. 案件を同時作成する場合
      if (createJob) {
        try {
          // 既存顧客チェック（論理削除済みを除外し、重複時でもエラーにならないよう limit(1) を使用）
          let customerId = crypto.randomUUID()
          const { data: existingCusts, error: custFetchErr } = await supabase
            .from('customers')
            .select('id')
            .is('deleted_at', null)
            .eq('name', customerName.trim())
            .limit(1)

          if (custFetchErr) {
            throw new Error(custFetchErr.message)
          }

          if (existingCusts && existingCusts.length > 0 && existingCusts[0]?.id) {
            customerId = existingCusts[0].id
          } else {
            const { error: custErr } = await supabase.from('customers').insert({
              id: customerId,
              name: customerName.trim(),
              phone: customerPhone?.trim() || null,
              address: customerAddress?.trim() || null,
            })
            if (custErr) {
              throw new Error(`顧客登録に失敗しました: ${custErr.message}`)
            }
          }

          // 新規案件 (quoting: 見積対応中)
          const jobId = crypto.randomUUID()
          createdJobId = jobId
          const startDateObj = new Date(startTime)
          const dateOnly = !isNaN(startDateObj.getTime())
            ? `${startDateObj.getFullYear()}-${String(startDateObj.getMonth() + 1).padStart(2, '0')}-${String(startDateObj.getDate()).padStart(2, '0')}`
            : startTime.split('T')[0]

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
            throw new Error(`案件登録に失敗しました: ${jobErr.message}`)
          }

          newJob = {
            ...jobPayload,
            customers: {
              name: customerName,
              phone: customerPhone || null,
              address: customerAddress || null,
            },
          }
        } catch (e: any) {
          console.warn('Failed to auto-create job alongside appointment:', e)
          setError(e.message || '見積訪問の顧客/案件登録に失敗しました')
          return null
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
