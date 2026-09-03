import React from 'react'
import ReactDOM from 'react-dom'
import { useCompanySettings } from '../../hooks/useCompanySettings'

export interface PrintQuoteItem {
  id?: string
  name: string
  category?: string
  price: number
  quantity: number
  volume: number
}

export interface PrintQuoteData {
  jobId?: string
  customerName: string
  customerPhone?: string
  customerAddress?: string
  title?: string
  createdDate?: string
  items: PrintQuoteItem[]
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
  signature?: string | null
}

interface PrintQuoteAreaProps {
  quote: PrintQuoteData | null
}

export const PrintQuoteArea: React.FC<PrintQuoteAreaProps> = ({ quote }) => {
  const { companyInfo } = useCompanySettings()
  const targetElement = document.getElementById('print-root') || document.body

  if (!quote) {
    return ReactDOM.createPortal(
      <div id="printQuoteArea" className="print-container"></div>,
      targetElement
    )
  }

  const todayStr = quote.createdDate
    ? new Date(quote.createdDate).toLocaleDateString('ja-JP', {
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
    <div id="printQuoteArea" className="print-container">
      <div className="print-page print-quote-page">
        {/* 見積書ヘッダー */}
        <div className="print-header-row border-b-2 border-slate-900 pb-3 mb-4 flex justify-between items-start">
          <div>
            <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
              概算御見積書
            </span>
            <h1 className="print-title text-xl font-bold text-slate-900 mt-1">
              概算御見積書
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              発行日: {todayStr}
              {quote.jobId && <span className="ml-4">案件No: #{quote.jobId.slice(0, 8)}</span>}
            </p>
          </div>

          <div className="text-right text-xs space-y-0.5">
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

        {/* 顧客情報 & 金額サマリー */}
        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-300 mb-4">
          <div className="space-y-1 text-xs">
            <p className="text-[10px] font-bold text-slate-500 uppercase">ご依頼者様</p>
            <p className="text-sm font-bold text-slate-900">{quote.customerName} 様</p>
            {quote.customerPhone && <p className="text-slate-600">TEL: {quote.customerPhone}</p>}
            {quote.customerAddress && <p className="text-slate-600">住所: {quote.customerAddress}</p>}
          </div>

          <div className="bg-slate-900 text-white p-3 rounded-lg flex flex-col justify-center items-end">
            <p className="text-[10px] text-slate-300">概算御見積合計金額 (税込)</p>
            <p className="text-2xl font-black text-emerald-400">
              ¥{quote.grandTotal.toLocaleString()} <span className="text-xs text-white">円</span>
            </p>
            <p className="text-[10px] text-slate-300">想定総体積: 約 {quote.totalVolume.toFixed(1)} m³</p>
          </div>
        </div>

        {/* 明細テーブル */}
        <table className="print-table w-full text-xs border-collapse mb-4">
          <thead>
            <tr className="bg-slate-100 border-y border-slate-400 text-slate-800 font-bold">
              <th className="py-1.5 px-2 text-left">回収対象品目 / 内容</th>
              <th className="py-1.5 px-2 text-center">数量</th>
              <th className="py-1.5 px-2 text-right">単価</th>
              <th className="py-1.5 px-2 text-right">想定体積</th>
              <th className="py-1.5 px-2 text-right">金額 (税込)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300">
            {quote.items.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-3 text-center text-slate-500 italic">
                  個別品目の登録はありません
                </td>
              </tr>
            ) : (
              quote.items.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-1.5 px-2 font-semibold text-slate-900">{item.name}</td>
                  <td className="py-1.5 px-2 text-center">{item.quantity}</td>
                  <td className="py-1.5 px-2 text-right">¥{item.price.toLocaleString()}</td>
                  <td className="py-1.5 px-2 text-right">{(item.volume * item.quantity).toFixed(1)} m³</td>
                  <td className="py-1.5 px-2 text-right font-bold">
                    ¥{(item.price * item.quantity).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* 内訳・作業条件・備考 */}
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="bg-slate-50 p-2.5 rounded border border-slate-300 space-y-1">
            <p className="font-bold border-b border-slate-300 pb-0.5 text-slate-900">搬出・作業条件</p>
            <p className="flex justify-between">
              <span>階数 / エレベーター:</span>
              <strong className="text-slate-900">
                {quote.floorLevel || 1}階 ({quote.hasElevator ? 'エレベーター有' : 'エレベーター無'})
              </strong>
            </p>
            {quote.autoStairFee ? (
              <p className="flex justify-between text-amber-900 font-medium">
                <span>階段手押し費:</span>
                <span>+¥{quote.autoStairFee.toLocaleString()}</span>
              </p>
            ) : null}
            {quote.disassemblyFee ? (
              <p className="flex justify-between text-indigo-900 font-medium">
                <span>家具分解・作業費:</span>
                <span>+¥{quote.disassemblyFee.toLocaleString()}</span>
              </p>
            ) : null}
            <p className="flex justify-between border-t border-slate-300 pt-1 font-bold text-emerald-800">
              <span>適用パック:</span>
              <span>{packLabelMap[quote.appliedPack || 'none'] || quote.appliedPack}</span>
            </p>
          </div>

          <div className="bg-slate-50 p-2.5 rounded border border-slate-300 space-y-1 flex flex-col justify-between">
            <div>
              <p className="font-bold border-b border-slate-300 pb-0.5 text-slate-900">備考・特記事項</p>
              <p className="text-[11px] text-slate-700 whitespace-pre-wrap leading-tight">
                {quote.notes || '指定なし'}
              </p>
            </div>
            {quote.signature && (
              <div className="border-t border-slate-200 pt-1.5 flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-600">お客様ご承諾サイン:</span>
                {quote.signature.startsWith('data:image/') ? (
                  <img
                    src={quote.signature}
                    alt="お客様サイン"
                    className="h-9 max-w-[140px] object-contain border border-slate-300 bg-white rounded px-1"
                  />
                ) : (
                  <span className="text-xs font-bold text-amber-900 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded">
                    {quote.signature}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-slate-300 mt-4 pt-2 text-[10px] text-slate-500">
          ※ 本概算御見積書は現地調査前の想定に基づく概算算定です。実際の現地状況により金額が変動する場合があります。
        </div>
      </div>
    </div>,
    targetElement
  )
}
