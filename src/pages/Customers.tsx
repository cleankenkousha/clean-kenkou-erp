import React, { useState, useMemo } from 'react'
import {
  Users,
  Search,
  Plus,
  Phone,
  MapPin,
  Edit2,
  Trash2,
  Briefcase,
  ExternalLink,
  UserCheck,
  Building2,
  RefreshCw,
} from 'lucide-react'
import { useCustomers, CustomerWithJobCount } from '../hooks/useCustomers'
import { CustomerModal } from '../components/features/CustomerModal'
import { Input, Button } from '../components/ui'

export const Customers: React.FC = () => {
  const { customers, isLoading, error, refetch, addCustomer, updateCustomer, deleteCustomer } =
    useCustomers()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithJobCount | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // インクリメンタル検索フィルター
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers

    const query = searchQuery.toLowerCase().trim()
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        (c.phone && c.phone.includes(query)) ||
        (c.address && c.address.toLowerCase().includes(query))
    )
  }, [customers, searchQuery])

  // 統計 KPI
  const totalCount = customers.length
  const activeCount = useMemo(
    () => customers.filter((c) => (c.job_count || 0) > 0).length,
    [customers]
  )
  const phoneCount = useMemo(
    () => customers.filter((c) => Boolean(c.phone)).length,
    [customers]
  )

  const handleOpenAddModal = () => {
    setSelectedCustomer(null)
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (customer: CustomerWithJobCount) => {
    setSelectedCustomer(customer)
    setIsModalOpen(true)
  }

  const handleSaveCustomer = async (data: { name: string; phone?: string; address?: string }) => {
    if (selectedCustomer) {
      return await updateCustomer(selectedCustomer.id, data)
    } else {
      const newCust = await addCustomer(data)
      return newCust !== null
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`「${name}」様を一覧から削除してもよろしいですか？`)) {
      setDeletingId(id)
      await deleteCustomer(id)
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* 1. Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-border shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-slate-900 text-white rounded-lg">
              <Users className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-main tracking-tight">顧客管理</h1>
          </div>
          <p className="text-xs text-sub mt-1">
            収集依頼者・お取引先様の情報閲覧および一元管理を行えます
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            title="最新データに更新"
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button type="button" variant="primary" size="sm" onClick={handleOpenAddModal}>
            <Plus className="w-4 h-4 mr-1.5" />
            新規顧客登録
          </Button>
        </div>
      </div>

      {/* 2. KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-border shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-sub">総顧客数</p>
            <p className="text-2xl font-bold text-main mt-1">{totalCount} <span className="text-xs font-normal text-sub">件</span></p>
          </div>
          <div className="p-3 bg-slate-100 text-slate-700 rounded-xl">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-border shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-sub">取引実績あり</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{activeCount} <span className="text-xs font-normal text-sub">件</span></p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
            <Briefcase className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-border shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-sub">連絡先登録率</p>
            <p className="text-2xl font-bold text-blue-700 mt-1">
              {totalCount > 0 ? Math.round((phoneCount / totalCount) * 100) : 0}%
            </p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-border shadow-sm flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-sub absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            type="text"
            placeholder="顧客名・電話番号・住所でインクリメンタル検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>
        <div className="text-xs text-sub hidden sm:block">
          該当: <span className="font-semibold text-main">{filteredCustomers.length}</span> 件
        </div>
      </div>

      {/* 4. Customer List / Table */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        {error && (
          <div className="p-4 bg-rose-50 border-b border-rose-200 text-rose-700 text-xs">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="p-12 text-center text-sub text-xs space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-slate-400" />
            <p>顧客データを読み込んでいます...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-12 text-center text-sub text-xs space-y-3">
            <Users className="w-8 h-8 mx-auto text-slate-300" />
            <p className="font-medium text-main text-sm">顧客データが見つかりません</p>
            <p className="text-sub max-w-sm mx-auto">
              {searchQuery
                ? `「${searchQuery}」に一致する顧客はありません。条件を変更して再検索してください。`
                : 'まだ顧客が登録されていません。右上ボタンから登録できます。'}
            </p>
            {!searchQuery && (
              <Button type="button" variant="primary" size="sm" onClick={handleOpenAddModal}>
                <Plus className="w-4 h-4 mr-1" />
                最初の顧客を登録する
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-border text-sub font-semibold">
                  <th className="py-3 px-4">顧客名</th>
                  <th className="py-3 px-4">電話番号</th>
                  <th className="py-3 px-4">住所</th>
                  <th className="py-3 px-4 text-center">案件実績</th>
                  <th className="py-3 px-4">登録日</th>
                  <th className="py-3 px-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    {/* 顧客名 */}
                    <td className="py-3.5 px-4 font-semibold text-main">
                      <div className="flex items-center space-x-2">
                        <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs flex-shrink-0 border border-slate-200">
                          {customer.name.slice(0, 1)}
                        </div>
                        <span className="truncate max-w-[180px]">{customer.name}</span>
                      </div>
                    </td>

                    {/* 電話番号 */}
                    <td className="py-3.5 px-4 text-sub">
                      {customer.phone ? (
                        <a
                          href={`tel:${customer.phone.replace(/[^0-9]/g, '')}`}
                          className="flex items-center space-x-1.5 text-slate-700 hover:text-blue-600 font-medium transition-colors inline-flex"
                          title="電話をかける"
                        >
                          <Phone className="w-3.5 h-3.5 text-sub group-hover:text-blue-500" />
                          <span>{customer.phone}</span>
                        </a>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* 住所 */}
                    <td className="py-3.5 px-4 text-sub">
                      {customer.address ? (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            customer.address
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-1.5 text-slate-700 hover:text-blue-600 transition-colors max-w-[260px] truncate"
                          title="Google Mapで開く"
                        >
                          <MapPin className="w-3.5 h-3.5 text-sub flex-shrink-0" />
                          <span className="truncate">{customer.address}</span>
                          <ExternalLink className="w-3 h-3 text-sub flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </a>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* 案件実績 */}
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          (customer.job_count || 0) > 0
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {customer.job_count || 0} 件
                      </span>
                    </td>

                    {/* 登録日 */}
                    <td className="py-3.5 px-4 text-sub text-[11px]">
                      {new Date(customer.created_at).toLocaleDateString('ja-JP')}
                    </td>

                    {/* 操作ボタン */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(customer)}
                          className="p-1.5 text-sub hover:text-main hover:bg-slate-200/60 rounded-md transition-colors"
                          title="編集"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(customer.id, customer.name)}
                          disabled={deletingId === customer.id}
                          className="p-1.5 text-sub hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                          title="削除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 顧客登録・編集モーダル */}
      <CustomerModal
        customer={selectedCustomer}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveCustomer}
      />
    </div>
  )
}
