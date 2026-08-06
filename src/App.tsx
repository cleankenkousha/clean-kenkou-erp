import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Layout, ProtectedRoute } from './components/ui'
import { Dashboard } from './pages/Dashboard'
import { JobReception } from './pages/JobReception'
import { Customers } from './pages/Customers'
import { Jobs } from './pages/Jobs'
import { Settings } from './pages/Settings'
import { Login } from './pages/Login'
import { ViewModeProvider } from './hooks/useViewMode'

export function App() {
  return (
    <Router>
      <ViewModeProvider>
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
                    <Route path="/customers" element={<Customers />} />
                    <Route path="/jobs" element={<Jobs />} />
                    <Route path="/settings" element={<Settings />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </ViewModeProvider>
    </Router>
  )
}

export default App

