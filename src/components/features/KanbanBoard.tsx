import React from 'react'
import { Calendar, User, Tag, Clock, CheckCircle2, AlertCircle } from 'lucide-react'

export interface JobCardData {
  id: string
  title: string
  customerName: string
  scheduledTime: string
  assignee?: string
  category: string
  status: 'pending' | 'in_progress' | 'completed'
}

const mockJobs: JobCardData[] = [
  {
    id: 'JOB-2026-001',
    title: '山鹿オフィス 産業廃棄物定期回収',
    customerName: '株式会社山鹿商事',
    scheduledTime: '本日 14:00',
    category: '廃プラ・段ボール',
    status: 'pending',
  },
  {
    id: 'JOB-2026-002',
    title: '健康ビル 厨房機器撤去スポット回収',
    customerName: '医療法人健康会',
    scheduledTime: '明日 09:30',
    category: '大型機器・金属屑',
    status: 'pending',
  },
  {
    id: 'JOB-2026-003',
    title: '熊本第一工場 廃プラスチック定期回収',
    customerName: '熊本マテリアル株式会社',
    scheduledTime: '本日 11:00',
    assignee: '佐藤ドライバー',
    category: 'PE・PP資材',
    status: 'in_progress',
  },
  {
    id: 'JOB-2026-004',
    title: '山鹿物流センター パレット定期引取',
    customerName: '山鹿物流サービス有限会社',
    scheduledTime: '本日 15:30',
    assignee: '田中ドライバー',
    category: '木製パレット',
    status: 'in_progress',
  },
  {
    id: 'JOB-2026-005',
    title: '南区倉庫 古紙・段ボール回収',
    customerName: 'アジアンロジテック(株)',
    scheduledTime: '本日 09:00完了',
    assignee: '高橋ドライバー',
    category: '古紙 2.5t',
    status: 'completed',
  },
  {
    id: 'JOB-2026-006',
    title: '中央区オフィス PC機器廃棄処理',
    customerName: '肥後ITソリューションズ',
    scheduledTime: '昨日 16:00完了',
    assignee: '山本作業員',
    category: '精密電子機器',
    status: 'completed',
  },
]

interface ColumnConfig {
  key: 'pending' | 'in_progress' | 'completed'
  title: string
  badgeStyle: string
  icon: React.ComponentType<{ className?: string }>
}

const columns: ColumnConfig[] = [
  {
    key: 'pending',
    title: '未対応',
    badgeStyle: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: AlertCircle,
  },
  {
    key: 'in_progress',
    title: '手配済 / 進行中',
    badgeStyle: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: Clock,
  },
  {
    key: 'completed',
    title: '回収完了 / 請求待ち',
    badgeStyle: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    icon: CheckCircle2,
  },
]

export const KanbanBoard: React.FC = () => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-main">案件ステータスボード</h2>
        <span className="text-xs text-sub">全 {mockJobs.length} 件の案件</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {columns.map((column) => {
          const jobsInColumn = mockJobs.filter(
            (job) => job.status === column.key
          )
          const ColumnIcon = column.icon

          return (
            <div
              key={column.key}
              className="bg-slate-50/70 p-4 rounded-xl border border-border flex flex-col space-y-3 min-h-[500px]"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div className="flex items-center space-x-2">
                  <ColumnIcon className="w-4 h-4 text-sub" />
                  <span className="font-semibold text-sm text-main">
                    {column.title}
                  </span>
                </div>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full border ${column.badgeStyle}`}
                >
                  {jobsInColumn.length}
                </span>
              </div>

              {/* Job Cards List */}
              <div className="flex-1 space-y-3">
                {jobsInColumn.map((job) => (
                  <div
                    key={job.id}
                    className="bg-white p-4 rounded-lg border border-border shadow-sm hover:shadow transition-shadow space-y-2 cursor-pointer group"
                  >
                    <div className="flex items-center justify-between text-xs text-sub">
                      <span className="font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded border border-border">
                        {job.id}
                      </span>
                      <span className="flex items-center space-x-1">
                        <Tag className="w-3 h-3 text-sub" />
                        <span>{job.category}</span>
                      </span>
                    </div>

                    <h3 className="font-bold text-sm text-main group-hover:text-slate-900 leading-snug">
                      {job.title}
                    </h3>

                    <p className="text-xs text-sub">{job.customerName}</p>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-sub">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-3.5 h-3.5 text-sub" />
                        <span>{job.scheduledTime}</span>
                      </div>

                      <div className="flex items-center space-x-1">
                        <User className="w-3.5 h-3.5 text-sub" />
                        <span>{job.assignee || '未割り当て'}</span>
                      </div>
                    </div>
                  </div>
                ))}

                {jobsInColumn.length === 0 && (
                  <div className="h-32 flex items-center justify-center border-2 border-dashed border-border rounded-lg text-xs text-sub">
                    案件はありません
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
