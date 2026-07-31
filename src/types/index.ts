// Clean KENKOU ERP 共通型定義

export type JobStatus =
  | 'received'
  | 'quoting'
  | 'arranged'
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

}

