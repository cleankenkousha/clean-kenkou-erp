import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Settings,
  User,
  Activity,
  LogOut,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

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
  { label: '顧客管理', path: '/customers', icon: Users },
  { label: '案件一覧', path: '/jobs', icon: Briefcase },
  { label: '設定', path: '/settings', icon: Settings },
]

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      navigate('/login', { replace: true })
    } catch (err) {
      console.error('Logout error:', err)
    }
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-surface font-sans antialiased">
      {/* Header (上部ナビゲーション: 高さ 56px, bg-white backdrop-blur-sm) */}
      <header className="h-14 flex-shrink-0 bg-white border-b border-border px-4 md:px-6 flex items-center justify-between z-10">
        <div className="flex items-center space-x-6">
          {/* App Brand Header */}
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-slate-900 text-white rounded-md">
              <Activity className="w-4 h-4" />
            </div>
            <span className="font-bold text-main tracking-tight text-base">
              Clean KENKOU ERP
            </span>
          </div>

          {/* PC用 トップナビゲーション */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    `flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
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

        {/* User Info & ログアウトボタン (右端) */}
        <div className="flex items-center space-x-3">
          <div className="hidden lg:flex flex-col text-right text-xs">
            <span className="font-medium text-main">有限会社クリーン健康社</span>
            <span className="text-[10px] text-sub">Clean KENKOU ERP v0.1</span>
          </div>

          <button
            type="button"
            className="p-2 rounded-full bg-slate-100 text-main hover:bg-slate-200 transition-colors border border-border min-h-[36px] min-w-[36px] flex items-center justify-center"
            title="ユーザープロフィール"
          >
            <User className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors min-h-[36px]"
            title="ログアウト"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">ログアウト</span>
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
  )
}
