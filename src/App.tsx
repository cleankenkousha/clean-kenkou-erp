import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Layout } from './components/ui'
import { Dashboard } from './pages/Dashboard'
import { JobReception } from './pages/JobReception'

export function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/reception" element={<JobReception />} />
          <Route
            path="/customers"
            element={
              <div className="p-6 bg-white rounded-xl border border-border">
                <h2 className="text-xl font-bold">顧客管理</h2>
                <p className="text-sm text-sub mt-2">
                  顧客一覧および新規登録機能がここに配置されます。
                </p>
              </div>
            }
          />
          <Route
            path="/jobs"
            element={
              <div className="p-6 bg-white rounded-xl border border-border">
                <h2 className="text-xl font-bold">案件一覧</h2>
                <p className="text-sm text-sub mt-2">
                  全案件のリスト・フィルター・検索機能がここに配置されます。
                </p>
              </div>
            }
          />
          <Route
            path="/settings"
            element={
              <div className="p-6 bg-white rounded-xl border border-border">
                <h2 className="text-xl font-bold">設定</h2>
                <p className="text-sm text-sub mt-2">
                  システム設定およびアカウント管理機能がここに配置されます。
                </p>
              </div>
            }
          />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App
