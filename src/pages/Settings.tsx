import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Settings as SettingsIcon,
  Building2,
  Users,
  Package,
  Save,
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
} from 'lucide-react'
import { useProfiles, getRoleInfo, StaffRole } from '../hooks/useProfiles'
import { useJobs } from '../hooks/useJobs'
import { useCustomers } from '../hooks/useCustomers'
import { useCompanySettings, CompanyInfo, DEFAULT_COMPANY_INFO } from '../hooks/useCompanySettings'
import { usePriceMaster } from '../hooks/usePriceMaster'
import { Input, Button } from '../components/ui'

export const Settings: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const isReturnFromQuote = Boolean(location.state?.returnToQuote)

  const [activeTab, setActiveTab] = useState<'company' | 'staff' | 'items' | 'backup'>(
    isReturnFromQuote ? 'items' : 'company'
  )

  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => {
    return import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem('clean_kenkou_gemini_api_key') || ''
  })

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
  const { profiles, isLoading: isLoadingProfiles, updateProfile, addStaff, deleteStaff } = useProfiles()
  const [newStaffName, setNewStaffName] = useState('')
  const [newStaffRole, setNewStaffRole] = useState<StaffRole>('operator')
  const [isSavedStaff, setIsSavedStaff] = useState(false)

  // 3. 単価マスタ（クラウド保存対応フック）
  const {
    items,
    addItem,
    updateItemPrice,
    deleteItem,
    moveItemUp,
    moveItemDown,
    resetToDefaults,
    isSyncing: isSyncingItems,
  } = usePriceMaster()


  const [newItemCategory, setNewItemCategory] = useState('組合搬入分')
  const [newItemName, setNewItemName] = useState('')
  const [newItemUnit, setNewItemUnit] = useState('kg')
  const [newItemPrice, setNewItemPrice] = useState<number | ''>('')
  const [isAddItemOpen, setIsAddItemOpen] = useState(false)
  const [isSavedItems, setIsSavedItems] = useState(false)

  // 4. データバックアップ用
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
    const success = await addStaff(newStaffName.trim(), newStaffRole)
    if (success) {
      setNewStaffName('')
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
            自社情報・請求印字設定、担当スタッフ管理、AI見積連携用単価マスタ、全データバックアップを管理します
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* 見積作成から移動してきた場合、または現場用に戻るアクションボタン */}
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
          onClick={() => setActiveTab('staff')}
          className={`flex items-center space-x-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'staff'
              ? 'border-slate-900 text-slate-900 font-bold'
              : 'border-transparent text-sub hover:text-main'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>担当者・スタッフ管理</span>
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

      {/* Tab 1: 自社情報 */}
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
                <Save className="w-4 h-4 mr-1.5" />
              )}
              {isSyncingCompany ? 'クラウド保存中...' : '自社情報を保存する'}
            </Button>
          </div>
        </form>
      )}

      {/* Tab 2: 担当者・スタッフ管理 */}
      {activeTab === 'staff' && (
        <div className="bg-white p-6 rounded-xl border border-border shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
            <div>
              <h2 className="text-base font-bold text-main">担当者・作業スタッフ管理</h2>
              <p className="text-xs text-sub">受付担当者やドライバーの表示名および権限を設定します</p>
            </div>

            <form onSubmit={handleAddStaff} className="flex items-center space-x-2">
              <select
                value={newStaffRole}
                onChange={(e) => setNewStaffRole(e.target.value as StaffRole)}
                className="p-2 border border-border rounded-lg text-xs bg-white text-main font-medium focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="operator">現場作業員</option>
                <option value="dispatcher">配車担当</option>
                <option value="sales">営業担当</option>
                <option value="clerk">事務担当</option>
                <option value="admin">管理者</option>
              </select>
              <Input
                type="text"
                placeholder="新しいスタッフ名を入力..."
                value={newStaffName}
                onChange={(e) => setNewStaffName(e.target.value)}
                className="text-xs max-w-xs"
              />
              <Button type="submit" variant="primary" size="sm">
                <Plus className="w-4 h-4 mr-1" />
                追加
              </Button>
            </form>
          </div>

          {isSavedStaff && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-2 shadow-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>担当者・スタッフ情報が更新・保存されました</span>
            </div>
          )}

          {isLoadingProfiles ? (
            <p className="text-xs text-sub py-4">スタッフ一覧を読み込んでいます...</p>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-sub border-b border-border">
                  <tr>
                    <th className="py-3 px-4">表示名（スタッフ名）</th>
                    <th className="py-3 px-4">役割 / 担当区分</th>
                    <th className="py-3 px-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {profiles.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-sub">
                        まだ登録されたスタッフはいません
                      </td>
                    </tr>
                  ) : (
                    profiles.map((profile) => {
                      const roleInfo = getRoleInfo(profile.role)

                      return (
                        <tr key={profile.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-semibold text-main">
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
                          <td className="py-3 px-4 text-right space-x-1">
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
                            >
                              名前を変更
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteStaff(profile.id, profile.display_name || 'スタッフ')}
                              className="hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200"
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

      {/* Tab 3: 回収品目・単価マスタ（編集・追加可能） */}
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
              Google AI Studioで作成した無料APIキー（1日1,500リクエスト完全無料）を入力すると、不用品写真の現場撮影・貼り付けから超高速なAI品目・体積自動算定が有効になります。
            </p>
            <div className="flex items-center space-x-2 pt-1">
              <Input
                type="password"
                placeholder="AIzaSy... (無料APIキー)"
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                className="text-xs font-mono bg-white flex-1"
              />
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => {
                  if (!geminiApiKey.trim()) {
                    localStorage.removeItem('clean_kenkou_gemini_api_key')
                    alert('APIキーの登録をクリアしました。')
                  } else {
                    localStorage.setItem('clean_kenkou_gemini_api_key', geminiApiKey.trim())
                    alert('Gemini APIキー（無料枠）を正常に保存しました！見積作成画面で本物のAI解析が利用できます。')
                  }
                }}
              >
                APIキーを保存
              </Button>
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

      {/* Tab 4: バックアップ */}
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
