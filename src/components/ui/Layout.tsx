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
      {/* PC用 Sidebar (左ナビゲーション: md以上で表示, 幅 240px) */}
      <aside className="hidden md:flex w-60 flex-shrink-0 border-r border-border bg-white flex-col justify-between">
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
      <div className="flex flex-1 flex-col overflow-hidden relative">
        {/* Header (上部: 高さ 56px, bg-white/90 backdrop-blur-sm) */}
        <header className="h-14 flex-shrink-0 bg-white/90 backdrop-blur-sm border-b border-border px-4 md:px-6 flex items-center justify-between z-10">
          <div className="flex items-center space-x-2">
            <div className="flex md:hidden items-center space-x-2 mr-1">
              <div className="p-1 bg-slate-900 text-white rounded">
                <Activity className="w-3.5 h-3.5" />
              </div>
              <span className="font-bold text-main text-sm">Clean ERP</span>
            </div>
            <div className="hidden md:flex items-center space-x-2 text-xs text-sub">
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
          </div>

          {/* User Icon (右端) */}
          <div className="flex items-center space-x-3">
            <button
              type="button"
              className="p-2 rounded-full bg-slate-100 text-main hover:bg-slate-200 transition-colors border border-border min-h-[40px] min-w-[40px] flex items-center justify-center"
              title="ユーザープロフィール"
            >
              <User className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Main Content Area (スマホ時ボトムナビと重ならないよう pb-20 付与) */}
        <main className="flex-1 overflow-y-auto bg-surface p-4 md:p-6 pb-20 md:pb-6">
          {children}
        </main>

        {/* スマホ用固定ボトムナビゲーション (md未満で画面最下部に固定表示) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-t border-border flex items-center justify-around z-40 px-1 shadow-lg">
          {navItems.map((item) => {
            const Icon = item.icon

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-medium transition-all min-h-[44px] min-w-[48px] ${
                    isActive
                      ? 'text-slate-900 font-bold bg-slate-100'
                      : 'text-sub hover:text-main'
                  }`
                }
              >
                <Icon className="w-5 h-5 mb-0.5" />
                <span className="truncate max-w-[64px]">{item.label}</span>
              </NavLink>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
