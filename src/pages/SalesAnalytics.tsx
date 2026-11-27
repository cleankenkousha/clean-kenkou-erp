import React, { useState, useMemo } from 'react'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart2,
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  RefreshCw,
  Loader2,
  ChevronUp,
  ChevronDown,
  Minus,
  Calendar,
  Edit3,
  Receipt,
  Target,
  X,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useSalesData, ExecutionJobItem } from '../hooks/useSalesData'
import { useJobs } from '../hooks/useJobs'
import { InvoiceModal } from '../components/features/InvoiceModal'
import { Job, JobStatus } from '../types'

// ── ユーティリティ ──
const fmt = (n: number) =>
  n < 0 ? `-¥${Math.abs(Math.round(n)).toLocaleString('ja-JP')}` : `¥${Math.round(n).toLocaleString('ja-JP')}`

const getCurrentYM = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const getTodayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const parseYenInput = (raw: string): number | null => {
  const ascii = raw.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
  const cleaned = ascii.replace(/[,，、\s¥￥円]/g, '')
  if (!cleaned) return null
  if (!/^\d+$/.test(cleaned)) return null
  return parseInt(cleaned, 10)
}

const getStageBadge = (item: ExecutionJobItem): { label: string; style: string } => {
  if (item.billingStatus === 'paid') {
    return { label: '入金済', style: 'bg-emerald-100 text-emerald-800 border-emerald-200' }
  }
  if (item.billingStatus === 'issued') {
    return { label: '請求済（未入金）', style: 'bg-teal-100 text-teal-800 border-teal-200' }
  }
  if (item.jobStatus === 'scheduled') {
    return { label: '実施日確定', style: 'bg-sky-100 text-sky-800 border-sky-200' }
  }
  return { label: '作業実施済・未請求', style: 'bg-amber-100 text-amber-800 border-amber-200' }
}

type QuoteScope = 'include_scheduled' | 'executed_only'
type StatusFilter = 'all' | 'scheduled' | 'unbilled_executed' | 'issued' | 'paid'
type SortKey = 'scheduledDate' | 'effectiveQuote' | 'invoiceAmount' | 'variance'
type SortDir = 'asc' | 'desc'

// ── カスタム Tooltip（実施日ベース 見積 vs 売上） ──
const ComparisonTooltip = ({ active, payload, quoteScope }: any) => {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  if (!row) return null

  const activeQuote = quoteScope === 'include_scheduled' ? row.totalQuote : row.executedQuote
  const diff = row.revenue - activeQuote
  const rate = activeQuote > 0 ? ((row.revenue / activeQuote) * 100).toFixed(1) : '–'

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xl p-3.5 text-xs min-w-[230px] space-y-2">
      <div className="font-black text-slate-800 border-b border-slate-100 pb-1.5 flex items-center justify-between">
        <span>{row.label}（実施日基準）</span>
        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
          達成率 {rate}{rate !== '–' ? '%' : ''}
        </span>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between gap-4 font-bold text-indigo-700">
          <span>見積合計</span>
          <span>{fmt(activeQuote)}</span>
        </div>
        <div className="flex justify-between gap-4 text-[11px] text-slate-500 pl-2">
          <span>・作業実施済 ({row.executedCount}件)</span>
          <span>{fmt(row.executedQuote)}</span>
        </div>
        {quoteScope === 'include_scheduled' && (
          <div className="flex justify-between gap-4 text-[11px] text-slate-500 pl-2">
            <span>・実施日確定 ({row.scheduledCount}件)</span>
            <span>{fmt(row.scheduledQuote)}</span>
          </div>
        )}
      </div>

      <div className="space-y-1 pt-1 border-t border-slate-100">
        <div className="flex justify-between gap-4 font-bold text-emerald-700">
          <span>確定売上合計 ({row.invoicedCount}件)</span>
          <span>{fmt(row.revenue)}</span>
        </div>
        <div className="flex justify-between gap-4 text-[11px] text-slate-500 pl-2">
          <span>・入金済</span>
          <span>{fmt(row.paidRevenue)}</span>
        </div>
        <div className="flex justify-between gap-4 text-[11px] text-slate-500 pl-2">
          <span>・請求済（未入金）</span>
          <span>{fmt(row.issuedRevenue)}</span>
        </div>
      </div>

      <div className="pt-1.5 border-t border-slate-100 flex justify-between gap-4 text-[11px] font-bold">
        <span className="text-slate-600">売上 − 見積</span>
        <span className={diff >= 0 ? 'text-emerald-700' : 'text-amber-700'}>
          {diff > 0 ? '+' : ''}{fmt(diff)}
        </span>
      </div>
    </div>
  )
}

