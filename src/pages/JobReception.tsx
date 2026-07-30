import React from 'react'
import { PhoneCall } from 'lucide-react'
import { JobReceptionForm } from '../components/features'

export const JobReception: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-main">新規案件受付</h1>
            <span className="bg-slate-900 text-white text-xs px-2.5 py-0.5 rounded-full font-medium flex items-center space-x-1">
              <PhoneCall className="w-3 h-3 mr-1" />
              電話受付 30秒対応
            </span>
          </div>
          <p className="text-sm text-sub mt-1">
            電話対応中に必要な項目のみを最速入力し、一時案件として即時登録します。
          </p>
        </div>
      </div>

      {/* 受付フォーム */}
      <JobReceptionForm />
    </div>
  )
}
