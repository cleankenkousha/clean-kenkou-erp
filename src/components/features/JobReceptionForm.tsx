import React, { useState, useRef, useMemo, useEffect } from 'react'
import {
  MapPin,
  Tag,
  Box,
  Calendar,
  Sparkles,
  Check,
  Phone,
  AlertCircle,
  UserCheck,
  Clock,
  CalendarCheck,
} from 'lucide-react'
import { Input, Button, MapLink } from '../ui'
import { supabase } from '../../lib/supabase'
import { useProfiles, getRoleInfo } from '../../hooks/useProfiles'
import { useCustomers } from '../../hooks/useCustomers'

export const JobReceptionForm: React.FC = () => {
  const { profiles } = useProfiles()
  const { customers } = useCustomers()

  const [customerInfo, setCustomerInfo] = useState('')
  const [address, setAddress] = useState('')
  const [wasteType, setWasteType] = useState('')
  const [estimatedAmount, setEstimatedAmount] = useState('')
  const [preferredDate, setPreferredDate] = useState('')
  const [assignedTo, setAssignedTo] = useState('')

  // 営業マンスケジュール連携
  const [syncSchedule, setSyncSchedule] = useState(false)
  const [selectedSalesStaff, setSelectedSalesStaff] = useState('')
  const [visitDate, setVisitDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [startHour, setStartHour] = useState('10:00')
  const [endHour, setEndHour] = useState('11:00')
  const [scheduleNotes, setScheduleNotes] = useState('')

  const [isLoading, setIsLoading] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // 顧客サジェスト
  const [isSuggestOpen, setIsSuggestOpen] = useState(false)
  const suggestRef = useRef<HTMLDivElement>(null)

  // 入力フィールドの参照 (Ref)
  const customerInfoRef = useRef<HTMLInputElement>(null)
  const addressRef = useRef<HTMLInputElement>(null)
  const wasteTypeRef = useRef<HTMLInputElement>(null)
  const estimatedAmountRef = useRef<HTMLInputElement>(null)
  const preferredDateRef = useRef<HTMLInputElement>(null)

  const inputRefs = [customerInfoRef, addressRef, wasteTypeRef, estimatedAmountRef, preferredDateRef]

  // クイック選択タグ
  const quickWasteTypes = ['段ボール・古紙', '粗大ゴミ', '廃プラスチック', '金属屑', '家電製品']
  const quickAmounts = ['軽トラ 1台分', '2tトラック 1台分', 'パレット 2箱', '袋詰 数個']
  const quickDates = ['本日中', '明日午前', '明後日', '来週月曜']

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
    if (!customerInfo.trim()) return []
    const q = customerInfo.trim().toLowerCase()
    return customers
      .filter((c) => c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q)))
      .slice(0, 5)
  }, [customers, customerInfo])

  // 顧客候補選択時の自動補完
  const handleSelectCustomer = (selected: any) => {
    setCustomerInfo(selected.phone ? `${selected.name} (${selected.phone})` : selected.name)
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

  // キーダウンハンドラー (Enterでのフォーカス移動＆Ctrl+Enterでの送信)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, currentIndex: number) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      e.currentTarget.form?.requestSubmit()
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      const nextIndex = currentIndex + 1
      if (nextIndex < inputRefs.length) {
        inputRefs[nextIndex].current?.focus()
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setIsSaved(false)

    if (!customerInfo.trim()) {
      setErrorMessage('「顧客名 / 電話番号」を入力してください。')
      customerInfoRef.current?.focus()
      return
    }
    if (!address.trim()) {
      setErrorMessage('「回収場所（住所）」を入力してください。')
      addressRef.current?.focus()
      return
    }
    if (!wasteType.trim()) {
      setErrorMessage('「廃棄物の種類（品目）」を入力してください。')
      wasteTypeRef.current?.focus()
      return
    }

    if (syncSchedule && !selectedSalesStaff) {
      setErrorMessage('営業スケジュール連動を行う場合は、担当営業を選択してください。')
      return
    }

    setIsLoading(true)

    try {
      const phoneMatch = customerInfo.match(/[\d-]{7,}/)?.[0] || ''
      const customerName = customerInfo.replace(/[\(\（].*?[\)\）]/g, '').trim() || customerInfo || '名称未設定'

      // 既存顧客チェック
      let customerId: string | null = null
      let query = supabase.from('customers').select('id, address, phone')
      if (phoneMatch) {
        query = query.eq('phone', phoneMatch)
      } else {
        query = query.eq('name', customerName)
      }
      const { data: existingCustomer } = await query.maybeSingle()

      if (existingCustomer?.id) {
        customerId = existingCustomer.id
        if (address.trim() && !existingCustomer.address) {
          await supabase.from('customers').update({ address: address.trim() }).eq('id', customerId)
        }
      } else {
        const { data: customerData, error: customerError } = await supabase
          .from('customers')
          .insert([
            {
              name: customerName,
              phone: phoneMatch || null,
              address: address || null,
            },
          ])
          .select()
          .single()

        if (customerError || !customerData) {
          throw new Error(`顧客情報の登録に失敗しました: ${customerError?.message || '不明'}`)
        }
        customerId = customerData.id
      }

      const jobTitle = wasteType ? `${wasteType} 回収依頼` : `${customerName}様 スポット回収`
      const notesDetail = [
        estimatedAmount ? `概算の量: ${estimatedAmount}` : '',
        preferredDate ? `希望日時: ${preferredDate}` : '',
        scheduleNotes ? `特記事項: ${scheduleNotes}` : '',
      ]
        .filter(Boolean)
        .join(' / ')

      // 案件のステータスと担当者
      const finalAssignedTo = syncSchedule && selectedSalesStaff ? selectedSalesStaff : assignedTo || null
      const finalStatus = syncSchedule ? 'quoting' : 'received'

      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .insert([
          {
            customer_id: customerId,
            title: jobTitle,
            status: finalStatus,
            scheduled_date: syncSchedule ? visitDate : null,
            notes: notesDetail || null,
            assigned_to: finalAssignedTo,
          },
        ])
        .select()
        .single()

      if (jobError) {
        throw new Error(`案件情報の登録に失敗しました: ${jobError.message}`)
      }

      // 営業マンのスケジュール（staff_schedules）への自動登録
      if (syncSchedule && selectedSalesStaff) {
        const startIso = `${visitDate}T${startHour}:00+09:00`
        const endIso = `${visitDate}T${endHour}:00+09:00`
        const scheduleTitle = `${customerName}様 見積訪問`

        const { error: schErr } = await supabase.from('staff_schedules').insert({
          id: crypto.randomUUID(),
          profile_id: selectedSalesStaff,
          job_id: jobData ? jobData.id : null,
          title: scheduleTitle,
          schedule_type: 'appointment',
          start_time: startIso,
          end_time: endIso,
          location: address.trim(),
          customer_name: customerName,
          customer_phone: phoneMatch || '',
          notes: notesDetail || wasteType.trim(),
        })

        if (schErr) {
          console.warn('営業スケジュールへの自動連携 notice:', schErr.message)
        }
      }

      // 入力クリア
      setCustomerInfo('')
      setAddress('')
      setWasteType('')
      setEstimatedAmount('')
      setPreferredDate('')
      setAssignedTo('')
      setSyncSchedule(false)
      setScheduleNotes('')
      setIsSaved(true)

      customerInfoRef.current?.focus()

      setTimeout(() => {
        setIsSaved(false)
      }, 5000)
    } catch (err: any) {
      console.error('受付登録エラー:', err)
      setErrorMessage(err.message || 'データ保存中にエラーが発生しました')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-2xl mx-auto bg-white p-6 md:p-8 rounded-xl border border-border shadow-sm space-y-6"
    >
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-slate-900 text-white rounded">
            <Phone className="w-4 h-4" />
          </div>
          <div>
            <span className="text-sm font-bold text-main block">
              電話受付 30秒ルールモード
            </span>
            <span className="text-[11px] text-sub">
              入力と同時に営業マンのスケジュールへも即座に枠を確保できます
            </span>
          </div>
        </div>
        <span className="text-xs text-sub hidden sm:inline-block">
          ショートカット: <kbd className="px-1.5 py-0.5 bg-slate-100 border border-border rounded text-[11px] font-mono">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-slate-100 border border-border rounded text-[11px] font-mono">Enter</kbd> で確定
        </span>
      </div>

      {isSaved && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-800 text-xs font-medium flex items-center space-x-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>
            受付を完了しました。案件の登録{syncSchedule ? 'および営業スケジュールへの自動連携' : ''}が完了しました。
          </span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-rose-800 text-xs font-medium flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 1. 顧客名 / 電話番号（オートコンプリート付き） */}
      <div className="space-y-2 relative" ref={suggestRef}>
        <Input
          ref={customerInfoRef}
          label="顧客名 / 電話番号"
          requiredMark
          required
          placeholder="例: 096-xxx-xxxx または 山田 太郎"
          value={customerInfo}
          onChange={(e) => {
            setCustomerInfo(e.target.value)
            setIsSuggestOpen(true)
          }}
          onFocus={() => setIsSuggestOpen(true)}
          onKeyDown={(e) => handleKeyDown(e, 0)}
          helperText="電話番号またはお名前を入力すると、登録済み顧客から自動検索・補完できます"
        />

        {/* 顧客サジェスト一覧 */}
        {isSuggestOpen && matchedCustomers.length > 0 && (
          <div className="absolute left-0 right-0 top-[70px] bg-white border border-slate-300 rounded-lg shadow-xl z-50 overflow-hidden divide-y divide-slate-100">
            <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-500 flex items-center justify-between">
              <span>登録済み顧客から補完（タップで住所・TEL反映）:</span>
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

      {/* 2. 回収場所 (住所) */}
      <div className="space-y-2">
        <Input
          ref={addressRef}
          label="回収場所（住所）"
          requiredMark
          required
          placeholder="例: 熊本県山鹿市鹿校通2-1-10"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, 1)}
        />
        <div className="flex items-center space-x-2 text-xs text-sub">
          <MapPin className="w-3.5 h-3.5 text-sub" />
          <span>クイック入力: </span>
          <button
            type="button"
            onClick={() => setAddress('熊本県山鹿市山鹿1000番地')}
            className="hover:text-main underline"
          >
            山鹿市山鹿
          </button>
          <span>/</span>
          <button
            type="button"
            onClick={() => setAddress('熊本県山鹿市鹿校通')}
            className="hover:text-main underline"
          >
            鹿校通
          </button>
          <span>/</span>
          <button
            type="button"
            onClick={() => setAddress('熊本県山鹿市鹿本町')}
            className="hover:text-main underline"
          >
            鹿本町
          </button>
        </div>

        {/* Googleマップ連携ボタン */}
        <MapLink address={address} variant="buttons" />
      </div>

      {/* 3. 廃棄物の種類 (品目) */}
      <div className="space-y-2">
        <Input
          ref={wasteTypeRef}
          label="廃棄物の種類（品目）"
          requiredMark
          required
          placeholder="例: 段ボール、粗大ゴミ、不要オフィスチェア、タンス2点"
          value={wasteType}
          onChange={(e) => setWasteType(e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, 2)}
        />
        <div className="flex flex-wrap gap-1.5 pt-1">
          <span className="text-xs text-sub flex items-center mr-1">
            <Tag className="w-3.5 h-3.5 mr-1" />
            定型品目:
          </span>
          {quickWasteTypes.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() =>
                setWasteType((prev) => (prev ? `${prev}, ${type}` : type))
              }
              className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-main rounded border border-border transition-colors"
            >
              + {type}
            </button>
          ))}
        </div>
      </div>

      {/* 4. 概算の量 */}
      <div className="space-y-2">
        <Input
          ref={estimatedAmountRef}
          label="概算の量"
          placeholder="例: 軽トラ1台分、2tトラック半載"
          value={estimatedAmount}
          onChange={(e) => setEstimatedAmount(e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, 3)}
        />
        <div className="flex flex-wrap gap-1.5 pt-1">
          <span className="text-xs text-sub flex items-center mr-1">
            <Box className="w-3.5 h-3.5 mr-1" />
            目安:
          </span>
          {quickAmounts.map((amt) => (
            <button
              key={amt}
              type="button"
              onClick={() => setEstimatedAmount(amt)}
              className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-main rounded border border-border transition-colors"
            >
              {amt}
            </button>
          ))}
        </div>
      </div>

      {/* 5. 希望日時 */}
      <div className="space-y-2">
        <Input
          ref={preferredDateRef}
          label="希望日時（受付メモ）"
          placeholder="例: 本日 15:00以降、明日午前中"
          value={preferredDate}
          onChange={(e) => setPreferredDate(e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, 4)}
        />
        <div className="flex flex-wrap gap-1.5 pt-1">
          <span className="text-xs text-sub flex items-center mr-1">
            <Calendar className="w-3.5 h-3.5 mr-1" />
            クイック日時:
          </span>
          {quickDates.map((dateStr) => (
            <button
              key={dateStr}
              type="button"
              onClick={() => setPreferredDate(dateStr)}
              className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-main rounded border border-border transition-colors"
            >
              {dateStr}
            </button>
          ))}
        </div>
      </div>

      {/* 🌟 6. 営業マンスケジュール枠への自動連動エリア */}
      <div
        className={`p-4 rounded-xl border transition-all ${
          syncSchedule
            ? 'bg-amber-50/80 border-amber-300 shadow-sm'
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
                <CalendarCheck className="w-4 h-4 text-amber-600" />
                <span>📅 営業マンのスケジュール枠に自動登録する</span>
                <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded font-bold">
                  おすすめ
                </span>
              </span>
              <p className="text-[11px] text-slate-600 mt-0.5">
                受付と同時に営業マンのカレンダー枠を確保し、現場ナビやAI写真見積がスマホで直結起動できます
              </p>
            </div>
          </label>
        </div>

        {syncSchedule && (
          <div className="mt-3 pt-3 border-t border-amber-200/70 space-y-3 text-xs animate-in fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  担当営業マン <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedSalesStaff}
                  onChange={(e) => setSelectedSalesStaff(e.target.value)}
                  className="w-full p-2.5 bg-white border border-amber-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500"
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

            <div className="grid grid-cols-2 gap-3">
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
                訪問時メモ・特記事項（任意）
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

      {/* 7. 通常の担当スタッフ設定（スケジュール未連動時） */}
      {!syncSchedule && (
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-main flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-slate-700" />
            <span>担当スタッフ（作業ドライバー / 受付担当）</span>
          </label>
          <select
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            className="w-full p-2.5 bg-white border border-border rounded-lg text-xs font-medium text-main focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            <option value="">-- 未割当（担当者を選択） --</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name || '名前未設定'} ({getRoleInfo(p.role).label})
              </option>
            ))}
          </select>
          <p className="text-[11px] text-sub">担当者を設定しておくと配車管理や担当別フィルタリングがスムーズになります</p>
        </div>
      )}

      {/* アクションエリア */}
      <div className="pt-4 border-t border-border flex items-center justify-between">
        <div className="flex items-center space-x-1.5 text-xs text-sub">
          <Sparkles className="w-4 h-4 text-semantic-info" />
          <span>
            {syncSchedule
              ? '受付確定と同時に営業マンのカレンダー枠を確保します'
              : '受付保存後、担当者が自動で配車調整へ回します'}
          </span>
        </div>

        <Button type="submit" size="lg" className="px-6 font-bold" isLoading={isLoading}>
          受付を確定して保存
        </Button>
      </div>
    </form>
  )
}
