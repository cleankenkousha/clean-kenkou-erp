import React from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Settings,
  User,
  Activity,
  LogOut,
  Smartphone,
  Monitor,
  TrendingUp,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useViewMode } from '../../hooks/useViewMode'

interface LayoutProps {
  children: React.ReactNode
}

interface NavItem {
  label: string
  path: string
  icon: React.ComponentType<{ className?: string }>
}

const pcNavItems: NavItem[] = [
  { label: 'ダッシュボード', path: '/', icon: LayoutDashboard },
  { label: '顧客管理', path: '/customers', icon: Users },
  { label: '案件一覧', path: '/jobs', icon: Briefcase },
  { label: '売上管理', path: '/sales', icon: TrendingUp },
  { label: '設定', path: '/settings', icon: Settings },
]

const mobileNavItems: NavItem[] = [
  { label: '案件一覧', path: '/jobs', icon: Briefcase },
  { label: '顧客管理', path: '/customers', icon: Users },
  { label: '設定・品目', path: '/settings', icon: Settings },
]

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { isMobileMode, toggleViewMode } = useViewMode()

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      navigate('/login', { replace: true })
    } catch (err) {
      console.error('Logout error:', err)
    }
  }

  // モード切り替え時にスマートにリダイレクト
  const handleToggleViewMode = () => {
    const nextIsMobile = !isMobileMode
    toggleViewMode()

    // モバイルモードへ切り替えた際、ダッシュボード(/)にいた場合は /jobs へ移動
    if (nextIsMobile && location.pathname === '/') {
      navigate('/jobs')
    }
  }

  const navItems = isMobileMode ? mobileNavItems : pcNavItems


  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-surface font-sans antialiased">
      {/* Header (上部ナビゲーション: 高さ 56px, bg-white backdrop-blur-sm) */}
      <header className="h-14 flex-shrink-0 bg-white border-b border-border px-3 md:px-6 flex items-center justify-between z-10">
        <div className="flex items-center space-x-3 md:space-x-6">
          {/* App Brand Header */}
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-slate-900 text-white rounded-md">
              <Activity className="w-4 h-4" />
            </div>
            <span className="font-bold text-main tracking-tight text-sm md:text-base">
              Clean KENKOU ERP
            </span>
            {isMobileMode && (
              <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">
                携帯・タブレット版
              </span>
            )}
          </div>

          {/* PC表示時のトップナビゲーション */}
          {!isMobileMode && (
            <nav className="hidden md:flex items-center space-x-1">
              {pcNavItems.map((item) => {
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
          )}
        </div>

        {/* User Info, 表示モード切替 & ログアウトボタン (右端) */}
        <div className="flex items-center space-x-2 md:space-x-3">
          {/* 💻 PC / 📱 モバイル 表示切り替えボタン */}
          <button
            type="button"
            onClick={handleToggleViewMode}
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-sm ${

              isMobileMode
                ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
            }`}
            title={isMobileMode ? 'PCモード表示へ切替' : '携帯・タブレット表示へ切替'}
          >
            {isMobileMode ? (
              <>
                <Monitor className="w-4 h-4 text-purple-600" />
                <span className="hidden sm:inline">PC表示へ</span>
              </>
            ) : (
              <>
                <Smartphone className="w-4 h-4 text-blue-600" />
                <span className="hidden sm:inline">携帯・タブレット表示へ</span>
              </>
            )}
          </button>

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
            className="flex items-center space-x-1 px-2.5 py-1.5 text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors min-h-[36px]"
            title="ログアウト"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">ログアウト</span>
          </button>
        </div>
      </header>

      {/* Main Content Area (スマホ時ボトムナビと重ならないよう pb-20 付与) */}
      <main className="flex-1 overflow-y-auto bg-surface p-3 md:p-6 pb-20 md:pb-6">
        {children}
      </main>

      {/* スマホ・タブレット用固定ボトムナビゲーション */}
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
