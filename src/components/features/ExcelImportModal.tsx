import React, { useState } from 'react'
import { X, FileSpreadsheet, Upload, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'
import { JobStatus } from '../../types'
import { Button } from '../ui'

export interface ExcelImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImportSuccess?: () => void
}

interface ParsedRow {
  managementNo?: string
  receivedDate?: string
  customerName: string
  title: string
  statusRaw: string
  statusMapped: JobStatus
  updater?: string
  updatedAt?: string
  notes?: string
}

// 日本語ステータス -> システムJobStatus へのマッピング
const mapStatusToEnum = (raw?: string): JobStatus => {
  if (!raw) return 'received'
  const s = raw.trim()
  if (s.includes('未着手') || s.includes('受付')) return 'received'
  if (s.includes('見積') || s.includes('検討')) return 'quoting'
  if (s.includes('手配') || s.includes('調整') || s.includes('確定')) return 'arranged'
  if (s.includes('実施') || s.includes('回収')) return 'collected'
  if (s.includes('請求')) return 'billed'
  if (s.includes('完了')) return 'completed'
  if (s.includes('保留')) return 'pending'
  if (s.includes('キャンセル')) return 'cancelled'
  return 'received'
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<{ count: number } | null>(null)

  if (!isOpen) return null

  // 共通のExcelパース処理関数
  const parseFile = async (file: File) => {
    setIsLoading(true)
    setError(null)
    setImportResult(null)
    setFileName(file.name)

    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array' })

      // 「臨時収集工程チェック」シート、もしくは最初のシート
      const sheetName =
        workbook.SheetNames.find((name) => name.includes('臨時収集工程')) ||
        workbook.SheetNames[0]

      const worksheet = workbook.Sheets[sheetName]
      if (!worksheet) {
        throw new Error('有効なワークシートが見つかりませんでした')
      }

      // 二次元配列として取得 (2行目がヘッダーの可能性)
      const rawData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 })

      if (rawData.length < 3) {
        throw new Error('データ行が見つかりません')
      }

      // ヘッダー行の特定 (2行目または1行目から「顧客名」などの列インデックスを検索)
      let headerRowIndex = 1 // 2行目がデフォルト
      let colIdx = {
        managementNo: 0, // A列
        receivedDate: 1, // B列
        customerName: 2, // C列
        title: 3,        // D列
        status: 4,       // E列
        updater: 14,     // O列
        updatedAt: 15,   // P列
        notes: 16,       // Q列
      }

      // 動的カラム検索
      for (let r = 0; r < Math.min(5, rawData.length); r++) {
        const row = rawData[r]
        if (!Array.isArray(row)) continue
        const custIndex = row.findIndex(
          (cell) => typeof cell === 'string' && cell.includes('顧客名')
        )
        if (custIndex !== -1) {
          headerRowIndex = r
          colIdx.customerName = custIndex
          colIdx.managementNo = row.findIndex(
            (c) => typeof c === 'string' && c.includes('管理番号')
          )
          colIdx.receivedDate = row.findIndex(
            (c) => typeof c === 'string' && c.includes('受付日')
          )
          colIdx.title = row.findIndex(
            (c) => typeof c === 'string' && (c.includes('案件内容') || c.includes('内容'))
          )
          colIdx.status = row.findIndex(
            (c) => typeof c === 'string' && (c.includes('ステータス') || c.includes('状態'))
          )
          colIdx.notes = row.findIndex(
            (c) => typeof c === 'string' && c.includes('メモ')
          )
          break
        }
      }

      const rows: ParsedRow[] = []

      // ヘッダー以降のデータ行をループ処理
      for (let i = headerRowIndex + 1; i < rawData.length; i++) {
        const row = rawData[i]
        if (!Array.isArray(row) || row.length === 0) continue

        const custName = row[colIdx.customerName] ? String(row[colIdx.customerName]).trim() : ''
        const titleVal = row[colIdx.title] ? String(row[colIdx.title]).trim() : ''

        // 顧客名またはタイトルがある行を取り込み対象とする
        if (!custName && !titleVal) continue

        const statusStr = row[colIdx.status] ? String(row[colIdx.status]).trim() : '未着手'
        const mgmtNo = row[colIdx.managementNo] ? String(row[colIdx.managementNo]).trim() : ''
        const recDate = row[colIdx.receivedDate] ? String(row[colIdx.receivedDate]).trim() : ''
        const notesVal = row[colIdx.notes] ? String(row[colIdx.notes]).trim() : ''

        rows.push({
          managementNo: mgmtNo,
          receivedDate: recDate,
          customerName: custName || '名称未設定',
          title: titleVal || '臨時収集依頼',
          statusRaw: statusStr,
          statusMapped: mapStatusToEnum(statusStr),
          notes: notesVal,
        })
      }

      if (rows.length === 0) {
        throw new Error('解析可能な案件データがファイル内に見つかりませんでした')
      }

      setParsedRows(rows)
    } catch (err: any) {
      console.error('Excel parse error:', err)
      setError(err.message || 'Excelファイルの解析に失敗しました')
      setParsedRows([])
    } finally {
      setIsLoading(false)
    }
  }

  // ファイル選択（クリック）でのハンドラー
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      parseFile(file)
    }
  }

  // ドラッグ＆ドロップ関連イベントハンドラー（ブラウザの自動ダウンロード/ファイルオープンを防止）
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const file = e.dataTransfer.files?.[0]
    if (file) {
      parseFile(file)
    }
  }

  // Supabase データベースへのデータ取り込み実行
  const handleExecuteImport = async () => {
    if (parsedRows.length === 0) return

    setIsImporting(true)
    setError(null)

    try {
      // 1. 顧客情報の取得 & 不足分の自動作成
      const { data: existingCustomers, error: custFetchErr } = await supabase
        .from('customers')
        .select('id, name')
        .is('deleted_at', null)

      if (custFetchErr) throw new Error(custFetchErr.message)

      const customerMap: Record<string, string> = {}
      if (existingCustomers) {
        existingCustomers.forEach((c) => {
          customerMap[c.name.trim()] = c.id
        })
      }

      // 未登録の顧客を収集
      const uniqueNames = Array.from(new Set(parsedRows.map((r) => r.customerName.trim())))
      const newCustomerNames = uniqueNames.filter((name) => !customerMap[name])

      // 新規顧客の登録
      if (newCustomerNames.length > 0) {
        const { data: insertedCusts, error: insertCustErr } = await supabase
          .from('customers')
          .insert(newCustomerNames.map((name) => ({ name })))
          .select('id, name')

        if (insertCustErr) throw new Error(insertCustErr.message)

        if (insertedCusts) {
          insertedCusts.forEach((c) => {
            customerMap[c.name.trim()] = c.id
          })
        }
      }

      // 2. 案件データの登録 (jobs テーブル)
      const jobsToInsert = parsedRows.map((row) => {
        const custId = customerMap[row.customerName.trim()]
        let noteCombined = row.notes || ''
        if (row.managementNo) {
          noteCombined = `[管理番号: ${row.managementNo}] ${noteCombined}`.trim()
        }

        return {
          customer_id: custId,
          title: row.title,
          status: row.statusMapped,
          notes: noteCombined || null,
        }
      })

      const { error: jobInsertErr } = await supabase
        .from('jobs')
        .insert(jobsToInsert)

      if (jobInsertErr) throw new Error(jobInsertErr.message)

      setImportResult({ count: parsedRows.length })
      if (onImportSuccess) {
        onImportSuccess()
      }
    } catch (err: any) {
      console.error('Import execution error:', err)
      setError(err.message || 'データベースへの取り込みに失敗しました')
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto"
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation() }}
    >
      <div className="bg-white rounded-xl shadow-2xl border border-border w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-emerald-600 text-white rounded-lg">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-main text-base">
                Excelデータの読み込み（臨時収集工程表）
              </h3>
              <p className="text-xs text-sub">
                Excelファイル (.xlsm / .xlsx) をドラッグ＆ドロップまたは選択して読み込みます
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-sub hover:text-main hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {importResult ? (
            <div className="p-8 text-center space-y-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <h4 className="text-base font-bold text-emerald-900">
                取り込みが完了しました！
              </h4>
              <p className="text-xs text-emerald-700">
                Excelから <span className="font-bold">{importResult.count}</span> 件の案件データおよび顧客データを正常に取り込みました。
              </p>
              <div className="pt-2">
                <Button type="button" variant="primary" size="sm" onClick={onClose}>
                  画面を閉じて反映を確認
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Drag & Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50/80 scale-[1.01]'
                    : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
                }`}
              >
                <input
                  type="file"
                  accept=".xlsx, .xlsm, .xls"
                  onChange={handleFileChange}
                  className="hidden"
                  id="excelFileInput"
                />
                <label
                  htmlFor="excelFileInput"
                  className="cursor-pointer flex flex-col items-center justify-center space-y-2"
                >
                  <Upload className={`w-10 h-10 transition-colors ${isDragging ? 'text-blue-600' : 'text-slate-400'}`} />
                  <div className="text-xs text-main font-semibold">
                    {fileName ? (
                      <span className="text-emerald-700 font-bold text-sm">📄 {fileName}</span>
                    ) : isDragging ? (
                      <span className="text-blue-600 font-bold text-sm">ここにファイルを離してドロップ</span>
                    ) : (
                      'ここにExcelファイルをドラッグ＆ドロップ、またはクリックして選択'
                    )}
                  </div>
                  <p className="text-[11px] text-sub">
                    「臨時収集工程チェックシート_v3.xlsm」の形式に完全対応しています
                  </p>
                </label>
              </div>

              {/* Parsed Rows Preview */}
              {isLoading && (
                <div className="py-6 text-center text-xs text-sub flex items-center justify-center space-x-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-500" />
                  <span>Excelデータを解析中...</span>
                </div>
              )}

              {parsedRows.length > 0 && !isLoading && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-main">
                      解析結果: <span className="text-emerald-600 font-extrabold">{parsedRows.length}</span> 件のデータ
                    </span>
                    <span className="text-sub">以下の内容がシステムに取り込まれます</span>
                  </div>

                  <div className="border border-border rounded-lg overflow-hidden max-h-56 overflow-y-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-100 text-sub border-b border-border sticky top-0">
                        <tr>
                          <th className="py-2 px-3">顧客名</th>
                          <th className="py-2 px-3">案件内容</th>
                          <th className="py-2 px-3">Excel表記</th>
                          <th className="py-2 px-3">取り込み先ステータス</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {parsedRows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-medium text-main">{row.customerName}</td>
                            <td className="py-2 px-3 text-sub">{row.title}</td>
                            <td className="py-2 px-3 text-sub">{row.statusRaw}</td>
                            <td className="py-2 px-3 font-semibold text-blue-700">{row.statusMapped}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        {!importResult && (
          <div className="px-6 py-3.5 bg-slate-50 border-t border-border flex items-center justify-end space-x-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              キャンセル
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={parsedRows.length === 0 || isImporting}
              onClick={handleExecuteImport}
            >
              {isImporting ? '取り込み処理中...' : `${parsedRows.length} 件を取り込む`}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
