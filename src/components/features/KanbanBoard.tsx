import React, { useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import {
  Calendar,
  User,
  Tag,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  GripVertical,
  Maximize2,
} from 'lucide-react'
import { useJobs } from '../../hooks'
import { Job, JobStatus } from '../../types'
import { JobDetailModal } from './JobDetailModal'

interface ColumnConfig {
  key: string
  statuses: JobStatus[]
  defaultTargetStatus: JobStatus
  title: string
  badgeStyle: string
  icon: React.ComponentType<{ className?: string }>
}

const columns: ColumnConfig[] = [
  {
    key: 'unhandled',
    statuses: ['received', 'quoting', 'pending'],
    defaultTargetStatus: 'received',
    title: '未対応 / 受付済',
    badgeStyle: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: AlertCircle,
  },
  {
    key: 'in_progress',
    statuses: ['arranged'],
    defaultTargetStatus: 'arranged',
    title: '手配済 / 進行中',
    badgeStyle: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: Clock,
  },
  {
    key: 'completed',
    statuses: ['collected', 'billed', 'completed'],
    defaultTargetStatus: 'collected',
    title: '回収完了 / 請求待ち',
    badgeStyle: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    icon: CheckCircle2,
  },
]

interface KanbanCardProps {
  job: Job
  isOverlay?: boolean
  onCardClick?: (job: Job) => void
}

const KanbanCard: React.FC<KanbanCardProps> = ({ job, isOverlay, onCardClick }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: job.id,
      data: { job },
    })

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined

  const customerName = job.customers?.name || '（顧客名なし）'
  const displayDate =
    job.scheduled_date ||
    (job.created_at
      ? new Date(job.created_at).toLocaleDateString('ja-JP')
      : '受付日未設定')

  const handleClick = () => {
    // ドラッグ中でなければ詳細モーダルを開く
    if (!isDragging && onCardClick) {
      onCardClick(job)
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={`bg-white p-4 rounded-lg border border-border shadow-sm transition-all cursor-grab active:cursor-grabbing space-y-2 select-none group relative touch-action-none ${
        isDragging ? 'opacity-40 border-dashed border-slate-400' : ''
      } ${
        isOverlay
          ? 'shadow-xl ring-2 ring-slate-900 ring-offset-2 rotate-2 opacity-95'
          : 'hover:shadow hover:border-slate-300'
      }`}
    >
      <div className="flex items-center justify-between text-xs text-sub">
        <div className="flex items-center space-x-1">
          <div className="p-1 -ml-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 touch-none cursor-grab active:cursor-grabbing">
            <GripVertical className="w-4 h-4" />
          </div>
          <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded border border-border truncate max-w-[120px]">
            {job.id}
          </span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="flex items-center space-x-1">
            <Tag className="w-3 h-3 text-sub" />
            <span className="capitalize">{job.status}</span>
          </span>
          {!isOverlay && (
            <span
              className="text-sub group-hover:text-slate-900 p-1 rounded hover:bg-slate-100 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
              title="クリックして詳細を表示"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </span>
          )}
        </div>
      </div>

      <h3 className="font-bold text-sm md:text-base text-main group-hover:text-slate-900 leading-snug">
        {job.title}
      </h3>

      <p className="text-xs font-medium text-slate-700 bg-slate-50 px-2.5 py-1.5 rounded border border-slate-100">
        顧客: {customerName}
      </p>

      {job.notes && (
        <p className="text-[11px] text-sub line-clamp-2 italic">
          {job.notes}
        </p>
      )}

      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-sub">
        <div className="flex items-center space-x-1">
          <Calendar className="w-3.5 h-3.5 text-sub" />
          <span>{displayDate}</span>
        </div>

        <div className="flex items-center space-x-1">
          <User className="w-3.5 h-3.5 text-sub" />
          <span>{job.assigned_to || '未割り当て'}</span>
        </div>
      </div>
    </div>
  )
}

interface KanbanColumnProps {
  column: ColumnConfig
  jobs: Job[]
  onCardClick?: (job: Job) => void
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({ column, jobs, onCardClick }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: column.key,
  })

  const ColumnIcon = column.icon

  return (
    <div
      ref={setNodeRef}
      className={`p-4 rounded-xl border transition-colors flex flex-col space-y-3 min-h-[420px] md:min-h-[500px] w-[86vw] sm:w-[340px] flex-shrink-0 snap-center md:w-auto ${
        isOver
          ? 'bg-slate-200/80 border-slate-400 ring-2 ring-slate-400'
          : 'bg-slate-50/70 border-border'
      }`}
    >
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
          {jobs.length}
        </span>
      </div>

      <div className="flex-1 space-y-3">
        {jobs.map((job) => (
          <KanbanCard key={job.id} job={job} onCardClick={onCardClick} />
        ))}

        {jobs.length === 0 && (
          <div className="h-32 flex items-center justify-center border-2 border-dashed border-border rounded-lg text-xs text-sub">
            ここにドラッグ＆ドロップ
          </div>
        )}
      </div>
    </div>
  )
}

