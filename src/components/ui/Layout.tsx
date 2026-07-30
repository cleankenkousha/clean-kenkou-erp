import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  PhoneCall,
  Users,
  Briefcase,
  Settings,
  User,
  Activity,
} from 'lucide-react'

interface LayoutProps {
  children: React.ReactNode
}

interface NavItem {
  label: string
  path: string
  icon: React.ComponentType<{ className?: string }>
}

const navItems: NavItem[] = [
  { label: 'ダッシュボード', path: '/', icon: LayoutDashboard },
  { label: '新規案件受付', path: '/reception', icon: PhoneCall },
  { label: '顧客管理', path: '/customers', icon: Users },
  { label: '案件一覧', path: '/jobs', icon: Briefcase },
  { label: '設定', path: '/settings', icon: Settings },
]

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation()

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface font-sans antialiased">
      {/* Sidebar (左ナビゲーション: 幅 240px 固定) */}
      <aside className="w-60 flex-shrink-0 border-r border-border bg-white flex flex-col justify-between">
        <div>
          {/* App Brand Header */}
          <div className="h-14 px-5 flex items-center space-x-2 border-b border-border">
            <div className="p-1.5 bg-slate-900 text-white rounded-md">
              <Activity className="w-4 h-4" />
            </div>
            <span className="font-bold text-main tracking-tight text-base">
              Clean KENKOU ERP
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-sub hover:bg-slate-100 hover:text-main'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              )
            })}
          </nav>
        </div>

        {/* Sidebar Footer Info */}
        <div className="p-4 border-t border-border text-xs text-sub">
          <p className="font-medium text-main">有限会社山鹿健康社</p>
          <p className="text-[11px] text-sub">Clean KENKOU ERP v0.1</p>
        </div>
      </aside>

      {/* Right Main Wrapper */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header (上部: 高さ 56px, bg-white/90 backdrop-blur-sm) */}
        <header className="h-14 flex-shrink-0 bg-white/90 backdrop-blur-sm border-b border-border px-6 flex items-center justify-between z-10">
          <div className="flex items-center space-x-2 text-xs text-sub">
            <span>ホーム</span>
            <span>/</span>
            <span className="text-main font-medium">
              {navItems.find((item) =>
                item.path === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.path)
              )?.label || 'ダッシュボード'}
            </span>
          </div>

          {/* User Icon (右端) */}
          <div className="flex items-center space-x-3">
            <button
              type="button"
              className="p-1.5 rounded-full bg-slate-100 text-main hover:bg-slate-200 transition-colors border border-border"
              title="ユーザープロフィール"
            >
              <User className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-surface p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
