import React, { useState, useEffect } from 'react'
import { Camera, Calculator } from 'lucide-react'
import { ProcessTask, ProcessLane, STEP_DEFINITIONS } from './KanbanBoard'
import { StepsData } from './PrintArea'
import { useProfiles } from '../../hooks/useProfiles'
import { MapLink } from '../ui/MapLink'
import { InitialQuoteData } from './MobileQuoteModal'

interface TaskDetailModalProps {
  task: ProcessTask | null
  isOpen: boolean
  onClose: () => void
  onSave: (updatedTask: ProcessTask) => void
  onDelete: (taskId: string) => void
  onPrint: (task: ProcessTask) => void
  onOpenQuoteWithData?: (data: InitialQuoteData) => void
}

export function getStatusRank(statusStr: string): number {
  const ranks: Record<string, number> = {
    '未着手': 0,
    '顧客検討': 1,
    '作業日程調整': 2,
    '日程確定': 3,
    '作業実施': 4,
    '請求書送付': 5,
  }
  return ranks[statusStr] !== undefined ? ranks[statusStr] : 0
}

export const STEP_MIN_STATUS_RANK: Record<string, number> = {
  reception: 0,
  estimate_schedule: 1,
  estimate_do: 1,
  estimate_submit: 1,
  customer_consideration: 1,
  work_schedule: 2,
  schedule_confirmed: 3,
  work_execution: 4,
  invoice_sent: 5,
}

export function resetStepsAfterStatus(stepsData: StepsData, targetStatus: ProcessLane): void {
  if (!stepsData) return
  const targetRank = getStatusRank(targetStatus)
  Object.keys(STEP_MIN_STATUS_RANK).forEach((stepId) => {
    const sKey = stepId as keyof StepsData
    if (STEP_MIN_STATUS_RANK[stepId] > targetRank && stepsData[sKey]) {
      stepsData[sKey] = { ...stepsData[sKey]!, status: '未' }
    }
  })
}

