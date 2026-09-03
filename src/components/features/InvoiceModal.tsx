import React, { useState, useEffect, useMemo } from 'react'
import {
  X,
  Receipt,
  DollarSign,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Calendar,
  FileText,
  AlertCircle,
  Save,
  Loader2,
  Clock,
  Sparkles,
} from 'lucide-react'
import { Job, Invoice } from '../../types'
import { Button, Input } from '../ui'
import { supabase } from '../../lib/supabase'

export interface InvoiceModalProps {
  job: Job | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  job,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [amount, setAmount] = useState<number>(0)
  const [billingStatus, setBillingStatus] = useState<'unissued' | 'issued' | 'paid'>('unissued')
  const [issuedAt, setIssuedAt] = useState<string>('')
  const [dueDate, setDueDate] = useState<string>('')
  const [paidAt, setPaidAt] = useState<string>('')
  const [invoiceNumber, setInvoiceNumber] = useState<string>('')
  const [varianceReason, setVarianceReason] = useState<string>('')
  const [notes, setNotes] = useState<string>('')

  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 案件のnotesから見積もり金額(grandTotal)を解析
  const quoteGrandTotal = useMemo(() => {
    if (!job?.notes) return 0
    try {
      const parsed = JSON.parse(job.notes)
      if (typeof parsed.grandTotal === 'number') {
        return parsed.grandTotal
      }
    } catch {
      // JSONでない場合は0
    }
    return 0
  }, [job])

