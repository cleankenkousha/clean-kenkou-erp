import React, { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  KanbanBoard,
  ProcessTask,
  ProcessLane,
  initialDummyTasks,
  isTaskCompleted,
} from '../components/features/KanbanBoard'
import {
  TaskDetailModal,
  getStatusRank,
  resetStepsAfterStatus,
} from '../components/features/TaskDetailModal'
import { NewTaskModal } from '../components/features/NewTaskModal'
import { ExportModal } from '../components/features/ExportModal'
import { ExcelImportModal } from '../components/features/ExcelImportModal'
import { MobileQuoteModal, InitialQuoteData } from '../components/features/MobileQuoteModal'
import { PrintArea, PrintTaskData } from '../components/features/PrintArea'
import { useJobs } from '../hooks/useJobs'
import { useViewMode } from '../hooks/useViewMode'


// SupabaseのJobStatus -> KanbanBoardのProcessLaneへの変換
const mapJobStatusToLane = (status: string): ProcessLane => {
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

export const Dashboard: React.FC = () => {
  const navigate = useNavigate()
  const { isMobileMode } = useViewMode()
  const { jobs, refetch, updateJobStatus } = useJobs()
  const [tasks, setTasks] = useState<ProcessTask[]>(initialDummyTasks)
  const [viewFilter, setViewFilter] = useState<'active' | 'archived' | 'all'>('active')

  // モバイルモードの場合は案件一覧画面 (/jobs) へリダイレクト
  useEffect(() => {
    if (isMobileMode) {
      navigate('/jobs', { replace: true })
    }
  }, [isMobileMode, navigate])


  // モーダル状態
  const [selectedTask, setSelectedTask] = useState<ProcessTask | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isQuoteOpen, setIsQuoteOpen] = useState(false)
  const [quoteInitialData, setQuoteInitialData] = useState<InitialQuoteData | null>(null)


  // 印刷データ
  const [printTask, setPrintTask] = useState<PrintTaskData | null>(null)

  // Supabaseからの案件データ (jobs) が存在する場合は ProcessTask[] へ同期
  useEffect(() => {
    if (jobs && jobs.length > 0) {
      const convertedTasks: ProcessTask[] = jobs.map((job) => ({
        id: job.id,
        receptionNo: `#${job.id.slice(0, 4)}`,
        customer: job.customers?.name || '名称未設定',
        tel: job.customers?.phone || '',
        address: job.customers?.address || '',
        taskType: job.title || '臨時収集',
        status: mapJobStatusToLane(job.status),
        receptionDate: job.created_at
          ? new Date(job.created_at).toLocaleDateString('ja-JP')
          : '',
        updatedAt: job.updated_at || job.created_at || new Date().toISOString(),
        stepsData: {},
      }))
      setTasks(convertedTasks)
    }
  }, [jobs])

  // カウント
  const counts = useMemo(() => {
    const activeCount = tasks.filter((t) => !isTaskCompleted(t)).length
    const archivedCount = tasks.filter((t) => isTaskCompleted(t)).length
    const allCount = tasks.length
    return { active: activeCount, archived: archivedCount, all: allCount }
  }, [tasks])

  // ドラッグ＆ドロップでステータス更新
  const handleTaskMove = (taskId: string, newStatus: ProcessLane) => {
    const nowStr = new Date().toISOString()
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t
        const oldRank = getStatusRank(t.status)
        const newRank = getStatusRank(newStatus)
        const stepsData = t.stepsData ? { ...t.stepsData } : {}

        if (newRank < oldRank) {
          resetStepsAfterStatus(stepsData, newStatus)
        }

        return {
          ...t,
          status: newStatus,
          updatedAt: nowStr,
          stepsData,
        }
      })
    )

    // DB側へも連動更新 (UUID形式のIDであれば)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskId)
    if (isUuid) {
      let dbStatus: any = 'received'
      if (newStatus === '未着手') dbStatus = 'received'
      else if (newStatus === '顧客検討') dbStatus = 'quoting'
      else if (newStatus === '作業日程調整' || newStatus === '日程確定') dbStatus = 'arranged'
      else if (newStatus === '作業実施') dbStatus = 'collected'
      else if (newStatus === '請求書送付') dbStatus = 'billed'
      else if (newStatus === '失注・キャンセル') dbStatus = 'cancelled'

      updateJobStatus(taskId, dbStatus)
    }
  }

  // カードクリック (詳細モーダルオープン)
  const handleCardClick = (task: ProcessTask) => {
    setSelectedTask(task)
    setIsDetailOpen(true)
  }

  // 詳細モーダル保存
  const handleSaveTaskDetail = (updatedTask: ProcessTask) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
    )
    setSelectedTask(updatedTask)
  }

  // タスクのキャンセル処理（データは消さずにキャンセルステータスへ更新）
  const handleDeleteTask = (taskId: string) => {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskId)
    if (isUuid) {
      updateJobStatus(taskId, 'cancelled')
    } else {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: '失注・キャンセル' } : t))
      )
    }
    setSelectedTask(null)
    refetch()
  }

  // 印刷データ発火用エフェクト (DOM完全描画を待ってwindow.print起動)
  useEffect(() => {
    if (printTask) {
      const timer = setTimeout(() => {
        window.print()
      }, 250)
      return () => clearTimeout(timer)
    }
  }, [printTask])

  // 印刷処理
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

  // 新規タスク登録
  const handleCreateNewTask = (
    newTaskData: Omit<ProcessTask, 'id' | 'updatedAt'>,
    shouldPrint = false
  ) => {
    const existingIds = tasks.map((t) => parseInt(t.id)).filter((id) => !isNaN(id))
    const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 1000
    const newId = (maxId + 1).toString()
    const nowStr = new Date().toISOString()

    const newTask: ProcessTask = {
      ...newTaskData,
      id: newId,
      receptionNo: `#${newId}`,
      updatedAt: nowStr,
    }

    setTasks((prev) => [...prev, newTask])

    if (shouldPrint) {
      handlePrintTask(newTask)
    }
  }



  return (
    <div className="app-container">
      {/* 印刷用隠しコンテナ */}
      <PrintArea task={printTask} />

      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="flex items-center gap-3 md:gap-4 flex-wrap">
            <h1 className="text-xl font-bold text-main">臨時収集工程ダッシュボード</h1>
            <button
              id="newTaskBtn"
              className="btn-primary"
              style={{ background: 'var(--success)' }}
              onClick={() => setIsNewTaskOpen(true)}
              aria-label="新規受付登録"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              新規受付
            </button>
          </div>
          <div className="header-actions" style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              id="importBtn"
              className="btn-secondary"
              style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
              onClick={() => setIsImportOpen(true)}
              aria-label="Excel読込"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
              Excel読込
            </button>
            <button
              id="exportBtn"
              className="btn-secondary"
              onClick={() => setIsExportOpen(true)}
              aria-label="Excel出力"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              Excel出力
            </button>
          </div>
        </div>
      </header>

      {/* View Filter Switcher Tabs */}
      <div className="view-switcher-container" style={{ margin: '1rem 0 0.5rem 0', display: 'flex', gap: '0.5rem' }}>
        <button
          className={`btn-filter ${viewFilter === 'active' ? 'active' : ''}`}
          onClick={() => setViewFilter('active')}
        >
          📄 進行中 <span className="badge">{counts.active}</span>
        </button>
        <button
          className={`btn-filter ${viewFilter === 'archived' ? 'active' : ''}`}
          onClick={() => setViewFilter('archived')}
        >
          🎨 完了・過去履歴 <span className="badge">{counts.archived}</span>
        </button>
        <button
          className={`btn-filter ${viewFilter === 'all' ? 'active' : ''}`}
          onClick={() => setViewFilter('all')}
        >
          📂 すべて <span className="badge">{counts.all}</span>
        </button>
      </div>

      {/* Main Kanban Content */}
      <main className="main-layout">
        <KanbanBoard
          tasks={tasks}
          viewFilter={viewFilter}
          onTaskMove={handleTaskMove}
          onTaskClick={handleCardClick}
          onOpenQuoteWithData={(data) => {
            setQuoteInitialData(data)
            setIsQuoteOpen(true)
          }}
        />
      </main>

      {/* Modals */}
      <TaskDetailModal
        task={selectedTask}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onSave={handleSaveTaskDetail}
        onDelete={handleDeleteTask}
        onPrint={handlePrintTask}
        onOpenQuoteWithData={(data) => {
          setQuoteInitialData(data)
          setIsQuoteOpen(true)
        }}
      />

      <MobileQuoteModal
        isOpen={isQuoteOpen}
        onClose={() => {
          setIsQuoteOpen(false)
          setQuoteInitialData(null)
        }}
        onSuccess={() => refetch()}
        initialData={quoteInitialData}
      />


      <NewTaskModal
        isOpen={isNewTaskOpen}
        onClose={() => setIsNewTaskOpen(false)}
        onSubmit={handleCreateNewTask}
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        jobs={jobs}
      />

      {/* Excelインポートモーダル (成功時にrefetch) */}
      <ExcelImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImportSuccess={() => {
          refetch()
        }}
      />
    </div>
  )
}
