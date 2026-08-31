import React, { useEffect } from 'react'
import ReactDOM from 'react-dom'
import { X, Printer, FileText, MapPin, Phone, User } from 'lucide-react'
import { Button } from '../ui'
import { useCompanySettings } from '../../hooks/useCompanySettings'

export interface QuoteItem {
  id?: string
  name: string
  category?: string
  price: number
  quantity: number
  volume: number
}

export interface QuoteData {
  jobId?: string
  customerName: string
  customerPhone?: string
  customerAddress?: string
  title?: string
  createdDate?: string
  items: QuoteItem[]
  itemsSubtotal: number
  baseFee: number
  expenses?: number
  workExpenses?: number
  floorLevel?: string | number
  hasElevator?: boolean
  autoStairFee?: number
  disassemblyFee?: number
  appliedPack?: string
  totalVolume: number
  grandTotal: number
  notes?: string
}

interface QuotePrintModalProps {
  isOpen: boolean
  onClose: () => void
  quoteData: QuoteData | null
  autoPrint?: boolean
}

export const QuotePrintModal: React.FC<QuotePrintModalProps> = ({
  isOpen,
  onClose,
  quoteData,
  autoPrint = false,
}) => {
  const { companyInfo } = useCompanySettings()
  if (!isOpen || !quoteData) return null

  const targetElement = document.getElementById('print-root') || document.body

  const handlePrint = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    // レンダリング安定化のため数ミリ秒遅延させて確実に起動
    setTimeout(() => {
      try {
        window.print()
      } catch (err) {
        console.error('Print trigger error:', err)
      }
    }, 150)
  }

  useEffect(() => {
    if (isOpen && autoPrint) {
      const timer = setTimeout(() => {
        window.print()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isOpen, autoPrint])

  const todayStr = quoteData.createdDate
    ? new Date(quoteData.createdDate).toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
    : new Date().toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })

  const packLabelMap: Record<string, string> = {
    軽トラパック: '軽トラパック (約2.5m³)',
    '1.5tトラックパック': '1.5tトラックパック (約5.0m³)',
    '2tトラックパック': '2tトラックパック (約7.0m³)',
    '2tロングトラックパック': '2tロングトラックパック (約10.0m³)',
    none: 'パック適用なし (単品積み上げ算定)',
  }

  return ReactDOM.createPortal(
    <div
      id="quotePrintArea"
      className="print-container fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static print:block pointer-events-auto"
      onClick={(e) => e.stopPropagation()}
    >
      {/* モーダル本体 (印刷時: フル画面) */}
      <div
        className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:w-full print:rounded-none"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* モーダルヘッダー (印刷時は非表示) */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-emerald-500 text-slate-950 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base">概算見積書 プレビュー & 印刷</h2>
              <p className="text-xs text-slate-300">電話・現場提示用としての記録・確認用見積書です</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs py-1.5 px-3 flex items-center space-x-1 shadow-md cursor-pointer"
              onClick={handlePrint}
            >
              <Printer className="w-4 h-4" />
              <span>印刷する</span>
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 見積書 本文エリア (A4風デザイン) */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 text-slate-900 bg-white font-sans text-xs print:p-6 print:overflow-visible">
          
          {/* 見積書タイトル ＆ 発行元情報 */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
            <div>
              <span className="text-[10px] font-bold tracking-widest text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200 uppercase">
                概算御見積書
              </span>
              <h1 className="text-2xl font-black text-slate-900 mt-1 tracking-tight">
                概算御見積書
              </h1>
              <p className="text-[11px] text-slate-500 mt-0.5">
                発行日: {todayStr}
                {quoteData.jobId && <span className="ml-3">案件ID: #{quoteData.jobId.slice(0, 8)}</span>}
              </p>
            </div>

            <div className="text-right text-[11px] space-y-0.5">
              <p className="font-bold text-slate-900 text-sm">{companyInfo.name}</p>
              {companyInfo.address && (
                <p className="text-slate-600">
                  〒{companyInfo.postalCode} {companyInfo.address}
                </p>
              )}
              <p className="text-slate-600">
                TEL: {companyInfo.tel} {companyInfo.fax ? `/ FAX: ${companyInfo.fax}` : ''}
              </p>
              {companyInfo.invoiceNo && (
                <p className="text-slate-500 text-[10px]">登録番号: {companyInfo.invoiceNo}</p>
              )}
            </div>
          </div>

          {/* 宛名 ＆ 合計金額サマリー */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            {/* 顧客情報 */}
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ご依頼者様</p>
              <p className="text-base font-extrabold text-slate-900 flex items-center gap-1.5">
                <User className="w-4 h-4 text-slate-500" />
                {quoteData.customerName} 様
              </p>
              {quoteData.customerPhone && (
                <p className="text-xs text-slate-600 flex items-center gap-1.5 pt-0.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {quoteData.customerPhone}
                </p>
              )}
              {quoteData.customerAddress && (
                <p className="text-xs text-slate-600 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {quoteData.customerAddress}
                </p>
              )}
            </div>

            {/* 見積合計金額ボックス */}
            <div className="bg-slate-900 text-white p-3.5 rounded-xl flex flex-col justify-center items-end shadow-md">
              <p className="text-[10px] font-semibold text-slate-300">概算お見積り合計金額 (税込)</p>
              <p className="text-2xl sm:text-3xl font-black text-emerald-400 mt-0.5">
                ¥{quoteData.grandTotal.toLocaleString()} <span className="text-xs font-normal text-white">円</span>
              </p>
              <p className="text-[10px] text-slate-300 mt-1">
                想定総体積: 約 <strong className="text-white font-bold">{quoteData.totalVolume.toFixed(1)}</strong> m³
              </p>
            </div>
          </div>

          {/* 明細テーブル */}
          <div className="space-y-2">
            <h3 className="font-bold text-xs text-slate-800 flex items-center gap-1.5 border-l-4 border-slate-900 pl-2">
              回収対象品目・作業内訳
            </h3>
            
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 border-y border-slate-300 text-slate-700 font-bold text-[11px]">
                  <th className="py-2 px-3">品目名 / 内容</th>
                  <th className="py-2 px-3 text-center">数量</th>
                  <th className="py-2 px-3 text-right">単価</th>
                  <th className="py-2 px-3 text-right">想定体積</th>
                  <th className="py-2 px-3 text-right">金額 (税込)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {quoteData.items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-slate-400 italic">
                      個別品目の登録はありません
                    </td>
                  </tr>
                ) : (
                  quoteData.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 font-semibold text-slate-900">{item.name}</td>
                      <td className="py-2 px-3 text-center text-slate-700 font-medium">{item.quantity}</td>
                      <td className="py-2 px-3 text-right text-slate-600">¥{item.price.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right text-slate-500">{(item.volume * item.quantity).toFixed(1)} m³</td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">
                        ¥{(item.price * item.quantity).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 内訳・諸経費・条件 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <p className="font-bold text-[11px] text-slate-800 border-b border-slate-200 pb-1">
                作業・搬出条件
              </p>
              <div className="space-y-1 text-[11px] text-slate-600">
                <p className="flex justify-between">
                  <span>階段階数 / エレベーター:</span>
                  <strong className="text-slate-900">
                    {quoteData.floorLevel || 1}階 ({quoteData.hasElevator ? 'エレベーター有' : 'エレベーター無'})
                  </strong>
                </p>
                {quoteData.autoStairFee ? (
                  <p className="flex justify-between text-amber-800 font-medium">
                    <span>階段手押し作業加算:</span>
                    <span>+¥{quoteData.autoStairFee.toLocaleString()}</span>
                  </p>
                ) : null}
                {quoteData.disassemblyFee ? (
                  <p className="flex justify-between text-indigo-800 font-medium">
                    <span>家具分解・作業費加算:</span>
                    <span>+¥{quoteData.disassemblyFee.toLocaleString()}</span>
                  </p>
                ) : null}
                <p className="flex justify-between border-t border-slate-200 pt-1 mt-1 font-semibold text-slate-800">
                  <span>適用プラン:</span>
                  <span className="text-emerald-700">
                    {packLabelMap[quoteData.appliedPack || 'none'] || quoteData.appliedPack}
                  </span>
                </p>
              </div>
            </div>

            {/* 備考・メモ */}
            <div className="space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <p className="font-bold text-[11px] text-slate-800 border-b border-slate-200 pb-1">
                備考・電話口やり取りメモ
              </p>
              <p className="text-[11px] text-slate-600 whitespace-pre-wrap leading-relaxed min-h-[60px]">
                {quoteData.notes || '特に指定事項なし'}
              </p>
            </div>
          </div>

          {/* フッター注意書き */}
          <div className="border-t border-slate-200 pt-3 text-[10px] text-slate-400 space-y-0.5">
            <p>※ 本概算見積書は現地確認前の想定に基づく概算算定です。現地状況や実際の不用品量により変動する場合がございます。</p>
            <p>※ ご不明な点がございましたら、上記お問い合わせ先までお気軽にお電話ください。</p>
          </div>
        </div>

        {/* モーダル フッター (印刷時非表示) */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between print:hidden">
          <p className="text-xs text-slate-500">
            『印刷する』ボタンでA4サイズ形式の紙・PDF印刷が可能です。
          </p>
          <div className="flex items-center space-x-2">
            <Button type="button" variant="outline" className="px-5 py-2 text-xs font-bold" onClick={onClose}>
              閉じる
            </Button>
            <Button
              type="button"
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs flex items-center space-x-1 shadow-md cursor-pointer"
              onClick={handlePrint}
            >
              <Printer className="w-4 h-4" />
              <span>見積書を印刷</span>
            </Button>
          </div>
        </div>

      </div>
    </div>,
    targetElement
  )
}