// ── KPI カード ──
interface KpiCardProps {
  title: string
  value: string
  sub?: string
  icon: React.ReactNode
  accent: string
  badge?: React.ReactNode
  extra?: React.ReactNode
}
const KpiCard: React.FC<KpiCardProps> = ({ title, value, sub, icon, accent, badge, extra }) => (
  <div className={`bg-white border rounded-2xl p-4 shadow-sm flex flex-col gap-2 ${accent}`}>
    <div className="flex items-center justify-between gap-1">
      <span className="text-xs font-bold text-slate-500">{title}</span>
      {badge}
    </div>
    <div className="flex items-end gap-3">
      <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex-shrink-0">{icon}</div>
      <span className="text-2xl font-black text-slate-800 leading-none">{value}</span>
    </div>
    {extra}
    {sub && <p className="text-[11px] text-slate-500 leading-snug">{sub}</p>}
  </div>
)

export const SalesAnalytics: React.FC = () => {
  const { summary, isLoading, error, refetch } = useSalesData()
  const { updateJobDetails } = useJobs()

  const [quoteScope, setQuoteScope] = useState<QuoteScope>('include_scheduled')
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentYM)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('scheduledDate')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // 実施日・予想見積のクイック編集モーダル用
  const [editTarget, setEditTarget] = useState<ExecutionJobItem | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editEstimated, setEditEstimated] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  // 請求入力モーダル用
  const [invoiceTarget, setInvoiceTarget] = useState<ExecutionJobItem | null>(null)

  const openQuickEdit = (item: ExecutionJobItem) => {
    setEditTarget(item)
    setEditDate(item.scheduledDate || '')
    setEditEstimated(item.estimatedAmount !== null ? String(item.estimatedAmount) : '')
  }

  const handleSaveQuickEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editTarget || isSavingEdit) return

    const parsedEst = parseYenInput(editEstimated)
    if (editEstimated.trim() && parsedEst === null) {
      alert('予想見積金額は0以上の整数で入力してください。')
      return
    }

    setIsSavingEdit(true)
    try {
      const ok = await updateJobDetails(editTarget.jobId, {
        scheduled_date: editDate || null,
        estimated_amount: parsedEst,
      })
      if (!ok) {
        alert('保存に失敗しました。通信状況をご確認ください。')
        return
      }
      setEditTarget(null)
      await refetch()
    } finally {
      setIsSavingEdit(false)
    }
  }

  // 選択中月のKPI計算
  const activeStats = useMemo(() => {
    if (selectedMonth === 'all') {
      const executedQuote = summary.monthlyExecution.reduce((s, m) => s + m.executedQuote, 0)
      const scheduledQuote = summary.monthlyExecution.reduce((s, m) => s + m.scheduledQuote, 0)
      const totalQuote = executedQuote + scheduledQuote
      const executedCount = summary.monthlyExecution.reduce((s, m) => s + m.executedCount, 0)
      const scheduledCount = summary.monthlyExecution.reduce((s, m) => s + m.scheduledCount, 0)
      const revenue = summary.totalRevenue
      const paidRevenue = summary.paidRevenue
      const issuedRevenue = summary.issuedRevenue
      const unbilledCount = summary.unissuedCount
      const unbilledQuote = summary.executionItems
        .filter((i) => ['collected', 'billed', 'completed'].includes(i.jobStatus) && i.billingStatus === 'unissued')
        .reduce((s, i) => s + i.effectiveQuote, 0)
      return {
        label: '全期間',
        quote: quoteScope === 'include_scheduled' ? totalQuote : executedQuote,
        executedQuote,
        scheduledQuote,
        executedCount,
        scheduledCount,
        revenue,
        paidRevenue,
        issuedRevenue,
        unbilledCount,
        unbilledQuote,
      }
    }

    if (selectedMonth === 'unscheduled') {
      const items = summary.executionItems.filter((i) => !i.executionMonth)
      const executedItems = items.filter((i) => ['collected', 'billed', 'completed'].includes(i.jobStatus))
      const scheduledItems = items.filter((i) => i.jobStatus === 'scheduled')
      const executedQuote = executedItems.reduce((s, i) => s + i.effectiveQuote, 0)
      const scheduledQuote = scheduledItems.reduce((s, i) => s + i.effectiveQuote, 0)
      const revenue = items
        .filter((i) => i.billingStatus === 'paid' || i.billingStatus === 'issued')
        .reduce((s, i) => s + i.invoiceAmount, 0)
      const paidRevenue = items
        .filter((i) => i.billingStatus === 'paid')
        .reduce((s, i) => s + i.invoiceAmount, 0)
      const issuedRevenue = items
        .filter((i) => i.billingStatus === 'issued')
        .reduce((s, i) => s + i.invoiceAmount, 0)
      const unbilledExecuted = executedItems.filter((i) => i.billingStatus === 'unissued')
      return {
        label: '実施日未設定',
        quote: quoteScope === 'include_scheduled' ? executedQuote + scheduledQuote : executedQuote,
        executedQuote,
        scheduledQuote,
        executedCount: executedItems.length,
        scheduledCount: scheduledItems.length,
        revenue,
        paidRevenue,
        issuedRevenue,
        unbilledCount: unbilledExecuted.length,
        unbilledQuote: unbilledExecuted.reduce((s, i) => s + i.effectiveQuote, 0),
      }
    }

    const found = summary.monthlyExecution.find((m) => m.month === selectedMonth)
    const [yStr, mStr] = selectedMonth.split('-')
    const fallbackLabel = yStr && mStr ? `${Number(yStr)}年${Number(mStr)}月` : selectedMonth
    if (!found) {
      return {
        label: fallbackLabel,
        quote: 0,
        executedQuote: 0,
        scheduledQuote: 0,
        executedCount: 0,
        scheduledCount: 0,
        revenue: 0,
        paidRevenue: 0,
        issuedRevenue: 0,
        unbilledCount: 0,
        unbilledQuote: 0,
      }
    }
    return {
      label: found.label,
      quote: quoteScope === 'include_scheduled' ? found.totalQuote : found.executedQuote,
      executedQuote: found.executedQuote,
      scheduledQuote: found.scheduledQuote,
      executedCount: found.executedCount,
      scheduledCount: found.scheduledCount,
      revenue: found.revenue,
      paidRevenue: found.paidRevenue,
      issuedRevenue: found.issuedRevenue,
      unbilledCount: found.unbilledExecutedCount,
      unbilledQuote: found.unbilledExecutedQuote,
    }
  }, [summary, selectedMonth, quoteScope])

  const activeAchievementPct =
    activeStats.quote > 0 ? Math.round((activeStats.revenue / activeStats.quote) * 1000) / 10 : 0

  // 先月比（今月表示時のみ）
  const isCurrentMonthSelected = selectedMonth === summary.currentMonth
  const monthDiff = summary.thisMonthRevenue - summary.lastMonthRevenue
  const monthDiffPct =
    summary.lastMonthRevenue > 0
      ? ((monthDiff / summary.lastMonthRevenue) * 100).toFixed(1)
      : null

  // 実施日未設定件数（日程確定＋作業実施済）
  const unscheduledActionableCount =
    summary.unscheduledExecutedCount + summary.unscheduledScheduledCount

  // 案件別明細のフィルタ・ソート
  const filteredItems = useMemo<ExecutionJobItem[]>(() => {
    let list = summary.executionItems

    if (selectedMonth === 'unscheduled') {
      list = list.filter((i) => !i.executionMonth)
    } else if (selectedMonth !== 'all') {
      list = list.filter((i) => i.executionMonth === selectedMonth)
    }

    if (statusFilter === 'scheduled') {
      list = list.filter((i) => i.jobStatus === 'scheduled')
    } else if (statusFilter === 'unbilled_executed') {
      list = list.filter(
        (i) => ['collected', 'billed', 'completed'].includes(i.jobStatus) && i.billingStatus === 'unissued'
      )
    } else if (statusFilter === 'issued') {
      list = list.filter((i) => i.billingStatus === 'issued')
    } else if (statusFilter === 'paid') {
      list = list.filter((i) => i.billingStatus === 'paid')
    }

    return [...list].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      if (sortKey === 'effectiveQuote') return (a.effectiveQuote - b.effectiveQuote) * dir
      if (sortKey === 'invoiceAmount') return (a.invoiceAmount - b.invoiceAmount) * dir
      if (sortKey === 'variance') {
        const aHas = a.effectiveQuote > 0 && (a.billingStatus === 'paid' || a.billingStatus === 'issued')
        const bHas = b.effectiveQuote > 0 && (b.billingStatus === 'paid' || b.billingStatus === 'issued')
        if (!aHas && !bHas) return 0
        if (!aHas) return 1
        if (!bHas) return -1
        return (a.variance - b.variance) * dir
      }
      // scheduledDate デフォルト（未設定は後ろに回す）
      const aDate = a.scheduledDate || ''
      const bDate = b.scheduledDate || ''
      if (!aDate && !bDate) return b.createdAt.localeCompare(a.createdAt)
      if (!aDate) return 1
      if (!bDate) return -1
      return aDate.localeCompare(bDate) * dir
    })
  }, [summary.executionItems, selectedMonth, statusFilter, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <Minus className="w-3 h-3 text-slate-300 inline ml-0.5" />
    return sortDir === 'desc'
      ? <ChevronDown className="w-3 h-3 text-slate-600 inline ml-0.5" />
      : <ChevronUp className="w-3 h-3 text-slate-600 inline ml-0.5" />
  }

  // InvoiceModal に渡す Job オブジェクト構築
  const invoiceModalJob: Job | null = useMemo(() => {
    if (!invoiceTarget) return null
    return {
      id: invoiceTarget.jobId,
      customer_id: '',
      title: invoiceTarget.jobTitle,
      status: invoiceTarget.jobStatus as JobStatus,
      scheduled_date: invoiceTarget.scheduledDate,
      estimated_amount: invoiceTarget.estimatedAmount,
      notes: invoiceTarget.rawNotes,
      created_at: invoiceTarget.createdAt,
      customers: {
        name: invoiceTarget.customerName,
        phone: invoiceTarget.customerPhone,
        address: invoiceTarget.customerAddress,
      },
    }
  }, [invoiceTarget])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
        <p className="text-sm font-medium">実施日ベースの見積・売上データを集計中...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-rose-500">
        <AlertCircle className="w-10 h-10" />
        <p className="text-sm font-medium">{error}</p>
        <button
          onClick={refetch}
          className="flex items-center gap-2 px-4 py-2 bg-rose-50 border border-rose-200 rounded-lg text-xs font-bold hover:bg-rose-100 transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> 再読み込み
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-10">
      {/* ── ページヘッダー ＆ コントロールバー ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg md:text-xl font-black text-slate-800 flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#059669] text-white">
              <BarChart2 className="w-5 h-5" />
            </span>
            <span>売上・見積ダッシュボード（実施日ベース）</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            作業実施日（scheduled_date）基準で、月ごとの見積金額と確定売上を比較・達成管理できます
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* 見積集計範囲トグル */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setQuoteScope('include_scheduled')}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${
                quoteScope === 'include_scheduled'
                  ? 'bg-[#059669] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="作業実施日が確定している案件の見積も含めて比較します"
            >
              実施日確定＋実施済
            </button>
            <button
              type="button"
              onClick={() => setQuoteScope('executed_only')}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${
                quoteScope === 'executed_only'
                  ? 'bg-[#059669] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="作業実施済以上の案件の見積のみで比較します"
            >
              作業実施済のみ
            </button>
          </div>

          {/* 対象月セレクタ */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
            <Calendar className="w-3.5 h-3.5 text-[#059669]" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="all">全期間</option>
              {summary.monthlyExecution.map((m) => (
                <option key={m.month} value={m.month}>
                  {m.label}{m.month === summary.currentMonth ? '（今月）' : ''}
                </option>
              ))}
              {unscheduledActionableCount > 0 && (
                <option value="unscheduled">実施日未設定（{unscheduledActionableCount}件）</option>
              )}
            </select>
          </div>

          <button
            type="button"
            onClick={refetch}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" /> データ更新
          </button>
        </div>
      </div>

      {/* ── 実施日未設定アラートバナー ── */}
      {unscheduledActionableCount > 0 && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start sm:items-center gap-2 text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5 sm:mt-0" />
            <span>
              <strong>作業実施日が未入力の確定・実施済案件が {unscheduledActionableCount}件</strong> あります（実施済 {summary.unscheduledExecutedCount}件 ／ 日程確定 {summary.unscheduledScheduledCount}件）。実施日・予想見積を入力すると月別グラフへ自動反映されます。
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedMonth(selectedMonth === 'unscheduled' ? summary.currentMonth : 'unscheduled')}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg whitespace-nowrap self-start sm:self-auto"
          >
            {selectedMonth === 'unscheduled' ? '今月の表示へ戻る' : '未設定案件を表示'}
          </button>
        </div>
      )}

      {/* ── KPI カード行 ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          title={`${activeStats.label}の確定売上`}
          value={fmt(activeStats.revenue)}
          sub={`入金済 ${fmt(activeStats.paidRevenue)} ／ 請求済 ${fmt(activeStats.issuedRevenue)}`}
          icon={<DollarSign className="w-5 h-5 text-[#059669]" />}
          accent="border-[#A7F3D0] bg-gradient-to-br from-white to-[#ECFDF5]/60"
          badge={
            isCurrentMonthSelected && monthDiffPct !== null ? (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  monthDiff >= 0
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}
              >
                {monthDiff >= 0 ? '↑' : '↓'} 先月比 {monthDiff >= 0 ? '+' : ''}{monthDiffPct}%
              </span>
            ) : undefined
          }
        />

        <KpiCard
          title={`${activeStats.label}の見積金額`}
          value={fmt(activeStats.quote)}
          sub={
            quoteScope === 'include_scheduled'
              ? `実施済 ${fmt(activeStats.executedQuote)} (${activeStats.executedCount}件) ＋ 確定 ${fmt(activeStats.scheduledQuote)} (${activeStats.scheduledCount}件)`
              : `作業実施済 ${activeStats.executedCount}件の見積合計`
          }
          icon={<Target className="w-5 h-5 text-indigo-600" />}
          accent="border-indigo-200"
          badge={
            activeStats.quote > 0 ? (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                達成率 {activeAchievementPct}%
              </span>
            ) : undefined
          }
          extra={
            activeStats.quote > 0 ? (
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-[#059669] h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, activeAchievementPct)}%` }}
                />
              </div>
            ) : undefined
          }
        />

        <KpiCard
          title={`${activeStats.label}の未請求（売上化待ち）`}
          value={`${activeStats.unbilledCount} 件`}
          sub={`未請求見積合計 ${fmt(activeStats.unbilledQuote)}（請求登録で確定売上へ計上）`}
          icon={<Clock className="w-5 h-5 text-amber-600" />}
          accent={activeStats.unbilledCount > 0 ? 'border-amber-300' : 'border-slate-200'}
          badge={
            activeStats.unbilledCount > 0 ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                要請求
              </span>
            ) : undefined
          }
        />

        <KpiCard
          title="全期間 累計確定売上 / 回収率"
          value={fmt(summary.totalRevenue)}
          sub={`回収率 ${summary.collectionRate}% ／ 未入金 ${summary.unpaidCount}件（請求済）`}
          icon={<CheckCircle2 className="w-5 h-5 text-blue-600" />}
          accent="border-blue-200"
          badge={
            summary.totalRevenue > 0 ? (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  summary.collectionRate >= 90
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : summary.collectionRate >= 70
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                回収率 {summary.collectionRate}%
              </span>
            ) : undefined
          }
        />
      </div>

      {/* ── メイングラフ：月別 実施日ベース 見積金額 vs 売上金額 ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-[#059669]" />
              月別 見積金額 vs 売上金額（作業実施日ベース）
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              左棒：実施日基準の見積金額 ／ 右棒：確定売上金額（棒をクリックするとその月の明細へ絞り込めます）
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-indigo-500" />実施済 見積
            </span>
            {quoteScope === 'include_scheduled' && (
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-sm bg-sky-300" />実施日確定 見積
              </span>
            )}
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-[#059669]" />入金済 売上
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-emerald-300" />請求済（未入金）
            </span>
          </div>
        </div>

        {summary.monthlyExecution.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-44 text-slate-400 gap-2">
            <BarChart2 className="w-8 h-8" />
            <p className="text-xs">表示できる月別データがありません</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={270}>
            <BarChart
              data={summary.monthlyExecution}
              margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
              barGap={4}
              onClick={(state: any) => {
                const clickedMonth = state?.activePayload?.[0]?.payload?.month
                if (clickedMonth) {
                  setSelectedMonth(clickedMonth)
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="shortLabel"
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => (v >= 10000 ? `¥${(v / 10000).toFixed(0)}万` : `¥${v.toLocaleString()}`)}
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                width={60}
              />
              <Tooltip content={<ComparisonTooltip quoteScope={quoteScope} />} />
              <Bar
                dataKey="executedQuote"
                name="実施済 見積"
                stackId="quote"
                fill="#6366F1"
                barSize={20}
                radius={quoteScope === 'executed_only' ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                className="cursor-pointer"
              />
              {quoteScope === 'include_scheduled' && (
                <Bar
                  dataKey="scheduledQuote"
                  name="実施日確定 見積"
                  stackId="quote"
                  fill="#7DD3FC"
                  barSize={20}
                  radius={[4, 4, 0, 0]}
                  className="cursor-pointer"
                />
              )}
              <Bar
                dataKey="paidRevenue"
                name="入金済 売上"
                stackId="sales"
                fill="#059669"
                barSize={20}
                radius={[0, 0, 0, 0]}
                className="cursor-pointer"
              />
              <Bar
                dataKey="issuedRevenue"
                name="請求済（未入金）"
                stackId="sales"
                fill="#34D399"
                barSize={20}
                radius={[4, 4, 0, 0]}
                className="cursor-pointer"
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── 月別 実施日サマリー表 ── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#059669]" />
            月別 実施日サマリー一覧
          </h2>
          <span className="text-[11px] text-slate-400">行をクリックすると下の案件明細を該当月に絞り込めます</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500">
                <th className="text-left px-4 py-2.5 font-bold whitespace-nowrap">実施月</th>
                <th className="text-right px-3 py-2.5 font-bold whitespace-nowrap">件数 (実施済 / 確定)</th>
                <th className="text-right px-3 py-2.5 font-bold whitespace-nowrap">見積金額</th>
                <th className="text-right px-3 py-2.5 font-bold whitespace-nowrap">確定売上金額</th>
                <th className="text-right px-3 py-2.5 font-bold whitespace-nowrap">売上 − 見積</th>
                <th className="text-right px-3 py-2.5 font-bold whitespace-nowrap">売上達成率</th>
                <th className="text-right px-4 py-2.5 font-bold whitespace-nowrap">未請求残（実施済）</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summary.monthlyExecution.map((m) => {
                const quoteAmt = quoteScope === 'include_scheduled' ? m.totalQuote : m.executedQuote
                const diff = m.revenue - quoteAmt
                const rate = quoteScope === 'include_scheduled' ? m.achievementRateTotal : m.achievementRateExecuted
                const isSelected = selectedMonth === m.month
                const isFuture = m.month > summary.currentMonth
                return (
                  <tr
                    key={m.month}
                    onClick={() => setSelectedMonth(m.month)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#ECFDF5]' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="px-4 py-2.5 font-bold text-slate-800 whitespace-nowrap flex items-center gap-1.5">
                      <span>{m.label}</span>
                      {m.month === summary.currentMonth && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#059669] text-white font-bold">今月</span>
                      )}
                      {isFuture && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-100 text-sky-800 font-bold">予定月</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-600 whitespace-nowrap">
                      <span className="font-bold text-slate-800">{m.executedCount}</span>
                      {quoteScope === 'include_scheduled' && (
                        <span className="text-slate-400"> / {m.scheduledCount}</span>
                      )}
                      件
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-indigo-700 whitespace-nowrap">
                      {fmt(quoteAmt)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-black text-[#047857] whitespace-nowrap">
                      {fmt(m.revenue)}
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap font-bold">
                      {quoteAmt > 0 || m.revenue > 0 ? (
                        <span className={diff >= 0 ? 'text-emerald-700' : 'text-amber-700'}>
                          {diff > 0 ? '+' : ''}{fmt(diff)}
                        </span>
                      ) : (
                        <span className="text-slate-300">–</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      {quoteAmt > 0 ? (
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            rate >= 100
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : rate >= 70
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {rate}%
                        </span>
                      ) : (
                        <span className="text-slate-300">–</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      {m.unbilledExecutedCount > 0 ? (
                        <span className="text-amber-700 font-bold">
                          {m.unbilledExecutedCount}件 ({fmt(m.unbilledExecutedQuote)})
                        </span>
                      ) : (
                        <span className="text-slate-300">なし</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 案件別 実施日・見積・売上・乖離テーブル ── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#059669]" />
              <span>案件別 実施日・見積・売上明細（{activeStats.label}）</span>
              <span className="text-[11px] font-normal text-slate-400">（{filteredItems.length}件表示）</span>
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {(
              [
                { key: 'all', label: 'すべて' },
                { key: 'scheduled', label: '📅 実施日確定' },
                { key: 'unbilled_executed', label: '📝 実施済・未請求' },
                { key: 'issued', label: '📨 請求済' },
                { key: 'paid', label: '✅ 入金済' },
              ] as { key: StatusFilter; label: string }[]
            ).map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setStatusFilter(f.key)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-colors ${
                  statusFilter === f.key
                    ? 'bg-[#059669] text-white border-[#059669]'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
            <FileText className="w-8 h-8" />
            <p className="text-xs">選択条件に該当する確定・実施済・請求済案件はありません</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500">
                  <th className="text-left px-4 py-2.5 font-bold whitespace-nowrap">
                    <button type="button" onClick={() => toggleSort('scheduledDate')} className="hover:text-slate-800">
                      作業実施日 <SortIcon k="scheduledDate" />
                    </button>
                  </th>
                  <th className="text-left px-3 py-2.5 font-bold whitespace-nowrap">顧客名 / 案件</th>
                  <th className="text-center px-3 py-2.5 font-bold whitespace-nowrap">区分</th>
                  <th className="text-right px-3 py-2.5 font-bold whitespace-nowrap">
                    <button type="button" onClick={() => toggleSort('effectiveQuote')} className="hover:text-slate-800">
                      見積金額 <SortIcon k="effectiveQuote" />
                    </button>
                  </th>
                  <th className="text-right px-3 py-2.5 font-bold whitespace-nowrap">
                    <button type="button" onClick={() => toggleSort('invoiceAmount')} className="hover:text-slate-800">
                      確定売上 <SortIcon k="invoiceAmount" />
                    </button>
                  </th>
                  <th className="text-right px-3 py-2.5 font-bold whitespace-nowrap">
                    <button type="button" onClick={() => toggleSort('variance')} className="hover:text-slate-800">
                      差額 / 乖離率 <SortIcon k="variance" />
                    </button>
                  </th>
                  <th className="text-right px-4 py-2.5 font-bold whitespace-nowrap">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => {
                  const stage = getStageBadge(item)
                  const hasConfirmedInvoice = item.billingStatus === 'paid' || item.billingStatus === 'issued'
                  const hasQuote = item.effectiveQuote > 0
                  const isUp = item.variance > 0
                  const isDown = item.variance < 0

                  return (
                    <tr key={item.jobId} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {item.scheduledDate ? (
                          <span className="font-mono font-bold text-slate-700">{item.scheduledDate}</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openQuickEdit(item)}
                            className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded hover:bg-amber-100"
                          >
                            + 実施日設定
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-bold text-slate-800">{item.customerName}</p>
                        <p className="text-slate-400 text-[11px] mt-0.5">
                          {item.jobTitle}
                          {item.staffName ? `（担当: ${item.staffName}）` : ''}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-full border ${stage.style}`}>
                          {stage.label}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        {hasQuote ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="font-bold text-indigo-700">{fmt(item.effectiveQuote)}</span>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-bold border ${
                                item.quoteSource === 'formal'
                                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              {item.quoteSource === 'formal' ? '正式見積' : '予想見積'}
                            </span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openQuickEdit(item)}
                            className="text-[11px] text-slate-400 hover:text-[#059669] underline"
                          >
                            予想見積を入力
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-black whitespace-nowrap">
                        {hasConfirmedInvoice ? (
                          <span className="text-[#047857]">{fmt(item.invoiceAmount)}</span>
                        ) : (
                          <span className="text-slate-300 font-normal">未請求</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        {hasQuote && hasConfirmedInvoice ? (
                          <div
                            className={`inline-flex items-center gap-1 font-bold ${
                              isUp ? 'text-blue-700' : isDown ? 'text-amber-700' : 'text-slate-500'
                            }`}
                          >
                            {isUp ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : isDown ? (
                              <TrendingDown className="w-3 h-3" />
                            ) : null}
                            <span>
                              {isUp ? '+' : ''}{fmt(item.variance)} ({isUp ? '+' : ''}{item.varianceRate.toFixed(1)}%)
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300">–</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap space-x-1.5">
                        <button
                          type="button"
                          onClick={() => openQuickEdit(item)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-bold"
                          title="作業実施日・予想見積金額を編集"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>実施日・予想</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setInvoiceTarget(item)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#059669] hover:bg-[#047857] text-white text-[11px] font-bold shadow-2xs"
                          title="確定請求金額・入金状況を入力"
                        >
                          <Receipt className="w-3 h-3" />
                          <span>請求</span>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 実施日・予想見積クイック編集モーダル ── */}
      {editTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          onClick={() => setEditTarget(null)}
        >
          <form
            onSubmit={handleSaveQuickEdit}
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-md rounded-2xl border border-slate-200 border-t-4 border-t-[#059669] shadow-2xl p-5 space-y-4 text-xs"
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-800">実施日 ＆ 予想見積の設定</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {editTarget.customerName} 様 — {editTarget.jobTitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">作業実施日（売上・見積 基準月）</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="flex-1 p-2 border border-slate-300 rounded-lg text-xs bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setEditDate(getTodayStr())}
                    className="px-2.5 py-2 bg-[#059669] text-white font-bold rounded-lg hover:bg-[#047857]"
                  >
                    今日
                  </button>
                  {editDate && (
                    <button
                      type="button"
                      onClick={() => setEditDate('')}
                      className="px-2.5 py-2 bg-slate-100 text-slate-600 font-semibold rounded-lg hover:bg-slate-200"
                    >
                      未定
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  翌月へ延期された場合は翌月の日付に変更（または「未定」）すると、当月集計から即座に外れます。
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">予想見積金額（税込・円）</label>
                {editTarget.formalQuoteAmount > 0 ? (
                  <div className="p-2.5 bg-[#ECFDF5] border border-[#A7F3D0] rounded-lg text-[#047857] font-bold">
                    正式見積が登録済み（{fmt(editTarget.formalQuoteAmount)}）のため、グラフには正式見積額が優先適用されます。
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={editEstimated}
                      onChange={(e) => setEditEstimated(e.target.value)}
                      placeholder="例: 35000（空欄でクリア）"
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      見積不要案件の見込み金額を入力しておくと、実施月の見積合計に反映されます。
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                disabled={isSavingEdit}
                className="px-3.5 py-2 rounded-lg border border-slate-200 text-slate-600 font-bold hover:bg-slate-50"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={isSavingEdit}
                className="px-4 py-2 rounded-lg bg-[#059669] hover:bg-[#047857] text-white font-bold disabled:opacity-50"
              >
                {isSavingEdit ? '保存中...' : '保存して反映'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── 請求・売上入力モーダル ── */}
      <InvoiceModal
        job={invoiceModalJob}
        isOpen={Boolean(invoiceTarget)}
        onClose={() => setInvoiceTarget(null)}
        onSuccess={async () => {
          setInvoiceTarget(null)
          await refetch()
        }}
      />
    </div>
  )
}
