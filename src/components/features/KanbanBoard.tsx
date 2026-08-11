import React, { useState, useMemo } from 'react'
import { Calculator } from 'lucide-react'
import { InitialQuoteData } from './MobileQuoteModal'
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
import { StepsData } from './PrintArea'

export type ProcessLane =
  | '未着手'
  | '顧客検討'
  | '作業日程調整'
  | '日程確定'
  | '作業実施'
  | '請求書送付'
  | '失注・キャンセル'

export interface ProcessTask {
  id: string
  receptionNo?: string
  customer: string
  tel: string
  address: string
  taskType: string
  status: ProcessLane
  receptionDate: string
  assignedTo?: string
  updater?: string
  updatedAt: string
  isArchived?: boolean
  stepsData?: StepsData
}

export const STEP_DEFINITIONS = [
  { id: 'reception', name: '受付', options: ['未', '済', '不要'] },
  { id: 'estimate_schedule', name: '見積日程調整', options: ['未', '済', '見積不要'] },
  { id: 'estimate_do', name: '見積実施', options: ['未', '済', '不要'] },
  { id: 'estimate_submit', name: '見積提出', options: ['未', '口頭', 'メール', '郵送', '不要'] },
  { id: 'customer_consideration', name: '顧客検討', options: ['未', '済', '不要'] },
  { id: 'work_schedule', name: '作業日程調整', options: ['未', '済', '不要'] },
  { id: 'schedule_confirmed', name: '日程確定', options: ['未', '済', '不要'] },
  { id: 'work_execution', name: '作業実施', options: ['未', '済', '不要'] },
  { id: 'invoice_sent', name: '請求書送付', options: ['未', '済', '不要'] },
]

export const processLanes: ProcessLane[] = [
  '未着手',
  '顧客検討',
  '作業日程調整',
  '日程確定',
  '作業実施',
  '請求書送付',
  '失注・キャンセル',
]

// 日付パーサー
function parseDateSafely(dateStr?: string | null): Date | null {
  if (!dateStr) return null
  let str = String(dateStr).trim()
  let d = new Date(str)
  if (!isNaN(d.getTime())) return d
  let normalized = str.replace(/\//g, '-')
  if (/^\d{4}-\d{1,2}-\d{1,2} \d{1,2}:\d{1,2}/.test(normalized)) {
    normalized = normalized.replace(' ', 'T')
  }
  d = new Date(normalized)
  if (!isNaN(d.getTime())) return d
  return null
}

function formatDateForDisplay(dateObj?: Date | null): string {
  if (!dateObj) return '-'
  const y = dateObj.getFullYear()
  const m = String(dateObj.getMonth() + 1).padStart(2, '0')
  const d = String(dateObj.getDate()).padStart(2, '0')
  const hh = String(dateObj.getHours()).padStart(2, '0')
  const mm = String(dateObj.getMinutes()).padStart(2, '0')
  return `${y}/${m}/${d} ${hh}:${mm}`
}

// 滞留・停滞判定 (元アプリ app.js 100% 同一ロジック)
export function getTaskStalledInfo(lastUpdatedStr?: string) {
  if (!lastUpdatedStr) return { borderClass: '', badgeHtml: null }
  const updatedDate = parseDateSafely(lastUpdatedStr)
  if (!updatedDate) return { borderClass: '', badgeHtml: null }

  const diffMs = Date.now() - updatedDate.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)

  if (diffHours >= 240) {
    // 10日以上 (240時間)
    return {
      borderClass: 'alert-danger',
      badgeHtml: <span className="stalled-badge-danger">🚨 滞留 (10日超)</span>,
    }
  } else if (diffHours >= 72) {
    // 3日以上 (72時間)
    return {
      borderClass: 'alert-warning',
      badgeHtml: <span className="stalled-badge">⚠️ 停滞 (3日超)</span>,
    }
  }

  return { borderClass: '', badgeHtml: null }
}

// 完了タスク判定
export function isTaskCompleted(task: ProcessTask): boolean {
  if (!task) return false
  if (task.status === '失注・キャンセル') return true
  if (
    task.status === '請求書送付' &&
    task.stepsData &&
    task.stepsData.invoice_sent?.status === '済'
  )
    return true
  return false
}