  // モーダルオープン時に既存の請求データを取得または初期値を設定
  useEffect(() => {
    if (!job || !isOpen) return

    let isMounted = true
    setIsLoading(true)
    setError(null)

    const todayStr = new Date().toISOString().split('T')[0]
    // 支払期日は標準で翌月末
    const nextMonth = new Date()
    nextMonth.setMonth(nextMonth.getMonth() + 2, 0)
    const defaultDueDate = nextMonth.toISOString().split('T')[0]

    const fetchInvoiceData = async () => {
      try {
        const { data, error: fetchErr } = await supabase
          .from('invoices')
          .select('*')
          .eq('job_id', job.id)
          .maybeSingle()

        if (!isMounted) return

        if (!fetchErr && data) {
          // 既存請求データあり
          setAmount(Number(data.amount) || quoteGrandTotal || 0)
          setBillingStatus(data.billing_status || 'unissued')
          setIssuedAt(data.issued_at ? data.issued_at.split('T')[0] : todayStr)
          setDueDate(data.due_date ? data.due_date.split('T')[0] : defaultDueDate)
          setPaidAt(data.paid_at ? data.paid_at.split('T')[0] : '')
          setInvoiceNumber(data.invoice_number || `INV-${job.id.slice(0, 8).toUpperCase()}`)
          setVarianceReason(data.variance_reason || '')
          setNotes(data.notes || '')
        } else {
          // 新規請求入力
          setAmount(quoteGrandTotal || 0)
          setBillingStatus('unissued')
          setIssuedAt(todayStr)
          setDueDate(defaultDueDate)
          setPaidAt('')
          setInvoiceNumber(`INV-${job.id.slice(0, 8).toUpperCase()}`)
          setVarianceReason('')
          setNotes('')
        }
      } catch (err) {
        console.warn('Failed to fetch invoice:', err)
        if (isMounted) {
          setAmount(quoteGrandTotal || 0)
          setBillingStatus('unissued')
          setIssuedAt(todayStr)
          setDueDate(defaultDueDate)
          setPaidAt('')
          setInvoiceNumber(`INV-${job.id.slice(0, 8).toUpperCase()}`)
        }
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    fetchInvoiceData()

    return () => {
      isMounted = false
    }
  }, [job, isOpen, quoteGrandTotal])

  if (!isOpen || !job) return null

  // 見積金額と確定請求金額の乖離（差額 & 乖離率）の計算
  const variance = amount - quoteGrandTotal
  const varianceRate = quoteGrandTotal > 0 ? (variance / quoteGrandTotal) * 100 : 0

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)

    const invoicePayload: Partial<Invoice> = {
      job_id: job.id,
      amount: Number(amount) || 0,
      billing_status: billingStatus,
      issued_at: issuedAt ? `${issuedAt}T00:00:00Z` : null,
      due_date: dueDate ? `${dueDate}T00:00:00Z` : null,
      paid_at: billingStatus === 'paid' ? (paidAt ? `${paidAt}T00:00:00Z` : new Date().toISOString()) : null,
      invoice_number: invoiceNumber.trim() || undefined,
      variance_reason: varianceReason.trim() || undefined,
      notes: notes.trim() || undefined,
    }

    try {
      // 1. Supabase invoices テーブルへ保存 (アップサート)
      const { error: invoiceErr } = await supabase
        .from('invoices')
        .upsert(invoicePayload, { onConflict: 'job_id' })

      if (invoiceErr) {
        // テーブルが存在しない場合などのフォールバック: jobs.notes にバックアップ保存
        console.warn('invoices table upsert failed, falling back to job notes:', invoiceErr)
      }

      // 2. 案件ステータスの自動追従 (入金済みならcompleted、請求書発行済ならbilled)
      const nextJobStatus = billingStatus === 'paid' ? 'completed' : 'billed'
      await supabase
        .from('jobs')
        .update({
          status: nextJobStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id)

      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Invoice save error:', err)
      setError(err.message || '請求情報の保存に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-6">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-800 text-white">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-500/20 border border-emerald-400/30 text-emerald-400 rounded-xl">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">請求書・売上確定入力</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                  完了済み案件
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {job.customers?.name || '名称未設定'} 様 ｜ {job.title}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        {isLoading ? (
          <div className="p-12 text-center text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-emerald-600" />
            <p className="text-xs">請求データを読み込み中...</p>
          </div>
        ) : (
          <form onSubmit={handleSave}>
          <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* 1. 見積 vs 確定請求金額の比較・乖離分析カード */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2 mb-3">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  見積・売上 乖離（カイリ）分析
                </span>
                <span className="text-[11px] text-slate-500">
                  ※ 経営分析・売上集計グラフに自動反映されます
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                {/* 事前見積金額 */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-500 block">事前見積金額</span>
                  <div className="text-base font-extrabold text-slate-800 mt-0.5">
                    {quoteGrandTotal > 0 ? `¥${quoteGrandTotal.toLocaleString()}` : '未算定'}
                  </div>
                  <span className="text-[10px] text-slate-400">現地調査・事前提示額</span>
                </div>

                {/* 確定請求金額 */}
                <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200 shadow-xs">
                  <span className="text-[11px] font-bold text-emerald-800 block">確定請求金額（売上計上）</span>
                  <div className="text-lg font-black text-emerald-700 mt-0.5">
                    ¥{Number(amount || 0).toLocaleString()}
                  </div>
                  <span className="text-[10px] text-emerald-600/80">最終お客様ご請求額</span>
                </div>
              </div>

              {/* 乖離ステータスバッジ */}
              {quoteGrandTotal > 0 ? (
                <div
                  className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                    variance === 0
                      ? 'bg-slate-100 border-slate-200 text-slate-700'
                      : variance > 0
                      ? 'bg-blue-50 border-blue-200 text-blue-800'
                      : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}
                >
                  <div className="flex items-center space-x-1.5">
                    {variance > 0 ? (
                      <TrendingUp className="w-4 h-4 text-blue-600" />
                    ) : variance < 0 ? (
                      <TrendingDown className="w-4 h-4 text-amber-600" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    )}
                    <span className="font-bold">
                      {variance === 0
                        ? '見積金額通り（乖離なし）'
                        : variance > 0
                        ? `現場増額: +¥${variance.toLocaleString()} (+${varianceRate.toFixed(1)}%)`
                        : `減額精算: -¥${Math.abs(variance).toLocaleString()} (${varianceRate.toFixed(1)}%)`}
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold opacity-80">
                    {variance > 0 ? '追加回収等あり' : variance < 0 ? '数量減少・値引等' : '事前想定と一致'}
                  </span>
                </div>
              ) : (
                <div className="p-2 bg-slate-100 rounded-lg text-[11px] text-slate-500 text-center">
                  事前見積金額が未登録の案件です（確定請求金額が売上として集計されます）
                </div>
              )}
            </div>

            {/* 2. 請求金額の入力 & 請求ステータス */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  確定請求金額 (税込) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">¥</span>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    className="pl-7 text-base font-bold"
                    value={amount || ''}
                    onChange={(e) => setAmount(Number(e.target.value) || 0)}
                    placeholder="40000"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                  請求・入金状況
                </label>
                <select
                  value={billingStatus}
                  onChange={(e) => setBillingStatus(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-slate-300 bg-white shadow-xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="unissued">📝 未請求（請求書作成中）</option>
                  <option value="issued">📨 請求書発行・送付済み（入金待ち）</option>
                  <option value="paid">✅ 入金完了（領収済み・売上完了）</option>
                </select>
              </div>
            </div>

            {/* 3. 日付情報 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  請求日
                </label>
                <Input
                  type="date"
                  className="text-xs"
                  value={issuedAt}
                  onChange={(e) => setIssuedAt(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  お支払期日
                </label>
                <Input
                  type="date"
                  className="text-xs"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  入金確認日
                </label>
                <Input
                  type="date"
                  className="text-xs"
                  value={paidAt}
                  onChange={(e) => {
                    setPaidAt(e.target.value)
                    if (e.target.value) setBillingStatus('paid')
                  }}
                  placeholder="入金確認時に入力"
                />
              </div>
            </div>

            {/* 4. 乖離理由メモ (見積と差がある場合) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span>見積もりとの差異・増減の理由（戦略・振り返りメモ）</span>
                <span className="text-[10px] text-slate-400 font-normal">任意</span>
              </label>
              <Input
                type="text"
                placeholder="例: 現場でタンス1点・小型家電の追加回収あり / 階段作業の追加"
                value={varianceReason}
                onChange={(e) => setVarianceReason(e.target.value)}
                className="text-xs"
              />
            </div>

            {/* 5. 備考・社内メモ */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                請求メモ・社内特記事項
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="振込案内や領収書発行の有無など..."
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg shadow-xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              閉じる
            </Button>
            <Button
              type="submit"
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5"
              disabled={isSaving}
            >
              {isSaving ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>保存中...</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Save className="w-4 h-4" />
                  <span>請求・売上を確定保存</span>
                </span>
              )}
            </Button>
          </div>
        </form>
        )}
      </div>
    </div>
  )
}
