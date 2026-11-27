import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { parseJobNotes } from '../lib/jobNotes'
import { JobStatus } from '../types'

// 実施日ベースの月別見積・売上集計データ
export interface MonthlyExecutionSummary {
  month: string                 // 'YYYY-MM'
  label: string                 // '2026年11月'
  shortLabel: string            // '26/11'
  executedQuote: number         // 作業実施済 (collected/billed/completed) の見積合計
  scheduledQuote: number        // 実施日確定 (scheduled) の見積合計
  totalQuote: number            // executedQuote + scheduledQuote
  executedCount: number         // 作業実施済件数
  scheduledCount: number        // 実施日確定件数
  revenue: number               // 確定売上合計 (paid + issued)
  paidRevenue: number           // 入金済合計
  issuedRevenue: number         // 請求済（未入金）合計
  invoicedCount: number         // 確定請求件数
  unbilledExecutedCount: number // 作業実施済かつ未請求件数
  unbilledExecutedQuote: number // 作業実施済かつ未請求の見積合計（売上化待ち）
  achievementRateExecuted: number // revenue / executedQuote * 100
  achievementRateTotal: number    // revenue / totalQuote * 100
}

// 案件別（実施日ベース見積・確定請求・乖離分析）明細
export interface ExecutionJobItem {
  jobId: string
  invoiceId: string | null
  customerName: string
  customerPhone: string | null
  customerAddress: string | null
  jobTitle: string
  jobStatus: JobStatus
  staffName: string | null
  scheduledDate: string | null   // 'YYYY-MM-DD' | null
  executionMonth: string | null  // 'YYYY-MM' | null
  formalQuoteAmount: number      // 正式見積 (notes.quoteData.grandTotal)
  estimatedAmount: number | null // 予想見積 (jobs.estimated_amount)
  effectiveQuote: number         // 採用見積（正式優先 → 予想見積）
  quoteSource: 'formal' | 'estimated' | 'none'
  invoiceAmount: number          // 確定請求額
  variance: number               // 差額 (invoiceAmount - effectiveQuote)
  varianceRate: number           // 乖離率 (%)
  billingStatus: 'unissued' | 'issued' | 'paid'
  issuedAt: string | null
  paidAt: string | null
  varianceReason: string | null
  rawNotes: string | null
  createdAt: string
}

// 全体サマリー
export interface SalesSummary {
  currentMonth: string
  totalRevenue: number            // 全期間確定売上合計（paid + issued）
  paidRevenue: number             // 入金済み合計
  issuedRevenue: number           // 請求済（未入金）合計
  unissuedCount: number           // 作業実施済で未請求の件数
  unpaidCount: number             // 未入金件数（issued のみ）
  collectionRate: number          // 回収率 = paid / (paid + issued) * 100
  thisMonthRevenue: number        // 今月売上（実施日ベース）
  lastMonthRevenue: number        // 先月売上（実施日ベース）
  unscheduledExecutedCount: number  // 実施日未設定の作業実施済件数
  unscheduledScheduledCount: number // 実施日未設定の日程確定件数
  unscheduledRevenue: number        // 実施日未設定の確定請求売上合計
  monthlyExecution: MonthlyExecutionSummary[]
  executionItems: ExecutionJobItem[]
}

const getLocalYearMonth = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

const formatMonthLabels = (ym: string): { label: string; shortLabel: string } => {
  const [yStr, mStr] = ym.split('-')
  const yNum = Number(yStr)
  const mNum = Number(mStr)
  return {
    label: `${yNum}年${mNum}月`,
    shortLabel: `${yStr.slice(-2)}/${mStr}`,
  }
}

const extractExecutionMonth = (scheduledDate?: string | null): string | null => {
  if (!scheduledDate) return null
  const trimmed = String(scheduledDate).trim()
  return /^\d{4}-\d{2}-\d{2}/.test(trimmed) ? trimmed.slice(0, 7) : null
}

const EXECUTED_JOB_STATUSES = new Set<JobStatus>(['collected', 'billed', 'completed'])

const createEmptyMonthBucket = (ym: string): MonthlyExecutionSummary => {
  const { label, shortLabel } = formatMonthLabels(ym)
  return {
    month: ym,
    label,
    shortLabel,
    executedQuote: 0,
    scheduledQuote: 0,
    totalQuote: 0,
    executedCount: 0,
    scheduledCount: 0,
    revenue: 0,
    paidRevenue: 0,
    issuedRevenue: 0,
    invoicedCount: 0,
    unbilledExecutedCount: 0,
    unbilledExecutedQuote: 0,
    achievementRateExecuted: 0,
    achievementRateTotal: 0,
  }
}

