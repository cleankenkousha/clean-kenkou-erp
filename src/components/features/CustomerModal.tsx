import React, { useState, useEffect } from 'react'
import { X, User, Phone, MapPin, Save, Briefcase, Calendar, Receipt } from 'lucide-react'
import { Customer, Job } from '../../types'
import { Input, Button } from '../ui'
import { supabase } from '../../lib/supabase'
import { InvoiceModal } from './InvoiceModal'

export interface CustomerModalProps {
  customer: Customer | null
  isOpen: boolean
  onClose: () => void
  onSave: (data: { name: string; phone?: string; address?: string }) => Promise<boolean | Customer | null>
}

export const CustomerModal: React.FC<CustomerModalProps> = ({
  customer,
  isOpen,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')

  const [customerJobs, setCustomerJobs] = useState<Job[]>([])
  const [isLoadingJobs, setIsLoadingJobs] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [invoiceJob, setInvoiceJob] = useState<Job | null>(null)
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false)

  useEffect(() => {
    if (customer) {
      setName(customer.name || '')
      setPhone(customer.phone || '')
      setAddress(customer.address || '')

      // 編集モード時: この顧客の過去案件履歴を取得
      setIsLoadingJobs(true)
      supabase
        .from('jobs')
        .select('*')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })
        .then(({ data, error: fetchErr }) => {
          setIsLoadingJobs(false)
          if (!fetchErr && data) {
            setCustomerJobs(data as Job[])
          }
        })
    } else {
      setName('')
      setPhone('')
      setAddress('')
      setCustomerJobs([])
    }
    setError(null)
  }, [customer, isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('顧客名を入力してください')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const success = await onSave({
        name: name.trim(),
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
      })

      if (success) {
        onClose()
      }
    } catch (err: any) {
      setError(err.message || '保存に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl border border-border w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-slate-900 text-white rounded-lg">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-main text-base">
                {customer ? '顧客情報の編集' : '新規顧客の登録'}
              </h3>
              <p className="text-xs text-sub">
                {customer ? '登録済みの顧客情報を更新します' : '新しい顧客情報を登録します'}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                {error}
              </div>
            )}

            {/* 顧客名 */}
            <div>
              <label className="block text-xs font-semibold text-main mb-1.5">
                顧客名 <span className="text-rose-500">*</span>
              </label>
              <Input
                type="text"
                placeholder="例: 高橋 健一 / 株式会社山鹿建設"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* 電話番号 */}
            <div>
              <label className="block text-xs font-semibold text-main mb-1.5 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-sub" /> 電話番号
              </label>
              <Input
                type="tel"
                placeholder="例: 090-1234-5678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            {/* 住所 */}
            <div>
              <label className="block text-xs font-semibold text-main mb-1.5 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-sub" /> 住所
              </label>
              <Input
                type="text"
                placeholder="例: 熊本県山鹿市山鹿1234"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            {/* 編集時: 過去案件履歴 */}
            {customer && (
              <div className="pt-4 border-t border-border mt-6">
                <h4 className="text-xs font-bold text-main mb-3 flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-slate-700" />
                  案件履歴 ({customerJobs.length}件)
                </h4>

                {isLoadingJobs ? (
                  <p className="text-xs text-sub py-2">案件履歴を読み込み中...</p>
                ) : customerJobs.length === 0 ? (
                  <p className="text-xs text-sub py-2 bg-slate-50 rounded-lg text-center">
                    まだ案件履歴はありません
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {customerJobs.map((job) => {
                      const isCompleted = ['completed', 'billed', 'collected'].includes(job.status)
                      return (
                        <div
                          key={job.id}
                          className="p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-lg border border-border text-xs flex justify-between items-center transition-colors gap-2"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-main truncate">{job.title}</p>
                            <p className="text-[11px] text-sub flex items-center gap-1 mt-0.5">
                              <Calendar className="w-3 h-3" />
                              {job.scheduled_date || '日程未定'}
                            </p>
                          </div>
                          <div className="flex items-center space-x-1.5 flex-shrink-0">
                            {isCompleted ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setInvoiceJob(job)
                                  setIsInvoiceModalOpen(true)
                                }}
                                className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-[10px] rounded shadow-sm flex items-center space-x-1 transition-all"
                                title="確定請求・売上内容の入力・確認"
                              >
                                <Receipt className="w-3 h-3" />
                                <span>請求・売上入力</span>
                              </button>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-700">
                                {job.status}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-3.5 bg-slate-50 border-t border-border flex items-center justify-end space-x-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              キャンセル
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={isSaving}>
              <Save className="w-4 h-4 mr-1.5" />
              {isSaving ? '保存中...' : customer ? '更新する' : '登録する'}
            </Button>
          </div>
        </form>
      </div>

      {/* 完了済み案件の請求・売上確定モーダル */}
      <InvoiceModal
        job={invoiceJob}
        isOpen={isInvoiceModalOpen}
        onClose={() => {
          setIsInvoiceModalOpen(false)
          setInvoiceJob(null)
        }}
        onSuccess={() => {
          // 案件一覧を再読み込み
          if (customer) {
            supabase
              .from('jobs')
              .select('*')
              .eq('customer_id', customer.id)
              .order('created_at', { ascending: false })
              .then(({ data }) => {
                if (data) setCustomerJobs(data as Job[])
              })
          }
        }}
      />
    </div>
  )
}
