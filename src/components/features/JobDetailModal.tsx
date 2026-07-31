import React, { useState, useEffect } from 'react'
import { X, User, MapPin, Phone, FileText, Clock, Save, AlertCircle } from 'lucide-react'
import { Job, JobStatus } from '../../types'
import { Input, Button } from '../ui'

export interface JobDetailModalProps {
  job: Job | null
  onClose: () => void
  onSave?: (jobId: string, updates: Partial<Job>) => Promise<boolean> | void
}

const statusBadgeConfig: Record<JobStatus, { label: string; style: string }> = {
  received: { label: '新規受付済', style: 'bg-amber-100 text-amber-800 border-amber-200' },
  quoting: { label: '見積中', style: 'bg-amber-100 text-amber-800 border-amber-200' },
  pending: { label: '保留中', style: 'bg-amber-100 text-amber-800 border-amber-200' },
  arranged: { label: '手配済 / 進行中', style: 'bg-blue-100 text-blue-800 border-blue-200' },
  collected: { label: '回収完了', style: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  billed: { label: '請求済', style: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  completed: { label: '完了済', style: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  cancelled: { label: 'キャンセル', style: 'bg-slate-100 text-slate-600 border-slate-200' },
}

// 日付文字列を YYYY-MM-DD 形式に安全にパースするヘルパー関数
const formatToDateInput = (dateVal?: string | null): string => {
  if (!dateVal) return ''
  const trimmed = dateVal.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10)
  }
  const parsed = new Date(trimmed)
  if (!isNaN(parsed.getTime())) {
    const yyyy = parsed.getFullYear()
    const mm = String(parsed.getMonth() + 1).padStart(2, '0')
    const dd = String(parsed.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }
  return ''
}

// メモ欄から [担当ドライバー: 名前] を抽出するヘルパー関数
const extractDriverFromNotes = (notesText?: string | null): string => {
  if (!notesText) return ''
  const match = notesText.match(/\[担当ドライバー:\s*([^\]\n]+)\]/)
  return match ? match[1].trim() : ''
}

export const JobDetailModal: React.FC<JobDetailModalProps> = ({ job, onClose, onSave }) => {
  const [title, setTitle] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [notes, setNotes] = useState('')

  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // モーダルオープン時・job変更時にフォーム状態を同期
  useEffect(() => {
    if (job) {
      setTitle(job.title || '')
      setScheduledDate(formatToDateInput(job.scheduled_date))
      const driverInNotes = extractDriverFromNotes(job.notes)
      setAssignedTo(job.assigned_to || driverInNotes || '')
      setNotes(job.notes || '')
      setSaveError(null)
    }
  }, [job])

  // Esc キーで閉じる処理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!job) return null

  const customerName = job.customers?.name || '（顧客名未設定）'
  const statusInfo = statusBadgeConfig[job.status] || {
    label: job.status,
    style: 'bg-slate-100 text-slate-700 border-slate-200',
  }

  const createdDate = job.created_at
    ? new Date(job.created_at).toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-'

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!job || !onSave) return

    setIsSaving(true)
    setSaveError(null)

    try {
      const assignedToText = assignedTo.trim()
      const isAssignedToUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assignedToText)
      
      const scheduledDateText = scheduledDate.trim()
      let validScheduledDate: string | null = null

      if (scheduledDateText) {
        if (/^\d{4}-\d{2}-\d{2}/.test(scheduledDateText)) {
          validScheduledDate = scheduledDateText.slice(0, 10)
        } else {
          const parsed = new Date(scheduledDateText)
          if (!isNaN(parsed.getTime())) {
            const yyyy = parsed.getFullYear()
            const mm = String(parsed.getMonth() + 1).padStart(2, '0')
            const dd = String(parsed.getDate()).padStart(2, '0')
            validScheduledDate = `${yyyy}-${mm}-${dd}`
          }
        }
      }

      // notes 内の既存の [担当ドライバー: XXX] タグを除去してベースのメモを取得
      let finalNotes = notes.replace(/\[担当ドライバー:\s*[^\]\n]+\]\n?/g, '').trim()

      // 非UUIDテキストの担当ドライバー名が存在する場合、notes の先頭にスマート保持
      if (assignedToText && !isAssignedToUuid) {
        finalNotes = `[担当ドライバー: ${assignedToText}]\n${finalNotes}`.trim()
      }

      // jobs テーブルの更新用安全なペイロード
      const updatesPayload: Partial<Job> = {
        title: title.trim() || job.title,
        scheduled_date: validScheduledDate,
        assigned_to: isAssignedToUuid ? assignedToText : null,
        notes: finalNotes || null,
      }

      const success = await onSave(job.id, updatesPayload)

      if (success !== false) {
        onClose()
      }
    } catch (err: any) {
      console.error('Job update error:', err)
      setSaveError(err.message || '保存中にエラーが発生しました')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <form
        onSubmit={handleFormSubmit}
        className="bg-white rounded-none md:rounded-xl border-0 md:border border-border shadow-2xl w-full h-full md:h-auto md:max-h-[90vh] md:max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* モーダルヘッダー */}
        <div className="p-4 md:p-5 border-b border-border flex items-center justify-between bg-slate-50/70">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs bg-slate-200 px-2 py-0.5 rounded text-slate-700 font-medium">
                ID: {job.id}
              </span>
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${statusInfo.style}`}
              >
                {statusInfo.label}
              </span>
            </div>
            <h2 className="text-base md:text-lg font-bold text-main leading-tight pt-0.5">
              案件詳細の編集・修正
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-md text-sub hover:text-main hover:bg-slate-200 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* モーダルコンテンツ領域 */}
        <div className="p-4 md:p-6 overflow-y-auto space-y-4 md:space-y-5 flex-1">
          {saveError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-rose-800 text-xs font-medium flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          {/* 顧客情報 */}
          <div className="bg-slate-50 p-3.5 md:p-4 rounded-lg border border-border space-y-1.5">
            <div className="flex items-center space-x-2 text-xs font-bold text-sub">
              <User className="w-4 h-4 text-slate-600" />
              <span>顧客情報</span>
            </div>
            <p className="text-base font-bold text-main">{customerName}</p>
            {job.customers?.phone && (
              <div className="flex items-center space-x-1.5 text-xs text-slate-700">
                <Phone className="w-3.5 h-3.5 text-sub" />
                <span>電話番号: {job.customers.phone}</span>
              </div>
            )}
            {job.customers?.address && (
              <div className="flex items-center space-x-1.5 text-xs text-slate-700">
                <MapPin className="w-3.5 h-3.5 text-sub" />
                <span>住所: {job.customers.address}</span>
              </div>
            )}
          </div>

          {/* 1. 案件名 / 品目概要 */}
          <Input
            label="案件名・品目概要"
            requiredMark
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例: 段ボール・粗大ゴミ 回収依頼"
          />

          {/* 2. グリッド: 希望日時 (カレンダーピッカー) & 担当者 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              type="date"
              label="希望日時（回収予定日）"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
            />

            <Input
              label="担当ドライバー・作業員"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              placeholder="例: 佐藤ドライバー"
            />
          </div>

          {/* 受付日時情報 (読み取り専用) */}
          <div className="text-xs text-sub flex items-center space-x-2 pt-1">
            <Clock className="w-3.5 h-3.5" />
            <span>受付登録日時: {createdDate}</span>
          </div>

          {/* 3. ドライバーへの共有メモ (textarea) */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <label className="block text-sm font-medium text-main flex items-center">
              <FileText className="w-4 h-4 mr-1 text-sub" />
              ドライバーへの共有メモ・備考
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="例: 概算量: 軽トラ1台分。現場裏手に駐車スペースあり。エレベーター利用可能。"
              className="w-full bg-white border border-border rounded-md px-3 py-2.5 min-h-[90px] text-xs md:text-sm text-main placeholder-sub focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-all resize-y"
            />
          </div>
        </div>

        {/* モーダルシートフッター (スマホ時タップしやすい min-h-[44px] ボタン) */}
        <div className="p-4 border-t border-border bg-slate-50/50 flex items-center justify-end space-x-3 flex-shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="min-h-[44px] px-4"
          >
            キャンセル
          </Button>
          <Button
            type="submit"
            isLoading={isSaving}
            className="min-h-[44px] px-6 text-sm flex items-center justify-center font-bold"
          >
            <Save className="w-4 h-4 mr-1.5" />
            保存する
          </Button>
        </div>
      </form>
    </div>
  )
}
