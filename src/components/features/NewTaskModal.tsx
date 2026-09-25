import React, { useState, useMemo, useRef, useEffect } from 'react'
import { Calendar, Clock, User, Phone, MapPin, CalendarCheck, Check } from 'lucide-react'
import { ProcessTask } from './KanbanBoard'
import { useProfiles } from '../../hooks/useProfiles'
import { useCustomers, CustomerWithJobCount } from '../../hooks/useCustomers'

export interface ReceptionScheduleParams {
  enabled: boolean
  salesStaffId: string
  date: string
  startHour: string
  endHour: string
  title?: string
  notes?: string
}

export interface NewTaskSubmissionData extends Omit<ProcessTask, 'id' | 'updatedAt'> {
  scheduleParams?: ReceptionScheduleParams
}

interface NewTaskModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (newTask: NewTaskSubmissionData, shouldPrint?: boolean) => void
}

export const NewTaskModal: React.FC<NewTaskModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const { profiles } = useProfiles()
  const { customers } = useCustomers()

  // 基本入力
  const [customer, setCustomer] = useState('')
  const [tel, setTel] = useState('')
  const [address, setAddress] = useState('')
  const [taskType, setTaskType] = useState('粗大ごみ回収')
  const [updater, setUpdater] = useState('')

  // 顧客サジェスト関連
  const [isSuggestOpen, setIsSuggestOpen] = useState(false)
  const suggestRef = useRef<HTMLDivElement>(null)

  // 営業スケジュール連動オプション
  const [syncSchedule, setSyncSchedule] = useState(false)
  const [selectedSalesStaff, setSelectedSalesStaff] = useState('')
  const [visitDate, setVisitDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [startHour, setStartHour] = useState('10:00')
  const [endHour, setEndHour] = useState('11:00')
  const [scheduleNotes, setScheduleNotes] = useState('')

  // 営業担当スタッフ一覧
  const salesProfiles = useMemo(() => {
    return profiles.filter((p) => p.role === 'sales')
  }, [profiles])

  // 初期営業スタッフ選択
  useEffect(() => {
    if (!selectedSalesStaff && salesProfiles.length > 0) {
      setSelectedSalesStaff(salesProfiles[0].id)
    }
  }, [salesProfiles, selectedSalesStaff])

  // 既存顧客検索サジェスト
  const matchedCustomers = useMemo(() => {
    if (!customer.trim()) return []
    const q = customer.trim().toLowerCase()
    return customers
      .filter((c) => c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q)))
      .slice(0, 5)
  }, [customers, customer])

  // 顧客選択時の自動補完
  const handleSelectCustomer = (selected: CustomerWithJobCount) => {
    setCustomer(selected.name)
    if (selected.phone) setTel(selected.phone)
    if (selected.address) setAddress(selected.address)
    setIsSuggestOpen(false)
  }

  // 外側クリックでサジェストを閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestRef.current && !suggestRef.current.contains(e.target as Node)) {
        setIsSuggestOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!isOpen) return null

  const handleFormSubmit = (shouldPrint = false) => {
    if (!customer.trim() || !taskType.trim() || !updater.trim()) {
      alert('顧客名、案件内容、担当者名（入力者名）は必須です。')
      return
    }

    if (syncSchedule && !selectedSalesStaff) {
      alert('スケジュール連動を行う場合は、担当営業を選択してください。')
      return
    }

    const today = new Date()
    const todayStr = `${today.getMonth() + 1}/${today.getDate()}`

    const submissionData: NewTaskSubmissionData = {
      customer: customer.trim(),
      tel: tel.trim(),
      address: address.trim(),
      taskType: taskType.trim(),
      status: syncSchedule ? '顧客検討' : '未着手',
      receptionDate: todayStr,
      updater: updater.trim(),
      isArchived: false,
      stepsData: {},
    }

    if (syncSchedule && selectedSalesStaff) {
      submissionData.scheduleParams = {
        enabled: true,
        salesStaffId: selectedSalesStaff,
        date: visitDate,
        startHour,
        endHour,
        title: `${customer.trim()}様 見積訪問`,
        notes: scheduleNotes.trim() || taskType.trim(),
      }
    }

    onSubmit(submissionData, shouldPrint)

    // リセット
    setCustomer('')
    setTel('')
    setAddress('')
    setTaskType('粗大ごみ回収')
    setUpdater('')
    setSyncSchedule(false)
    setScheduleNotes('')
    onClose()
  }

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-blue-600 text-white rounded-lg">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 id="newTaskModalTitle" className="text-base font-bold text-main">
                新規受付の入力
              </h2>
              <p className="text-[11px] text-sub">
                電話受付の入力と同時に、営業マンのスケジュール枠も自動確保できます
              </p>
            </div>
          </div>
          <button type="button" className="close-btn" onClick={onClose} aria-label="閉じる">
            &times;
          </button>
        </div>

        <div className="modal-body space-y-4">
          <form className="form-layout space-y-3" onSubmit={(e) => e.preventDefault()}>
            {/* 1. 顧客名（オートコンプリート付き） */}
            <div className="form-group relative" ref={suggestRef}>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="newCustomer" className="text-xs font-bold text-main flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span>顧客名</span> <span className="required text-rose-500">*</span>
                </label>
                {customers.length > 0 && (
                  <span className="text-[10px] text-slate-400">
                    既存顧客なら入力すると住所・TELが自動補完されます
                  </span>
                )}
              </div>
              <input
                type="text"
                id="newCustomer"
                required
                autoComplete="off"
                className="form-input text-xs font-semibold"
                placeholder="例: 山田 太郎 様"
                value={customer}
                onChange={(e) => {
                  setCustomer(e.target.value)
                  setIsSuggestOpen(true)
                }}
                onFocus={() => setIsSuggestOpen(true)}
              />

              {/* 顧客サジェストドロップダウン */}
              {isSuggestOpen && matchedCustomers.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-300 rounded-lg shadow-xl z-50 overflow-hidden divide-y divide-slate-100">
                  <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-500 flex items-center justify-between">
                    <span>登録済み顧客から補完（タップして反映）:</span>
                    <span>{matchedCustomers.length}件</span>
                  </div>
                  {matchedCustomers.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => handleSelectCustomer(c)}
                      className="p-2.5 hover:bg-blue-50 cursor-pointer transition-colors text-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 text-blue-600" />
                          <span>{c.name} 様</span>
                        </div>
                        {c.address && (
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span className="truncate max-w-[320px]">{c.address}</span>
                          </div>
                        )}
                      </div>
                      {c.phone && (
                        <div className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-emerald-600" />
                          <span>{c.phone}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. 連絡先 & 案件内容 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="form-group">
                <label htmlFor="newTel" className="text-xs font-bold text-main flex items-center gap-1 mb-1">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>連絡先 (TEL)</span>
                </label>
                <input
                  type="tel"
                  id="newTel"
                  className="form-input text-xs"
                  placeholder="例: 090-1234-5678"
                  value={tel}
                  onChange={(e) => setTel(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="newTaskType" className="text-xs font-bold text-main mb-1 block">
                  案件内容・品目 <span className="required text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  id="newTaskType"
                  required
                  className="form-input text-xs"
                  placeholder="例: 粗大ごみ回収、タンス2点、遺品整理"
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value)}
                />
              </div>
            </div>

            {/* 3. 住所 */}
            <div className="form-group">
              <label htmlFor="newAddress" className="text-xs font-bold text-main flex items-center gap-1 mb-1">
                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                <span>訪問先住所 (Googleマップ連携用)</span>
              </label>
              <input
                type="text"
                id="newAddress"
                className="form-input text-xs"
                placeholder="例: 熊本県山鹿市鹿校通2-1-10"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            {/* 4. 入力者名 */}
            <div className="form-group">
              <label htmlFor="newUpdater" className="text-xs font-bold text-main mb-1 block">
                受付・入力担当者名 <span className="required text-rose-500">*</span>
              </label>
              <input
                type="text"
                id="newUpdater"
                required
                className="form-input text-xs"
                placeholder="例: 廣田、原口、事務員名"
                value={updater}
                onChange={(e) => setUpdater(e.target.value)}
              />
            </div>

            {/* 🌟 5. 営業マンスケジュールへの自動連動オプション（目玉機能） */}
            <div
              className={`p-3.5 rounded-xl border transition-all ${
                syncSchedule
                  ? 'bg-amber-50/70 border-amber-300 shadow-sm'
                  : 'bg-slate-50 border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={syncSchedule}
                    onChange={(e) => setSyncSchedule(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-amber-600" />
                      <span>📅 営業マンのスケジュール枠に自動登録する</span>
                      <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded font-bold">
                        おすすめ
                      </span>
                    </span>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      受付と同時に営業マンのカレンダー枠を確保し、現場ナビやAI写真見積がスマホですぐ使えます
                    </p>
                  </div>
                </label>
              </div>

              {/* スケジュール登録詳細入力欄 */}
              {syncSchedule && (
                <div className="mt-3 pt-3 border-t border-amber-200/70 space-y-2.5 text-xs animate-in fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-bold text-slate-800 mb-1">
                        担当営業マン <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={selectedSalesStaff}
                        onChange={(e) => setSelectedSalesStaff(e.target.value)}
                        className="w-full p-2 bg-white border border-amber-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500"
                        required={syncSchedule}
                      >
                        <option value="">担当営業を選択...</option>
                        {salesProfiles.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.display_name} (営業担当)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-800 mb-1">
                        訪問予定日 <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={visitDate}
                        onChange={(e) => setVisitDate(e.target.value)}
                        className="w-full p-2 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-amber-500"
                        required={syncSchedule}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-bold text-slate-800 mb-1 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>開始時刻</span>
                      </label>
                      <input
                        type="time"
                        value={startHour}
                        onChange={(e) => setStartHour(e.target.value)}
                        className="w-full p-2 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-amber-500"
                        required={syncSchedule}
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-800 mb-1 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>終了時刻</span>
                      </label>
                      <input
                        type="time"
                        value={endHour}
                        onChange={(e) => setEndHour(e.target.value)}
                        className="w-full p-2 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-amber-500"
                        required={syncSchedule}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      訪問時伝言・品目メモ（任意）
                    </label>
                    <input
                      type="text"
                      placeholder="例: タンスは2階から搬出、駐車スペースあり"
                      value={scheduleNotes}
                      onChange={(e) => setScheduleNotes(e.target.value)}
                      className="w-full p-2 bg-white border border-amber-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </form>
        </div>

        <div className="modal-footer flex items-center justify-between border-t border-border pt-3">
          <button type="button" className="btn-secondary text-xs" onClick={onClose}>
            キャンセル
          </button>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              className="btn-secondary text-xs"
              style={{ background: '#0284c7', color: 'white', borderColor: '#0284c7' }}
              onClick={() => handleFormSubmit(true)}
            >
              🖨️ 登録して指示書を印刷
            </button>
            <button
              type="button"
              className="btn-primary text-xs font-bold bg-slate-900 hover:bg-slate-800"
              onClick={() => handleFormSubmit(false)}
            >
              登録する
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
