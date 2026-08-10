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
  unit: string
  volume: number
  unitPrice: number
  reason?: string
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

// AI検出品目を自社の登録単価マスタ(masterItems)と高精度照合し、自社の登録品名・単価・単位・体積を優先適用する関数
const matchMasterItem = (
  aiItem: { name: string; quantity: number; unit?: string; volume?: number; unitPrice?: number; reason?: string },
  masterList: any[]
) => {
  const reason = aiItem.reason || ''
  if (!masterList || masterList.length === 0) {
    return {
      name: aiItem.name,
      unit: aiItem.unit || '点',
      unitPrice: aiItem.unitPrice || 3000,
      volume: aiItem.volume !== undefined ? aiItem.volume : 0.4,
      reason,
    }
  }

  const aiName = aiItem.name.trim()

  // 1. 完全一致チェック
  const exactMatch = masterList.find((m) => m.name.trim() === aiName)
  if (exactMatch) {
    return {
      name: exactMatch.name,
      unit: exactMatch.unit || aiItem.unit || '点',
      unitPrice: exactMatch.price,
      volume: exactMatch.volume !== undefined ? exactMatch.volume : (aiItem.volume || 0.4),
      reason: reason || '社内マスタ完全一致',
    }
  }

  // 2. 双方向部分一致チェック (マスタ名がAI名に含まれる、またはAI名がマスタ名に含まれる)
  const partialMatch = masterList.find((m) => aiName.includes(m.name) || m.name.includes(aiName))
  if (partialMatch) {
    return {
      name: partialMatch.name,
      unit: partialMatch.unit || aiItem.unit || '点',
      unitPrice: partialMatch.price,
      volume: partialMatch.volume !== undefined ? partialMatch.volume : (aiItem.volume || 0.4),
      reason: reason || '社内マスタ部分照合',
    }
  }

  // 3. 詳細なシノニム・同義語カテゴリ別高精度マッチンググループ
  const synonymGroups: { keywords: string[]; masterMatchKeywords: string[] }[] = [
    {
      keywords: ['除湿機', '衣類乾燥除湿機', '加湿器', '空気清浄機', '扇風機', 'ヒーター', 'ストーブ', '電子レンジ', '炊飯器', '掃除機', '食洗機', '小型家電'],
      masterMatchKeywords: ['除湿機', '乾燥機', '加湿器', '小型家電', '中型家電', '家電'],
    },
    {
      keywords: ['テレビ', '液晶', 'ブラウン管', 'モニター', 'ディスプレイ'],
      masterMatchKeywords: ['テレビ', '液晶テレビ', '家電'],
    },
    {
      keywords: ['冷蔵庫', '冷凍庫', 'ワインセラー'],
      masterMatchKeywords: ['冷蔵庫', '大型冷蔵庫', '小型冷蔵庫', '家電'],
    },
    {
      keywords: ['洗濯機', 'ドラム式', '乾燥機'],
      masterMatchKeywords: ['洗濯機', '衣類乾燥機', '家電'],
    },
    {
      keywords: ['エアコン', 'クーラー', '室外機'],
      masterMatchKeywords: ['エアコン', '家電'],
    },
    {
      keywords: ['ソファ', 'ソファー', 'カウチ'],
      masterMatchKeywords: ['ソファ', 'ソファー', '家具'],
    },
    {
      keywords: ['ベッド', 'マットレス', '布団'],
      masterMatchKeywords: ['ベッド', 'シングルベッド', 'マットレス', '家具'],
    },
    {
      keywords: ['タンス', 'チェスト', 'キャビネット', '棚', 'ラック', '本棚', '食器棚'],
      masterMatchKeywords: ['タンス', '棚', 'キャビネット', '家具'],
    },
    {
      keywords: ['段ボール', 'ダンボール', '紙箱', '古紙'],
      masterMatchKeywords: ['段ボール', 'ダンボール', '古紙', '可燃不用品', '日用品'],
    },
    {
      keywords: ['タイヤ', 'ホイール'],
      masterMatchKeywords: ['タイヤ'],
    },
    {
      keywords: ['自転車', '原付', 'バイク'],
      masterMatchKeywords: ['自転車', 'バイク'],
    },
  ]

  for (const group of synonymGroups) {
    const matchedKeyword = group.keywords.find((kw) => aiName.includes(kw))
    if (matchedKeyword) {
      for (const masterKw of group.masterMatchKeywords) {
        const match = masterList.find((m) => m.name.includes(masterKw))
        if (match) {
          return {
            name: match.name,
            unit: match.unit || aiItem.unit || '点',
            unitPrice: match.price,
            volume: match.volume !== undefined ? match.volume : (aiItem.volume || 0.4),
            reason: reason || `カテゴリ同義語「${matchedKeyword}」より判定`,
          }
        }
      }
    }
  }

  // 4. マスタに該当品目がない場合は、AIが正しく認識した名前（aiItem.name）をそのまま維持
  return {
    name: aiItem.name,
    unit: aiItem.unit || '点',
    unitPrice: aiItem.unitPrice || 3000,
    volume: aiItem.volume !== undefined ? aiItem.volume : 0.4,
    reason: reason || 'AI直接検出品目',
  }
}

