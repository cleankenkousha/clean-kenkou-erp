import { JobStatus } from '../types'
import { ProcessLane } from '../components/features/KanbanBoard'

/**
 * Supabase の JobStatus から カンバンボードの ProcessLane へのマッピング
 */
export const mapJobStatusToLane = (
  status?: string | null,
  stepsData?: any
): ProcessLane => {
  if (!status) return '未着手'

  // 1. DBステータスが直接 scheduled の場合は日程確定
  if (status === 'scheduled') {
    return '日程確定'
  }

  // 2. stepsData が存在し、日程確定が「済」の場合は作業実施・請求以降でない限り「日程確定」として判定
  if (stepsData && typeof stepsData === 'object') {
    if (
      stepsData.schedule_confirmed?.status === '済' &&
      !['collected', 'billed', 'completed', 'cancelled'].includes(status)
    ) {
      return '日程確定'
    }
  }

  switch (status) {
    case 'received':
      return '未着手'
    case 'quoting':
    case 'pending':
      return '顧客検討'
    case 'arranged':
      return '作業日程調整'
    case 'scheduled':
      return '日程確定'
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
      return 'arranged'
    case '日程確定':
      return 'scheduled'
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
