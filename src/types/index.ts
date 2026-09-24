// Clean KENKOU ERP 共通型定義

export type JobStatus =
  | 'received'
  | 'quoting'
  | 'arranged'
  | 'scheduled'
  | 'collected'
  | 'billed'
  | 'completed'
  | 'pending'
  | 'cancelled'

export interface Customer {
  id: string
  name: string
  phone?: string | null
  address?: string | null
  created_at: string
  updated_at?: string
  deleted_at?: string | null
}

export interface Job {
  id: string
  customer_id: string
  title: string
  status: JobStatus
  received_at?: string | null
  scheduled_date?: string | null
  assigned_to?: string | null
  notes?: string | null
  created_at: string
  updated_at?: string
  customers?: {
    name: string
    phone?: string | null
    address?: string | null
  } | null
  profiles?: {
    display_name: string | null
  } | null
}

export interface Invoice {
  id?: string
  job_id: string
  amount: number
  billing_status: 'unissued' | 'issued' | 'paid'
  issued_at?: string | null
  due_date?: string | null
  paid_at?: string | null
  invoice_number?: string | null
  variance_reason?: string | null
  notes?: string | null
  created_at?: string
  updated_at?: string
}

export type ScheduleType = 'appointment' | 'meeting' | 'away' | 'work' | 'private' | 'other'

export interface StaffSchedule {
  id: string
  profile_id: string
  job_id?: string | null
  title: string
  schedule_type: ScheduleType
  start_time: string // ISO string
  end_time: string // ISO string
  is_all_day?: boolean
  location?: string | null
  customer_name?: string | null
  customer_phone?: string | null
  notes?: string | null
  created_by?: string | null
  created_at?: string
  updated_at?: string
  profiles?: {
    display_name: string | null
    role?: string
  } | null
  jobs?: {
    id: string
    title: string
    status: JobStatus
    customer_id?: string
    customers?: {
      name: string
      phone?: string | null
      address?: string | null
    } | null
  } | null
}


