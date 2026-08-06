import React from 'react'
import { MapPin, Navigation, ExternalLink } from 'lucide-react'

interface MapLinkProps {
  address?: string | null
  variant?: 'inline' | 'buttons' | 'badge'
  className?: string
}

export const getGoogleMapSearchUrl = (address: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`

export const getGoogleMapDirUrl = (address: string) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address.trim())}`

export const MapLink: React.FC<MapLinkProps> = ({ address, variant = 'inline', className = '' }) => {
  if (!address || !address.trim()) return null

  const searchUrl = getGoogleMapSearchUrl(address)
  const dirUrl = getGoogleMapDirUrl(address)

  if (variant === 'buttons') {
    return (
      <div className={`flex items-center space-x-2 pt-1 ${className}`}>
        <a
          href={searchUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold transition-colors shadow-sm"
          title="Googleマップで場所を表示"
        >
          <MapPin className="w-3.5 h-3.5 text-blue-600" />
          <span>Googleマップで確認</span>
          <ExternalLink className="w-3 h-3 text-blue-500 opacity-75" />
        </a>

        <a
          href={dirUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold transition-colors shadow-sm"
          title="現場までのナビ・ルート案内を開始"
        >
          <Navigation className="w-3.5 h-3.5 text-emerald-600" />
          <span>ルート案内 (ナビ)</span>
          <ExternalLink className="w-3 h-3 text-emerald-500 opacity-75" />
        </a>
      </div>
    )
  }

  if (variant === 'badge') {
    return (
      <a
        href={searchUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={`inline-flex items-center space-x-1 px-2 py-0.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-200 rounded text-[11px] font-medium transition-colors ${className}`}
        title="Googleマップで開く"
      >
        <MapPin className="w-3 h-3 text-blue-600 flex-shrink-0" />
        <span>マップ</span>
      </a>
    )
  }

  return (
    <div className={`inline-flex items-center space-x-1 ${className}`}>
      <a
        href={searchUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-800 hover:underline font-medium text-xs"
        title="Googleマップで開く"
      >
        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
        <span>マップ</span>
        <ExternalLink className="w-3 h-3 opacity-70" />
      </a>
    </div>
  )
}