export function computeTaskStatus(stepsData: StepsData): ProcessLane {
  if (!stepsData) return '未着手'

  const getStatus = (stepId: keyof StepsData) =>
    stepsData[stepId] && stepsData[stepId]?.status ? stepsData[stepId]?.status : '未'

  if (getStatus('invoice_sent') === '済') return '請求書送付'
  if (getStatus('work_execution') === '済') return '作業実施'
  if (getStatus('schedule_confirmed') === '済') return '日程確定'

  const workSched = getStatus('work_schedule')
  if (workSched === '済' || workSched === '不要') return '作業日程調整'

  const custConsider = getStatus('customer_consideration')
  const estSubmit = getStatus('estimate_submit')
  const estDo = getStatus('estimate_do')
  const estSched = getStatus('estimate_schedule')

  if (
    custConsider === '済' ||
    custConsider === '不要' ||
    ['口頭', 'メール', '郵送', '済', '不要'].includes(estSubmit || '') ||
    estDo === '済' ||
    estDo === '不要' ||
    estSched === '済' ||
    estSched === '見積不要'
  ) {
    return '顧客検討'
  }

  return '未着手'
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  isOpen,
  onClose,
  onSave,
  onDelete,
  onPrint,
  onOpenQuoteWithData,
}) => {
  const { profiles } = useProfiles()
  const [currentStatus, setCurrentStatus] = useState<ProcessLane>('未着手')
  const [updater, setUpdater] = useState('')
  const [stepsData, setStepsData] = useState<StepsData>({})

  useEffect(() => {
    if (task) {
      setCurrentStatus(task.status)
      setUpdater(task.updater || '')
      setStepsData(task.stepsData || {})
    }
  }, [task])

  if (!isOpen || !task) return null

  const handleOpenQuoteForThisTask = () => {
    if (onOpenQuoteWithData && task) {
      onClose()
      onOpenQuoteWithData({
        jobId: task.id,
        customerName: task.customer,
        customerPhone: task.tel,
        customerAddress: task.address,
      })
    }
  }


  // ステータスセレクト手動変更時の処理
  const handleStatusSelectChange = (newStatus: ProcessLane) => {
    const newRank = getStatusRank(newStatus)
    const oldRank = getStatusRank(currentStatus)

    setCurrentStatus(newStatus)

    if (newRank < oldRank) {
      setStepsData((prev) => {
        const nextData = { ...prev }
        const STEP_MIN_RANK: Record<string, number> = {
          reception: 0,
          estimate_schedule: 1,
          estimate_do: 1,
          estimate_submit: 1,
          customer_consideration: 1,
          work_schedule: 2,
          schedule_confirmed: 3,
          work_execution: 4,
          invoice_sent: 5,
        }
        Object.keys(STEP_MIN_RANK).forEach((sKey) => {
          const stepId = sKey as keyof StepsData
          if (STEP_MIN_RANK[sKey] > newRank && nextData[stepId]) {
            nextData[stepId] = { ...nextData[stepId]!, status: '未' }
          }
        })
        return nextData
      })
    }
  }

  // ステップボタンクリック時 (自動連動 & 自動昇格機能)
  const handleStepStatusChange = (stepId: keyof StepsData, statusVal: string) => {
    setStepsData((prev) => {
      let nextData = { ...prev }
      const currentUpdater = updater.trim()

      if (stepId === 'estimate_schedule' && statusVal === '見積不要') {
        const autoWorker = prev.estimate_schedule?.worker || currentUpdater
        nextData = {
          ...nextData,
          estimate_schedule: { status: '見積不要', memo: prev.estimate_schedule?.memo || '', worker: autoWorker },
          estimate_do: { status: '不要', memo: prev.estimate_do?.memo || '', worker: prev.estimate_do?.worker || autoWorker },
          estimate_submit: { status: '不要', memo: prev.estimate_submit?.memo || '', worker: prev.estimate_submit?.worker || autoWorker },
          customer_consideration: { status: '不要', memo: prev.customer_consideration?.memo || '', worker: prev.customer_consideration?.worker || autoWorker },
        }
      } else if (stepId === 'estimate_schedule' && statusVal !== '見積不要' && prev.estimate_schedule?.status === '見積不要') {
        nextData = {
          ...nextData,
          estimate_schedule: { status: statusVal, memo: prev.estimate_schedule?.memo || '', worker: prev.estimate_schedule?.worker || currentUpdater },
        }
        ;(['estimate_do', 'estimate_submit', 'customer_consideration'] as (keyof StepsData)[]).forEach((tId) => {
          if (nextData[tId]?.status === '不要') {
            nextData[tId] = { ...nextData[tId]!, status: '未' }
          }
        })
      } else {
        const autoWorker = prev[stepId]?.worker || (statusVal !== '未' ? currentUpdater : '')
        nextData = {
          ...nextData,
          [stepId]: {
            status: statusVal,
            memo: prev[stepId]?.memo || '',
            worker: autoWorker,
          },
        }
      }

      const suggestedStatus = computeTaskStatus(nextData)
      const currentRank = getStatusRank(currentStatus)
      const suggestedRank = getStatusRank(suggestedStatus)

      if (suggestedRank > currentRank) {
        setCurrentStatus(suggestedStatus)
      }

      return nextData
    })
  }

  // ステップメモ変更
  const handleStepMemoChange = (stepId: keyof StepsData, memoVal: string) => {
    setStepsData((prev) => ({
      ...prev,
      [stepId]: {
        status: prev[stepId]?.status || '未',
        memo: memoVal,
        worker: prev[stepId]?.worker || updater,
      },
    }))
  }

  // ステップ担当者変更
  const handleStepWorkerChange = (stepId: keyof StepsData, workerVal: string) => {
    setStepsData((prev) => ({
      ...prev,
      [stepId]: {
        status: prev[stepId]?.status || '未',
        memo: prev[stepId]?.memo || '',
        worker: workerVal,
      },
    }))
  }

  const handleSave = () => {
    if (!updater.trim()) {
      alert('担当者名（更新者名）を入力してください。')
      return
    }

    const nowStr = new Date().toISOString()
    const autoStatus = computeTaskStatus(stepsData)
    const selectedRank = getStatusRank(currentStatus)
    const autoRank = getStatusRank(autoStatus)

    let finalStatus = currentStatus
    if (selectedRank < autoRank) {
      finalStatus = currentStatus
    } else {
      finalStatus = autoRank > selectedRank ? autoStatus : currentStatus
    }

    const updatedTask: ProcessTask = {
      ...task,
      status: finalStatus,
      updater: updater.trim(),
      updatedAt: nowStr,
      stepsData,
      assignedTo: updater.trim(),
    }

    onSave(updatedTask)
    onClose()
  }

  const handleDelete = () => {
    if (confirm(`案件 #${task.id}（${task.customer}）を『失注・キャンセル』として処理しますか？\n（※完全削除されず、キャンセル履歴として保存されます）`)) {
      onDelete(task.id)
      onClose()
    }
  }


  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="modalTitle">案件詳細 #{task.id}</h2>
          <button type="button" className="close-btn" onClick={onClose} aria-label="閉じる">
            &times;
          </button>
        </div>

        <div className="modal-body">
          <div className="info-section">
            <div className="info-group">
              <label>顧客名</label>
              <div className="info-value">{task.customer || ''}</div>
            </div>
            <div className="info-group">
              <label>連絡先 (TEL)</label>
              <div className="info-value">{task.tel || '未登録'}</div>
            </div>
            <div className="info-group">
              <label>案件内容</label>
              <div className="info-value">{task.taskType || ''}</div>
            </div>
            <div className="info-group">
              <label>住所・現場アクセス</label>
              <div className="info-value">
                <span>{task.address || '未登録'}</span>
                <MapLink address={task.address} variant="buttons" className="mt-1" />
              </div>
            </div>
            <div className="info-group">
              <label htmlFor="modalStatusSelect">現在のステータス</label>
              <select
                id="modalStatusSelect"
                value={currentStatus}
                onChange={(e) => handleStatusSelectChange(e.target.value as ProcessLane)}
                className="form-input"
              >
                <option value="未着手">未着手</option>
                <option value="顧客検討">顧客検討</option>
                <option value="作業日程調整">作業日程調整</option>
                <option value="日程確定">日程確定</option>
                <option value="作業実施">作業実施</option>
                <option value="請求書送付">請求書送付</option>
                <option value="失注・キャンセル">失注・キャンセル</option>
              </select>
            </div>
            <div className="info-group">
              <label>最終更新日時</label>
              <div className="info-value">{task.updatedAt || '未更新'}</div>
            </div>

            {/* 担当者選択（登録済みスタッフからの選択 & 直接入力対応） */}
            <div className="info-group" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="modalUpdater">
                担当者名（作業/配車担当） <span className="required">*</span>
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  id="modalUpdater"
                  list="staffListOptions"
                  value={updater}
                  onChange={(e) => setUpdater(e.target.value)}
                  className="form-input"
                  placeholder="リストから選択または担当者名を入力..."
                  style={{ flex: 1 }}
                />
                <datalist id="staffListOptions">
                  {profiles.map((p) => (
                    <option key={p.id} value={p.display_name || ''} />
                  ))}
                </datalist>
                {profiles.length > 0 && (
                  <select
                    onChange={(e) => {
                      if (e.target.value) setUpdater(e.target.value)
                    }}
                    value=""
                    className="form-input"
                    style={{ width: 'auto', minWidth: '130px' }}
                  >
                    <option value="">登録スタッフ選択</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.display_name || ''}>
                        {p.display_name || '名前未設定'}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* 見積作成アクションバー (未着手・顧客検討・日程調整フェーズのみ表示) */}
          {onOpenQuoteWithData && (currentStatus === '未着手' || currentStatus === '顧客検討' || currentStatus === '作業日程調整') && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 flex items-center justify-between gap-2 shadow-sm">
              <div className="flex items-center space-x-2 min-w-0">
                <div className="p-2 bg-blue-600 text-white rounded-lg flex-shrink-0">
                  <Calculator className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-blue-900 leading-tight">AI概算見積 & 写真撮影</p>
                  <p className="text-[11px] text-blue-700 truncate">この案件の情報（顧客名・住所等）を引き継いで見積作成画面を開きます</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleOpenQuoteForThisTask}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs rounded-lg shadow flex items-center space-x-1.5 transition-all flex-shrink-0"
              >
                <Camera className="w-4 h-4" />
                <span>見積作成を開く</span>
              </button>
            </div>
          )}

          <h3 className="timeline-title">工程チェックリスト & 伝言</h3>

          <div className="timeline">
            {STEP_DEFINITIONS.map((step) => {
              const stepKey = step.id as keyof StepsData
              const currentStepData = stepsData[stepKey] || { status: '未', memo: '', worker: '' }
              const isCompleted = currentStepData.status && currentStepData.status !== '未'
              const isUnnecessary = ['不要', '見積不要'].includes(currentStepData.status)

              return (
                <div
                  key={step.id}
                  className={`timeline-item ${isCompleted ? 'completed' : ''} ${
                    isUnnecessary ? 'is-unnecessary' : ''
                  }`}
                >
                  <div className="timeline-dot"></div>
                  <div className="timeline-content">
                    <div className="timeline-header">
                      <div className="timeline-step-name">{step.name}</div>
                      <div className="timeline-step-controls">
                        <div className="status-toggle">
                          {step.options.map((opt) => {
                            let activeClass = ''
                            if (currentStepData.status === opt) {
                              activeClass = ['不要', '見積不要'].includes(opt)
                                ? 'active active-unnecessary'
                                : 'active'
                            }
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => handleStepStatusChange(stepKey, opt)}
                                className={`status-btn ${activeClass}`}
                              >
                                {opt}
                              </button>
                            )
                          })}
                        </div>
                        <input
                          type="text"
                          list="staffListOptions"
                          value={currentStepData.worker || ''}
                          onChange={(e) => handleStepWorkerChange(stepKey, e.target.value)}
                          placeholder="担当者"
                          className="timeline-worker-input"
                          title="工程担当者名"
                        />
                      </div>
                    </div>
                    <textarea
                      value={currentStepData.memo || ''}
                      onChange={(e) => handleStepMemoChange(stepKey, e.target.value)}
                      placeholder="伝言・メモを追加..."
                      className="timeline-input"
                    />

                    {/* 見積実施・見積調整など見積関連ステップ時に「カメラ撮影・概算見積作成」ボタンを表示 */}
                    {(step.id === 'estimate_do' || step.id === 'estimate_schedule' || step.id === 'estimate_submit' || step.id === 'reception') && onOpenQuoteWithData && (
                      <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
                          <Calculator className="w-3.5 h-3.5 text-blue-600" />
                          現場で写真撮影 & 概算算定
                        </span>
                        <button
                          type="button"
                          onClick={handleOpenQuoteForThisTask}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs rounded-lg shadow-sm flex items-center space-x-1.5 transition-all"
                        >
                          <Camera className="w-4 h-4" />
                          <span>概算見積を作成 (顧客情報連動)</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>


        <div className="modal-footer">
          <button
            type="button"
            onClick={handleDelete}
            className="btn-secondary"
            style={{ background: '#f43f5e', color: 'white', borderColor: '#f43f5e', marginRight: 'auto' }}
          >
            案件をキャンセル
          </button>

          <button
            type="button"
            onClick={() => onPrint(task)}
            className="btn-secondary"
            style={{ background: '#0284c7', color: 'white', borderColor: '#0284c7' }}
          >
            🖨️ 指示書を印刷
          </button>

          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
          >
            閉じる
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="btn-primary"
          >
            保存する
          </button>
        </div>
      </div>
    </div>
  )
}
