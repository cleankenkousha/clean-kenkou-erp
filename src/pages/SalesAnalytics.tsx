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
import { useSalesData, VarianceItem } from '../hooks/useSalesData'

// ── ユーティリティ ──
const fmt = (n: number) => `¥${n.toLocaleString('ja-JP')}`

// 入金ステータス表示用
const statusLabel = (s: 'unissued' | 'issued' | 'paid') =>
  s === 'paid' ? '入金済' : s === 'issued' ? '請求済（未入金）' : '未請求'

const statusBadge = (s: 'unissued' | 'issued' | 'paid') => {
  if (s === 'paid') return 'bg-emerald-100 text-emerald-800 border-emerald-200'
  if (s === 'issued') return 'bg-blue-100 text-blue-800 border-blue-200'
  return 'bg-slate-100 text-slate-600 border-slate-200'
}

type FilterType = 'all' | 'paid' | 'issued' | 'unissued'
type SortKey = 'invoiceAmount' | 'variance' | 'varianceRate' | 'issuedAt'
type SortDir = 'asc' | 'desc'

// ── カスタム Tooltip ──
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs min-w-[160px]">
      <p className="font-bold text-slate-700 mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex justify-between gap-4 mb-1">
          <span style={{ color: p.fill }} className="font-medium">{p.name}</span>
          <span className="font-bold text-slate-800">{fmt(p.value)}</span>
        </div>
      ))}
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
}
const KpiCard: React.FC<KpiCardProps> = ({ title, value, sub, icon, accent, badge }) => (
  <div className={`bg-white border rounded-2xl p-4 shadow-sm flex flex-col gap-2 ${accent}`}>
    <div className="flex items-center justify-between">
      <span className="text-xs font-bold text-slate-500">{title}</span>
      {badge}
    </div>
    <div className="flex items-end gap-3">
      <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">{icon}</div>
      <span className="text-2xl font-black text-slate-800 leading-none">{value}</span>
    </div>
    {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
  </div>
)

export const SalesAnalytics: React.FC = () => {
  const { summary, isLoading, error, refetch } = useSalesData()

  const [filter, setFilter] = useState<FilterType>('all')
  const [sortKey, setSortKey] = useState<SortKey>('issuedAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // テーブルのフィルタ + ソート
  const filteredList = useMemo<VarianceItem[]>(() => {
    let list = summary.varianceList
    if (filter !== 'all') list = list.filter((v) => v.billingStatus === filter)
    return [...list].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      if (sortKey === 'invoiceAmount') return (a.invoiceAmount - b.invoiceAmount) * dir
      if (sortKey === 'variance') return (a.variance - b.variance) * dir
      if (sortKey === 'varianceRate') return (a.varianceRate - b.varianceRate) * dir
      // issuedAt (デフォルト)
      const aDate = a.issuedAt ?? '0'
      const bDate = b.issuedAt ?? '0'
      return aDate.localeCompare(bDate) * dir
    })
  }, [summary.varianceList, filter, sortKey, sortDir])

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

  // 先月比バッジ
  const monthDiff = summary.thisMonthRevenue - summary.lastMonthRevenue
  const monthDiffPct =
    summary.lastMonthRevenue > 0
      ? ((monthDiff / summary.lastMonthRevenue) * 100).toFixed(1)
      : null

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
        <p className="text-sm font-medium">売上データを集計中...</p>
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
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      {/* ── ページヘッダー ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-emerald-600" />
            売上・乖離分析ダッシュボード
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            請求書が登録された案件の売上集計・見積乖離分析
          </p>
        </div>
        <button
          onClick={refetch}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" /> データ更新
        </button>
      </div>

      {/* ── KPI カード行 ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          title="今月売上合計"
          value={fmt(summary.thisMonthRevenue)}
          sub={
            monthDiffPct !== null
              ? `先月比 ${monthDiff >= 0 ? '+' : ''}${monthDiffPct}%`
              : '先月データなし'
          }
          icon={<DollarSign className="w-5 h-5 text-emerald-600" />}
          accent="border-emerald-200"
          badge={
            monthDiff !== 0 && monthDiffPct !== null ? (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                  monthDiff >= 0
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}
              >
                {monthDiff >= 0 ? '↑' : '↓'} 前月比
              </span>
            ) : undefined
          }
        />
        <KpiCard
          title="累計確定売上"
          value={fmt(summary.totalRevenue)}
          sub={`入金済 ${fmt(summary.paidRevenue)} ／ 請求中 ${fmt(summary.issuedRevenue)}`}
          icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
          accent="border-blue-200"
        />
        <KpiCard
          title="回収率"
          value={`${summary.collectionRate}%`}
          sub={`未入金 ${summary.unpaidCount}件（請求済）`}
          icon={<CheckCircle2 className="w-5 h-5 text-violet-600" />}
          accent="border-violet-200"
          badge={
            summary.collectionRate >= 90 ? (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                優良
              </span>
            ) : summary.collectionRate >= 70 ? (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                注意
              </span>
            ) : undefined
          }
        />
        <KpiCard
          title="未請求件数"
          value={`${summary.unissuedCount} 件`}
          sub="請求書未発行の完了案件"
          icon={<Clock className="w-5 h-5 text-amber-600" />}
          accent={summary.unissuedCount > 0 ? 'border-amber-300' : 'border-slate-200'}
          badge={
            summary.unissuedCount > 0 ? (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                要対応
              </span>
            ) : undefined
          }
        />
      </div>

      {/* ── 月別売上グラフ ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-black text-slate-700 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-slate-500" />
            月別売上推移（直近12ヶ月）
          </h2>
          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500" />入金済
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-blue-400" />請求済（未入金）
            </span>
          </div>
        </div>

        {summary.monthlyRevenue.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
            <BarChart2 className="w-8 h-8" />
            <p className="text-xs">請求データがありません</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={summary.monthlyRevenue}
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
              barSize={28}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => `¥${(v / 10000).toFixed(0)}万`}
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="paidRevenue" name="入金済" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
              <Bar dataKey="issuedRevenue" name="請求済（未入金）" stackId="a" fill="#60a5fa" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── 乖離分析テーブル ── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-sm font-black text-slate-700 flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-500" />
            見積 vs 確定請求 乖離分析
            <span className="text-[11px] font-normal text-slate-400">
              （{filteredList.length}件表示）
            </span>
          </h2>
          {/* フィルタータブ */}
          <div className="flex items-center gap-1">
            {(
              [
                { key: 'all', label: 'すべて' },
                { key: 'paid', label: '✅ 入金済' },
                { key: 'issued', label: '📨 請求済' },
                { key: 'unissued', label: '📝 未請求' },
              ] as { key: FilterType; label: string }[]
            ).map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-colors ${
                  filter === f.key
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {filteredList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
            <FileText className="w-8 h-8" />
            <p className="text-xs">該当する請求データがありません</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-2.5 font-bold text-slate-500 whitespace-nowrap">顧客名 / 案件</th>
                  <th className="text-right px-3 py-2.5 font-bold text-slate-500 whitespace-nowrap">
                    <button onClick={() => toggleSort('invoiceAmount')} className="hover:text-slate-800 transition-colors">
                      確定請求額 <SortIcon k="invoiceAmount" />
                    </button>
                  </th>
                  <th className="text-right px-3 py-2.5 font-bold text-slate-500 whitespace-nowrap">事前見積額</th>
                  <th className="text-right px-3 py-2.5 font-bold text-slate-500 whitespace-nowrap">
                    <button onClick={() => toggleSort('variance')} className="hover:text-slate-800 transition-colors">
                      差額 <SortIcon k="variance" />
                    </button>
                  </th>
                  <th className="text-right px-3 py-2.5 font-bold text-slate-500 whitespace-nowrap">
                    <button onClick={() => toggleSort('varianceRate')} className="hover:text-slate-800 transition-colors">
                      乖離率 <SortIcon k="varianceRate" />
                    </button>
                  </th>
                  <th className="text-center px-3 py-2.5 font-bold text-slate-500 whitespace-nowrap">ステータス</th>
                  <th className="text-left px-3 py-2.5 font-bold text-slate-500 whitespace-nowrap">増減理由</th>
                  <th className="text-right px-3 py-2.5 font-bold text-slate-500 whitespace-nowrap">
                    <button onClick={() => toggleSort('issuedAt')} className="hover:text-slate-800 transition-colors">
                      請求日 <SortIcon k="issuedAt" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredList.map((item) => {
                  const isUp = item.variance > 0
                  const isDown = item.variance < 0
                  const hasQuote = item.quoteAmount > 0
                  return (
                    <tr key={item.invoiceId} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-800">{item.customerName}</p>
                        <p className="text-slate-400 text-[11px] mt-0.5">{item.jobTitle}</p>
                      </td>
                      <td className="px-3 py-3 text-right font-black text-emerald-700 whitespace-nowrap">
                        {fmt(item.invoiceAmount)}
                      </td>
                      <td className="px-3 py-3 text-right text-slate-500 whitespace-nowrap">
                        {hasQuote ? fmt(item.quoteAmount) : <span className="text-slate-300">未算定</span>}
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        {hasQuote ? (
                          <span
                            className={`font-bold ${
                              isUp ? 'text-blue-700' : isDown ? 'text-amber-700' : 'text-slate-500'
                            }`}
                          >
                            {isUp ? '+' : ''}{fmt(item.variance)}
                          </span>
                        ) : (
                          <span className="text-slate-300">–</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        {hasQuote ? (
                          <span
                            className={`inline-flex items-center gap-0.5 font-bold ${
                              isUp ? 'text-blue-700' : isDown ? 'text-amber-700' : 'text-slate-500'
                            }`}
                          >
                            {isUp ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : isDown ? (
                              <TrendingDown className="w-3 h-3" />
                            ) : null}
                            {isUp ? '+' : ''}{item.varianceRate.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-slate-300">–</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-full border ${statusBadge(item.billingStatus)}`}
                        >
                          {statusLabel(item.billingStatus)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-500 max-w-[180px]">
                        {item.varianceReason ? (
                          <span className="truncate block" title={item.varianceReason}>
                            {item.varianceReason}
                          </span>
                        ) : (
                          <span className="text-slate-300">–</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right text-slate-400 whitespace-nowrap">
                        {item.issuedAt
                          ? new Date(item.issuedAt).toLocaleDateString('ja-JP')
                          : '–'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