// 元アプリ同等の初期ダミーデータ
export const initialDummyTasks: ProcessTask[] = [
  {
    id: '1001',
    customer: '田尻',
    tel: '096-300-1122',
    address: '熊本県山鹿市山鹿1000',
    taskType: '生活ごみ回収',
    status: '顧客検討',
    receptionDate: '7/15',
    updater: '佐藤',
    updatedAt: '2026-07-20T14:30:00', // 10日以上前（滞留）
    isArchived: false,
    stepsData: {
      reception: { status: '済', memo: '軽トラ1台分のごみ', worker: '佐藤' },
      estimate_schedule: { status: '済', memo: '7/17 訪問見積済', worker: '佐藤' },
      estimate_do: { status: '済', memo: '25,000円で提示', worker: '佐藤' },
      estimate_submit: { status: '郵送', memo: '見積書郵送済', worker: '佐藤' },
      customer_consideration: { status: '未', memo: '返答待ち', worker: '佐藤' },
    },
  },
  {
    id: '1002',
    customer: '株式会社山鹿商事',
    tel: '096-321-4567',
    address: '熊本県山鹿市鹿本町来民500',
    taskType: 'オフィス不要品撤去',
    status: '作業日程調整',
    receptionDate: '7/28',
    updater: '田中',
    updatedAt: '2026-07-30T09:15:00', // 3日以上前（停滞）
    isArchived: false,
    stepsData: {
      reception: { status: '済', memo: 'お得意先につき見積不要', worker: '田中' },
      estimate_schedule: { status: '見積不要', memo: '', worker: '田中' },
      estimate_do: { status: '不要', memo: '', worker: '田中' },
      estimate_submit: { status: '不要', memo: '', worker: '田中' },
      customer_consideration: { status: '不要', memo: '', worker: '田中' },
      work_schedule: { status: '未', memo: 'トラック手配調整中', worker: '田中' },
    },
  },
  {
    id: '1003',
    customer: '高橋',
    tel: '090-9988-7766',
    address: '熊本県山鹿市菊鹿町123',
    taskType: '粗大ごみ（ベッド・冷蔵庫）',
    status: '未着手',
    receptionDate: '8/02',
    updater: '鈴木',
    updatedAt: '2026-08-02T11:00:00',
    isArchived: false,
    stepsData: {
      reception: { status: '済', memo: '大型家電あり', worker: '鈴木' },
    },
  },
  {
    id: '1004',
    customer: '山鹿建設株式会社',
    tel: '0968-43-1111',
    address: '熊本県山鹿市古閑888',
    taskType: '現場廃材スポット回収',
    status: '日程確定',
    receptionDate: '7/31',
    updater: '佐藤',
    updatedAt: '2026-08-03T10:00:00',
    isArchived: false,
    stepsData: {
      reception: { status: '済', memo: '現場裏手へ車付', worker: '佐藤' },
      schedule_confirmed: { status: '済', memo: '8/5 午前9時訪問決定', worker: '佐藤' },
    },
  },
  {
    id: '1005',
    customer: '中村',
    tel: '080-1122-3344',
    address: '熊本県山鹿市鹿央町777',
    taskType: '引越しに伴う不燃ごみ',
    status: '作業実施',
    receptionDate: '8/01',
    updater: '山本',
    updatedAt: '2026-08-03T13:20:00',
    isArchived: false,
    stepsData: {
      work_execution: { status: '済', memo: '積み込み完了。処分場移動中。', worker: '山本' },
    },
  },
  {
    id: '1006',
    customer: '有限会社メディカルケア',
    tel: '0968-44-5566',
    address: '熊本県山鹿市山鹿500',
    taskType: '定期廃棄物回収',
    status: '請求書送付',
    receptionDate: '7/20',
    updater: '田中',
    updatedAt: '2026-08-01T16:45:00',
    isArchived: false,
    stepsData: {
      invoice_sent: { status: '未', memo: '月末締め請求書作成中', worker: '田中' },
    },
  },
]

interface TaskCardProps {
  task: ProcessTask
  isOverlay?: boolean
  onClick?: (task: ProcessTask) => void
  onOpenQuoteWithData?: (data: InitialQuoteData) => void
}

