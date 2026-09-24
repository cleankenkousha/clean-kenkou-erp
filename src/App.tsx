import React, { Suspense, lazy } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Layout, ProtectedRoute } from './components/ui'
import { ViewModeProvider } from './hooks/useViewMode'

// 各ページコンポーネントの動的インポート (Code Splitting)
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })))
const JobReception = lazy(() => import('./pages/JobReception').then((m) => ({ default: m.JobReception })))
const Customers = lazy(() => import('./pages/Customers').then((m) => ({ default: m.Customers })))
const Jobs = lazy(() => import('./pages/Jobs').then((m) => ({ default: m.Jobs })))
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })))
const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })))
const SalesAnalytics = lazy(() => import('./pages/SalesAnalytics').then((m) => ({ default: m.SalesAnalytics })))
const Schedule = lazy(() => import('./pages/Schedule').then((m) => ({ default: m.Schedule })))

// ページ読み込み中のフォールバック表示
const PageLoadingFallback: React.FC = () => (
  <div className="flex items-center justify-center min-h-[50vh] text-xs text-sub space-x-2">
    <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
    <span>画面を読み込んでいます...</span>
  </div>
)

export function App() {
  return (
    <Router>
      <ViewModeProvider>
        <Suspense fallback={<PageLoadingFallback />}>
          <Routes>
            {/* パブリックルート */}
            <Route path="/login" element={<Login />} />

            {/* 認証ガード適用ルート */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/reception" element={<JobReception />} />
                      <Route path="/schedule" element={<Schedule />} />
                      <Route path="/customers" element={<Customers />} />
                      <Route path="/jobs" element={<Jobs />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/sales" element={<SalesAnalytics />} />
                    </Routes>
                  </Layout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Suspense>
      </ViewModeProvider>
    </Router>
  )
}

export default App


