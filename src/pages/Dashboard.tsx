import React, { useMemo } from 'react'
import { FilePlus, Clock, CheckCircle } from 'lucide-react'
import { KpiCard } from '../components/ui'
import { KanbanBoard } from '../components/features'
import { useJobs } from '../hooks'

export const Dashboard: React.FC = () => {
  const jobsData = useJobs()
  const { jobs, isLoading } = jobsData

  // jobs データから各ステータスの件数を安全に計算
  const counts = useMemo(() => {
    if (!jobs || !Array.isArray(jobs) || jobs.length === 0) {
      return { received: 0, inProgress: 0, completed: 0 }
    }

    const receivedCount = jobs.filter(
      (job) => job && job.status && ['received', 'quoting', 'pending'].includes(job.status)
    ).length

    const inProgressCount = jobs.filter(
      (job) => job && job.status && ['arranged'].includes(job.status)
    ).length

    const completedCount = jobs.filter(
      (job) => job && job.status && ['collected', 'billed', 'completed'].includes(job.status)
    ).length

    return {
      received: receivedCount,
      inProgress: inProgressCount,
      completed: completedCount,
    }
  }, [jobs])

  const isDataReady = !isLoading && Array.isArray(jobs)

  return (
    <div className="space-y-4 md:space-y-6">
      {/* ページヘッダー */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-main">ダッシュボード</h1>
        <p className="text-xs md:text-sm text-sub mt-0.5 md:mt-1">
          本日の業務概要および案件進行状況のリアルタイム確認
        </p>
      </div>

      {/* KPIパネル (スマホ: 縦積み 1列, PC: 横並び 3列) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6">
        <KpiCard
          title="新規受付・未対応"
          value={isDataReady ? `${counts.received} 件` : '...'}
          trend={isDataReady ? 'リアルタイム同期中' : undefined}
          trendColor="emerald"
          icon={FilePlus}
        />
        <KpiCard
          title="進行中の案件（手配済）"
          value={isDataReady ? `${counts.inProgress} 件` : '...'}
          trend={isDataReady ? '配車・作業進行中' : undefined}
          trendColor="emerald"
          icon={Clock}
        />
        <KpiCard
          title="回収完了・完了済"
          value={isDataReady ? `${counts.completed} 件` : '...'}
          trend={isDataReady ? '累計対応実績' : undefined}
          trendColor="emerald"
          icon={CheckCircle}
        />
      </div>

      {/* カンバンボード (下部) */}
      <div className="pt-1 md:pt-2">
        <KanbanBoard jobsData={jobsData} />
      </div>
    </div>
  )
}