const TaskCard: React.FC<TaskCardProps> = ({ task, isOverlay, onClick, onOpenQuoteWithData }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: task.id,
      data: { task },
    })

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined

  const stalledInfo = getTaskStalledInfo(task.updatedAt)
  const isEstimateUnnecessary =
    task.stepsData &&
    (task.stepsData.estimate_schedule?.status === '見積不要' ||
      task.stepsData.estimate_schedule?.status === '不要')

  const displayDate = task.updatedAt
    ? formatDateForDisplay(parseDateSafely(task.updatedAt))
    : '-'

  const handleOpenQuote = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onOpenQuoteWithData) {
      onOpenQuoteWithData({
        jobId: task.id,
        customerName: task.customer,
        customerPhone: task.tel,
        customerAddress: task.address,
      })
    }
  }

  const showQuoteBtn =
    onOpenQuoteWithData &&
    (task.status === '未着手' || task.status === '顧客検討')

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => !isDragging && onClick?.(task)}
      className={`task-card ${isDragging ? 'is-dragging' : ''} ${
        isOverlay ? 'shadow-2xl ring-2 ring-sky-500 scale-105 rotate-1' : ''
      }`}
    >
      <div className={stalledInfo.borderClass}>
        {/* 上部: 顧客名（主役）と各種バッジ */}
        <div className="flex items-start justify-between gap-1 mb-1">
          <div className="font-bold text-main text-sm truncate leading-snug">
            {task.customer}
          </div>
          <div className="flex items-center space-x-1 flex-shrink-0">
            {isEstimateUnnecessary && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                見積不要
              </span>
            )}
            {stalledInfo.badgeHtml}
          </div>
        </div>

        {/* 中段: 案件内容 / 依頼内容 + 見積作成アクション（未着手・顧客検討のみ） */}
        <div className="flex items-center justify-between gap-1 mb-2">
          <div className="text-xs font-medium text-slate-700 truncate flex-1">
            {task.taskType}
          </div>
          {showQuoteBtn && (
            <button
              type="button"
              onClick={handleOpenQuote}
              className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-[10px] font-bold rounded shadow-sm flex items-center space-x-1 flex-shrink-0 transition-all"
              title="この案件の見積書を作成"
            >
              <Calculator className="w-3 h-3" />
              <span>見積作成</span>
            </button>
          )}
        </div>

        {/* 下部 (フッター): 受付日・更新・担当者 + 右端に控えめな管理ID */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-sub">
          <div className="flex items-center space-x-2 truncate">
            <span>{task.receptionDate} 受付</span>
            {task.updater && (
              <span className="font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                {task.updater}
              </span>
            )}
          </div>
          {/* IDは右端に小さく薄いグレーで表示 */}
          <span className="font-mono text-[10px] text-slate-400 font-normal ml-1 flex-shrink-0" title={`最終更新: ${displayDate}`}>
            #{task.id}
          </span>
        </div>
      </div>
    </div>
  )
}

interface ColumnProps {
  lane: ProcessLane
  tasks: ProcessTask[]
  onCardClick?: (task: ProcessTask) => void
  onOpenQuoteWithData?: (data: InitialQuoteData) => void
}

const KanbanColumn: React.FC<ColumnProps> = ({ lane, tasks, onCardClick, onOpenQuoteWithData }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: lane,
  })

  return (
    <div
      ref={setNodeRef}
      className={`kanban-lane ${isOver ? 'drag-over' : ''}`}
      data-status={lane}
    >
      <div className="lane-header">
        <span>{lane}</span>
        <span className="item-count">{tasks.length}</span>
      </div>
      <div className="lane-tasks">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onClick={onCardClick} onOpenQuoteWithData={onOpenQuoteWithData} />
        ))}
      </div>
    </div>
  )
}

export interface KanbanBoardProps {
  viewFilter: 'active' | 'archived' | 'all'
  tasks?: ProcessTask[]
  onTaskMove?: (taskId: string, newStatus: ProcessLane) => void
  onTaskClick?: (task: ProcessTask) => void
  onOpenQuoteWithData?: (data: InitialQuoteData) => void
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  viewFilter,
  tasks: externalTasks,
  onTaskMove,
  onTaskClick,
  onOpenQuoteWithData,
}) => {
  const [internalTasks] = useState<ProcessTask[]>(initialDummyTasks)
  const [activeTask, setActiveTask] = useState<ProcessTask | null>(null)

  const tasks = externalTasks || internalTasks

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

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (viewFilter === 'active') return !isTaskCompleted(task)
      if (viewFilter === 'archived') return isTaskCompleted(task)
      return true
    })
  }, [tasks, viewFilter])

  const handleDragStart = (event: DragStartEvent) => {
    const taskData = event.active.data.current?.task as ProcessTask | undefined
    if (taskData) {
      setActiveTask(taskData)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)

    if (!over) return

    const taskId = active.id as string
    const targetLane = over.id as ProcessLane

    if (onTaskMove) {
      onTaskMove(taskId, targetLane)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="kanban-board">
        {processLanes.map((lane) => {
          const tasksInLane = filteredTasks.filter((t) => t.status === lane)

          // アクティブビュー時かつ空の失注・キャンセルレーンは非表示 (元アプリ仕様)
          if (lane === '失注・キャンセル' && tasksInLane.length === 0 && viewFilter === 'active') {
            return null
          }

          return (
            <KanbanColumn
              key={lane}
              lane={lane}
              tasks={tasksInLane}
              onCardClick={onTaskClick}
              onOpenQuoteWithData={onOpenQuoteWithData}
            />
          )
        })}
      </div>

      <DragOverlay>
        {activeTask ? <TaskCard task={activeTask} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  )
}
