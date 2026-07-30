// Clean KENKOU ERP 共通型定義

export type JobStatus = 'pending' | 'in_progress' | 'completed' | 'error'

export interface Customer {
  id: string
  name: string
  phone: string
  address: string
  createdAt: string
}

export interface Job {
  id: string
  customerId: string
  customerName?: string
  status: JobStatus
  title: string
  description?: string
  scheduledDate?: string
  createdAt: string
}
