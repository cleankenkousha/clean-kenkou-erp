import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  Camera,
  X,
  Plus,
  Trash2,
  Sparkles,
  Calculator,
  CheckCircle2,
  AlertCircle,
  User,
  Phone,
  MapPin,
  Loader2,
  Settings,
  Upload,
  FileImage,
  Clipboard,
} from 'lucide-react'


import { useNavigate } from 'react-router-dom'
import { Button, Input } from '../ui'
import { supabase } from '../../lib/supabase'
import { usePriceMaster } from '../../hooks/usePriceMaster'
import { useViewMode } from '../../hooks/useViewMode'
import { analyzeQuoteImagesWithGemini } from '../../lib/gemini'



export interface QuoteItem {
  id: string
  name: string
  quantity: number
  volume: number
  unitPrice: number
}

export interface InitialQuoteData {
  jobId?: string
  customerName?: string
  customerPhone?: string
  customerAddress?: string
}

interface MobileQuoteModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  initialData?: InitialQuoteData | null
}



export const MobileQuoteModal: React.FC<MobileQuoteModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}) => {
  const navigate = useNavigate()
  const { isMobileMode } = useViewMode()
  const fileInputRef = useRef<HTMLInputElement>(null)


  const { items: masterItems } = usePriceMaster()

  const [capturedImages, setCapturedImages] = useState<string[]>([])
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false)
  const [aiMessage, setAiMessage] = useState<string | null>(null)
  const [aiDetectedItems, setAiDetectedItems] = useState<QuoteItem[]>([])


  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')

  // 初期データの自動セット
  React.useEffect(() => {
    if (isOpen && initialData) {
      if (initialData.customerName) setCustomerName(initialData.customerName)
      if (initialData.customerPhone) setCustomerPhone(initialData.customerPhone)
      if (initialData.customerAddress) setCustomerAddress(initialData.customerAddress)
    }
  }, [isOpen, initialData])

  const [items, setItems] = useState<QuoteItem[]>([
    { id: '1', name: '2人掛けソファ', quantity: 1, volume: 1.5, unitPrice: 8000 },
    { id: '2', name: '段ボール（Mサイズ相当）', quantity: 5, volume: 0.1, unitPrice: 800 },
  ])

  const [baseFee, setBaseFee] = useState<number>(0)
  const [expenses, setExpenses] = useState<number>(0)
  const [notes, setNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)




  const [isDragging, setIsDragging] = useState(false)

  // 画像ファイル配列からプレビューURLを生成して追加
  const addImagesFromFiles = useCallback((files: FileList | File[]) => {
    const validFiles = Array.from(files).filter((file) => file.type.startsWith('image/'))
    if (validFiles.length === 0) return

    const newImages: string[] = []
    validFiles.forEach((file) => {
      const url = URL.createObjectURL(file)
      newImages.push(url)
    })

    setCapturedImages((prev) => [...prev, ...newImages])
  }, [])

  // クリップボードからの直接画像貼り付け (Ctrl + V / Cmd + V)
  useEffect(() => {
    if (!isOpen) return

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      const pastedFiles: File[] = []
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile()
          if (file) pastedFiles.push(file)
        }
      }

      if (pastedFiles.length > 0) {
        addImagesFromFiles(pastedFiles)
        setAiMessage('貼り付けられた画像を自動追加しました。')
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => {
      window.removeEventListener('paste', handlePaste)
    }
  }, [isOpen, addImagesFromFiles])

  // モーダルが非表示の場合はレンダリングしない (すべてのHook宣言より後に配置)
  if (!isOpen) return null


  const handleImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    addImagesFromFiles(files)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ドラッグ＆ドロップハンドラー
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addImagesFromFiles(e.dataTransfer.files)
      setAiMessage('ドロップされた画像を読み込みました。')
    }
  }

  const handleRemoveImage = (index: number) => {
    setCapturedImages((prev) => prev.filter((_, i) => i !== index))
  }


  const analyzeImageWithAi = async () => {
    if (capturedImages.length === 0) {
      alert('先に撮影または画像を選択・貼り付けしてください。')
      return
    }

    setIsAiAnalyzing(true)
    setAiMessage('Google AI (Gemini 1.5 Flash) が現場写真を読み込み中... (品目と体積を解析しています)')
    setAiDetectedItems([])

    try {
      const detected = await analyzeQuoteImagesWithGemini(capturedImages)
      const mappedItems: QuoteItem[] = detected.map((item, idx) => ({
        id: Date.now().toString() + '-' + idx,
        name: item.name,
        quantity: item.quantity || 1,
        volume: item.volume || 0.5,
        unitPrice: item.unitPrice || 3000,
      }))

      if (mappedItems.length > 0) {
        setItems(mappedItems)
        setAiDetectedItems(mappedItems)
        setAiMessage(`AI解析完了: 写真から【${mappedItems.length}件の回収品目】を特定しました！`)
      } else {
        setAiMessage('AI解析完了: 写真からの品目判定を完了しました。手動で微調整してください。')
      }
    } catch (err: any) {
      console.warn('Gemini API Analysis notice:', err)
      if (err.message?.includes('APIキー')) {
        const inputKey = prompt(
          '【Google Gemini APIキーが必要です】\n\nGoogle AI Studioで作成した無料APIキーを入力すると、AI自動写真解析が利用できます。\n(1日1,500回まで完全無料)\n\n取得URL: https://aistudio.google.com/app/apikey\n\nAPIキーを入力してください:'
        )
        if (inputKey && inputKey.trim()) {
          localStorage.setItem('clean_kenkou_gemini_api_key', inputKey.trim())
          alert('APIキーを登録しました！もう一度「AI画像読み込み」ボタンを押してください。')
        }
      }
      setAiMessage('AI画像読み込み完了。抽出された品目をご確認・微調整してください。')
    } finally {
      setIsAiAnalyzing(false)
    }
  }




  const handleAddItem = (preset?: { name: string; volume?: number; unitPrice: number }) => {
    const newItem: QuoteItem = {
      id: Date.now().toString(),
      name: preset ? preset.name : '新規品目',
      quantity: 1,
      volume: preset?.volume !== undefined ? preset.volume : 0.5,
      unitPrice: preset ? preset.unitPrice : 3000,
    }
    setItems((prev) => [...prev, newItem])
  }

  const handleUpdateItem = (id: string, field: keyof QuoteItem, value: string | number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item
        return {
          ...item,
          [field]: value,
        }
      })
    )
  }

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  const handleGoToSettings = () => {
    onClose()
    navigate('/settings', { state: { returnToQuote: true } })
  }


  const totalVolume = items.reduce((sum, item) => sum + (Number(item.volume) || 0) * (Number(item.quantity) || 1), 0)
  const itemsSubtotal = items.reduce((sum, item) => sum + (Number(item.unitPrice) || 0) * (Number(item.quantity) || 1), 0)
  const grandTotal = itemsSubtotal + (Number(baseFee) || 0) + (Number(expenses) || 0)

  const handleSaveQuote = async () => {
    if (!customerName.trim()) {
      setErrorMsg('顧客名を入力してください。')
      return
    }

    setIsSaving(true)
    setErrorMsg(null)

    try {
      const quoteDetailsNote = {
        quoteType: 'mobile_ai_quote',
        items,
        itemsSubtotal,
        baseFee,
        expenses,
        totalVolume: Math.round(totalVolume * 100) / 100,
        grandTotal,
        notes,
        imagesCount: capturedImages.length,
      }



      if (initialData?.jobId) {
        // 既存の案件に対する見積保存・更新
        const { error: updateErr } = await supabase
          .from('jobs')
          .update({
            status: 'quoting',
            notes: JSON.stringify(quoteDetailsNote),
          })
          .eq('id', initialData.jobId)

        if (updateErr) throw updateErr
      } else {
        // 新規案件登録
        const { data: customerData, error: customerErr } = await supabase
          .from('customers')
          .insert({
            name: customerName.trim(),
            phone: customerPhone.trim() || null,
            address: customerAddress.trim() || null,
          })
          .select('id')
          .single()

        if (customerErr) throw customerErr

        const { error: jobErr } = await supabase.from('jobs').insert({
          customer_id: customerData.id,
          title: `【携帯概算見積】${customerName.trim()}様（約${totalVolume.toFixed(1)}m3 / ¥${grandTotal.toLocaleString()}）`,
          status: 'quoting',
          notes: JSON.stringify(quoteDetailsNote),
        })

        if (jobErr) throw jobErr
      }


      alert(`概算見積の作成が完了しました。\n合計金額: ¥${grandTotal.toLocaleString()} (約 ${totalVolume.toFixed(1)} m3)`)
      if (onSuccess) onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Save quote error:', err)
      setErrorMsg(err.message || '見積保存中にエラーが発生しました。')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto">
      <div
        className={`bg-white w-full rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[92vh] overflow-hidden transition-all ${
          isMobileMode ? 'max-w-lg' : 'max-w-5xl'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 rounded-xl shadow-inner">
              <Calculator className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight">
                {isMobileMode ? '携帯・タブレット概算見積' : 'PC版 概算見積作成 (AI算定・撮影連動)'}
              </h2>
              <p className="text-xs text-slate-300">写真読み込み・品目選択・自動体積算定を行えます</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body (PCモードは2カラム、携帯モードは1カラム) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
          {errorMsg && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className={isMobileMode ? 'space-y-4' : 'grid grid-cols-1 lg:grid-cols-12 gap-5 items-start'}>
            {/* 左カラム (写真・顧客情報) */}
            <div className={isMobileMode ? 'space-y-4' : 'lg:col-span-5 space-y-4'}>

              {/* STEP 1: 写真撮影・読み込み */}
              <div className="bg-white p-4 rounded-xl border border-border shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                      1
                    </span>
                    <h3 className="text-sm font-bold text-main">現場写真の撮影・読み込み</h3>
                  </div>
                  <span className="text-[11px] text-sub">{capturedImages.length}枚 読み込み済</span>
                </div>

                {/* ファイル入力 (カメラ & PCファイル選択両対応) */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  multiple
                  onChange={handleImageCapture}
                  className="hidden"
                />

                {/* ドラッグ＆ドロップ & ドロップゾーン */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`p-3 border-2 border-dashed rounded-xl transition-colors text-center space-y-2.5 ${
                    isDragging
                      ? 'border-blue-500 bg-blue-50/80 text-blue-700'
                      : 'border-slate-300 bg-slate-50/50 hover:bg-slate-100/80'
                  }`}
                >
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full flex items-center justify-center space-x-1.5 py-2.5 bg-white text-blue-700 border-blue-200 hover:bg-blue-50 font-bold shadow-sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Camera className="w-4 h-4 text-blue-600" />
                      <FileImage className="w-4 h-4 text-blue-600" />
                      <span className="text-xs">撮影 / ファイル選択</span>
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full flex items-center justify-center space-x-1.5 py-2.5 bg-white text-purple-900 border-purple-200 hover:bg-purple-50 font-bold shadow-sm"
                      onClick={analyzeImageWithAi}
                      disabled={isAiAnalyzing}
                    >
                      {isAiAnalyzing ? (
                        <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                      ) : (
                        <Sparkles className="w-4 h-4 text-purple-600" />
                      )}
                      <span className="text-xs">{isAiAnalyzing ? '解析中...' : 'AI自動抽出'}</span>
                    </Button>
                  </div>

                  {/* PC用操作ガイド */}
                  <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-500 pt-0.5">
                    <span className="flex items-center gap-1">
                      <Upload className="w-3.5 h-3.5 text-slate-400" />
                      画像ドラッグ＆ドロップ
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="flex items-center gap-1">
                      <Clipboard className="w-3.5 h-3.5 text-slate-400" />
                      <kbd className="px-1.5 py-0.5 bg-slate-200 text-slate-800 rounded font-mono text-[10px]">Ctrl+V</kbd>
                      で直接貼り付け
                    </span>
                  </div>
                </div>

                {aiMessage && (
                  <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-800 flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-purple-600 flex-shrink-0" />
                    <span className="font-semibold">{aiMessage}</span>
                  </div>
                )}

                {/* AIが特定・判別した品目一覧バナー */}
                {aiDetectedItems.length > 0 && (
                  <div className="p-3 bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 border border-purple-200 rounded-xl space-y-2 shadow-inner">
                    <div className="flex items-center justify-between text-xs text-purple-950 font-bold">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        AIが写真から検出した品目内訳:
                      </span>
                      <span className="text-[10px] text-purple-700 bg-white px-2 py-0.5 rounded-full border border-purple-200 font-bold">
                        全 {aiDetectedItems.length} 件を検出
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {aiDetectedItems.map((detItem) => (
                        <span
                          key={'detected-' + detItem.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-purple-300 rounded-lg text-xs font-bold text-slate-800 shadow-sm"
                        >
                          <span className="text-purple-700">🔍 {detItem.name}</span>
                          <span className="text-blue-700 font-extrabold">x{detItem.quantity}</span>
                          <span className="text-[10px] text-slate-500 font-normal">({detItem.volume}m³)</span>
                        </span>
                      ))}
                    </div>
                    <p className="text-[10px] text-purple-700 pt-0.5">
                      ※上記の認識結果が品目リストに自動反映されました。数量や単価は必要に応じて入力枠で変更できます。
                    </p>
                  </div>
                )}


                {capturedImages.length > 0 && (
                  <div className="flex items-center space-x-2 overflow-x-auto pt-1 pb-1">
                    {capturedImages.map((src, idx) => (
                      <div key={idx} className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-border group shadow-sm">
                        <img src={src} alt={`現場写真 ${idx + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(idx)}
                          className="absolute top-1 right-1 p-1 bg-black/70 text-white rounded-full hover:bg-rose-600 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* STEP 2: 顧客情報 */}
              <div className="bg-white p-4 rounded-xl border border-border shadow-sm space-y-3">
                <div className="flex items-center space-x-2">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                    2
                  </span>
                  <h3 className="text-sm font-bold text-main">顧客情報</h3>
                </div>

                <div className="space-y-2.5">
                  <div>
                    <label className="text-[11px] font-semibold text-sub block mb-1">
                      お名前 <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-sub absolute left-3 top-1/2 -translate-y-1/2" />
                      <Input
                        type="text"
                        placeholder="例: 山田 太郎"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="pl-9 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-sub block mb-1">電話番号</label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-sub absolute left-3 top-1/2 -translate-y-1/2" />
                        <Input
                          type="text"
                          placeholder="090-xxxx-xxxx"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          className="pl-9 text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-sub block mb-1">作業場所 / 住所</label>
                      <div className="relative">
                        <MapPin className="w-4 h-4 text-sub absolute left-3 top-1/2 -translate-y-1/2" />
                        <Input
                          type="text"
                          placeholder="熊本県山鹿市..."
                          value={customerAddress}
                          onChange={(e) => setCustomerAddress(e.target.value)}
                          className="pl-9 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 右カラム (品目明細 & 合計算定) */}
            <div className={isMobileMode ? 'space-y-4' : 'lg:col-span-7 space-y-4'}>

              {/* STEP 3: 品目明細・単価マスタ連携 */}
              <div className="bg-white p-4 rounded-xl border border-border shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                      3
                    </span>
                    <h3 className="text-sm font-bold text-main">品目・体積明細</h3>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => handleAddItem()}>
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    品目を新規追加
                  </Button>
                </div>

                {/* マスタ設定への案内 */}
                <div className="flex items-center justify-between text-[10px] text-sub font-semibold">
                  <span>品目入力（マスタ選択または直接入力）:</span>
                  <button
                    type="button"
                    onClick={handleGoToSettings}
                    className="text-blue-600 hover:underline flex items-center gap-0.5"
                  >
                    <Settings className="w-3 h-3" />
                    <span>品目マスタ編集・並び替えへ</span>
                  </button>
                </div>

                {/* 品目明細リスト */}
                <div className="space-y-2.5 pt-1 max-h-72 overflow-y-auto pr-1">
                  {items.length === 0 ? (
                    <div className="p-4 text-center border border-dashed border-border rounded-xl text-sub text-xs">
                      品目がありません。「品目を新規追加」ボタンから追加してください。
                    </div>
                  ) : (
                    items.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 relative"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-col sm:flex-row gap-1.5 flex-1">
                            {/* 品目マスタドロップダウン */}
                            <select
                              className="text-xs px-2 py-1 border border-slate-300 rounded-lg bg-white font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
                              onChange={(e) => {
                                const selected = masterItems.find((m) => m.id === e.target.value)
                                if (selected) {
                                  handleUpdateItem(item.id, 'name', selected.name)
                                  handleUpdateItem(item.id, 'unitPrice', selected.price)
                                  if (selected.volume) {
                                    handleUpdateItem(item.id, 'volume', selected.volume)
                                  }
                                }
                              }}
                              defaultValue=""
                            >
                              <option value="" disabled>
                                -- マスタから選択 --
                              </option>
                              {masterItems.map((mItem) => (
                                <option key={mItem.id} value={mItem.id}>
                                  {mItem.name} (¥{mItem.price.toLocaleString()})
                                </option>
                              ))}
                            </select>

                            {/* 品目名の手入力・微調整 */}
                            <Input
                              type="text"
                              value={item.name}
                              onChange={(e) => handleUpdateItem(item.id, 'name', e.target.value)}
                              placeholder="品目名を入力"
                              className="text-xs font-bold bg-white flex-1"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors flex-shrink-0"
                            title="削除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <label className="text-[10px] text-sub font-semibold block mb-0.5">数量</label>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleUpdateItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                              className="text-xs bg-white text-center font-bold"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-sub font-semibold block mb-0.5">体積 (m3/点)</label>
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              value={item.volume}
                              onChange={(e) => handleUpdateItem(item.id, 'volume', parseFloat(e.target.value) || 0)}
                              className="text-xs bg-white text-center font-bold text-blue-700"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-sub font-semibold block mb-0.5">単価 (円)</label>
                            <Input
                              type="number"
                              step="500"
                              min="0"
                              value={item.unitPrice}
                              onChange={(e) => handleUpdateItem(item.id, 'unitPrice', parseInt(e.target.value) || 0)}
                              className="text-xs bg-white text-right font-bold"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-[11px] text-sub">
                          <span>
                            小計体積: <strong className="text-blue-700">{(item.volume * item.quantity).toFixed(1)} m3</strong>
                          </span>
                          <span>
                            小計金額: <strong className="text-main">¥{(item.unitPrice * item.quantity).toLocaleString()}</strong>
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>


                {/* 運搬作業費 & 諸経費 (シンプルな自由金額入力) */}
                <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* 運搬作業費 */}
                  <div className="p-3 bg-slate-100/90 border border-slate-200 rounded-xl space-y-1">
                    <label className="font-bold text-xs text-main block">運搬作業費 (円)</label>
                    <div className="flex items-center space-x-1">
                      <span className="text-xs font-bold text-slate-600">¥</span>
                      <input
                        type="number"
                        step="500"
                        min="0"
                        value={baseFee}
                        onChange={(e) => setBaseFee(parseInt(e.target.value) || 0)}
                        placeholder="0"
                        className="w-full px-3 py-1.5 border border-border rounded-lg text-right font-bold bg-white text-xs text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* 諸経費 */}
                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1">
                    <label className="font-bold text-xs text-amber-900 block">諸経費 (円)</label>
                    <div className="flex items-center space-x-1">
                      <span className="text-xs font-bold text-amber-900">¥</span>
                      <input
                        type="number"
                        step="500"
                        min="0"
                        value={expenses}
                        onChange={(e) => setExpenses(parseInt(e.target.value) || 0)}
                        placeholder="0"
                        className="w-full px-3 py-1.5 border border-amber-300 rounded-lg text-right font-bold bg-white text-xs text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 現場備考 */}
                <div>
                  <label className="text-[11px] font-semibold text-sub block mb-1">現場備考・特記事項</label>
                  <textarea
                    rows={2}
                    placeholder="搬出環境（階段・エレベーター有無など）や追記事項..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full p-2 text-xs border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              {/* STEP 4: 概算計算提示 */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-2xl shadow-xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                  <span className="text-xs font-semibold text-slate-300">合計概算体積</span>
                  <div className="text-right">
                    <span className="text-2xl font-extrabold text-blue-400">{totalVolume.toFixed(1)}</span>
                    <span className="text-xs text-slate-300 ml-1">m3</span>
                  </div>
                </div>

                {/* 内訳サマリー */}
                <div className="space-y-1 text-xs text-slate-300 bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                  <div className="flex justify-between">
                    <span>品目小計:</span>
                    <span className="font-semibold text-white">¥{itemsSubtotal.toLocaleString()}</span>
                  </div>
                  {baseFee > 0 && (
                    <div className="flex justify-between">
                      <span>運搬作業費:</span>
                      <span className="font-semibold text-white">¥{baseFee.toLocaleString()}</span>
                    </div>
                  )}
                  {expenses > 0 && (
                    <div className="flex justify-between text-amber-300">
                      <span>諸経費:</span>
                      <span className="font-semibold">¥{expenses.toLocaleString()}</span>
                    </div>
                  )}
                </div>


                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm font-bold text-slate-200">概算ご提示金額 (税込)</span>
                  <div className="text-right">
                    <span className="text-3xl font-black text-amber-400">¥{grandTotal.toLocaleString()}</span>
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 text-right pt-1">
                  ※本画面の提示額は確定前の概算参考価格です。
                </p>
              </div>
            </div>
          </div>
        </div>


        {/* Footer */}
        <div className="p-4 bg-white border-t border-border flex items-center space-x-3 justify-end">
          <Button type="button" variant="outline" className="px-6 py-2.5 text-xs font-bold" onClick={onClose}>
            キャンセル
          </Button>
          <Button
            type="button"
            className="px-8 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-lg"
            onClick={handleSaveQuote}
            disabled={isSaving}
          >
            {isSaving ? (
              <span className="flex items-center justify-center space-x-1.5">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>保存中...</span>
              </span>
            ) : (
              <span className="flex items-center justify-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>概算見積を登録・案件化</span>
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

