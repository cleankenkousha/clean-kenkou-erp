import { JobStatus } from '../types'
import { ProcessLane } from '../components/features/KanbanBoard'

/**
 * Supabase の JobStatus から カンバンボードの ProcessLane へのマッピング
 */
export const mapJobStatusToLane = (status?: string | null): ProcessLane => {
  if (!status) return '未着手'
  switch (status) {
    case 'received':
      return '未着手'
    case 'quoting':
    case 'pending':
      return '顧客検討'
    case 'arranged':
      return '作業日程調整'
    case 'collected':
      return '作業実施'
    case 'billed':
    case 'completed':
      return '請求書送付'
    case 'cancelled':
      return '失注・キャンセル'
    default:
      return '未着手'
  }
}

/**
 * カンバンボードの ProcessLane から Supabase の JobStatus へのマッピング
 */
export const mapLaneToJobStatus = (lane: ProcessLane): JobStatus => {
  switch (lane) {
    case '未着手':
      return 'received'
    case '顧客検討':
      return 'quoting'
    case '作業日程調整':
    case '日程確定':
      return 'arranged'
    case '作業実施':
      return 'collected'
    case '請求書送付':
      return 'billed'
    case '失注・キャンセル':
      return 'cancelled'
    default:
      return 'received'
  }
}
