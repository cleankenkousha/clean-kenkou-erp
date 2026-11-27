import React, { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  KanbanBoard,
  ProcessTask,
  ProcessLane,
  isTaskCompleted,
} from '../components/features/KanbanBoard'
import {
  TaskDetailModal,
  getStatusRank,
  resetStepsAfterStatus,
} from '../components/features/TaskDetailModal'
import { NewTaskModal, NewTaskSubmissionData } from '../components/features/NewTaskModal'
import { ExportModal } from '../components/features/ExportModal'
import { ExcelImportModal } from '../components/features/ExcelImportModal'
import { MobileQuoteModal, InitialQuoteData } from '../components/features/MobileQuoteModal'
import { PrintArea, PrintTaskData } from '../components/features/PrintArea'
import { useJobs } from '../hooks/useJobs'
import { useProfiles, getRoleInfo } from '../hooks/useProfiles'
import { useViewMode } from '../hooks/useViewMode'
import { supabase } from '../lib/supabase'
import { JobStatus } from '../types'
import { mapJobStatusToLane, mapLaneToJobStatus } from '../lib/statusMapping'
import { parseJobNotes, mergeJobNotes } from '../lib/jobNotes'

const isUuidString = (val: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)

export const Dashboard: React.FC = () => {
  const navigate = useNavigate()
  const { isMobileMode } = useViewMode()
  const { jobs, refetch, updateJobStatus, updateJobDetails } = useJobs()
  const { profiles, addStaff } = useProfiles()
  const [tasks, setTasks] = useState<ProcessTask[]>([])
  const [viewFilter, setViewFilter] = useState<'active' | 'archived' | 'all'>('active')
  const [staffFilter, setStaffFilter] = useState<string>('all')

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

  // Supabaseからの案件データ (jobs) を ProcessTask[] へ同期
  useEffect(() => {
    if (jobs) {
      const convertedTasks: ProcessTask[] = jobs.map((job) => {
        const parsed = parseJobNotes(job.notes)
        const stepsData = parsed.stepsData

        return {
          id: job.id,
          receptionNo: `#${job.id.slice(0, 4)}`,
          customer: job.customers?.name || '名称未設定',
          tel: job.customers?.phone || '',
          address: job.customers?.address || '',
          taskType: job.title || '臨時収集',
          status: mapJobStatusToLane(job.status, stepsData),
          receptionDate: job.created_at
            ? new Date(job.created_at).toLocaleDateString('ja-JP')
            : '',
          scheduledDate: job.scheduled_date || null,
          estimatedAmount: job.estimated_amount ?? null,
          updatedAt: job.updated_at || job.created_at || new Date().toISOString(),
          assignedTo: job.assigned_to || '',
          updater: job.profiles?.display_name || '',
          stepsData,
          signature: parsed.signature,
          rawNotes: job.notes,
          dbStatus: job.status,
        }
      })
      setTasks(convertedTasks)
    }
  }, [jobs])

  // 担当者絞り込み後のタスク一覧
  const filteredTasks = useMemo(() => {
    if (staffFilter === 'all') return tasks
    if (staffFilter === 'unassigned') return tasks.filter((t) => !t.assignedTo)
    return tasks.filter((t) => t.assignedTo === staffFilter)
  }, [tasks, staffFilter])

  // カウント
  const counts = useMemo(() => {
    const activeCount = filteredTasks.filter((t) => !isTaskCompleted(t)).length
    const archivedCount = filteredTasks.filter((t) => isTaskCompleted(t)).length
    const allCount = filteredTasks.length
    return { active: activeCount, archived: archivedCount, all: allCount }
  }, [filteredTasks])


  // ドラッグ＆ドロップでステータス更新（React 18 バッチ更新前の同期計算によりDBへ確実に反映）
  const handleTaskMove = async (taskId: string, newStatus: ProcessLane) => {
    const targetTask = tasks.find((t) => t.id === taskId)
    if (!targetTask || targetTask.status === newStatus) return

    const nowStr = new Date().toISOString()
    const nextStepsData: any = targetTask.stepsData ? { ...targetTask.stepsData } : {}

    if (newStatus !== '失注・キャンセル') {
      const oldRank = getStatusRank(targetTask.status)
      const newRank = getStatusRank(newStatus)
      if (newRank < oldRank && targetTask.status !== '失注・キャンセル') {
        resetStepsAfterStatus(nextStepsData, newStatus)
      }
      if (newStatus === '日程確定') {
        nextStepsData.schedule_confirmed = {
          status: '済',
          memo: nextStepsData.schedule_confirmed?.memo || '',
          worker: nextStepsData.schedule_confirmed?.worker || targetTask.updater || '',
        }
      }
    }

    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: newStatus,
              updatedAt: nowStr,
              stepsData: nextStepsData,
            }
          : t
      )
    )

    // DB側へも連動更新 (UUID形式のIDであれば)
    if (isUuidString(taskId)) {
      const origJob = jobs.find((j) => j.id === taskId)
      const dbStatus = mapLaneToJobStatus(newStatus, origJob?.status)
      const mergedNotes = mergeJobNotes(origJob?.notes ?? targetTask.rawNotes, {
        stepsData: nextStepsData,
      })
      const ok = await updateJobDetails(taskId, {
        status: dbStatus,
        notes: mergedNotes,
      })
      if (!ok) {
        alert('ステータスの保存に失敗しました。画面を最新状態に戻します。')
      }
      await refetch()
    }
  }

  // カードクリック (詳細モーダルオープン)
  const handleCardClick = (task: ProcessTask) => {
    setSelectedTask(task)
    setIsDetailOpen(true)
  }

  // 詳細モーダル保存
  const handleSaveTaskDetail = async (updatedTask: ProcessTask) => {
    const stepsData = updatedTask.stepsData ? { ...updatedTask.stepsData } : {}
    if (updatedTask.status === '日程確定') {
      stepsData.schedule_confirmed = {
        status: '済',
        memo: stepsData.schedule_confirmed?.memo || '',
        worker: stepsData.schedule_confirmed?.worker || updatedTask.updater || '',
      }
    }
    const origJob = jobs.find((j) => j.id === updatedTask.id)
    const mergedNotes = mergeJobNotes(origJob?.notes ?? updatedTask.rawNotes, {
      stepsData,
      signature: updatedTask.signature,
    })

    const finalTask: ProcessTask = {
      ...updatedTask,
      stepsData,
      rawNotes: mergedNotes,
    }

    setTasks((prev) =>
      prev.map((t) => (t.id === finalTask.id ? finalTask : t))
    )
    setSelectedTask(finalTask)

    if (isUuidString(finalTask.id)) {
      const dbStatus: JobStatus = mapLaneToJobStatus(finalTask.status, origJob?.status)

      // 担当スタッフの特定および自動プロファイル登録（UUID文字列そのものの誤登録を防止）
      let assignedUuid: string | null = null
      const updaterName = updatedTask.updater?.trim()
      if (updaterName) {
        const matchProfile = profiles.find(
          (p) => (p.display_name || '').trim() === updaterName || p.id === updaterName
        )
        if (matchProfile) {
          assignedUuid = matchProfile.id
        } else if (!isUuidString(updaterName)) {
          const newStaff = await addStaff(updaterName)
          if (newStaff) {
            assignedUuid = newStaff.id
          }
        }
      }

      const ok = await updateJobDetails(updatedTask.id, {
        title: updatedTask.taskType,
        status: dbStatus,
        scheduled_date: updatedTask.scheduledDate ?? null,
        estimated_amount: updatedTask.estimatedAmount ?? null,
        notes: mergedNotes,
        assigned_to: assignedUuid,
      })
      if (!ok) {
        alert('案件詳細の保存に失敗しました。通信状況をご確認ください。')
      }
      await refetch()
    }
  }

  // タスクのキャンセル処理（データは消さずにキャンセルステータスへ更新）
  const handleDeleteTask = async (taskId: string) => {
    if (isUuidString(taskId)) {
      const ok = await updateJobStatus(taskId, 'cancelled')
      if (!ok) {
        alert('キャンセル処理に失敗しました。')
      }
      setSelectedTask(null)
      await refetch()
    } else {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: '失注・キャンセル' } : t))
      )
      setSelectedTask(null)
    }
  }

  // 印刷データ発火用エフェクト (DOM完全描画を待ってwindow.print起動 & 終了後クリア)
  useEffect(() => {
    if (printTask) {
      const handleAfterPrint = () => setPrintTask(null)
      window.addEventListener('afterprint', handleAfterPrint)
      const timer = setTimeout(() => {
        window.print()
      }, 250)
      return () => {
        clearTimeout(timer)
        window.removeEventListener('afterprint', handleAfterPrint)
      }
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
      signature: task.signature,
    })
  }

  // 新規タスク登録（Supabase DB への確実な保存連携 ＆ 営業スケジュール自動連携）
  const handleCreateNewTask = async (
    newTaskData: NewTaskSubmissionData,
    shouldPrint = false
  ): Promise<boolean> => {
    try {
      if (!newTaskData.customer.trim()) {
        alert('顧客名を入力してください。')
        return false
      }

      // 1. 既存顧客の検索または新規作成
      let customerId: string | null = null
      let customerRecord = {
        name: newTaskData.customer.trim(),
        phone: newTaskData.tel?.trim() || null,
        address: newTaskData.address?.trim() || null,
      }

      // 既存顧客チェック (論理削除済みを除外、複数重複時でもエラーにならないよう limit(1) を使用)
      const baseCustQuery = supabase
        .from('customers')
        .select('id, name, phone, address')
        .is('deleted_at', null)
      const query = newTaskData.tel?.trim()
        ? baseCustQuery.eq('phone', newTaskData.tel.trim())
        : baseCustQuery.eq('name', newTaskData.customer.trim())
      const { data: existingCustomers } = await query.limit(1)
      const existingCustomer = existingCustomers?.[0]

      if (existingCustomer?.id) {
        customerId = existingCustomer.id
        // 住所等に更新があれば更新
        if (newTaskData.address?.trim() && !existingCustomer.address) {
          await supabase
            .from('customers')
            .update({ address: newTaskData.address.trim() })
            .eq('id', customerId)
        }
      } else {
        // 新規作成
        const { data: createdCustomer, error: customerErr } = await supabase
          .from('customers')
          .insert([customerRecord])
          .select()
          .single()

        if (customerErr || !createdCustomer) {
          console.error('顧客登録エラー:', customerErr)
          alert(`顧客の登録に失敗しました: ${customerErr?.message || '不明なエラー'}`)
          return false
        }
        customerId = createdCustomer.id
      }

      // 2. 担当スタッフの特定および自動プロファイル登録（UUID誤登録を防止）
      let assignedUuid: string | null = null
      const updaterName = newTaskData.updater?.trim()
      if (updaterName) {
        const matchProfile = profiles.find(
          (p) => (p.display_name || '').trim() === updaterName || p.id === updaterName
        )
        if (matchProfile) {
          assignedUuid = matchProfile.id
        } else if (!isUuidString(updaterName)) {
          const newStaff = await addStaff(updaterName)
          if (newStaff) {
            assignedUuid = newStaff.id
          }
        }
      }

      // スケジュール連動時は、選択した営業マンを案件の担当者に設定
      const finalAssignedTo =
        newTaskData.scheduleParams?.enabled && newTaskData.scheduleParams.salesStaffId
          ? newTaskData.scheduleParams.salesStaffId
          : assignedUuid

      const finalStatus: JobStatus =
        newTaskData.scheduleParams?.enabled ? 'quoting' : 'received'

      // 3. 案件の作成
      const { data: jobData, error: jobErr } = await supabase
        .from('jobs')
        .insert([
          {
            customer_id: customerId,
            title: newTaskData.taskType.trim() || '臨時収集',
            status: finalStatus,
            scheduled_date: newTaskData.scheduleParams?.enabled
              ? newTaskData.scheduleParams.date
              : null,
            assigned_to: finalAssignedTo,
            notes: newTaskData.scheduleParams?.notes
              ? `【受付時メモ】\n${newTaskData.scheduleParams.notes}`
              : null,
          },
        ])
        .select()
        .single()

      if (jobErr) {
        console.error('新規受付保存エラー:', jobErr)
        alert(`案件の作成に失敗しました: ${jobErr.message}`)
        return false
      }

      // 4. 営業マンスケジュール枠への自動連携
      if (newTaskData.scheduleParams?.enabled && newTaskData.scheduleParams.salesStaffId) {
        const sp = newTaskData.scheduleParams
        const startIso = `${sp.date}T${sp.startHour}:00+09:00`
        const endIso = `${sp.date}T${sp.endHour}:00+09:00`
        const scheduleTitle = sp.title || `${newTaskData.customer.trim()}様 見積訪問`

        const { error: schErr } = await supabase.from('staff_schedules').insert({
          id: crypto.randomUUID(),
          profile_id: sp.salesStaffId,
          job_id: jobData ? jobData.id : null,
          title: scheduleTitle,
          schedule_type: 'appointment',
          start_time: startIso,
          end_time: endIso,
          location: newTaskData.address?.trim() || '',
          customer_name: newTaskData.customer.trim(),
          customer_phone: newTaskData.tel?.trim() || '',
          notes: sp.notes || newTaskData.taskType.trim(),
        })

        if (schErr) {
          console.warn('営業スケジュールへの自動連携 notice:', schErr.message)
          alert(`案件は登録されましたが、営業スケジュールへの登録に失敗しました: ${schErr.message}`)
        }
      }

      const createdTask: ProcessTask = {
        ...newTaskData,
        id: jobData ? jobData.id : crypto.randomUUID(),
        receptionNo: jobData ? `#${jobData.id.slice(0, 4)}` : '#新',
        updatedAt: new Date().toISOString(),
      }

      setTasks((prev) => [createdTask, ...prev])

      if (shouldPrint) {
        handlePrintTask(createdTask)
      }

      setIsNewTaskOpen(false)
      refetch()
      return true
    } catch (err: any) {
      console.error('新規受付登録時例外:', err)
      alert(`登録処理中にエラーが発生しました: ${err.message || String(err)}`)
      return false
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
              style={{ background: 'var(--brand-main)' }}
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

      {/* View Filter Switcher Tabs & Staff Filter */}
      <div className="view-tabs-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div className="view-tabs">
          <button
            className={`tab-btn ${viewFilter === 'active' ? 'active' : ''}`}
            onClick={() => setViewFilter('active')}
          >
            📄 進行中 <span className="tab-count">{counts.active}</span>
          </button>
          <button
            className={`tab-btn ${viewFilter === 'archived' ? 'active' : ''}`}
            onClick={() => setViewFilter('archived')}
          >
            🎨 完了・過去履歴 <span className="tab-count">{counts.archived}</span>
          </button>
          <button
            className={`tab-btn ${viewFilter === 'all' ? 'active' : ''}`}
            onClick={() => setViewFilter('all')}
          >
            📂 すべて <span className="tab-count">{counts.all}</span>
          </button>
        </div>

        {/* 担当者（スタッフ・マイタスク）絞り込み */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-sub)' }}>担当者:</span>
          <select
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            style={{
              padding: '0.35rem 0.6rem',
              borderRadius: '0.375rem',
              border: '1px solid var(--border)',
              background: '#fff',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--text-main)',
              cursor: 'pointer',
            }}
          >
            <option value="all">全スタッフ表示</option>
            <option value="unassigned">担当未割当のみ</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name} ({getRoleInfo(p.role).label})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Kanban Content */}
      <main className="main-layout">
        <KanbanBoard
          tasks={filteredTasks}
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
        onInvoiceSuccess={() => refetch()}
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
