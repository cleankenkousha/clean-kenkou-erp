import React, { useState } from 'react'
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
} from 'lucide-react'
import { useProfiles } from '../hooks/useProfiles'
import { useJobs } from '../hooks/useJobs'
import { useCustomers } from '../hooks/useCustomers'
import { Input, Button } from '../components/ui'

// 初期自社情報型
interface CompanyInfo {
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

const DEFAULT_COMPANY_INFO: CompanyInfo = {
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

// 品目マスタ型
export interface ItemPriceMaster {
  id: string
  category: string
  name: string
  unit: string
  price: number
}

const DEFAULT_ITEMS: ItemPriceMaster[] = [
  { id: '1', category: '組合搬入分', name: '金物・危険物', unit: 'kg', price: 50 },
  { id: '2', category: '組合搬入分', name: '不燃粗大', unit: 'kg', price: 60 },
  { id: '3', category: '組合搬入分', name: 'びん類', unit: 'kg', price: 40 },
  { id: '4', category: '４家電', name: '冷蔵庫（170L以下）', unit: '台', price: 4000 },
  { id: '5', category: '４家電', name: '洗濯機・衣類乾燥機', unit: '台', price: 3000 },
  { id: '6', category: '４家電', name: 'エアコン', unit: '台', price: 2500 },
  { id: '7', category: 'その他自社処理', name: '可燃物', unit: 'kg', price: 45 },
  { id: '8', category: 'その他自社処理', name: '可燃粗大（木製家具等）', unit: 'kg', price: 55 },
  { id: '9', category: 'その他自社処理', name: '混合廃棄物', unit: 'kg', price: 70 },
  { id: '10', category: 'その他自社処理', name: '搬出基本料（2F以上/特殊環境）', unit: '㎥', price: 1500 },
]

export const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'company' | 'staff' | 'items' | 'backup'>('company')

  // 1. 自社情報
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>(() => {
    const saved = localStorage.getItem('clean_kenkou_company_info')
    return saved ? JSON.parse(saved) : DEFAULT_COMPANY_INFO
  })
  const [isSavedCompany, setIsSavedCompany] = useState(false)

  // 2. スタッフ・担当者
  const { profiles, isLoading: isLoadingProfiles, updateProfile, addStaff } = useProfiles()
  const [newStaffName, setNewStaffName] = useState('')

  // 3. 単価マスタ（編集・永続化対応）
  const [items, setItems] = useState<ItemPriceMaster[]>(() => {
    const saved = localStorage.getItem('clean_kenkou_price_master')
    return saved ? JSON.parse(saved) : DEFAULT_ITEMS
  })

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
  const handleSaveCompany = (e: React.FormEvent) => {
    e.preventDefault()
    localStorage.setItem('clean_kenkou_company_info', JSON.stringify(companyInfo))
    setIsSavedCompany(true)
    setTimeout(() => setIsSavedCompany(false), 3000)
  }

  // ---------------- スタッフ追加 ----------------
  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newStaffName.trim()) return
    const success = await addStaff(newStaffName.trim())
    if (success) {
      setNewStaffName('')
    }
  }

  // ---------------- 品目マスタ操作 ----------------
  const saveItemsToStorage = (updatedItems: ItemPriceMaster[]) => {
    setItems(updatedItems)
    localStorage.setItem('clean_kenkou_price_master', JSON.stringify(updatedItems))
    setIsSavedItems(true)
    setTimeout(() => setIsSavedItems(false), 3000)
  }

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItemName.trim() || newItemPrice === '') return

    const newItem: ItemPriceMaster = {
      id: crypto.randomUUID(),
      category: newItemCategory,
      name: newItemName.trim(),
      unit: newItemUnit.trim() || 'kg',
      price: Number(newItemPrice),
    }

    const updated = [...items, newItem]
    saveItemsToStorage(updated)

    setNewItemName('')
    setNewItemPrice('')
    setIsAddItemOpen(false)
  }

  const handleEditPrice = (id: string, currentPrice: number, name: string) => {
    const input = prompt(`「${name}」の新しい参考単価（円）を入力してください:`, currentPrice.toString())
    if (input !== null) {
      const val = parseInt(input, 10)
      if (!isNaN(val) && val >= 0) {
        const updated = items.map((item) => (item.id === id ? { ...item, price: val } : item))
        saveItemsToStorage(updated)
      } else {
        alert('有効な金額を入力してください。')
      }
    }
  }

  const handleDeleteItem = (id: string, name: string) => {
    if (confirm(`品目「${name}」をマスタから削除してもよろしいですか？`)) {
      const updated = items.filter((item) => item.id !== id)
      saveItemsToStorage(updated)
    }
  }

  const handleResetDefaultItems = () => {
    if (confirm('回収品目マスタを初期状態に戻しますか？（追加したカスタム品目はリセットされます）')) {
      saveItemsToStorage(DEFAULT_ITEMS)
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
              <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                <CheckCircle2 className="w-4 h-4" />
                設定を保存しました
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-main mb-1">会社名 / 屋号</label>
              <Input
                type="text"
                value={companyInfo.name}
                onChange={(e) => setCompanyInfo({ ...companyInfo, name: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-main mb-1">インボイス登録番号</label>
              <Input
                type="text"
                placeholder="例: T1234567890123"
                value={companyInfo.invoiceNo}
                onChange={(e) => setCompanyInfo({ ...companyInfo, invoiceNo: e.target.value })}
              />
            </div>

            <div>
              <label className="block font-semibold text-main mb-1">郵便番号</label>
              <Input
                type="text"
                value={companyInfo.postalCode}
                onChange={(e) => setCompanyInfo({ ...companyInfo, postalCode: e.target.value })}
              />
            </div>

            <div>
              <label className="block font-semibold text-main mb-1">所在地・住所</label>
              <Input
                type="text"
                value={companyInfo.address}
                onChange={(e) => setCompanyInfo({ ...companyInfo, address: e.target.value })}
              />
            </div>

            <div>
              <label className="block font-semibold text-main mb-1">電話番号</label>
              <Input
                type="text"
                value={companyInfo.tel}
                onChange={(e) => setCompanyInfo({ ...companyInfo, tel: e.target.value })}
              />
            </div>

            <div>
              <label className="block font-semibold text-main mb-1">FAX番号</label>
              <Input
                type="text"
                value={companyInfo.fax}
                onChange={(e) => setCompanyInfo({ ...companyInfo, fax: e.target.value })}
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
                  value={companyInfo.bankName}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, bankName: e.target.value })}
                />
              </div>

              <div>
                <label className="block font-semibold text-main mb-1">支店名</label>
                <Input
                  type="text"
                  placeholder="例: 山鹿支店"
                  value={companyInfo.bankBranch}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, bankBranch: e.target.value })}
                />
              </div>

              <div>
                <label className="block font-semibold text-main mb-1">口座種別・番号</label>
                <div className="flex space-x-2">
                  <select
                    value={companyInfo.bankAccountType}
                    onChange={(e) => setCompanyInfo({ ...companyInfo, bankAccountType: e.target.value })}
                    className="p-2 border border-border rounded-md text-xs"
                  >
                    <option value="普通">普通</option>
                    <option value="当座">当座</option>
                  </select>
                  <Input
                    type="text"
                    placeholder="1234567"
                    value={companyInfo.bankAccountNumber}
                    onChange={(e) => setCompanyInfo({ ...companyInfo, bankAccountNumber: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="mt-3 text-xs">
              <label className="block font-semibold text-main mb-1">口座名義（カナ）</label>
              <Input
                type="text"
                placeholder="例: ユウゲンガイシャ クリーンケンコウシャ"
                value={companyInfo.bankAccountName}
                onChange={(e) => setCompanyInfo({ ...companyInfo, bankAccountName: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" variant="primary" size="sm">
              <Save className="w-4 h-4 mr-1.5" />
              自社情報を保存する
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

          {isLoadingProfiles ? (
            <p className="text-xs text-sub py-4">スタッフ一覧を読み込んでいます...</p>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-sub border-b border-border">
                  <tr>
                    <th className="py-3 px-4">表示名（スタッフ名）</th>
                    <th className="py-3 px-4">役割 / 権限</th>
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
                    profiles.map((profile) => (
                      <tr key={profile.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-semibold text-main">
                          {profile.display_name || '名前未設定'}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                              profile.role === 'admin'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            <ShieldCheck className="w-3 h-3 mr-1" />
                            {profile.role === 'admin' ? '管理者' : '作業オペレーター'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const newName = prompt('表示名を入力してください', profile.display_name || '')
                              if (newName !== null) {
                                updateProfile(profile.id, { display_name: newName.trim() })
                              }
                            }}
                          >
                            名前を変更
                          </Button>
                        </td>
                      </tr>
                    ))
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

          {isSavedItems && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              回収品目マスタを更新・保存しました（AI見積もりに反映されます）
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
                    <td colSpan={5} className="py-6 text-center text-sub">
                      品目マスタが登録されていません。「品目を新規追加」ボタンから追加してください。
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
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
