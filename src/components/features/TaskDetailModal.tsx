import React, { useState, useEffect } from 'react'
import { Camera, Calculator, PenTool, CheckCircle2, RotateCcw, Trash2, Receipt } from 'lucide-react'
import { ProcessTask, ProcessLane, STEP_DEFINITIONS } from './KanbanBoard'
import { StepsData } from './PrintArea'
import { useProfiles } from '../../hooks/useProfiles'
import { MapLink } from '../ui/MapLink'
import { InitialQuoteData } from './MobileQuoteModal'
import { SignaturePadModal } from './SignaturePadModal'
import { InvoiceModal } from './InvoiceModal'

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
  const [signature, setSignature] = useState<string | null>(null)
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false)
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false)

  useEffect(() => {
    if (task) {
      setCurrentStatus(task.status)
      setUpdater(task.updater || task.assignedTo || '')
      setStepsData(task.stepsData || {})
      setSignature(task.signature || null)
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

      // ランクが下がった場合は後ろのステップをリセット
      if (newRank < oldRank) {
        Object.keys(STEP_MIN_RANK).forEach((sKey) => {
          const stepId = sKey as keyof StepsData
          if (STEP_MIN_RANK[sKey] > newRank && nextData[stepId]) {
            nextData[stepId] = { ...nextData[stepId]!, status: '未' }
          }
        })
      }

      // ステータスを手動で進めた場合、該当ステップを「済」にする
      const currentWorker = updater.trim()
      if (newStatus === '日程確定') {
        nextData.schedule_confirmed = {
          status: '済',
          memo: nextData.schedule_confirmed?.memo || '',
          worker: nextData.schedule_confirmed?.worker || currentWorker,
        }
      } else if (newStatus === '作業実施') {
        nextData.schedule_confirmed = {
          status: '済',
          memo: nextData.schedule_confirmed?.memo || '',
          worker: nextData.schedule_confirmed?.worker || currentWorker,
        }
        nextData.work_execution = {
          status: '済',
          memo: nextData.work_execution?.memo || '',
          worker: nextData.work_execution?.worker || currentWorker,
        }
      } else if (newStatus === '請求書送付') {
        nextData.invoice_sent = {
          status: '済',
          memo: nextData.invoice_sent?.memo || '',
          worker: nextData.invoice_sent?.worker || currentWorker,
        }
      }

      return nextData
    })
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
        let autoWorker = prev[stepId]?.worker || ''
        if (!autoWorker && statusVal !== '未') {
          if (stepId === 'work_execution' || stepId === 'work_schedule' || stepId === 'schedule_confirmed') {
            autoWorker = currentUpdater
          }
        }

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
      // チェックリストの変更に合わせてステータスを即座に連動
      setCurrentStatus(suggestedStatus)

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

    // ユーザー選択ステータス、またはチェックリスト進捗から高い方を採用
    const selectedRank = getStatusRank(currentStatus)
    const autoRank = getStatusRank(autoStatus)
    const finalStatus: ProcessLane = selectedRank >= autoRank ? currentStatus : autoStatus

    // finalStatus が「日程確定」の場合は、stepsData.schedule_confirmed が確実に「済」になるよう保証
    const finalStepsData = { ...stepsData }
    if (finalStatus === '日程確定') {
      finalStepsData.schedule_confirmed = {
        status: '済',
        memo: finalStepsData.schedule_confirmed?.memo || '',
        worker: finalStepsData.schedule_confirmed?.worker || updater.trim(),
      }
    }

    const updatedTask: ProcessTask = {
      ...task,
      status: finalStatus,
      updater: updater.trim(),
      updatedAt: nowStr,
      stepsData: finalStepsData,
      assignedTo: updater.trim(),
      signature,
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
          {/* 完了済み案件の請求・売上管理バー */}
          {currentStatus === '請求書送付' && (
            <div className="mb-4 p-3.5 bg-gradient-to-r from-indigo-50 to-emerald-50 border border-indigo-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-600 text-white rounded-lg flex-shrink-0">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-bold text-xs text-indigo-900">作業完了・請求管理</h4>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded border border-emerald-300">
                      完了済み
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    確定請求金額や入金状況の入力、事前見積との乖離（差額）分析を行えます
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsInvoiceModalOpen(true)}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs rounded-lg shadow-sm flex items-center justify-center space-x-1.5 transition-all flex-shrink-0"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>💰 請求・売上を入力</span>
              </button>
            </div>
          )}

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

          {/* 電子サイン（お客様受領署名）セクション */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                  <PenTool className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">お客様サイン（電子署名・受領印）</h4>
                  <p className="text-[11px] text-slate-500">現場でタブレットやスマートフォン上で直接サインをいただけます</p>
                </div>
              </div>

              {signature ? (
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  {signature.startsWith('data:image/') ? (
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      署名受領済
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded flex items-center gap-1">
                      {signature}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsSignatureModalOpen(true)}
                    className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-100 flex items-center gap-1 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    {signature.startsWith('data:image/') ? '再署名' : '手書き署名する'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('サイン・署名設定を解除しますか？')) {
                        setSignature(null)
                      }
                    }}
                    className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                    title="解除する"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                  <button
                    type="button"
                    onClick={() => setIsSignatureModalOpen(true)}
                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-lg shadow-sm flex items-center space-x-1 transition-all"
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    <span>サイン受領</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignature('立ち会い無し（不在回収）')}
                    className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold text-xs rounded-lg transition-colors"
                    title="お客様不在時の回収・立ち会い無し作業"
                  >
                    立ち会い無し
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignature('サイン不要（事前承諾済）')}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-bold text-xs rounded-lg transition-colors"
                    title="電話等で事前確認済みまたはサイン不要案件"
                  >
                    サイン不要
                  </button>
                </div>
              )}
            </div>

            {signature && (
              <div className="mt-2.5 pt-2.5 border-t border-slate-200 flex items-center space-x-3 bg-white p-2 rounded-lg border border-slate-200">
                {signature.startsWith('data:image/') ? (
                  <img
                    src={signature}
                    alt="お客様受領サイン"
                    className="h-12 max-w-[200px] object-contain border border-slate-200 rounded px-2 bg-slate-50"
                  />
                ) : (
                  <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded text-amber-900 font-bold text-xs">
                    {signature}
                  </div>
                )}
                <div className="text-[11px] text-slate-500 space-y-0.5">
                  <p className="font-semibold text-slate-700">
                    {signature.startsWith('data:image/')
                      ? `署名者: ${task.customer || 'ご依頼者'} 様`
                      : `記録: ${signature}`}
                  </p>
                  <p className="text-[10px] text-slate-400">※ 印刷指示書にもこのサイン状況が自動印字されます</p>
                </div>
              </div>
            )}
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
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          <input
                            type="text"
                            list="staffListOptions"
                            value={currentStepData.worker || ''}
                            onChange={(e) => handleStepWorkerChange(stepKey, e.target.value)}
                            placeholder="担当者"
                            className="timeline-worker-input"
                            title="工程担当者名（直接入力または右から選択）"
                          />
                          {profiles.length > 0 && (
                            <select
                              value=""
                              onChange={(e) => {
                                if (e.target.value) handleStepWorkerChange(stepKey, e.target.value)
                              }}
                              className="form-input"
                              style={{
                                padding: '0.2rem 0.35rem',
                                fontSize: '0.72rem',
                                width: 'auto',
                                cursor: 'pointer',
                                borderColor: '#cbd5e1',
                                borderRadius: '0.375rem',
                                height: '26px',
                                background: '#f8fafc',
                              }}
                              title="登録スタッフから担当者を選択"
                            >
                              <option value="">▼選択</option>
                              {profiles.map((p) => (
                                <option key={p.id} value={p.display_name || ''}>
                                  {p.display_name || '名前未設定'}
                                </option>
                              ))}
                            </select>
                          )}
                          {currentStepData.worker && (
                            <button
                              type="button"
                              onClick={() => handleStepWorkerChange(stepKey, '')}
                              style={{
                                background: '#f1f5f9',
                                border: '1px solid #cbd5e1',
                                borderRadius: '0.25rem',
                                color: '#64748b',
                                cursor: 'pointer',
                                fontSize: '0.7rem',
                                padding: '1px 5px',
                                height: '26px',
                                lineHeight: '24px',
                              }}
                              title="担当者をクリア"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    <textarea
                      value={currentStepData.memo || ''}
                      onChange={(e) => handleStepMemoChange(stepKey, e.target.value)}
                      placeholder="伝言・メモを追加..."
                      className="timeline-input"
                    />

                    {/* 見積実施・見積調整など見積関連ステップ時に「カメラ撮影・概算見積作成」ボタンを表示 (完了案件時は非表示) */}
                    {currentStatus !== '請求書送付' &&
                      (step.id === 'estimate_do' || step.id === 'estimate_schedule' || step.id === 'estimate_submit' || step.id === 'reception') &&
                      onOpenQuoteWithData && (
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

                    {/* 請求書送付ステップ時に「請求・売上入力」ボタンを表示 */}
                    {step.id === 'invoice_sent' && (
                      <div className="mt-2 pt-2 border-t border-indigo-200/60 flex items-center justify-between">
                        <span className="text-[11px] text-indigo-800 font-semibold flex items-center gap-1">
                          <Receipt className="w-3.5 h-3.5 text-indigo-600" />
                          確定請求金額・入金状況の入力 & 乖離分析
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsInvoiceModalOpen(true)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs rounded-lg shadow-sm flex items-center space-x-1.5 transition-all"
                        >
                          <Receipt className="w-4 h-4" />
                          <span>請求・売上内容を入力</span>
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

          {currentStatus === '請求書送付' ? (
            <button
              type="button"
              onClick={() => setIsInvoiceModalOpen(true)}
              className="btn-secondary"
              style={{ background: '#4f46e5', color: 'white', borderColor: '#4f46e5', fontWeight: 'bold' }}
            >
              💰 請求・売上入力
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onPrint({ ...task, status: currentStatus, updater, stepsData, signature })}
              className="btn-secondary"
              style={{ background: '#0284c7', color: 'white', borderColor: '#0284c7' }}
            >
              🖨️ 指示書を印刷
            </button>
          )}

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

      {/* 電子サイン受領モーダル */}
      <SignaturePadModal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        onSave={(dataUrl) => {
          setSignature(dataUrl)
        }}
        customerName={task.customer}
        existingSignature={signature}
      />

      {/* 完了済み案件の請求・売上確定モーダル */}
      <InvoiceModal
        job={
          task
            ? {
                id: task.id,
                customer_id: '',
                title: task.taskType,
                status: 'billed',
                notes: task.stepsData ? JSON.stringify(task.stepsData) : null,
                created_at: task.receptionDate,
                customers: {
                  name: task.customer,
                  phone: task.tel,
                  address: task.address,
                },
              }
            : null
        }
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        onSuccess={() => {
          setIsInvoiceModalOpen(false)
        }}
      />
    </div>
  )
}
