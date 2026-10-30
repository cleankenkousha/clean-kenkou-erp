import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Settings as SettingsIcon,
  Building2,
  Users,
  Package,
  Plus,
  CheckCircle2,
  Download,
  ShieldCheck,
  Edit2,
  Trash2,
  RotateCcw,
  Sparkles,
  Cloud,
  RefreshCw,
  ArrowLeft,
  Calculator,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Mail,
  Key,
  History,
  Clock,
  Lock,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ActivityLog } from '../lib/activityLogger'
import { useProfiles, getRoleInfo, StaffRole, Profile } from '../hooks/useProfiles'
import { useJobs } from '../hooks/useJobs'
import { useCustomers } from '../hooks/useCustomers'
import { useCompanySettings, CompanyInfo, DEFAULT_COMPANY_INFO } from '../hooks/useCompanySettings'
import { usePriceMaster } from '../hooks/usePriceMaster'
import { Input, Button } from '../components/ui'

export const Settings: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const isReturnFromQuote = Boolean(location.state?.returnToQuote)

  const [activeTab, setActiveTab] = useState<'company' | 'staff' | 'logs' | 'items' | 'backup'>(
    isReturnFromQuote ? 'items' : 'staff'
  )

  // 1. 自社情報（クラウド保存対応フック）
  const { companyInfo, updateCompanyInfo, isSyncing: isSyncingCompany } = useCompanySettings()
  const [companyForm, setCompanyForm] = useState<CompanyInfo>(DEFAULT_COMPANY_INFO)
  const [isSavedCompany, setIsSavedCompany] = useState(false)

  useEffect(() => {
    if (companyInfo) {
      setCompanyForm(companyInfo)
    }
  }, [companyInfo])

  // 2. スタッフ・担当者
  const {
    profiles,
    isLoading: isLoadingProfiles,
    refetch: refetchProfiles,
    updateProfile,
    addStaff,
    deleteStaff,
    syncAllProfiles,
  } = useProfiles()
  const [newStaffName, setNewStaffName] = useState('')
  const [newStaffRole, setNewStaffRole] = useState<StaffRole>('operator')
  const [newStaffEmail, setNewStaffEmail] = useState('')
  const [newStaffPassword, setNewStaffPassword] = useState('')
  const [isSavedStaff, setIsSavedStaff] = useState(false)
  const [isSyncingStaff, setIsSyncingStaff] = useState(false)

  // スタッフ直接パスワード設定モーダル用ステート
  const [accountModalTarget, setAccountModalTarget] = useState<Profile | null>(null)
  const [accountEmailInput, setAccountEmailInput] = useState('')
  const [accountPasswordInput, setAccountPasswordInput] = useState('')
  const [isSavingAccount, setIsSavingAccount] = useState(false)
  const [accountModalMsg, setAccountModalMsg] = useState<{ text: string; isError: boolean } | null>(null)

  // 3. ログイン・操作履歴（activity_logs）
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)

  const fetchActivityLogs = async () => {
    setIsLoadingLogs(true)
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)
      if (!error && data) {
        setActivityLogs(data as ActivityLog[])
      }
    } catch (e) {
      console.warn('Activity logs fetch warning:', e)
    } finally {
      setIsLoadingLogs(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchActivityLogs()
    }
  }, [activeTab])

  // 4. 単価マスタ（クラウド保存対応フック）
  const {
    items,
    addItem,
    updateItemPrice,
    deleteItem,
    moveItemUp,
    moveItemDown,
    resetToDefaults,
    syncAllItemsToCloud,
    isSyncing: isSyncingItems,
  } = usePriceMaster()

  const [newItemCategory, setNewItemCategory] = useState('組合搬入分')
  const [newItemName, setNewItemName] = useState('')
  const [newItemUnit, setNewItemUnit] = useState('kg')
  const [newItemPrice, setNewItemPrice] = useState<number | ''>('')
  const [isAddItemOpen, setIsAddItemOpen] = useState(false)
  const [isSavedItems, setIsSavedItems] = useState(false)

  // 5. データバックアップ用
  const { jobs } = useJobs()
  const { customers } = useCustomers()

  // ---------------- 自社情報保存 ----------------
  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    await updateCompanyInfo(companyForm)
    setIsSavedCompany(true)
    setTimeout(() => setIsSavedCompany(false), 4000)
  }

  // ---------------- スタッフ追加 ----------------
  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newStaffName.trim()) return

    const createdProfile = await addStaff(newStaffName.trim(), newStaffRole, newStaffEmail.trim())

    // もし初期パスワードも同時に入力されていた場合はアカウントも即座に発行
    if (createdProfile && newStaffEmail.trim() && newStaffPassword.trim().length >= 6) {
      const normalizedEmail = newStaffEmail.trim().includes('@')
        ? newStaffEmail.trim().toLowerCase()
        : `${newStaffEmail.trim().toLowerCase()}@kenkou.co.jp`

      await supabase.functions.invoke('manage-staff-auth', {
        body: {
          action: 'set_staff_account',
          profileId: createdProfile.id,
          email: normalizedEmail,
          password: newStaffPassword.trim(),
          displayName: createdProfile.display_name,
          role: createdProfile.role,
        },
      })
      await refetchProfiles()
    }

    if (createdProfile) {
      setNewStaffName('')
      setNewStaffEmail('')
      setNewStaffPassword('')
      setIsSavedStaff(true)
      setTimeout(() => setIsSavedStaff(false), 4000)
    }
  }

  const handleDeleteStaff = async (id: string, name: string) => {
    if (confirm(`スタッフ「${name}」を削除してもよろしいですか？`)) {
      await deleteStaff(id)
      setIsSavedStaff(true)
      setTimeout(() => setIsSavedStaff(false), 4000)
    }
  }

  // ---------------- スタッフの直接パスワード発行・変更 ----------------
  const openAccountModal = (profile: Profile) => {
    setAccountModalTarget(profile)
    setAccountEmailInput(profile.email || '')
    setAccountPasswordInput('')
    setAccountModalMsg(null)
  }

  const handleSaveStaffAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!accountModalTarget) return

    setAccountModalMsg(null)
    const rawEmail = accountEmailInput.trim().toLowerCase()
    const normalizedEmail = rawEmail
      ? rawEmail.includes('@')
        ? rawEmail
        : `${rawEmail}@kenkou.co.jp`
      : ''

    if (!normalizedEmail) {
      setAccountModalMsg({ text: 'ログインID（またはメールアドレス）を入力してください。', isError: true })
      return
    }
    if (accountPasswordInput.trim().length < 6) {
      setAccountModalMsg({ text: 'パスワードは6文字以上で入力してください。', isError: true })
      return
    }

    setIsSavingAccount(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const currentActorEmail = userData?.user?.email || null

      const { data, error } = await supabase.functions.invoke('manage-staff-auth', {
        body: {
          action: 'set_staff_account',
          profileId: accountModalTarget.id,
          email: normalizedEmail,
          password: accountPasswordInput.trim(),
          displayName: accountModalTarget.display_name,
          role: accountModalTarget.role,
          actorEmail: currentActorEmail,
        },
      })

      if (error || data?.error) {
        setAccountModalMsg({
          text: `エラー: ${data?.error || error?.message || '設定に失敗しました'}`,
          isError: true,
        })
      } else {
        await updateProfile(accountModalTarget.id, {
          email: normalizedEmail,
          auth_user_id: data?.authUserId || accountModalTarget.auth_user_id,
        })
        await refetchProfiles()
        setAccountModalMsg({
          text: data?.message || '✅ ログインID・パスワードを設定しました！今すぐこの内容でログインできます。',
          isError: false,
        })
        setAccountPasswordInput('')
        setIsSavedStaff(true)
        setTimeout(() => {
          setAccountModalTarget(null)
          setAccountModalMsg(null)
        }, 1800)
      }
    } catch (err: any) {
      setAccountModalMsg({
        text: `通信エラー: ${err.message || String(err)}`,
        isError: true,
      })
    } finally {
      setIsSavingAccount(false)
    }
  }

  // ---------------- 品目マスタ操作 ----------------
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItemName.trim() || newItemPrice === '') return

    await addItem({
      category: newItemCategory,
      name: newItemName.trim(),
      unit: newItemUnit.trim() || 'kg',
      price: Number(newItemPrice),
    })

    setIsSavedItems(true)
    setTimeout(() => setIsSavedItems(false), 4000)

    setNewItemName('')
    setNewItemPrice('')
    setIsAddItemOpen(false)
  }

  const handleEditPrice = async (id: string, currentPrice: number, name: string) => {
    const input = prompt(`「${name}」の新しい参考単価（円）を入力してください:`, currentPrice.toString())
    if (input !== null) {
      const val = parseInt(input, 10)
      if (!isNaN(val) && val >= 0) {
        await updateItemPrice(id, val)
        setIsSavedItems(true)
        setTimeout(() => setIsSavedItems(false), 4000)
      } else {
        alert('有効な金額を入力してください。')
      }
    }
  }

  const handleDeleteItem = async (id: string, name: string) => {
    if (confirm(`品目「${name}」をマスタから削除してもよろしいですか？`)) {
      await deleteItem(id)
      setIsSavedItems(true)
      setTimeout(() => setIsSavedItems(false), 4000)
    }
  }

  const handleResetDefaultItems = async () => {
    if (confirm('回収品目マスタを初期状態に戻しますか？（追加したカスタム品目はリセットされます）')) {
      await resetToDefaults()
      setIsSavedItems(true)
      setTimeout(() => setIsSavedItems(false), 4000)
    }
  }

  // ---------------- 全データバックアップ ----------------
  const handleExportBackup = () => {
    const jobRows = jobs.map((j) => ({
      種別: '案件',
      ID: j.id,
      タイトル: j.title,
      顧客名: j.customers?.name || '',
      電話番号: j.customers?.phone || '',
      住所: j.customers?.address || '',
      ステータス: j.status,
      作業予定日: j.scheduled_date || '',
      登録日時: j.created_at,
    }))

    const custRows = customers.map((c) => ({
      種別: '顧客',
      ID: c.id,
      タイトル: c.name,
      顧客名: c.name,
      電話番号: c.phone || '',
      住所: c.address || '',
      ステータス: 'アクティブ',
      作業予定日: '',
      登録日時: c.created_at,
    }))

    const headers = ['種別', 'ID', 'タイトル', '顧客名', '電話番号', '住所', 'ステータス', '作業予定日', '登録日時']
    const combinedRows = [...jobRows, ...custRows].map((r) => [
      r.種別,
      r.ID,
      `"${r.タイトル.replace(/"/g, '""')}"`,
      `"${r.顧客名.replace(/"/g, '""')}"`,
      `"${r.電話番号.replace(/"/g, '""')}"`,
      `"${r.住所.replace(/"/g, '""')}"`,
      r.ステータス,
      r.作業予定日,
      r.登録日時,
    ])

    const csvContent =
      '\uFEFF' + [headers.join(','), ...combinedRows.map((row) => row.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `Clean_KENKOU_ERP_Backup_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatDateTime = (iso?: string | null) => {
    if (!iso) return '未ログイン'
    try {
      return new Date(iso).toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return iso
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-border shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-slate-900 text-white rounded-lg">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-main tracking-tight">システム設定</h1>
          </div>
          <p className="text-xs text-sub mt-1">
            スタッフのパスワード設定・ログイン履歴確認、自社情報・請求印字設定、AI見積連携用単価マスタを管理します
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-3 shadow-md flex items-center space-x-1.5"
            onClick={() => navigate('/jobs', { state: { openQuoteModal: true } })}
          >
            <ArrowLeft className="w-4 h-4" />
            <Calculator className="w-4 h-4" />
            <span>← 見積作成画面に戻る</span>
          </Button>

          <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-xs text-slate-700">
            <Cloud className="w-4 h-4 text-emerald-600 animate-pulse" />
            <span className="font-semibold">クラウド全社同期</span>
          </div>
        </div>
      </div>

      {/* 2. Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-border bg-white px-4 rounded-xl border shadow-sm overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('staff')}
          className={`flex items-center space-x-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'staff'
              ? 'border-slate-900 text-slate-900 font-bold'
              : 'border-transparent text-sub hover:text-main'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>担当者・スタッフ管理（パスワード設定）</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`flex items-center space-x-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'logs'
              ? 'border-slate-900 text-slate-900 font-bold'
              : 'border-transparent text-sub hover:text-main'
          }`}
        >
          <History className="w-4 h-4" />
          <span>ログイン・操作履歴</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('company')}
          className={`flex items-center space-x-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'company'
              ? 'border-slate-900 text-slate-900 font-bold'
              : 'border-transparent text-sub hover:text-main'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>自社情報・帳票印字設定</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('items')}
          className={`flex items-center space-x-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'items'
              ? 'border-slate-900 text-slate-900 font-bold'
              : 'border-transparent text-sub hover:text-main'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>回収品目・単価マスタ（AI見積用）</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('backup')}
          className={`flex items-center space-x-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'backup'
              ? 'border-slate-900 text-slate-900 font-bold'
              : 'border-transparent text-sub hover:text-main'
          }`}
        >
          <Download className="w-4 h-4" />
          <span>データバックアップ・出力</span>
        </button>
      </div>

      {/* 3. Tab Contents */}

      {/* Tab 1: 担当者・スタッフ管理 */}
      {activeTab === 'staff' && (
        <div className="bg-white p-6 rounded-xl border border-border shadow-sm space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border pb-4">
            <div>
              <h2 className="text-base font-bold text-main">担当者・作業スタッフ管理（ログインアカウント発行）</h2>
              <p className="text-xs text-sub mt-0.5">
                各スタッフの「パスワード設定」ボタンから、実在しない架空のID（例: <code className="bg-slate-100 px-1 py-0.5 rounded">chiba@kenkou.co.jp</code>）でもその場で直接パスワードを設定・変更できます。
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSyncingStaff}
                onClick={async () => {
                  setIsSyncingStaff(true)
                  const res = await syncAllProfiles()
                  setIsSyncingStaff(false)
                  alert(res.message)
                  if (res.success) {
                    setIsSavedStaff(true)
                    setTimeout(() => setIsSavedStaff(false), 4000)
                  }
                }}
                className="bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 font-semibold"
              >
                <Cloud className={`w-3.5 h-3.5 mr-1 text-purple-600 ${isSyncingStaff ? 'animate-spin' : ''}`} />
                {isSyncingStaff ? 'Supabase同期中...' : 'Supabaseへ全件同期'}
              </Button>
            </div>
          </div>

          {/* スタッフ新規追加フォーム */}
          <form onSubmit={handleAddStaff} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="text-xs font-bold text-main flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-slate-700" />
              <span>新しいスタッフを追加</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 items-end">
              <div>
                <label className="block text-[11px] font-semibold text-sub mb-1">役割 / 担当区分</label>
                <select
                  value={newStaffRole}
                  onChange={(e) => setNewStaffRole(e.target.value as StaffRole)}
                  className="w-full p-2 border border-border rounded-lg text-xs bg-white text-main font-medium focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="operator">現場作業員</option>
                  <option value="dispatcher">配車担当</option>
                  <option value="sales">営業担当</option>
                  <option value="clerk">事務担当</option>
                  <option value="admin">管理者</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-sub mb-1">スタッフ氏名 *</label>
                <Input
                  type="text"
                  placeholder="例: 山鹿 太郎"
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  className="text-xs"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-sub mb-1">ログインID / メール (任意)</label>
                <Input
                  type="text"
                  placeholder="例: yamaga@kenkou.co.jp"
                  value={newStaffEmail}
                  onChange={(e) => setNewStaffEmail(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-sub mb-1">初期パスワード (任意・6文字以上)</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={newStaffPassword}
                  onChange={(e) => setNewStaffPassword(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div>
                <Button type="submit" variant="primary" size="sm" className="w-full py-2">
                  <Plus className="w-4 h-4 mr-1" />
                  スタッフ追加
                </Button>
              </div>
            </div>
          </form>

          {isSavedStaff && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-2 shadow-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>担当者・スタッフ情報が更新・保存されました</span>
            </div>
          )}

          {isLoadingProfiles ? (
            <p className="text-xs text-sub py-4">スタッフ一覧を読み込んでいます...</p>
          ) : (
            <div className="border border-border rounded-lg overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-sub border-b border-border font-semibold">
                  <tr>
                    <th className="py-3 px-4">表示名（スタッフ名）</th>
                    <th className="py-3 px-4">役割 / 担当区分</th>
                    <th className="py-3 px-4">ログインID（メールアドレス）</th>
                    <th className="py-3 px-4">アカウント状態 / 最終ログイン</th>
                    <th className="py-3 px-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {profiles.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-sub">
                        まだ登録されたスタッフはいません
                      </td>
                    </tr>
                  ) : (
                    profiles.map((profile) => {
                      const roleInfo = getRoleInfo(profile.role)
                      const isAccountReady = Boolean(profile.auth_user_id)

                      return (
                        <tr key={profile.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-bold text-main">
                            {profile.display_name || '名前未設定'}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-semibold border ${roleInfo.style}`}
                              >
                                <ShieldCheck className="w-3 h-3 mr-1" />
                                {roleInfo.label}
                              </span>
                              <select
                                value={profile.role}
                                onChange={async (e) => {
                                  await updateProfile(profile.id, { role: e.target.value as StaffRole })
                                  setIsSavedStaff(true)
                                  setTimeout(() => setIsSavedStaff(false), 4000)
                                }}
                                className="p-1 border border-border rounded text-[11px] bg-white text-main font-medium focus:outline-none focus:ring-1 focus:ring-slate-900"
                              >
                                <option value="operator">現場作業員</option>
                                <option value="dispatcher">配車担当</option>
                                <option value="sales">営業担当</option>
                                <option value="clerk">事務担当</option>
                                <option value="admin">管理者</option>
                              </select>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-1.5 text-slate-700">
                              <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span className="font-mono text-[11px] font-semibold">
                                {profile.email || <span className="text-slate-400">未設定</span>}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-col space-y-0.5">
                              {isAccountReady ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  パスワード設定済
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700">
                                  <Lock className="w-3 h-3 text-amber-500" />
                                  パスワード未設定
                                </span>
                              )}
                              <span className="text-[10px] text-sub flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                最終: {formatDateTime(profile.last_login_at)}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              onClick={() => openAccountModal(profile)}
                              className="text-[11px] py-1.5 px-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-xs"
                              title="このスタッフのログインIDとパスワードを直接設定・変更します"
                            >
                              <Key className="w-3.5 h-3.5 mr-1 text-amber-400" />
                              パスワード設定
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                const newName = prompt('表示名を入力してください', profile.display_name || '')
                                if (newName !== null && newName.trim()) {
                                  await updateProfile(profile.id, { display_name: newName.trim() })
                                  setIsSavedStaff(true)
                                  setTimeout(() => setIsSavedStaff(false), 4000)
                                }
                              }}
                              className="text-[11px] py-1 px-2"
                            >
                              名前変更
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteStaff(profile.id, profile.display_name || 'スタッフ')}
                              className="hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 py-1 px-2"
                            >
                              <Trash2 className="w-3 h-3 text-rose-500" />
                            </Button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* スタッフ直接パスワード設定モーダル */}
      {accountModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl border border-border shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-main flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-amber-600" />
                  <span>{accountModalTarget.display_name} さんのログイン設定</span>
                </h3>
                <p className="text-[11px] text-sub mt-0.5">
                  確認メール不要で、今すぐログインできるパスワードを直接設定します
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAccountModalTarget(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            {accountModalMsg && (
              <div
                className={`p-3 rounded-lg text-xs font-semibold ${
                  accountModalMsg.isError
                    ? 'bg-rose-50 border border-rose-200 text-rose-800'
                    : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                }`}
              >
                {accountModalMsg.text}
              </div>
            )}

            <form onSubmit={handleSaveStaffAccount} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-main mb-1">
                  ログインID / メールアドレス <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="text"
                  placeholder="例: chiba@kenkou.co.jp または chiba"
                  value={accountEmailInput}
                  onChange={(e) => setAccountEmailInput(e.target.value)}
                  required
                />
                <p className="text-[11px] text-sub mt-1">
                  ※実在しない社内用アドレス（<code className="bg-slate-100 px-1 rounded">〇〇@kenkou.co.jp</code>）で問題ありません。ログイン時は <code className="bg-slate-100 px-1 rounded">@</code> より前のIDだけでも入れます。
                </p>
              </div>

              <div>
                <label className="block font-bold text-main mb-1">
                  設定するパスワード（6文字以上） <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="text"
                  placeholder="例: kenkou1234"
                  value={accountPasswordInput}
                  onChange={(e) => setAccountPasswordInput(e.target.value)}
                  required
                  autoFocus
                />
                <p className="text-[11px] text-sub mt-1">
                  ※入力ミスを防ぐため文字が見える状態で表示しています。6文字以上の英数字を設定してください。
                </p>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAccountModalTarget(null)}
                >
                  キャンセル
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isSavingAccount}
                  className="font-bold px-4"
                >
                  この内容でパスワードを確定・保存
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tab 2: ログイン・操作履歴 */}
      {activeTab === 'logs' && (
        <div className="bg-white p-6 rounded-xl border border-border shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h2 className="text-base font-bold text-main">ログイン・操作履歴一覧</h2>
              <p className="text-xs text-sub">
                誰が・いつログインしたか、どの案件を受付登録したかの履歴がリアルタイムに記録されます
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchActivityLogs}
              disabled={isLoadingLogs}
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoadingLogs ? 'animate-spin' : ''}`} />
              最新の履歴に更新
            </Button>
          </div>

          {isLoadingLogs ? (
            <p className="text-xs text-sub py-6 text-center">履歴を読み込んでいます...</p>
          ) : (
            <div className="border border-border rounded-lg overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-sub border-b border-border font-semibold">
                  <tr>
                    <th className="py-3 px-4 w-44">日時</th>
                    <th className="py-3 px-4 w-40">スタッフ名</th>
                    <th className="py-3 px-4 w-32">種別</th>
                    <th className="py-3 px-4">操作内容・詳細</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {activityLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-sub">
                        まだ履歴データがありません（ログインや受付操作を行うとここに自動記録されます）
                      </td>
                    </tr>
                  ) : (
                    activityLogs.map((log) => {
                      const badge =
                        log.action_type === 'login'
                          ? { label: 'ログイン', style: 'bg-emerald-100 text-emerald-800 border-emerald-200' }
                          : log.action_type === 'logout'
                          ? { label: 'ログアウト', style: 'bg-slate-100 text-slate-700 border-slate-200' }
                          : log.action_type === 'job_create'
                          ? { label: '新規受付', style: 'bg-blue-100 text-blue-800 border-blue-200' }
                          : log.action_type === 'account_update'
                          ? { label: 'アカウント設定', style: 'bg-amber-100 text-amber-800 border-amber-200' }
                          : { label: log.action_type, style: 'bg-purple-100 text-purple-800 border-purple-200' }

                      return (
                        <tr key={log.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-mono text-[11px] text-sub whitespace-nowrap">
                            {formatDateTime(log.created_at)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-main">{log.staff_name}</div>
                            {log.staff_email && (
                              <div className="text-[10px] text-sub font-mono">{log.staff_email}</div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ${badge.style}`}
                            >
                              {badge.label}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-main font-medium">{log.description}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: 自社情報 */}
      {activeTab === 'company' && (
        <form onSubmit={handleSaveCompany} className="bg-white p-6 rounded-xl border border-border shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h2 className="text-base font-bold text-main">自社基本情報設定</h2>
              <p className="text-xs text-sub">請求書・作業指示書等に印刷される会社情報です</p>
            </div>
            {isSavedCompany && (
              <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 shadow-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                クラウドへ保存されました（他の方の画面にも反映中）
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-main mb-1">会社名 / 屋号</label>
              <Input
                type="text"
                value={companyForm.name}
                onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-main mb-1">インボイス登録番号</label>
              <Input
                type="text"
                placeholder="例: T1234567890123"
                value={companyForm.invoiceNo}
                onChange={(e) => setCompanyForm({ ...companyForm, invoiceNo: e.target.value })}
              />
            </div>

            <div>
              <label className="block font-semibold text-main mb-1">郵便番号</label>
              <Input
                type="text"
                value={companyForm.postalCode}
                onChange={(e) => setCompanyForm({ ...companyForm, postalCode: e.target.value })}
              />
            </div>

            <div>
              <label className="block font-semibold text-main mb-1">所在地・住所</label>
              <Input
                type="text"
                value={companyForm.address}
                onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
              />
            </div>

            <div>
              <label className="block font-semibold text-main mb-1">電話番号</label>
              <Input
                type="text"
                value={companyForm.tel}
                onChange={(e) => setCompanyForm({ ...companyForm, tel: e.target.value })}
              />
            </div>

            <div>
              <label className="block font-semibold text-main mb-1">FAX番号</label>
              <Input
                type="text"
                value={companyForm.fax}
                onChange={(e) => setCompanyForm({ ...companyForm, fax: e.target.value })}
              />
            </div>
          </div>

          {/* 振込先口座設定 */}
          <div className="pt-4 border-t border-border">
            <h3 className="text-sm font-bold text-main mb-3">振込先口座情報（請求書用）</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-main mb-1">金融機関名</label>
                <Input
                  type="text"
                  placeholder="例: 肥後銀行"
                  value={companyForm.bankName}
                  onChange={(e) => setCompanyForm({ ...companyForm, bankName: e.target.value })}
                />
              </div>

              <div>
                <label className="block font-semibold text-main mb-1">支店名</label>
                <Input
                  type="text"
                  placeholder="例: 山鹿支店"
                  value={companyForm.bankBranch}
                  onChange={(e) => setCompanyForm({ ...companyForm, bankBranch: e.target.value })}
                />
              </div>

              <div>
                <label className="block font-semibold text-main mb-1">口座種別・番号</label>
                <div className="flex space-x-2">
                  <select
                    value={companyForm.bankAccountType}
                    onChange={(e) => setCompanyForm({ ...companyForm, bankAccountType: e.target.value })}
                    className="p-2 border border-border rounded-md text-xs"
                  >
                    <option value="普通">普通</option>
                    <option value="当座">当座</option>
                  </select>
                  <Input
                    type="text"
                    placeholder="1234567"
                    value={companyForm.bankAccountNumber}
                    onChange={(e) => setCompanyForm({ ...companyForm, bankAccountNumber: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="mt-3 text-xs">
              <label className="block font-semibold text-main mb-1">口座名義（カナ）</label>
              <Input
                type="text"
                placeholder="例: ユウゲンガイシャ クリーンケンコウシャ"
                value={companyForm.bankAccountName}
                onChange={(e) => setCompanyForm({ ...companyForm, bankAccountName: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-slate-500 flex items-center gap-1">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>変更内容はクラウドに保存され全使用者に自動共有されます</span>
            </div>
            <Button type="submit" variant="primary" size="sm" disabled={isSyncingCompany}>
              {isSyncingCompany ? (
                <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Cloud className="w-4 h-4 mr-1.5 text-blue-400" />
              )}
              {isSyncingCompany ? 'クラウド保存中...' : 'クラウド（Supabase）へ保存・同期する'}
            </Button>
          </div>
        </form>
      )}

      {/* Tab 4: 回収品目・単価マスタ（編集・追加可能） */}
      {activeTab === 'items' && (
        <div className="bg-white p-6 rounded-xl border border-border shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-main">回収品目・単価参考マスタ</h2>
                <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded text-[11px] font-semibold">
                  <Sparkles className="w-3 h-3" />
                  AI見積もり連携対応
                </span>
              </div>
              <p className="text-xs text-sub mt-1">
                見積および回収実績計算・AI自動概算見積もりに使用する単価マスタです。自由に追加・編集いただけます。
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSyncingItems}
                onClick={async () => {
                  const res = await syncAllItemsToCloud()
                  alert(res.message)
                  if (res.success) {
                    setIsSavedItems(true)
                    setTimeout(() => setIsSavedItems(false), 4000)
                  }
                }}
                className="bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 font-semibold"
                title="現在表示されている全単価品目をSupabaseクラウドへ一括同期・保存します"
              >
                <Cloud className={`w-3.5 h-3.5 mr-1 text-purple-600 ${isSyncingItems ? 'animate-spin' : ''}`} />
                {isSyncingItems ? 'クラウド同期中...' : 'クラウドへ全件同期'}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetDefaultItems}
                title="初期状態に戻す"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1 text-slate-500" />
                初期化
              </Button>

              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setIsAddItemOpen(!isAddItemOpen)}
              >
                <Plus className="w-4 h-4 mr-1" />
                品目を新規追加
              </Button>
            </div>
          </div>

          {/* Gemini API Key (Google AI Studio 無料枠対応) 設定カード */}
          <div className="p-4 bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 border border-purple-200 rounded-xl space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-purple-600 flex-shrink-0" />
                <span className="text-xs font-bold text-slate-800">
                  Google Gemini 2.0 Flash AI 画像解析キー設定（1日1,500回 完全無料枠）
                </span>
              </div>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-purple-700 hover:text-purple-900 hover:underline flex items-center gap-1"
              >
                <span>無料APIキーを取得する (AI Studio)</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <p className="text-[11px] text-slate-600">
              Gemini APIキーはSupabase Edge Functionサーバーサイド環境変数（`GEMINI_API_KEY`）で全社一括かつ安全に保護されています。
            </p>
            <div className="flex items-center space-x-2 pt-1">
              <div className="text-xs font-medium text-emerald-800 bg-emerald-100 border border-emerald-300 px-3 py-1.5 rounded-md flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>サーバーサイドプロキシ構成（APIキー完全保護中）</span>
              </div>
            </div>
          </div>

          {(isSavedItems || isSyncingItems) && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-2 shadow-sm">
              {isSyncingItems ? (
                <RefreshCw className="w-4 h-4 text-emerald-600 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              )}
              {isSyncingItems
                ? 'クラウド保存・同期処理中...'
                : 'クラウドへ保存・共有されました（他の方の画面やAI見積もりに即時反映されます）'}
            </div>
          )}

          {/* 新規品目追加フォーム */}
          {isAddItemOpen && (
            <form onSubmit={handleAddItem} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <h3 className="text-xs font-bold text-main">＋ 新しい回収品目の登録</h3>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-sub mb-1">分類</label>
                  <select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                    className="w-full p-2 bg-white border border-border rounded-md"
                  >
                    <option value="組合搬入分">組合搬入分</option>
                    <option value="４家電">４家電</option>
                    <option value="その他自社処理">その他自社処理</option>
                    <option value="現場搬出・作業料">現場搬出・作業料</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-sub mb-1">品目名 *</label>
                  <Input
                    type="text"
                    placeholder="例: パソコン本体, 木工家具"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-sub mb-1">単位</label>
                  <Input
                    type="text"
                    placeholder="例: kg, 台, ㎥, 式"
                    value={newItemUnit}
                    onChange={(e) => setNewItemUnit(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-sub mb-1">参考単価（円） *</label>
                  <Input
                    type="number"
                    placeholder="例: 3000"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsAddItemOpen(false)}>
                  キャンセル
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  登録保存
                </Button>
              </div>
            </form>
          )}

          {/* 品目マスタテーブル */}
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-sub border-b border-border font-semibold">
                <tr>
                  <th className="py-3 px-3 text-center w-16">順序</th>
                  <th className="py-3 px-4">分類</th>
                  <th className="py-3 px-4">品目名</th>
                  <th className="py-3 px-4">単位</th>
                  <th className="py-3 px-4 text-right">参考単価 (円)</th>
                  <th className="py-3 px-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-sub">
                      品目マスタが登録されていません。「品目を新規追加」ボタンから追加してください。
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-2 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveItemUp(idx)}
                            className="p-1 hover:bg-slate-200 rounded disabled:opacity-30 transition-colors text-slate-700"
                            title="上に移動"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === items.length - 1}
                            onClick={() => moveItemDown(idx)}
                            className="p-1 hover:bg-slate-200 rounded disabled:opacity-30 transition-colors text-slate-700"
                            title="下に移動"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sub font-medium">{item.category}</td>
                      <td className="py-3 px-4 font-bold text-main">{item.name}</td>
                      <td className="py-3 px-4 text-sub">{item.unit}</td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-700">
                        ¥ {item.price.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right space-x-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditPrice(item.id, item.price, item.name)}
                          title="単価を変更"
                        >
                          <Edit2 className="w-3 h-3 mr-1 text-slate-600" />
                          単価変更
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteItem(item.id, item.name)}
                          title="品目を削除"
                          className="hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200"
                        >
                          <Trash2 className="w-3 h-3 text-rose-500" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: バックアップ */}
      {activeTab === 'backup' && (
        <div className="bg-white p-6 rounded-xl border border-border shadow-sm space-y-6">
          <div className="border-b border-border pb-4">
            <h2 className="text-base font-bold text-main">全データバックアップ・出力</h2>
            <p className="text-xs text-sub">システム内のすべての案件データ・顧客データをCSVで一括出力します</p>
          </div>

          <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl space-y-4 max-w-xl">
            <h3 className="text-sm font-bold text-main flex items-center gap-2">
              <Download className="w-4 h-4 text-blue-600" />
              一括全件CSVエクスポート
            </h3>
            <p className="text-xs text-sub leading-relaxed">
              現在登録されている全案件データおよび顧客情報を統合CSVとしてまとめてダウンロードします。
              バックアップやExcelでの独自分析にご活用いただけます。
            </p>

            <Button type="button" variant="primary" size="sm" onClick={handleExportBackup}>
              <Download className="w-4 h-4 mr-1.5" />
              バックアップCSVをダウンロード
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
