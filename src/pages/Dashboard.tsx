import React from 'react'
import { FilePlus, Clock, AlertTriangle } from 'lucide-react'
import { KpiCard } from '../components/ui'
import { KanbanBoard } from '../components/features'

export const Dashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div>
        <h1 className="text-2xl font-bold text-main">ダッシュボード</h1>
        <p className="text-sm text-sub mt-1">
          本日の業務概要および案件進行状況のリアルタイム確認
        </p>
      </div>

      {/* KPIパネル (上部 3カード) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KpiCard
          title="本日の新規受付"
          value="14 件"
          trend="+3件 (前日比)"
          trendColor="emerald"
          icon={FilePlus}
        />
        <KpiCard
          title="進行中の案件"
          value="8 件"
          trend="順調"
          trendColor="emerald"
          icon={Clock}
        />
        <KpiCard
          title="請求漏れ警告"
          value="2 件"
          trend="-1件 (要確認)"
          trendColor="red"
          icon={AlertTriangle}
        />
      </div>

      {/* カンバンボード (下部) */}
      <div className="pt-2">
        <KanbanBoard />
      </div>
    </div>
  )
}
