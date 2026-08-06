import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface CompanyInfo {
  name: string
  postalCode: string
  address: string
  tel: string
  fax: string
  invoiceNo: string
  bankName: string
  bankBranch: string
  bankAccountType: string
  bankAccountNumber: string
  bankAccountName: string
}

export const DEFAULT_COMPANY_INFO: CompanyInfo = {
  name: '有限会社クリーン健康社',
  postalCode: '861-0501',
  address: '熊本県山鹿市山鹿1000',
  tel: '0968-43-1111',
  fax: '0968-43-2222',
  invoiceNo: 'T1234567890123',
  bankName: '肥後銀行',
  bankBranch: '山鹿支店',
  bankAccountType: '普通',
  bankAccountNumber: '1234567',
  bankAccountName: 'ユウゲンガイシャ クリーンケンコウシャ',
}

export interface UseCompanySettingsReturn {
  companyInfo: CompanyInfo
  isLoading: boolean
  isSyncing: boolean
  error: string | null
  updateCompanyInfo: (newInfo: CompanyInfo) => Promise<boolean>
  refetch: () => Promise<void>
}

export const useCompanySettings = (): UseCompanySettingsReturn => {
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>(() => {
    const saved = localStorage.getItem('clean_kenkou_company_info')
    return saved ? JSON.parse(saved) : DEFAULT_COMPANY_INFO
  })
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isSyncing, setIsSyncing] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const fetchCompanySettings = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true)
    setError(null)
    try {
      const { data, error: fetchErr } = await supabase
        .from('company_settings')
        .select('*')
        .eq('id', 'default')
        .maybeSingle()

      if (fetchErr) {
        // テーブル未作成等のエラー時はローカルストレージを使用
        console.warn('Company settings table sync notice (using local fallback if unavailable):', fetchErr.message)
      } else if (data) {
        const fetchedInfo: CompanyInfo = {
          name: data.name ?? DEFAULT_COMPANY_INFO.name,
          postalCode: data.postal_code ?? DEFAULT_COMPANY_INFO.postalCode,
          address: data.address ?? DEFAULT_COMPANY_INFO.address,
          tel: data.tel ?? DEFAULT_COMPANY_INFO.tel,
          fax: data.fax ?? DEFAULT_COMPANY_INFO.fax,
          invoiceNo: data.invoice_no ?? DEFAULT_COMPANY_INFO.invoiceNo,
          bankName: data.bank_name ?? DEFAULT_COMPANY_INFO.bankName,
          bankBranch: data.bank_branch ?? DEFAULT_COMPANY_INFO.bankBranch,
          bankAccountType: data.bank_account_type ?? DEFAULT_COMPANY_INFO.bankAccountType,
          bankAccountNumber: data.bank_account_number ?? DEFAULT_COMPANY_INFO.bankAccountNumber,
          bankAccountName: data.bank_account_name ?? DEFAULT_COMPANY_INFO.bankAccountName,
        }
        setCompanyInfo(fetchedInfo)
        localStorage.setItem('clean_kenkou_company_info', JSON.stringify(fetchedInfo))
      }
    } catch (err: any) {
      console.warn('Failed to sync company settings with Supabase:', err)
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }, [])

  const updateCompanyInfo = useCallback(async (newInfo: CompanyInfo): Promise<boolean> => {
    setIsSyncing(true)
    setError(null)

    // 1. ローカルストレージを即時更新
    setCompanyInfo(newInfo)
    localStorage.setItem('clean_kenkou_company_info', JSON.stringify(newInfo))

    // 2. Supabaseへクラウド保存
    try {
      const payload = {
        id: 'default',
        name: newInfo.name,
        postal_code: newInfo.postalCode,
        address: newInfo.address,
        tel: newInfo.tel,
        fax: newInfo.fax,
        invoice_no: newInfo.invoiceNo,
        bank_name: newInfo.bankName,
        bank_branch: newInfo.bankBranch,
        bank_account_type: newInfo.bankAccountType,
        bank_account_number: newInfo.bankAccountNumber,
        bank_account_name: newInfo.bankAccountName,
        updated_at: new Date().toISOString(),
      }

      const { error: upsertErr } = await supabase
        .from('company_settings')
        .upsert(payload)

      if (upsertErr) {
        console.warn('Cloud sync for company_settings encountered an error (saved locally):', upsertErr.message)
      }
      return true
    } catch (err: any) {
      console.warn('Failed to update company settings on cloud:', err)
      return true // ローカル保存は成功しているためユーザー操作としては成功とする
    } finally {
      setIsSyncing(false)
    }
  }, [])

  useEffect(() => {
    fetchCompanySettings(true)
  }, [fetchCompanySettings])

  return {
    companyInfo,
    isLoading,
    isSyncing,
    error,
    updateCompanyInfo,
    refetch: () => fetchCompanySettings(true),
  }
}