const EMPTY_SUMMARY: SalesSummary = {
  currentMonth: getLocalYearMonth(new Date()),
  totalRevenue: 0,
  paidRevenue: 0,
  issuedRevenue: 0,
  unissuedCount: 0,
  unpaidCount: 0,
  collectionRate: 0,
  thisMonthRevenue: 0,
  lastMonthRevenue: 0,
  unscheduledExecutedCount: 0,
  unscheduledScheduledCount: 0,
  unscheduledRevenue: 0,
  monthlyExecution: [],
  executionItems: [],
}

export interface UseSalesDataReturn {
  summary: SalesSummary
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export const useSalesData = (): UseSalesDataReturn => {
  const [summary, setSummary] = useState<SalesSummary>(EMPTY_SUMMARY)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSalesData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // キャンセル除外済み案件 + 請求データを並列取得
      const [jobsRes, invoicesRes] = await Promise.all([
        supabase
          .from('jobs')
          .select(
            'id, customer_id, title, status, scheduled_date, estimated_amount, notes, received_at, created_at, customers(name, phone, address), profiles:assigned_to(display_name)'
          )
          .neq('status', 'cancelled')
          .order('scheduled_date', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('invoices')
          .select('*')
          .order('created_at', { ascending: false }),
      ])

      if (jobsRes.error) throw new Error(jobsRes.error.message)
      if (invoicesRes.error) throw new Error(invoicesRes.error.message)

      const jobsList = (jobsRes.data || []) as any[]
      const invoicesList = (invoicesRes.data || []) as any[]

      // job_id ごとの最新 invoice をマップ化
      const invoiceByJobId = new Map<string, any>()
      for (const inv of invoicesList) {
        if (inv?.job_id && !invoiceByJobId.has(inv.job_id)) {
          invoiceByJobId.set(inv.job_id, inv)
        }
      }

      const now = new Date()
      const currentYM = getLocalYearMonth(now)
      const lastYM = getLocalYearMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1))
      const historyCutoffYM = getLocalYearMonth(new Date(now.getFullYear(), now.getMonth() - 11, 1))

      // 直近6ヶ月をベースラインとして必ず生成（実績0件でも推移が見やすいようにする）
      const monthMap = new Map<string, MonthlyExecutionSummary>()
      for (let offset = 5; offset >= 0; offset--) {
        const d = new Date(now.getFullYear(), now.getMonth() - offset, 1)
        const ym = getLocalYearMonth(d)
        monthMap.set(ym, createEmptyMonthBucket(ym))
      }

      const executionItems: ExecutionJobItem[] = []

      let totalRevenue = 0
      let paidRevenue = 0
      let issuedRevenue = 0
      let unissuedCount = 0
      let unpaidCount = 0
      let thisMonthRevenue = 0
      let lastMonthRevenue = 0
      let unscheduledExecutedCount = 0
      let unscheduledScheduledCount = 0
      let unscheduledRevenue = 0

