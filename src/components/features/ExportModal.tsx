import React, { useState } from 'react'
import * as XLSX from 'xlsx'
import { Job } from '../../types'
import { Button } from '../ui'

interface ExportModalProps {
  isOpen: boolean
  onClose: () => void
  jobs: Job[]
}

const statusLabelMap: Record<string, string> = {
  received: '新規受付済',
  quoting: '見積中',
  arranged: '手配済 / 作業日程調整',
  collected: '回収完了',
  billed: '請求済',
  completed: '完了済',
  pending: '保留中',
  cancelled: 'キャンセル',
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, jobs }) => {
  const [selectedMonth, setSelectedMonth] = useState('all')
  const [isExporting, setIsExporting] = useState(false)

  if (!isOpen) return null

  // 年月選択肢を直近数ヶ月から動的に生成
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const formatMonthValue = (y: number, m: number) =>
    `${y}-${String(m).padStart(2, '0')}`

  const months = [
    { value: 'all', label: '🗂️ 全期間（すべての案件データ）' },
    {
      value: formatMonthValue(year, month),
      label: `📅 ${year}年${month}月度`,
    },
    {
      value: formatMonthValue(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1),
      label: `📅 ${month === 1 ? year - 1 : year}年${month === 1 ? 12 : month - 1}月度`,
    },
    {
      value: formatMonthValue(month <= 2 ? year - 1 : year, month <= 2 ? month + 10 : month - 2),
      label: `📅 ${month <= 2 ? year - 1 : year}年${month <= 2 ? month + 10 : month - 2}月度`,
    },
  ]

  // 本物の .xlsx ファイルを生成してダウンロード
  const handleExecuteExport = () => {
    setIsExporting(true)
    try {
      // 1. 年月フィルター
      const filteredJobs = jobs.filter((j) => {
        if (selectedMonth === 'all') return true
        if (!j.created_at) return false
        const jobMonth = j.created_at.slice(0, 7) // YYYY-MM
        return jobMonth === selectedMonth
      })

      if (filteredJobs.length === 0) {
        alert('選択された年月に対象となる案件データがありませんでした。')
        setIsExporting(false)
        return
      }

      // 2. ワークシート 1: 案件明細リスト
      const detailRows = filteredJobs.map((j) => ({
        管理コード: `#${j.id.slice(0, 8)}`,
        受付日時: j.created_at ? new Date(j.created_at).toLocaleString('ja-JP') : '',
        顧客名: j.customers?.name || '名称未設定',
        電話番号: j.customers?.phone || '',
        住所: j.customers?.address || '',
        案件内容: j.title || '',
        ステータス: statusLabelMap[j.status] || j.status,
        作業予定日: j.scheduled_date || '',
        備考: j.notes || '',
      }))

      const detailWorksheet = XLSX.utils.json_to_sheet(detailRows)

      // 列幅の自動調整
      detailWorksheet['!cols'] = [
        { wch: 12 }, // 管理コード
        { wch: 18 }, // 受付日時
        { wch: 20 }, // 顧客名
        { wch: 15 }, // 電話番号
        { wch: 30 }, // 住所
        { wch: 25 }, // 案件内容
        { wch: 16 }, // ステータス
        { wch: 14 }, // 作業予定日
        { wch: 35 }, // 備考
      ]

      // 3. ワークシート 2: ステータス別集計サマリー
      const statusCounts: Record<string, number> = {}
      Object.keys(statusLabelMap).forEach((st) => {
        statusCounts[st] = 0
      })

      filteredJobs.forEach((j) => {
        statusCounts[j.status] = (statusCounts[j.status] || 0) + 1
      })

      const summaryRows = Object.entries(statusLabelMap).map(([key, label]) => ({
        ステータス: label,
        案件件数: statusCounts[key] || 0,
        割合: `${
          filteredJobs.length > 0
            ? Math.round(((statusCounts[key] || 0) / filteredJobs.length) * 100)
            : 0
        }%`,
      }))

      summaryRows.push({
        ステータス: '【合計】',
        案件件数: filteredJobs.length,
        割合: '100%',
      })

      const summaryWorksheet = XLSX.utils.json_to_sheet(summaryRows)
      summaryWorksheet['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 10 }]

      // 4. Excelブックの作成とシート追加
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, detailWorksheet, '案件明細一覧')
      XLSX.utils.book_append_sheet(workbook, summaryWorksheet, '工程別集計サマリー')

      // 5. Excelファイル (.xlsx) の書き出し
      const monthText = selectedMonth === 'all' ? '全期間' : selectedMonth
      const outputFileName = `臨時収集工程集計レポート_${monthText}.xlsx`

      XLSX.writeFile(workbook, outputFileName)
      onClose()
    } catch (err: any) {
      console.error('Excel export error:', err)
      alert('Excelファイルの生成に失敗しました: ' + err.message)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-border w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-slate-50">
          <h3 className="font-bold text-main text-base">Excel集計レポートの出力</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-sub hover:text-main hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-main mb-1.5">
              出力対象年月（受付基準）
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full text-xs p-2.5 bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-sub space-y-1">
            <p className="font-semibold text-main">📄 出力されるExcelファイルの内容:</p>
            <ul className="list-disc list-inside space-y-0.5 text-[11px]">
              <li><b>シート1 (案件明細一覧)</b>: 顧客名、住所、電話番号、収集内容、ステータス</li>
              <li><b>シート2 (工程別集計サマリー)</b>: 各工程の件数と割合％</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-border flex items-center justify-end space-x-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            キャンセル
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={isExporting}
            onClick={handleExecuteExport}
          >
            {isExporting ? '生成中...' : 'Excelファイル (.xlsx) をダウンロード'}
          </Button>
        </div>
      </div>
    </div>
  )
}
