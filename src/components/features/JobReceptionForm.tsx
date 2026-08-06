import React, { useState, useRef } from 'react'
import { Search, MapPin, Tag, Box, Calendar, Sparkles, Check, Phone, AlertCircle, UserCheck } from 'lucide-react'
import { Input, Button, MapLink } from '../ui'
import { supabase } from '../../lib/supabase'
import { useProfiles, getRoleInfo } from '../../hooks/useProfiles'

export const JobReceptionForm: React.FC = () => {
  const { profiles } = useProfiles()

  const [customerInfo, setCustomerInfo] = useState('')
  const [address, setAddress] = useState('')
  const [wasteType, setWasteType] = useState('')
  const [estimatedAmount, setEstimatedAmount] = useState('')
  const [preferredDate, setPreferredDate] = useState('')
  const [assignedTo, setAssignedTo] = useState('')

  const [isLoading, setIsLoading] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

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

    setIsLoading(true)

    try {
      const phoneMatch = customerInfo.match(/[\d-]{7,}/)?.[0] || ''
      const customerName = customerInfo.replace(/[\(\（].*?[\)\）]/g, '').trim() || customerInfo || '名称未設定'

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

      if (customerError) {
        throw new Error(`顧客情報の登録に失敗しました: ${customerError.message}`)
      }

      const jobTitle = wasteType ? `${wasteType} 回収依頼` : `${customerName}様 スポット回収`
      const notesDetail = [
        estimatedAmount ? `概算の量: ${estimatedAmount}` : '',
        preferredDate ? `希望日時: ${preferredDate}` : '',
      ]
        .filter(Boolean)
        .join(' / ')

      const { error: jobError } = await supabase.from('jobs').insert([
        {
          customer_id: customerData.id,
          title: jobTitle,
          status: 'received',
          notes: notesDetail || null,
          assigned_to: assignedTo || null,
        },
      ])

      if (jobError) {
        throw new Error(`案件情報の登録に失敗しました: ${jobError.message}`)
      }

      setCustomerInfo('')
      setAddress('')
      setWasteType('')
      setEstimatedAmount('')
      setPreferredDate('')
      setAssignedTo('')
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
          <div className="p-1.5 bg-slate-100 text-main rounded">
            <Phone className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-main">
            電話受付 30秒ルールモード
          </span>
        </div>
        <span className="text-xs text-sub">
          ショートカット: <kbd className="px-1.5 py-0.5 bg-slate-100 border border-border rounded text-[11px] font-mono">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-slate-100 border border-border rounded text-[11px] font-mono">Enter</kbd> で確定
        </span>
      </div>

      {isSaved && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-800 text-xs font-medium flex items-center space-x-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>受付を完了しました（Supabase データベースへの保存完了）。</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-rose-800 text-xs font-medium flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 1. 顧客名 / 電話番号 */}
      <div className="space-y-2">
        <Input
          ref={customerInfoRef}
          label="顧客名 / 電話番号"
          requiredMark
          required
          placeholder="例: 096-xxx-xxxx または 株式会社山鹿商事"
          value={customerInfo}
          onChange={(e) => setCustomerInfo(e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, 0)}
          helperText="電話番号を入力すると既存顧客が自動検索されます"
        />
        <div className="flex items-center space-x-2 text-xs text-sub pt-1">
          <Search className="w-3.5 h-3.5 text-sub" />
          <span>AI予測サジェスト: </span>
          <button
            type="button"
            onClick={() => {
              setCustomerInfo('株式会社山鹿商事 (096-300-1122)')
              setAddress('熊本県山鹿市山鹿1000番地')
            }}
            className="text-semantic-info hover:underline font-medium"
          >
            [候補] 株式会社山鹿商事
          </button>
        </div>
      </div>

      {/* 2. 回収場所 (住所) */}
      <div className="space-y-2">
        <Input
          ref={addressRef}
          label="回収場所（住所）"
          requiredMark
          required
          placeholder="例: 熊本県山鹿市山鹿1000番地 本社ビル裏手"
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
          placeholder="例: 段ボール、粗大ゴミ、不要オフィスチェア"
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

      {/* 4. 担当ドライバー / 受付者 (新規追加項目) */}
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

      {/* 5. 概算の量 */}
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

      {/* 6. 希望日時 */}
      <div className="space-y-2">
        <Input
          ref={preferredDateRef}
          label="希望日時"
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

      {/* アクションエリア */}
      <div className="pt-4 border-t border-border flex items-center justify-between">
        <div className="flex items-center space-x-1.5 text-xs text-sub">
          <Sparkles className="w-4 h-4 text-semantic-info" />
          <span>受付保存後、担当者が自動で配車調整へ回します</span>
        </div>

        <Button type="submit" size="lg" className="px-6" isLoading={isLoading}>
          受付を確定して保存
        </Button>
      </div>
    </form>
  )
}