      for (const job of jobsList) {
        const jobStatus = job.status as JobStatus
        const isExecuted = EXECUTED_JOB_STATUSES.has(jobStatus)
        const isScheduled = jobStatus === 'scheduled'

        const inv = invoiceByJobId.get(job.id) || null
        const billingStatus: 'unissued' | 'issued' | 'paid' = inv?.billing_status || 'unissued'
        const hasConfirmedInvoice = billingStatus === 'paid' || billingStatus === 'issued'
        const invoiceAmount =
          inv && inv.amount !== null && inv.amount !== undefined ? Number(inv.amount) || 0 : 0

        const formalQuoteAmount = parseJobNotes(job.notes).quoteGrandTotal
        const rawEst = job.estimated_amount
        const estimatedAmount =
          rawEst !== null && rawEst !== undefined && Number.isFinite(Number(rawEst))
            ? Number(rawEst)
            : null

        const effectiveQuote =
          formalQuoteAmount > 0
            ? formalQuoteAmount
            : estimatedAmount !== null && estimatedAmount > 0
              ? estimatedAmount
              : 0

        const quoteSource: 'formal' | 'estimated' | 'none' =
          formalQuoteAmount > 0
            ? 'formal'
            : estimatedAmount !== null && estimatedAmount > 0
              ? 'estimated'
              : 'none'

        const executionMonth = extractExecutionMonth(job.scheduled_date)

        // KPI 全体集計
        if (billingStatus === 'paid') {
          totalRevenue += invoiceAmount
          paidRevenue += invoiceAmount
        } else if (billingStatus === 'issued') {
          totalRevenue += invoiceAmount
          issuedRevenue += invoiceAmount
          unpaidCount++
        } else if (isExecuted) {
          unissuedCount++
        }

        // 月別集計（実施日 YYYY-MM ベース）
        if (executionMonth) {
          if (!monthMap.has(executionMonth)) {
            monthMap.set(executionMonth, createEmptyMonthBucket(executionMonth))
          }
          const bucket = monthMap.get(executionMonth)!

          if (isExecuted) {
            bucket.executedQuote += effectiveQuote
            bucket.executedCount++
            if (!hasConfirmedInvoice) {
              bucket.unbilledExecutedCount++
              bucket.unbilledExecutedQuote += effectiveQuote
            }
          } else if (isScheduled) {
            bucket.scheduledQuote += effectiveQuote
            bucket.scheduledCount++
          }

          if (hasConfirmedInvoice) {
            bucket.revenue += invoiceAmount
            bucket.invoicedCount++
            if (billingStatus === 'paid') {
              bucket.paidRevenue += invoiceAmount
            } else {
              bucket.issuedRevenue += invoiceAmount
            }
            if (executionMonth === currentYM) thisMonthRevenue += invoiceAmount
            if (executionMonth === lastYM) lastMonthRevenue += invoiceAmount
          }
        } else {
          if (isExecuted) unscheduledExecutedCount++
          else if (isScheduled) unscheduledScheduledCount++
          if (hasConfirmedInvoice) unscheduledRevenue += invoiceAmount
        }

        // 明細リストは「実施日確定 / 作業実施済 / 請求登録済」の案件を対象にする
        if (isExecuted || isScheduled || hasConfirmedInvoice) {
          const variance =
            effectiveQuote > 0 && hasConfirmedInvoice ? invoiceAmount - effectiveQuote : 0
          const varianceRate =
            effectiveQuote > 0 && hasConfirmedInvoice ? (variance / effectiveQuote) * 100 : 0

          executionItems.push({
            jobId: job.id,
            invoiceId: inv?.id || null,
            customerName: job.customers?.name || '名称未設定',
            customerPhone: job.customers?.phone || null,
            customerAddress: job.customers?.address || null,
            jobTitle: job.title || '–',
            jobStatus,
            staffName: job.profiles?.display_name || null,
            scheduledDate: job.scheduled_date || null,
            executionMonth,
            formalQuoteAmount,
            estimatedAmount,
            effectiveQuote,
            quoteSource,
            invoiceAmount,
            variance,
            varianceRate,
            billingStatus,
            issuedAt: inv?.issued_at || null,
            paidAt: inv?.paid_at || null,
            varianceReason: inv?.variance_reason || null,
            rawNotes: job.notes || null,
            createdAt: job.created_at,
          })
        }
      }

      // 合計・達成率の算出、時系列ソート（直近12ヶ月＋未来の確定月）
      const monthlyExecution = Array.from(monthMap.values())
        .filter((m) => m.month >= historyCutoffYM)
        .map((m) => {
          const totalQuote = m.executedQuote + m.scheduledQuote
          return {
            ...m,
            totalQuote,
            achievementRateExecuted:
              m.executedQuote > 0 ? Math.round((m.revenue / m.executedQuote) * 1000) / 10 : 0,
            achievementRateTotal:
              totalQuote > 0 ? Math.round((m.revenue / totalQuote) * 1000) / 10 : 0,
          }
        })
        .sort((a, b) => a.month.localeCompare(b.month))

      const collectionRate =
        paidRevenue + issuedRevenue > 0
          ? Math.round((paidRevenue / (paidRevenue + issuedRevenue)) * 1000) / 10
          : 0

      setSummary({
        currentMonth: currentYM,
        totalRevenue,
        paidRevenue,
        issuedRevenue,
        unissuedCount,
        unpaidCount,
        collectionRate,
        thisMonthRevenue,
        lastMonthRevenue,
        unscheduledExecutedCount,
        unscheduledScheduledCount,
        unscheduledRevenue,
        monthlyExecution,
        executionItems,
      })
    } catch (err: any) {
      console.error('useSalesData: fetch failed', err)
      setError(err.message || '売上データの取得に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSalesData()
  }, [fetchSalesData])

  return {
    summary,
    isLoading,
    error,
    refetch: fetchSalesData,
  }
}