export interface KanbanBoardProps {
  jobsData?: ReturnType<typeof useJobs>
}

const KanbanBoardInner: React.FC<{ jobsData: ReturnType<typeof useJobs> }> = ({
  jobsData,
}) => {
  const { jobs = [], isLoading, error, refetch, updateJobStatus, updateJobDetails } = jobsData
  const [activeJob, setActiveJob] = useState<Job | null>(null)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 5,
      },
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    const jobData = event.active.data.current?.job as Job | undefined
    if (jobData) {
      setActiveJob(jobData)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveJob(null)

    if (!over) return

    const jobId = active.id as string
    const targetColumnKey = over.id as string

    const targetColumn = columns.find((col) => col.key === targetColumnKey)
    if (!targetColumn) return

    const activeJobData = (jobs || []).find((j) => j && j.id === jobId)
    if (!activeJobData) return

    // すでにそのカラムに含まれるステータスの場合は更新不要
    if (targetColumn.statuses.includes(activeJobData.status)) {
      return
    }

    const newStatus = targetColumn.defaultTargetStatus
    await updateJobStatus(jobId, newStatus)
  }

  if (isLoading) {
    return (
      <div className="bg-slate-50/70 p-12 rounded-xl border border-border flex flex-col items-center justify-center space-y-3 min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
        <p className="text-sm text-sub font-medium">案件データを読み込み中...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-rose-50 p-6 rounded-xl border border-rose-200 text-rose-800 space-y-3">
        <div className="flex items-center space-x-2 font-bold">
          <AlertCircle className="w-5 h-5 text-rose-600" />
          <span>データの取得中にエラーが発生しました</span>
        </div>
        <p className="text-xs text-rose-700">{error}</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="text-xs px-3 py-1.5 bg-white border border-rose-300 rounded font-medium hover:bg-rose-100 text-rose-900 transition-colors"
        >
          再読み込み
        </button>
      </div>
    )
  }

  const safeJobs = Array.isArray(jobs) ? jobs : []

  return (
    <div className="space-y-3 md:space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h2 className="text-base md:text-lg font-bold text-main">案件ステータスボード</h2>
          <span className="md:hidden text-[11px] text-sub bg-slate-100 px-2 py-0.5 rounded-full">
            ← 左右スワイプ可 →
          </span>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-xs text-sub">全 {safeJobs.length} 件の案件</span>
          <button
            type="button"
            onClick={() => refetch()}
            className="p-1.5 hover:bg-slate-100 rounded text-sub transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
            title="最新データに更新"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* スマホ画面: 横スワイプ対応 (overflow-x-auto, snap-x, snap-mandatory), PC画面: 3列グリッド */}
        <div className="flex overflow-x-auto snap-x snap-mandatory space-x-4 pb-4 md:space-x-0 md:grid md:grid-cols-3 md:gap-6 scrollbar-thin">
          {columns.map((column) => {
            const jobsInColumn = safeJobs.filter(
              (job) => job && job.status && column.statuses.includes(job.status)
            )

            return (
              <KanbanColumn
                key={column.key}
                column={column}
                jobs={jobsInColumn}
                onCardClick={(job) => setSelectedJob(job)}
              />
            )
          })}
        </div>

        <DragOverlay>
          {activeJob ? <KanbanCard job={activeJob} isOverlay /> : null}
        </DragOverlay>
      </DndContext>

      {/* 案件詳細モーダル */}
      <JobDetailModal
        job={selectedJob ? (safeJobs.find((j) => j?.id === selectedJob.id) || selectedJob) : null}
        onClose={() => setSelectedJob(null)}
        onSave={updateJobDetails}
      />

    </div>
  )
}

const KanbanBoardWithSelfFetch: React.FC = () => {
  const selfJobsData = useJobs()
  return <KanbanBoardInner jobsData={selfJobsData} />
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ jobsData }) => {
  if (jobsData) {
    return <KanbanBoardInner jobsData={jobsData} />
  }
  return <KanbanBoardWithSelfFetch />
}