// 単位（kg / m3 / 個数系）に応じた品目の小計体積(m3)算出ヘルパー
const calcItemVolume = (item: { unit?: string; volume: number; quantity: number }): number => {
  const unit = item.unit || '点'
  const qty = Number(item.quantity) || 0
  const vol = Number(item.volume) || 0

  if (unit === 'kg') {
    // kg単位の場合、体積に入力された数値は該当重量(500kg等)全体の概算体積m3として採用
    return vol
  }
  if (unit === 'm3') {
    // m3単位の場合、数量に入力された数値がm3体積そのもの
    return qty
  }
  // 個数系単位（台、点、個、本、枚、箱、袋）の場合：1点あたり体積 × 数量
  return vol * qty
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

  const [items, setItems] = useState<QuoteItem[]>([])

  // 作業搬出環境・費用State
  const [floorLevel, setFloorLevel] = useState<'1F' | '2F' | '3F' | '4F' | '5F'>('1F')
  const [hasElevator, setHasElevator] = useState<boolean>(true)
  const [disassemblyFee, setDisassemblyFee] = useState<number>(0)
  const [applyTruckPack, setApplyTruckPack] = useState<'auto' | 'none' | 'light' | '2t_short' | '2t_long'>('auto')

  const [baseFee, setBaseFee] = useState<number>(0)
  const [expenses, setExpenses] = useState<number>(0)
  const [notes, setNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // 階段作業費の自動算出 (エレベーター無しの場合)
  const autoStairFee = React.useMemo(() => {
    if (hasElevator) return 0
    switch (floorLevel) {
      case '2F': return 3000
      case '3F': return 6000
      case '4F': return 9000
      case '5F': return 12000
      default: return 0
    }
  }, [floorLevel, hasElevator])

  // 全データを初期化・クリアするハンドラー
  const handleResetAll = useCallback(() => {
    setCapturedImages([])
    setItems([])
    setAiMessage(null)
    setAiDetectedItems([])
    setFloorLevel('1F')
    setHasElevator(true)
    setDisassemblyFee(0)
    setApplyTruckPack('auto')
    setBaseFee(0)
    setExpenses(0)
    setNotes('')
    setErrorMsg(null)
    if (initialData) {
      setCustomerName(initialData.customerName || '')
      setCustomerPhone(initialData.customerPhone || '')
      setCustomerAddress(initialData.customerAddress || '')
    } else {
      setCustomerName('')
      setCustomerPhone('')
      setCustomerAddress('')
    }
  }, [initialData])

  // モーダルオープン時の自動状態クリア・初期化
  React.useEffect(() => {
    if (isOpen) {
      handleResetAll()
    }
  }, [isOpen, handleResetAll])

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

  // モーダルが非表示の場合はレンダリングしない
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

  const handleClearAllImages = () => {
    setCapturedImages([])
    setAiMessage('画像をすべてクリアしました。')
  }

  const analyzeImageWithAi = async () => {
    if (capturedImages.length === 0) {
      alert('先に撮影または現場写真を選択・貼り付けしてください。')
      return
    }

    setIsAiAnalyzing(true)
    setAiMessage(`Google AI (Gemini) が社内単価マスタを参照し、計${capturedImages.length}枚の写真を解析中...`)
    setAiDetectedItems([])

    try {
      const detected = await analyzeQuoteImagesWithGemini(
        capturedImages,
        undefined,
        (progressStatus) => {
          setAiMessage(progressStatus)
        },
        masterItems
      )

      const mappedItems: QuoteItem[] = detected.map((item, idx) => {
        const matched = matchMasterItem(item, masterItems)
        return {
          id: Date.now().toString() + '-' + idx,
          name: matched.name,
          quantity: item.quantity || 1,
          unit: matched.unit,
          volume: matched.volume,
          unitPrice: matched.unitPrice,
          reason: matched.reason,
        }
      })

      if (mappedItems.length > 0) {
        setItems(mappedItems)
        setAiDetectedItems(mappedItems)
        setAiMessage(
          `AI解析完了: 全${capturedImages.length}枚の写真から社内マスタと一致する【${mappedItems.length}件の回収品目】を自動算定しました！`
        )
      } else {
        setAiMessage(
          `AI解析完了: 全${capturedImages.length}枚の写真から品目を判別しました。手動で微調整してください。`
        )
      }
    } catch (err: any) {
      console.warn('Gemini API Analysis notice:', err)
      const errText = err.message || String(err)
      if (errText.includes('APIキー')) {
        const inputKey = prompt(
          '【Google Gemini APIキーが必要です】\n\nGoogle AI Studioで作成した無料APIキーを入力すると、AI自動写真解析が利用できます。\n(1日1,500回まで完全無料)\n\n取得URL: https://aistudio.google.com/app/apikey\n\nAPIキーを入力してください:'
        )
        if (inputKey && inputKey.trim()) {
          localStorage.setItem('clean_kenkou_gemini_api_key', inputKey.trim())
          alert('APIキーを登録しました！もう一度「AI自動抽出」ボタンを押してください。')
        }
      }
      setAiMessage(`AI画像読み込み通知: ${errText}`)
    } finally {
      setIsAiAnalyzing(false)
    }
  }

  // 1タップで自社マスタの正しい品名・単価・単位に差し替えるハンドラー
  const handleApplyMasterCorrection = (itemId: string, masterItemName: string) => {
    const targetMaster = masterItems.find((m) => m.name === masterItemName)
    if (!targetMaster) return

    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item
        return {
          ...item,
          name: targetMaster.name,
          unitPrice: targetMaster.price,
          unit: targetMaster.unit || item.unit || '点',
          volume: targetMaster.volume !== undefined ? targetMaster.volume : item.volume,
          reason: `自社単価マスタ「${targetMaster.name}」へ1タップ補正`,
        }
      })
    )
  }

  const handleAddItem = (preset?: { name: string; unit?: string; volume?: number; unitPrice: number }) => {
    const firstMaster = masterItems && masterItems.length > 0 ? masterItems[0] : null
    const newItem: QuoteItem = {
      id: Date.now().toString(),
      name: preset ? preset.name : (firstMaster ? firstMaster.name : '新規不用品'),
      quantity: 1,
      unit: preset?.unit || (firstMaster?.unit || '点'),
      volume: preset?.volume !== undefined ? preset.volume : (firstMaster?.volume !== undefined ? firstMaster.volume : 0.4),
      unitPrice: preset ? preset.unitPrice : (firstMaster ? firstMaster.price : 3000),
      reason: '手動追加品目',
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

  const totalVolume = items.reduce((sum, item) => sum + calcItemVolume(item), 0)
  const itemsSubtotal = items.reduce((sum, item) => sum + (Number(item.unitPrice) || 0) * (Number(item.quantity) || 1), 0)

  // トラック積載量＆適合シミュレーション計算
  const truckPackOptions = React.useMemo(() => {
    const vol = Math.round(totalVolume * 100) / 100
    // 軽トラパック: 2.5m3 (目安¥18,000)
    // 2tショートパック: 6.0m3 (目安¥45,000)
    // 2tロングパック: 10.0m3 (目安¥75,000)
    let bestPack: 'light' | '2t_short' | '2t_long' | 'multi' = 'light'
    if (vol <= 2.5) bestPack = 'light'
    else if (vol <= 6.0) bestPack = '2t_short'
    else if (vol <= 10.0) bestPack = '2t_long'
    else bestPack = 'multi'

    return {
      vol,
      lightRatio: Math.min(100, Math.round((vol / 2.5) * 100)),
      shortRatio: Math.min(100, Math.round((vol / 6.0) * 100)),
      longRatio: Math.min(100, Math.round((vol / 10.0) * 100)),
      bestPack,
    }
  }, [totalVolume])

  // 作業搬出費用（階段料金 ＋ 特殊工賃 ＋ その他実費）
  const workExpenses = autoStairFee + (Number(disassemblyFee) || 0) + (Number(expenses) || 0)

  // トラックパック適用時のパック価格判定
  const packPrice = React.useMemo(() => {
    const activePack = applyTruckPack === 'auto' ? truckPackOptions.bestPack : applyTruckPack
    if (activePack === 'light') return 18000
    if (activePack === '2t_short') return 45000
    if (activePack === '2t_long') return 75000
    return null
  }, [applyTruckPack, truckPackOptions.bestPack])

  // 単品積み上げとトラックパックのお得度比較
  const isPackDiscounted = packPrice !== null && itemsSubtotal > packPrice
  const effectiveItemsCost = isPackDiscounted ? packPrice : itemsSubtotal
  const grandTotal = effectiveItemsCost + (Number(baseFee) || 0) + workExpenses

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
        workExpenses,
        floorLevel,
        hasElevator,
        autoStairFee,
        disassemblyFee,
        appliedPack: isPackDiscounted ? (applyTruckPack === 'auto' ? truckPackOptions.bestPack : applyTruckPack) : 'none',
        totalVolume: Math.round(totalVolume * 100) / 100,
        grandTotal,
        notes,
        imagesCount: capturedImages.length,
      }

      if (initialData?.jobId) {
        // 既存案件の更新
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
          title: `【概算見積】${customerName.trim()}様（約${totalVolume.toFixed(1)}m3 / ¥${grandTotal.toLocaleString()}）`,
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
              <p className="text-xs text-slate-300">単価マスタ連動・写真読み込み・AI自動体積算定を行えます</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleResetAll}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors border border-slate-700 shadow-sm"
              title="すべての入力と写真を初期化します"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>入力全クリア</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
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
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full font-bold border border-blue-200">
                      {capturedImages.length}枚 読み込み済
                    </span>
                    {capturedImages.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearAllImages}
                        className="text-[11px] text-rose-600 hover:text-rose-800 underline font-medium"
                      >
                        全消去
                      </button>
                    )}
                  </div>
                </div>

                {/* ファイル入力 */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  multiple
                  onChange={handleImageCapture}
                  className="hidden"
                />

                {/* ドロップゾーン */}
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
                    <Sparkles className="w-4 h-4 text-purple-600 flex-shrink-0 animate-pulse" />
                    <span className="font-semibold">{aiMessage}</span>
                  </div>
                )}

                {/* AI検出結果バナー */}
                {aiDetectedItems.length > 0 && (
                  <div className="p-3 bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 border border-purple-200 rounded-xl space-y-2 shadow-inner">
                    <div className="flex items-center justify-between text-xs text-purple-950 font-bold">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        AIが特定・マスタ照合した品目・単位内訳:
                      </span>
                      <span className="text-[10px] text-purple-700 bg-white px-2 py-0.5 rounded-full border border-purple-200 font-bold">
                        全 {aiDetectedItems.length} 件を特定
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {aiDetectedItems.map((detItem) => {
                        const emoji = detItem.name.includes('テレビ') ? '📺' :
                          detItem.name.includes('冷蔵庫') ? '🧊' :
                          detItem.name.includes('洗濯機') ? '🧺' :
                          detItem.name.includes('エアコン') ? '❄️' :
                          detItem.name.includes('ソファ') || detItem.name.includes('椅子') ? '🛋️' :
                          detItem.name.includes('ベッド') || detItem.name.includes('布団') ? '🛏️' :
                          detItem.name.includes('段ボール') || detItem.name.includes('箱') ? '📦' :
                          detItem.name.includes('タイヤ') ? '🛞' :
                          detItem.name.includes('金属') || detItem.name.includes('鉄') ? '⚙️' :
                          detItem.name.includes('古紙') || detItem.name.includes('新聞') ? '📰' : '🔍'

                        return (
                          <span
                            key={'detected-' + detItem.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-purple-300 rounded-lg text-xs font-bold text-slate-800 shadow-sm"
                          >
                            <span className="text-purple-900">{emoji} {detItem.name}</span>
                            <span className="text-blue-700 font-extrabold">x{detItem.quantity}{detItem.unit || '点'}</span>
                            <span className="text-[10px] text-slate-500 font-normal">({detItem.volume}m³)</span>
                          </span>
                        )
                      })}
                    </div>
                    <p className="text-[10px] text-purple-700 pt-0.5">
                      ※特定品目・リサイクル品目（テレビ・家電・タイヤ・kg・本数等）の単位で明細に自動展開されました。
                    </p>
                  </div>
                )}

                {capturedImages.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold px-0.5">
                      <span>アップロード写真プレビュー (全 {capturedImages.length} 枚)</span>
                      <span className="text-[10px] text-slate-400">※30枚以上の一括AI認識に対応</span>
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-48 overflow-y-auto p-1.5 bg-slate-100/70 rounded-xl border border-slate-200">
                      {capturedImages.map((src, idx) => (
                        <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 group shadow-sm bg-black/5">
                          <img src={src} alt={`現場写真 ${idx + 1}`} className="w-full h-full object-cover" />
                          <span className="absolute bottom-0.5 left-0.5 bg-black/60 text-white text-[9px] px-1 rounded font-mono">
                            #{idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(idx)}
                            className="absolute top-1 right-1 p-1 bg-black/70 text-white rounded-full hover:bg-rose-600 transition-colors opacity-90 sm:opacity-0 group-hover:opacity-100"
                            title="写真を削除"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
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

              {/* STEP 3: 作業・搬出環境＆特殊作業設定 */}
              <div className="bg-white p-4 rounded-xl border border-border shadow-sm space-y-3">
                <div className="flex items-center space-x-2">
                  <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 text-xs font-bold flex items-center justify-center">
                    3
                  </span>
                  <h3 className="text-sm font-bold text-main">搬出環境・作業難易度</h3>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[11px] font-semibold text-sub block mb-1">作業階数</label>
                    <select
                      value={floorLevel}
                      onChange={(e) => setFloorLevel(e.target.value as any)}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white font-bold text-slate-800"
                    >
                      <option value="1F">1階 (戸建て/1F)</option>
                      <option value="2F">2階</option>
                      <option value="3F">3階</option>
                      <option value="4F">4階</option>
                      <option value="5F">5階以上</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-sub block mb-1">エレベーター</label>
                    <select
                      value={hasElevator ? 'true' : 'false'}
                      onChange={(e) => setHasElevator(e.target.value === 'true')}
                      className="w-full p-2 border border-slate-300 rounded-lg bg-white font-bold text-slate-800"
                    >
                      <option value="true">あり (エレベーター使用可)</option>
                      <option value="false">なし (階段手下ろし作業)</option>
                    </select>
                  </div>
                </div>

                {/* 階段作業費バナー */}
                {autoStairFee > 0 && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center justify-between font-semibold">
                    <span>階段手下ろし作業費 ({floorLevel}・エレベーター無):</span>
                    <span className="font-bold text-amber-700">+¥{autoStairFee.toLocaleString()}</span>
                  </div>
                )}

                <div>
                  <label className="text-[11px] font-semibold text-sub block mb-1">
                    特殊作業費 (エアコン外し・家具解体工賃等)
                  </label>
                  <div className="flex items-center space-x-1">
                    <span className="text-xs font-bold text-slate-500">¥</span>
                    <input
                      type="number"
                      step="1000"
                      min="0"
                      value={disassemblyFee}
                      onChange={(e) => setDisassemblyFee(parseInt(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-right font-bold bg-white text-xs text-slate-800"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 右カラム (品目明細 & 合計算定) */}
            <div className={isMobileMode ? 'space-y-4' : 'lg:col-span-7 space-y-4'}>

              {/* トラック積載量シミュレーター & 定額パック自動診断カード */}
              <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-4 rounded-xl shadow-md space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-base">🚚</span>
                    <h3 className="text-xs font-bold tracking-wide text-blue-100">
                      トラック積載率シミュレーター & パック判定
                    </h3>
                  </div>
                  <span className="text-xs font-extrabold bg-blue-500/30 text-blue-200 px-2 py-0.5 rounded-full border border-blue-400/40">
                    合計体積: {truckPackOptions.vol.toFixed(1)} m3
                  </span>
                </div>

                {/* 積載率プログレスバー */}
                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div className="bg-white/10 p-2 rounded-lg border border-white/10 space-y-1">
                    <div className="flex justify-between font-bold text-slate-200">
                      <span>軽トラ (〜2.5m3)</span>
                      <span>{truckPackOptions.lightRatio}%</span>
                    </div>
                    <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          truckPackOptions.lightRatio > 100 ? 'bg-rose-500' : 'bg-emerald-400'
                        }`}
                        style={{ width: `${Math.min(100, truckPackOptions.lightRatio)}%` }}
                      />
                    </div>
                  </div>

                  <div className="bg-white/10 p-2 rounded-lg border border-white/10 space-y-1">
                    <div className="flex justify-between font-bold text-slate-200">
                      <span>2tショート (〜6.0m3)</span>
                      <span>{truckPackOptions.shortRatio}%</span>
                    </div>
                    <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          truckPackOptions.shortRatio > 100 ? 'bg-rose-500' : 'bg-blue-400'
                        }`}
                        style={{ width: `${Math.min(100, truckPackOptions.shortRatio)}%` }}
                      />
                    </div>
                  </div>

                  <div className="bg-white/10 p-2 rounded-lg border border-white/10 space-y-1">
                    <div className="flex justify-between font-bold text-slate-200">
                      <span>2tロング (〜10.0m3)</span>
                      <span>{truckPackOptions.longRatio}%</span>
                    </div>
                    <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          truckPackOptions.longRatio > 100 ? 'bg-rose-500' : 'bg-indigo-400'
                        }`}
                        style={{ width: `${Math.min(100, truckPackOptions.longRatio)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* パックプランお得比較判定バナー */}
                <div className="flex items-center justify-between bg-white/10 p-2.5 rounded-lg border border-white/15 text-xs">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-amber-300 flex-shrink-0" />
                    <span>
                      {isPackDiscounted ? (
                        <>
                          <strong className="text-amber-300">
                            {truckPackOptions.bestPack === 'light' ? '軽トラパック (¥18,000)' :
                             truckPackOptions.bestPack === '2t_short' ? '2tショートパック (¥45,000)' :
                             '2tロングパック (¥75,000)'}
                          </strong> 適用でお得!
                        </>
                      ) : (
                        <span>単品積み上げ料金が最安計算されています</span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[10px] text-slate-300">パック適用:</span>
                    <select
                      value={applyTruckPack}
                      onChange={(e) => setApplyTruckPack(e.target.value as any)}
                      className="bg-slate-900 text-white text-[11px] font-bold px-2 py-1 rounded border border-slate-700 focus:outline-none"
                    >
                      <option value="auto">✨ AI最適自動判定</option>
                      <option value="none">適用なし (単品積み上げ)</option>
                      <option value="light">軽トラ (¥18,000)</option>
                      <option value="2t_short">2tショート (¥45,000)</option>
                      <option value="2t_long">2tロング (¥75,000)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* STEP 4: 品目明細・単価マスタ連携 */}
              <div className="bg-white p-4 rounded-xl border border-border shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                      4
                    </span>
                    <h3 className="text-sm font-bold text-main">品目・単価・体積明細</h3>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => handleAddItem()}>
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    品目を新規追加
                  </Button>
                </div>

                <div className="flex items-center justify-between text-[10px] text-sub font-semibold">
                  <span>品目選択（回収品目・単価マスタ連動）:</span>
                  <button
                    type="button"
                    onClick={handleGoToSettings}
                    className="text-blue-600 hover:underline flex items-center gap-0.5"
                  >
                    <Settings className="w-3 h-3" />
                    <span>単価マスタ編集へ</span>
                  </button>
                </div>

                {/* 品目明細リスト */}
                <div className="space-y-2.5 pt-1 max-h-72 overflow-y-auto pr-1">
                  {items.length === 0 ? (
                    <div className="p-4 text-center border border-dashed border-border rounded-xl text-sub text-xs">
                      品目がありません。「品目を新規追加」または「AI自動抽出」を行ってください。
                    </div>
                  ) : (
                    items.map((item) => {
                      const isRecycleItem = ['テレビ', '液晶', '冷蔵庫', '洗濯機', 'エアコン'].some((k) =>
                        item.name.includes(k)
                      )
                      return (
                        <div
                          key={item.id}
                          className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 relative hover:border-blue-300 transition-colors"
                        >
                          {/* 品目ヘッダー & マスタ補正 */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex flex-col sm:flex-row gap-1.5 flex-1">
                              {/* 品目マスタドロップダウン */}
                              <select
                                className="text-xs px-2 py-1 border border-slate-300 rounded-lg bg-white font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleApplyMasterCorrection(item.id, e.target.value)
                                  }
                                }}
                                defaultValue=""
                              >
                                <option value="" disabled>
                                  -- マスタから選択・一発補正 --
                                </option>
                                {masterItems.map((mItem) => (
                                  <option key={mItem.id} value={mItem.name}>
                                    {mItem.name} ({mItem.unit ? `${mItem.unit} / ` : ''}¥{mItem.price.toLocaleString()})
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

                          {/* AI理由メモ & リサイクル法対象品バッジ */}
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                            {isRecycleItem && (
                              <span className="bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                                ♻️ 家電リサイクル対象品
                              </span>
                            )}
                            {item.reason && (
                              <span className="bg-purple-100/80 text-purple-900 font-semibold px-2 py-0.5 rounded border border-purple-200/60 flex items-center gap-1">
                                🤖 {item.reason}
                              </span>
                            )}
                          </div>

                        {/* 数量・単位・体積・単価入力 */}
                        <div className="grid grid-cols-4 gap-2 text-xs">
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
                            <label className="text-[10px] text-sub font-semibold block mb-0.5">単位</label>
                            <select
                              className="w-full text-xs px-1.5 py-1.5 border border-slate-300 rounded-lg bg-white font-bold text-slate-800 focus:outline-none"
                              value={item.unit || '点'}
                              onChange={(e) => handleUpdateItem(item.id, 'unit', e.target.value)}
                            >
                              <option value="点">点</option>
                              <option value="個">個</option>
                              <option value="台">台</option>
                              <option value="箱">箱</option>
                              <option value="袋">袋</option>
                              <option value="kg">kg</option>
                              <option value="本">本</option>
                              <option value="枚">枚</option>
                              <option value="m3">m3</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-[10px] text-sub font-semibold block mb-0.5">
                              {item.unit === 'kg' ? '概算体積(m3)' : item.unit === 'm3' ? '体積(m3)' : '体積(m3/点)'}
                            </label>
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
                            小計体積: <strong className="text-blue-700">{calcItemVolume(item).toFixed(1)} m3</strong>
                          </span>
                          <span>
                            小計金額: <strong className="text-main">¥{(item.unitPrice * item.quantity).toLocaleString()}</strong>
                          </span>
                        </div>
                      </div>
                    )
                  }))}
                </div>

                {/* 運搬作業費 & 諸経費 */}
                <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                <div className="space-y-1.5 text-xs text-slate-300 bg-slate-800/80 p-3 rounded-lg border border-slate-700/60">
                  <div className="flex justify-between items-center">
                    <span>品目合計積算:</span>
                    <span className="font-semibold text-white">¥{itemsSubtotal.toLocaleString()}</span>
                  </div>

                  {isPackDiscounted && packPrice && (
                    <div className="flex justify-between items-center text-amber-300 font-bold bg-amber-950/40 p-1.5 rounded border border-amber-500/30">
                      <span>🚚 定額パック割引適用:</span>
                      <span>¥{packPrice.toLocaleString()} (差額 -¥{(itemsSubtotal - packPrice).toLocaleString()})</span>
                    </div>
                  )}

                  {autoStairFee > 0 && (
                    <div className="flex justify-between items-center text-amber-200">
                      <span>🏢 階段作業費 ({floorLevel}):</span>
                      <span className="font-semibold">+¥{autoStairFee.toLocaleString()}</span>
                    </div>
                  )}

                  {disassemblyFee > 0 && (
                    <div className="flex justify-between items-center text-blue-200">
                      <span>⚙️ 特殊作業費 (エアコン・解体):</span>
                      <span className="font-semibold">+¥{disassemblyFee.toLocaleString()}</span>
                    </div>
                  )}

                  {baseFee > 0 && (
                    <div className="flex justify-between items-center">
                      <span>運搬作業基本費:</span>
                      <span className="font-semibold text-white">¥{baseFee.toLocaleString()}</span>
                    </div>
                  )}

                  {expenses > 0 && (
                    <div className="flex justify-between items-center text-amber-300">
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
