import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// 月別売上データ
export interface MonthlyRevenue {
  month: string        // 'YYYY-MM' 形式
  label: string        // '2026年9月' 形式
  revenue: number      // 確定売上合計（paid + issued）
  paidRevenue: number  // 入金済み合計
  issuedRevenue: number // 請求書発行済み（未入金）
  count: number        // 件数
}

// 乖離分析リスト 1件分
export interface VarianceItem {
  jobId: string
  invoiceId: string
  customerName: string
  jobTitle: string
  quoteAmount: number       // 事前見積金額 (notes.grandTotal)
  invoiceAmount: number     // 確定請求金額
  variance: number          // 差額 (invoiceAmount - quoteAmount)
  varianceRate: number      // 乖離率 (%)
  billingStatus: 'unissued' | 'issued' | 'paid'
  issuedAt: string | null
  paidAt: string | null
  varianceReason: string | null
}

// 全体サマリー
export interface SalesSummary {
  totalRevenue: number       // 全期間確定売上合計（paid + issued）
  paidRevenue: number        // 入金済み合計
  issuedRevenue: number      // 請求済（未入金）合計
  unissuedCount: number      // 未請求件数
  unpaidCount: number        // 未入金件数（issued のみ）
  collectionRate: number     // 回収率 = paid / (paid + issued) * 100
  thisMonthRevenue: number   // 今月売上合計
  lastMonthRevenue: number   // 先月売上合計
  monthlyRevenue: MonthlyRevenue[]
  varianceList: VarianceItem[]
}

const EMPTY_SUMMARY: SalesSummary = {
  totalRevenue: 0,
  paidRevenue: 0,
  issuedRevenue: 0,
  unissuedCount: 0,
  unpaidCount: 0,
  collectionRate: 0,
  thisMonthRevenue: 0,
  lastMonthRevenue: 0,
  monthlyRevenue: [],
  varianceList: [],
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
      // invoices + jobs（顧客情報含む）を JOIN して取得
      // ※ invoices テーブルの列は DB マイグレーション状況により異なるため * で取得
      const { data: invoices, error: fetchErr } = await supabase
        .from('invoices')
        .select(`
          *,
          jobs (
            id,
            title,
            notes,
            customers (
              name
            )
          )
        `)
        .order('created_at', { ascending: false })

      if (fetchErr) throw new Error(fetchErr.message)

      const rows = (invoices || []) as any[]

      // ── 月別集計用マップ ──
      const monthMap = new Map<string, MonthlyRevenue>()

      // ── 乖離分析リスト ──
      const varianceList: VarianceItem[] = []

      // ── KPI 集計用 ──
      let totalRevenue = 0
      let paidRevenue = 0
      let issuedRevenue = 0
      let unissuedCount = 0
      let unpaidCount = 0

      const now = new Date()
      const thisYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastYM = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`

      let thisMonthRevenue = 0
      let lastMonthRevenue = 0

      for (const row of rows) {
        const amount = Number(row.amount) || 0
        const status = row.billing_status as 'unissued' | 'issued' | 'paid'
        const job = row.jobs as any
        const customer = job?.customers as any

        // ── 事前見積金額の抽出 (jobs.notes の grandTotal) ──
        let quoteAmount = 0
        if (job?.notes) {
          try {
            const parsed = JSON.parse(job.notes)
            if (typeof parsed.grandTotal === 'number') {
              quoteAmount = parsed.grandTotal
            }
          } catch {
            // JSON パースエラーは無視
          }
        }

        // ── KPI 集計 ──
        if (status === 'paid') {
          totalRevenue += amount
          paidRevenue += amount
        } else if (status === 'issued') {
          totalRevenue += amount
          issuedRevenue += amount
          unpaidCount++
        } else {
          unissuedCount++
        }

        // ── 月別集計 (paid + issued のみ) ──
        if (status === 'paid' || status === 'issued') {
          // 月の基準: issued_at → created_at の順で判断
          const baseDate = row.issued_at
            ? new Date(row.issued_at)
            : new Date(row.created_at)
          const ym = `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, '0')}`
          const yearNum = baseDate.getFullYear()
          const monthNum = baseDate.getMonth() + 1
          const label = `${yearNum}年${monthNum}月`

          if (!monthMap.has(ym)) {
            monthMap.set(ym, {
              month: ym,
              label,
              revenue: 0,
              paidRevenue: 0,
              issuedRevenue: 0,
              count: 0,
            })
          }
          const m = monthMap.get(ym)!
          m.revenue += amount
          m.count++
          if (status === 'paid') m.paidRevenue += amount
          else m.issuedRevenue += amount

          // 今月・先月集計
          if (ym === thisYM) thisMonthRevenue += amount
          if (ym === lastYM) lastMonthRevenue += amount
        }

        // ── 乖離分析リスト ──
        const variance = amount - quoteAmount
        const varianceRate = quoteAmount > 0 ? (variance / quoteAmount) * 100 : 0

        varianceList.push({
          jobId: row.job_id,
          invoiceId: row.id,
          customerName: customer?.name || '名称未設定',
          jobTitle: job?.title || '–',
          quoteAmount,
          invoiceAmount: amount,
          variance,
          varianceRate,
          billingStatus: status,
          issuedAt: row.issued_at || null,
          paidAt: row.paid_at || null,
          varianceReason: row.variance_reason || null,
        })
      }

      // 月別データを時系列順にソート（新しい月が右端）
      const monthlyRevenue = Array.from(monthMap.values()).sort((a, b) =>
        a.month.localeCompare(b.month)
      )

      // 直近12か月分だけに限定
      const recent12 = monthlyRevenue.slice(-12)

      // 回収率 = paid / (paid + issued) * 100
      const collectionRate =
        paidRevenue + issuedRevenue > 0
          ? Math.round((paidRevenue / (paidRevenue + issuedRevenue)) * 1000) / 10
          : 0

      setSummary({
        totalRevenue,
        paidRevenue,
        issuedRevenue,
        unissuedCount,
        unpaidCount,
        collectionRate,
        thisMonthRevenue,
        lastMonthRevenue,
        monthlyRevenue: recent12,
        varianceList,
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
