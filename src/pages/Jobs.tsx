import React, { useState, useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Briefcase,
  Search,
  Calendar,
  Phone,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  RefreshCw,
  User,
  UserCheck,
  Calculator,
  ChevronRight,
} from 'lucide-react'


import { useJobs } from '../hooks/useJobs'
import { useProfiles, getRoleInfo } from '../hooks/useProfiles'
import { useViewMode } from '../hooks/useViewMode'
import { Job, JobStatus } from '../types'
import { TaskDetailModal } from '../components/features/TaskDetailModal'
import { ProcessTask, ProcessLane } from '../components/features/KanbanBoard'
import { ExcelImportModal } from '../components/features/ExcelImportModal'
import { MobileQuoteModal, InitialQuoteData } from '../components/features/MobileQuoteModal'
import { PrintArea, PrintTaskData } from '../components/features/PrintArea'
import { Input, Button, MapLink } from '../components/ui'



const statusBadgeConfig: Record<JobStatus, { label: string; style: string }> = {
  received: { label: '新規受付済', style: 'bg-amber-100 text-amber-800 border-amber-200' },
  quoting: { label: '見積中', style: 'bg-purple-100 text-purple-800 border-purple-200' },
  pending: { label: '保留中', style: 'bg-orange-100 text-orange-800 border-orange-200' },
  arranged: { label: '手配済 / 進行中', style: 'bg-blue-100 text-blue-800 border-blue-200' },
  collected: { label: '回収完了', style: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  billed: { label: '請求済', style: 'bg-teal-100 text-teal-800 border-teal-200' },
  completed: { label: '完了済', style: 'bg-emerald-200 text-emerald-900 border-emerald-300' },
  cancelled: { label: 'キャンセル', style: 'bg-slate-100 text-slate-600 border-slate-200' },
}

// JobStatus -> ProcessLane マッピング
const mapJobStatusToLane = (status: string): ProcessLane => {
  switch (status) {
    case 'received': return '未着手'
    case 'quoting':
    case 'pending': return '顧客検討'
    case 'arranged': return '作業日程調整'
    case 'collected': return '作業実施'
    case 'billed':
    case 'completed': return '請求書送付'
    case 'cancelled': return '失注・キャンセル'
    default: return '未着手'
  }
}

// Job -> ProcessTask 変換ヘルパー
const mapJobToProcessTask = (job: Job): ProcessTask => {
  let stepsData = {}
  if (job.notes) {
    try {
      const parsed = JSON.parse(job.notes)
      if (parsed && typeof parsed === 'object' && parsed.stepsData) {
        stepsData = parsed.stepsData
      } else if (job.notes.startsWith('{')) {
        stepsData = JSON.parse(job.notes)
      }
    } catch (e) {
      // JSONでない場合はスルー
    }
  }

  return {
    id: job.id,
    receptionNo: `#${job.id.slice(0, 4)}`,
    customer: job.customers?.name || '名称未設定',
    tel: job.customers?.phone || '',
    address: job.customers?.address || '',
    taskType: job.title || '臨時収集',
    status: mapJobStatusToLane(job.status),
    receptionDate: job.created_at ? new Date(job.created_at).toLocaleDateString('ja-JP') : '',
    updatedAt: job.updated_at || job.created_at || new Date().toISOString(),
    updater: job.profiles?.display_name || '',
    stepsData,
  }
}

export const Jobs: React.FC = () => {
  const location = useLocation()
  const { jobs, isLoading, error, refetch, updateJobDetails } = useJobs()
  const { profiles } = useProfiles()
  const { isMobileMode } = useViewMode()

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all')
  const [staffFilter, setStaffFilter] = useState<string>('all')

  const [selectedTask, setSelectedTask] = useState<ProcessTask | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [isExcelImportOpen, setIsExcelImportOpen] = useState(false)
  const [isMobileQuoteOpen, setIsMobileQuoteOpen] = useState(false)
  const [quoteInitialData, setQuoteInitialData] = useState<InitialQuoteData | null>(null)
  const [printTask, setPrintTask] = useState<PrintTaskData | null>(null)

  // 設定画面からの復帰時に見積作成モーダルを自動で展開
  useEffect(() => {
    if (location.state?.openQuoteModal) {
      setQuoteInitialData(null)
      setIsMobileQuoteOpen(true)
    }
  }, [location.state])

  // フィルタリング処理
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      // 1. ステータスフィルター
      if (statusFilter === 'active') {
        if (['completed', 'cancelled'].includes(job.status)) return false
      } else if (statusFilter === 'completed') {
        if (!['collected', 'billed', 'completed'].includes(job.status)) return false
      } else if (statusFilter === 'cancelled') {
        if (job.status !== 'cancelled') return false
      }

      // 2. 担当スタッフフィルター
      if (staffFilter !== 'all') {
        if (staffFilter === 'unassigned') {
          if (job.assigned_to) return false
        } else {
          if (job.assigned_to !== staffFilter) return false
        }
      }

      // 3. フリーワード検索 (タイトル、顧客名、電話番号、住所、メモ、担当者名)
      if (!searchQuery.trim()) return true
      const query = searchQuery.toLowerCase().trim()

      const titleMatch = job.title?.toLowerCase().includes(query) || false
      const customerMatch = job.customers?.name?.toLowerCase().includes(query) || false
      const phoneMatch = job.customers?.phone?.includes(query) || false
      const addressMatch = job.customers?.address?.toLowerCase().includes(query) || false
      const notesMatch = job.notes?.toLowerCase().includes(query) || false
      const staffMatch = job.profiles?.display_name?.toLowerCase().includes(query) || false

      return titleMatch || customerMatch || phoneMatch || addressMatch || notesMatch || staffMatch
    })
  }, [jobs, searchQuery, statusFilter, staffFilter])

  // KPI 集計
  const kpiStats = useMemo(() => {
    const total = jobs.length
    const active = jobs.filter((j) => !['completed', 'cancelled'].includes(j.status)).length
    const completed = jobs.filter((j) => ['collected', 'billed', 'completed'].includes(j.status)).length
    const pending = jobs.filter((j) => j.status === 'pending').length
    return { total, active, completed, pending }
  }, [jobs])

  const handleOpenDetail = (job: Job) => {
    const task = mapJobToProcessTask(job)
    setSelectedTask(task)
    setIsDetailModalOpen(true)
  }

  const handleOpenQuoteForJob = (job: Job, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setQuoteInitialData({
      jobId: job.id,
      customerName: job.customers?.name || '名称未設定',
      customerPhone: job.customers?.phone || '',
      customerAddress: job.customers?.address || '',
    })
    setIsMobileQuoteOpen(true)
  }

  const handleSaveProcessTask = async (updatedTask: ProcessTask) => {
    let dbStatus: JobStatus = 'received'
    if (updatedTask.status === '未着手') dbStatus = 'received'
    else if (updatedTask.status === '顧客検討') dbStatus = 'quoting'
    else if (updatedTask.status === '作業日程調整' || updatedTask.status === '日程確定') dbStatus = 'arranged'
    else if (updatedTask.status === '作業実施') dbStatus = 'collected'
    else if (updatedTask.status === '請求書送付') dbStatus = 'billed'
    else if (updatedTask.status === '失注・キャンセル') dbStatus = 'cancelled'

    let notesVal: string | undefined = undefined
    if (updatedTask.stepsData && Object.keys(updatedTask.stepsData).length > 0) {
      notesVal = JSON.stringify(updatedTask.stepsData)
    }

    // 担当スタッフ名のUUID検索試行
    let assignedUuid: string | null | undefined = undefined
    const updaterName = updatedTask.updater?.trim()
    if (updaterName) {
      const matchProfile = profiles.find((p) => p.display_name === updaterName)
      if (matchProfile) {
        assignedUuid = matchProfile.id
      }
    }

    await updateJobDetails(updatedTask.id, {
      title: updatedTask.taskType,
      status: dbStatus,
      notes: notesVal,
      assigned_to: assignedUuid,
    })

    setIsDetailModalOpen(false)
    refetch()
  }

  const handleDeleteJob = async (taskId: string) => {
    const success = await updateJobDetails(taskId, { status: 'cancelled' })
    if (success) {
      setIsDetailModalOpen(false)
      refetch()
    }
  }

  // 印刷データ発火用エフェクト
  useEffect(() => {
    if (printTask) {
      const timer = setTimeout(() => {
        window.print()
      }, 250)
      return () => clearTimeout(timer)
    }
  }, [printTask])

  const handlePrintTask = (task: ProcessTask) => {
    setPrintTask({
      receptionNo: task.receptionNo || `#${task.id}`,
      customer: task.customer,
      tel: task.tel,
      address: task.address,
      taskType: task.taskType,
      receptionDate: task.receptionDate,
      updater: task.updater || '未指定',
      stepsData: task.stepsData,
    })
  }

  // CSV エクスポート機能
  const handleExportCSV = () => {
    if (filteredJobs.length === 0) {
      alert('出力対象の案件データがありません。')
      return
    }

    const headers = ['案件ID', '案件タイトル', '顧客名', '電話番号', '住所', '担当スタッフ', 'ステータス', '作業予定日', '受付日時', '備考']
    const rows = filteredJobs.map((j) => [
      j.id,
      `"${(j.title || '').replace(/"/g, '""')}"`,
      `"${(j.customers?.name || '').replace(/"/g, '""')}"`,
      `"${(j.customers?.phone || '').replace(/"/g, '""')}"`,
      `"${(j.customers?.address || '').replace(/"/g, '""')}"`,
      `"${(j.profiles?.display_name || '未割当').replace(/"/g, '""')}"`,
      statusBadgeConfig[j.status]?.label || j.status,
      j.scheduled_date || '',
      j.created_at ? new Date(j.created_at).toLocaleString('ja-JP') : '',
      `"${(j.notes || '').replace(/"/g, '""')}"`,
    ])

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `案件一覧_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-4 md:space-y-6 max-w-7xl mx-auto pb-10">
      {/* 印刷用隠しコンテナ */}
      <PrintArea task={printTask} />

      {/* 1. Header & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 md:p-5 rounded-xl border border-border shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-slate-900 text-white rounded-lg">
              <Briefcase className="w-5 h-5" />
            </div>
            <h1 className="text-lg md:text-xl font-bold text-main tracking-tight">
              {isMobileMode ? '案件一覧 (現場用)' : '案件一覧'}
            </h1>
          </div>
          <p className="text-xs text-sub mt-1">
            {isMobileMode
              ? '現場での案件確認、AI概算見積作成・撮影がすぐに行えます'
              : '受付済み全案件の検索、担当者フィルタリング、状態変更、データ書き出しを行えます'}
          </p>
        </div>

        {/* アクションボタン群 */}
        <div className="flex items-center space-x-2">
          {/* モバイルモード・携帯時は目立つ「見積作成」ボタンを表示 */}
          <Button
            type="button"
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 text-xs shadow-md"
            onClick={() => {
              setQuoteInitialData(null)
              setIsMobileQuoteOpen(true)
            }}
          >
            <Calculator className="w-4 h-4 mr-1.5" />
            <span>+ 見積作成 (カメラ撮影)</span>
          </Button>


          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            title="最新データに更新"
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>

          {/* PCモード時のみ Excel/CSV ボタンを表示（要件1: 携帯・タブレットでは不要） */}
          {!isMobileMode && (
            <>
              <Button type="button" variant="outline" size="sm" onClick={() => setIsExcelImportOpen(true)}>
                <FileSpreadsheet className="w-4 h-4 mr-1.5 text-emerald-600" />
                Excel読込
              </Button>

              <Button type="button" variant="outline" size="sm" onClick={handleExportCSV}>
                <FileSpreadsheet className="w-4 h-4 mr-1.5 text-blue-600" />
                CSV出力 ({filteredJobs.length}件)
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 2. KPI Cards (PC表示時またはモバイル時コンパクト表示) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white p-3 md:p-4 rounded-xl border border-border shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-sub">全案件</p>
            <p className="text-xl md:text-2xl font-bold text-main mt-0.5">
              {kpiStats.total} <span className="text-xs font-normal text-sub">件</span>
            </p>
          </div>
          <div className="p-2 md:p-3 bg-slate-100 text-slate-700 rounded-xl">
            <Briefcase className="w-4 h-4 md:w-5 md:h-5" />
          </div>
        </div>

        <div className="bg-white p-3 md:p-4 rounded-xl border border-border shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-sub">進行中</p>
            <p className="text-xl md:text-2xl font-bold text-blue-700 mt-0.5">
              {kpiStats.active} <span className="text-xs font-normal text-sub">件</span>
            </p>
          </div>
          <div className="p-2 md:p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
            <Clock className="w-4 h-4 md:w-5 md:h-5" />
          </div>
        </div>

        <div className="bg-white p-3 md:p-4 rounded-xl border border-border shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-sub">完了済</p>
            <p className="text-xl md:text-2xl font-bold text-emerald-700 mt-0.5">
              {kpiStats.completed} <span className="text-xs font-normal text-sub">件</span>
            </p>
          </div>
          <div className="p-2 md:p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
            <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5" />
          </div>
        </div>

        <div className="bg-white p-3 md:p-4 rounded-xl border border-border shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-sub">保留中</p>
            <p className="text-xl md:text-2xl font-bold text-amber-700 mt-0.5">
              {kpiStats.pending} <span className="text-xs font-normal text-sub">件</span>
            </p>
          </div>
          <div className="p-2 md:p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
            <AlertCircle className="w-4 h-4 md:w-5 md:h-5" />
          </div>
        </div>
      </div>

      {/* 3. Search Bar, Staff Filter & Status Filter Tabs */}
      <div className="bg-white p-3 md:p-4 rounded-xl border border-border shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search & Staff Filter */}
        <div className="flex flex-col sm:flex-row items-center gap-2 flex-1">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-sub absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              placeholder="案件名・顧客名・電話番号・住所で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>

          {/* 担当者絞り込みドロップダウン */}
          <div className="flex items-center space-x-1.5 w-full sm:w-auto">
            <UserCheck className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <select
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              className="p-2 border border-border rounded-lg text-xs bg-white text-main font-medium focus:outline-none focus:ring-2 focus:ring-slate-900 w-full sm:w-auto"
            >
              <option value="all">すべての担当者</option>
              <option value="unassigned">未割当のみ</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name || '名前未設定'} ({getRoleInfo(p.role).label})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs overflow-x-auto">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
              statusFilter === 'all'
                ? 'bg-white text-main shadow-sm font-bold'
                : 'text-sub hover:text-main'
            }`}
          >
            すべて ({jobs.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
              statusFilter === 'active'
                ? 'bg-white text-blue-700 shadow-sm font-bold'
                : 'text-sub hover:text-main'
            }`}
          >
            進行中 ({kpiStats.active})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('completed')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
              statusFilter === 'completed'
                ? 'bg-white text-emerald-700 shadow-sm font-bold'
                : 'text-sub hover:text-main'
            }`}
          >
            完了済 ({kpiStats.completed})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('cancelled')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
              statusFilter === 'cancelled'
                ? 'bg-white text-slate-700 shadow-sm font-bold'
                : 'text-sub hover:text-main'
            }`}
          >
            キャンセル
          </button>
        </div>
      </div>

      {/* 4. Main Job Data List / Table */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        {error && (
          <div className="p-4 bg-rose-50 border-b border-rose-200 text-rose-700 text-xs">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="p-12 text-center text-sub text-xs space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-slate-400" />
            <p>案件データを読み込んでいます...</p>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="p-12 text-center text-sub text-xs space-y-3">
            <Briefcase className="w-8 h-8 mx-auto text-slate-300" />
            <p className="font-medium text-main text-sm">該当する案件が見つかりません</p>
            <p className="text-sub max-w-sm mx-auto">
              検索条件またはフィルタータグを変更してお試しください。
            </p>
          </div>
        ) : isMobileMode ? (
          /* モバイル・携帯モード専用スリムカード型リスト (超高密度・行間最小化) */
          <div className="divide-y divide-border">

            {filteredJobs.map((job) => {
              const badge = statusBadgeConfig[job.status] || {
                label: job.status,
                style: 'bg-slate-100 text-slate-700 border-slate-200',
              }
              const canCreateQuote = ['received', 'quoting', 'pending'].includes(job.status)

              return (
                <div
                  key={job.id}
                  onClick={() => handleOpenDetail(job)}
                  className="py-1.5 px-2.5 hover:bg-slate-50 transition-colors space-y-0.5 cursor-pointer active:bg-slate-100"
                >
                  {/* 1行目: [ステータス] 案件タイトル & 顧客名 + 見積ボタン(要件ステータスのみ) */}
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center space-x-1.5 min-w-0 flex-1">
                      <span className={`inline-block px-1.5 py-0.2 rounded-full text-[9px] font-bold border ${badge.style} flex-shrink-0`}>
                        {badge.label}
                      </span>
                      <h3 className="font-bold text-xs text-main truncate leading-tight">{job.title}</h3>
                      <span className="text-[11px] text-slate-500 truncate flex-shrink-0 font-medium">
                        ({job.customers?.name || '名称未設定'})
                      </span>
                    </div>
                    <div className="flex items-center space-x-1 flex-shrink-0">
                      {canCreateQuote && (
                        <button
                          type="button"
                          onClick={(e) => handleOpenQuoteForJob(job, e)}
                          className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-[10px] font-bold rounded shadow-sm flex items-center space-x-1 transition-all"
                          title="この案件の見積書を作成"
                        >
                          <Calculator className="w-3 h-3" />
                          <span>見積</span>
                        </button>
                      )}
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>

                  {/* 2行目: 担当者・作業予定日・電話・住所 */}
                  <div className="flex flex-wrap items-center justify-between text-[10px] text-slate-500 gap-x-2 pt-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="flex items-center gap-0.5">
                        <UserCheck className="w-3 h-3 text-slate-400" />
                        担当:<strong className="text-slate-700 font-semibold ml-0.5">{job.profiles?.display_name || '未割当'}</strong>
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Calendar className="w-3 h-3 text-blue-600" />
                        予定:<strong className="text-blue-700 font-semibold ml-0.5">{job.scheduled_date || '未定'}</strong>
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      {job.customers?.phone && (
                        <a
                          href={`tel:${job.customers.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center text-blue-600 font-normal underline text-[10px]"
                        >
                          <Phone className="w-3 h-3 mr-0.5" />
                          {job.customers.phone}
                        </a>
                      )}
                      {job.customers?.address && (
                        <MapLink address={job.customers.address} variant="badge" />
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* PC用標準テーブル表示 (パディングを狭めた高密度テーブル) */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-border text-sub font-semibold">
                  <th className="py-2 px-3">案件内容 / タイトル</th>
                  <th className="py-2 px-3">顧客情報</th>
                  <th className="py-2 px-3">担当スタッフ</th>
                  <th className="py-2 px-3">作業予定日</th>
                  <th className="py-2 px-3">ステータス</th>
                  <th className="py-2 px-3">受付日時</th>
                  <th className="py-2 px-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredJobs.map((job) => {
                  const badge = statusBadgeConfig[job.status] || {
                    label: job.status,
                    style: 'bg-slate-100 text-slate-700 border-slate-200',
                  }
                  const canCreateQuote = ['received', 'quoting', 'pending'].includes(job.status)

                  return (
                    <tr
                      key={job.id}
                      onClick={() => handleOpenDetail(job)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                    >
                      {/* 案件タイトル */}
                      <td className="py-2 px-3 font-semibold text-main">
                        <div className="space-y-0.5">
                          <p className="group-hover:text-blue-600 transition-colors font-bold">
                            {job.title}
                          </p>
                        </div>
                      </td>

                      {/* 顧客情報 */}
                      <td className="py-2 px-3 text-sub">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-main flex items-center gap-1">
                            <User className="w-3 h-3 text-sub" />
                            {job.customers?.name || '名称未設定'}
                          </p>
                          {job.customers?.phone && (
                            <p className="text-[11px] flex items-center gap-1 text-slate-600">
                              <Phone className="w-3 h-3 text-sub" />
                              {job.customers.phone}
                            </p>
                          )}
                          {job.customers?.address && (
                            <div className="flex items-center space-x-1.5 pt-0.5">
                              <p className="text-[11px] flex items-center gap-1 text-slate-500 truncate max-w-[180px]">
                                <MapPin className="w-3 h-3 text-sub flex-shrink-0" />
                                <span className="truncate">{job.customers.address}</span>
                              </p>
                              <MapLink address={job.customers.address} variant="badge" />
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 担当スタッフ */}
                      <td className="py-2 px-3 text-sub">
                        {job.profiles?.display_name ? (
                          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-medium text-[11px]">
                            <UserCheck className="w-3 h-3 text-slate-600" />
                            {job.profiles.display_name}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal text-[11px]">未割当</span>
                        )}
                      </td>

                      {/* 作業予定日 */}
                      <td className="py-2 px-3 text-sub">
                        {job.scheduled_date ? (
                          <div className="flex items-center space-x-1.5 text-main font-medium">
                            <Calendar className="w-3.5 h-3.5 text-blue-600" />
                            <span>{job.scheduled_date}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-normal">未定</span>
                        )}
                      </td>

                      {/* ステータスバッジ */}
                      <td className="py-2 px-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badge.style}`}
                        >
                          {badge.label}
                        </span>
                      </td>

                      {/* 受付日時 */}
                      <td className="py-2 px-3 text-sub text-[11px]">
                        {job.created_at
                          ? new Date(job.created_at).toLocaleDateString('ja-JP', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '-'}
                      </td>

                      {/* 操作ボタン */}
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {canCreateQuote && (
                            <Button
                              type="button"
                              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-2 text-[11px] shadow-sm flex items-center space-x-1"
                              size="sm"
                              onClick={(e) => handleOpenQuoteForJob(job, e)}
                              title="この案件の見積書を作成"
                            >
                              <Calculator className="w-3.5 h-3.5" />
                              <span>見積作成</span>
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenDetail(job)
                            }}
                          >
                            詳細・編集
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* モバイル用見積作成モーダル */}
      <MobileQuoteModal
        isOpen={isMobileQuoteOpen}
        onClose={() => {
          setIsMobileQuoteOpen(false)
          setQuoteInitialData(null)
        }}
        onSuccess={() => refetch()}
        initialData={quoteInitialData}
      />

      {/* ダッシュボード共通の案件詳細・進捗モーダル */}
      <TaskDetailModal
        task={selectedTask}
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        onSave={handleSaveProcessTask}
        onDelete={handleDeleteJob}
        onPrint={handlePrintTask}
        onOpenQuoteWithData={(data) => {
          setQuoteInitialData(data)
          setIsMobileQuoteOpen(true)
        }}
      />


      {/* Excelインポートモーダル */}
      <ExcelImportModal
        isOpen={isExcelImportOpen}
        onClose={() => setIsExcelImportOpen(false)}
        onImportSuccess={() => refetch()}
      />
    </div>
  )
}


