import React from 'react'
import { LayoutDashboard, CheckCircle2, Clock, AlertTriangle, Sparkles } from 'lucide-react'

export const DashboardPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-surface text-main p-6 space-y-6">
      {/* Header Area */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-primary text-white rounded-md">
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-main">ダッシュボード</h1>
            <p className="text-xs text-sub">Clean KENKOU ERP 業務進行状況</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-md border border-border text-xs text-sub shadow-sm">
          <Sparkles className="w-4 h-4 text-semantic-info" />
          <span>AI アシスタント準備完了</span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1 */}
        <div className="bg-white p-5 rounded-xl border border-border shadow-sm space-y-2">
          <div className="flex items-center justify-between text-sub text-sm">
            <span>本日対応完了</span>
            <CheckCircle2 className="w-4 h-4 text-semantic-success" />
          </div>
          <div className="text-3xl font-bold text-main">12 件</div>
          <div className="text-xs text-semantic-success font-medium">↑ 前日比 +2件</div>
        </div>

        {/* Card 2 */}
        <div className="bg-white p-5 rounded-xl border border-border shadow-sm space-y-2">
          <div className="flex items-center justify-between text-sub text-sm">
            <span>進行中・手配済</span>
            <Clock className="w-4 h-4 text-semantic-info" />
          </div>
          <div className="text-3xl font-bold text-main">5 件</div>
          <div className="text-xs text-sub">正常進行中</div>
        </div>

        {/* Card 3 */}
        <div className="bg-white p-5 rounded-xl border border-border shadow-sm space-y-2">
          <div className="flex items-center justify-between text-sub text-sm">
            <span>保留・確認要</span>
            <AlertTriangle className="w-4 h-4 text-semantic-warning" />
          </div>
          <div className="text-3xl font-bold text-main">2 件</div>
          <div className="text-xs text-semantic-warning font-medium">要対応</div>
        </div>
      </div>
    </div>
  )
}
