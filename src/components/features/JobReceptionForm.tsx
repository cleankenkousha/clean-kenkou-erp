import React, { useState } from 'react'
import { Search, MapPin, Tag, Box, Calendar, Sparkles, Check, Phone } from 'lucide-react'
import { Input, Button } from '../ui'

export const JobReceptionForm: React.FC = () => {
  const [customerInfo, setCustomerInfo] = useState('')
  const [address, setAddress] = useState('')
  const [wasteType, setWasteType] = useState('')
  const [estimatedAmount, setEstimatedAmount] = useState('')
  const [preferredDate, setPreferredDate] = useState('')
  const [isSaved, setIsSaved] = useState(false)

  // クイック選択タグ
  const quickWasteTypes = ['段ボール・古紙', '粗大ゴミ', '廃プラスチック', '金属屑', '家電製品']
  const quickAmounts = ['軽トラ 1台分', '2tトラック 1台分', 'パレット 2箱', '袋詰 数個']
  const quickDates = ['本日中', '明日午前', '明後日', '来週月曜']

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaved(true)
    setTimeout(() => {
      setIsSaved(false)
    }, 3000)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-2xl mx-auto bg-white p-6 md:p-8 rounded-xl border border-border shadow-sm space-y-6"
    >
      {/* フォームサブヘッダー / 電話受付スピード通知 */}
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
          <span>案件を一時保存しました（ダッシュボードに反映完了）。</span>
        </div>
      )}

      {/* 1. 顧客名 / 電話番号 (スマート検索) */}
      <div className="space-y-2">
        <Input
          label="顧客名 / 電話番号"
          requiredMark
          placeholder="例: 096-xxx-xxxx または 株式会社山鹿商事"
          value={customerInfo}
          onChange={(e) => setCustomerInfo(e.target.value)}
          helperText="電話番号を入力すると既存顧客が自動検索されます"
        />
        {/* サジェスト用クイック選択ヒント */}
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
          label="回収場所（住所）"
          requiredMark
          placeholder="例: 熊本県山鹿市山鹿1000番地 本社ビル裏手"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
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
      </div>

      {/* 3. 廃棄物の種類 (品目) */}
      <div className="space-y-2">
        <Input
          label="廃棄物の種類（品目）"
          requiredMark
          placeholder="例: 段ボール、粗大ゴミ、不要オフィスチェア"
          value={wasteType}
          onChange={(e) => setWasteType(e.target.value)}
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
          label="概算の量"
          requiredMark
          placeholder="例: 軽トラ1台分、2tトラック半載"
          value={estimatedAmount}
          onChange={(e) => setEstimatedAmount(e.target.value)}
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
          label="希望日時"
          requiredMark
          placeholder="例: 本日 15:00以降、明日午前中"
          value={preferredDate}
          onChange={(e) => setPreferredDate(e.target.value)}
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
          <span>一時保存後、担当者が自動で配車調整へ回します</span>
        </div>

        <Button type="submit" size="lg" className="px-6">
          受付を確定して一時保存
        </Button>
      </div>
    </form>
  )
}
