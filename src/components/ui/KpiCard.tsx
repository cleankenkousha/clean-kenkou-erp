import React from 'react'
import { LucideIcon } from 'lucide-react'

export interface KpiCardProps {
  title: string
  value: string | number
  trend?: string
  trendColor?: 'emerald' | 'red' | 'gray'
  icon: LucideIcon
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  trend,
  trendColor = 'emerald',
  icon: Icon,
}) => {
  const getTrendColorClass = () => {
    switch (trendColor) {
      case 'emerald':
        return 'text-semantic-success'
      case 'red':
        return 'text-semantic-error'
      default:
        return 'text-sub'
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-border p-5 transition-all duration-200 hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-sub">{title}</span>
        <div className="p-2 bg-slate-50 text-slate-700 rounded-md border border-border">
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <div className="text-3xl font-bold text-main tracking-tight">
          {value}
        </div>
        {trend && (
          <div className={`text-xs font-semibold ${getTrendColorClass()}`}>
            {trend}
          </div>
        )}
      </div>
    </div>
  )
}
