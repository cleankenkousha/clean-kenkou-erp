import React, { useState, useMemo } from 'react'
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
import { PrintArea, PrintTaskData } from '../components/features/PrintArea'

export const Dashboard: React.FC = () => {
  const [tasks, setTasks] = useState<ProcessTask[]>(initialDummyTasks)
  const [viewFilter, setViewFilter] = useState<'active' | 'archived' | 'all'>('active')

  // モーダル状態
  const [selectedTask, setSelectedTask] = useState<ProcessTask | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)

  // 印刷データ
  const [printTask, setPrintTask] = useState<PrintTaskData | null>(null)

  // カウント
  const counts = useMemo(() => {
    const activeCount = tasks.filter((t) => !isTaskCompleted(t)).length
    const archivedCount = tasks.filter((t) => isTaskCompleted(t)).length
    const allCount = tasks.length
    return { active: activeCount, archived: archivedCount, all: allCount }
  }, [tasks])

  // ドラッグ＆ドロップでステータス更新 (降格時のステップリセット連動付き)
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

  // タスク削除
  const handleDeleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
    setSelectedTask(null)
  }

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

    setTimeout(() => {
      window.print()
    }, 150)
  }

  // 新規タスク登録 (shouldPrintで登録後即印刷)
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

  // Excel出力
  const handleExportMonth = (targetMonth: string) => {
    alert(`【${targetMonth}】のExcel集計レポート（サマリー＆明細シート）を出力します。`)
  }

  return (
    <div className="app-container">
      {/* 印刷用隠しコンテナ */}
      <PrintArea task={printTask} />

      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <h1>臨時収集工程ダッシュボード</h1>
          <div className="header-actions" style={{ display: 'flex', gap: '0.75rem' }}>
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
            <button
              id="importBtn"
              className="btn-secondary"
              style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
              onClick={() => alert('Excel読込機能：Excelファイルから一括読み込みを行います。')}
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

      {/* View Filter Tabs Navigation */}
      <div className="view-tabs-container">
        <div className="view-tabs">
          <button
            type="button"
            className={`tab-btn ${viewFilter === 'active' ? 'active' : ''}`}
            onClick={() => setViewFilter('active')}
          >
            📋 進行中 <span className="tab-count">{counts.active}</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${viewFilter === 'archived' ? 'active' : ''}`}
            onClick={() => setViewFilter('archived')}
          >
            📦 完了・過去履歴 <span className="tab-count">{counts.archived}</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${viewFilter === 'all' ? 'active' : ''}`}
            onClick={() => setViewFilter('all')}
          >
            🗂️ すべて <span className="tab-count">{counts.all}</span>
          </button>
        </div>
      </div>

      {/* Main Kanban Board */}
      <main className="kanban-board" style={{ flex: 1, padding: '1.25rem' }}>
        <KanbanBoard
          viewFilter={viewFilter}
          tasks={tasks}
          onTaskMove={handleTaskMove}
          onTaskClick={handleCardClick}
        />
      </main>

      {/* 案件詳細モーダル */}
      <TaskDetailModal
        task={selectedTask}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onSave={handleSaveTaskDetail}
        onDelete={handleDeleteTask}
        onPrint={handlePrintTask}
      />

      {/* 新規受付モーダル */}
      <NewTaskModal
        isOpen={isNewTaskOpen}
        onClose={() => setIsNewTaskOpen(false)}
        onSubmit={handleCreateNewTask}
      />

      {/* Excel集計出力モーダル */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        onExport={handleExportMonth}
      />
    </div>
  )
}

export default Dashboard
