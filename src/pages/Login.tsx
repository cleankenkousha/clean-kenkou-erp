import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Activity, AlertCircle, UserCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { recordActivityLog } from '../lib/activityLogger'
import { DEFAULT_PROFILES } from '../hooks/useProfiles'
import { Input, Button } from '../components/ui'

export const Login: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: Location })?.from?.pathname || '/'

  // スタッフIDのみ（例: chiba）で入力された場合も自動で @kenkou.co.jp を補完
  const normalizeLoginEmail = (raw: string) => {
    const trimmed = raw.trim().toLowerCase()
    if (!trimmed) return ''
    return trimmed.includes('@') ? trimmed : `${trimmed}@kenkou.co.jp`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    const loginEmail = normalizeLoginEmail(email)

    if (!loginEmail || !password.trim()) {
      setErrorMessage('ログインID（メールアドレス）とパスワードを入力してください。')
      return
    }

    setIsLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      })

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setErrorMessage(
            'メールアドレス（ID）またはパスワードが正しくありません。（※まだパスワードを設定していないスタッフは、システム設定＞担当者・スタッフ管理からパスワードを設定してください）'
          )
        } else {
          setErrorMessage(error.message || 'ログイン中にエラーが発生しました。')
        }
        return
      }

      // ログイン成功時、ログイン記録（activity_logs）を残す
      if (data.user) {
        await recordActivityLog({
          actionType: 'login',
          description: 'システムにログインしました',
          staffEmail: data.user.email || loginEmail,
        })
      }

      // 成功時、要求されていたページまたはダッシュボードへ遷移
      navigate(from, { replace: true })
    } catch (err: any) {
      console.error('Login error:', err)
      setErrorMessage(err.message || '予期せぬエラーが発生しました。')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4 font-sans antialiased">
      <div className="w-full max-w-md bg-white rounded-2xl border border-border shadow-xl p-6 md:p-8 space-y-6">
        {/* ブランドヘッダー */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="p-3 bg-slate-900 text-white rounded-xl shadow-md">
            <Activity className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-main tracking-tight pt-2">
            Clean KENKOU ERP
          </h1>
          <p className="text-xs text-sub">
            システムを利用するにはログインしてください
          </p>
        </div>

        {/* エラーメッセージ */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs font-medium flex items-start space-x-2 animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* スタッフ クイック選択（ワンタップでID入力） */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold text-sub flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5 text-slate-600" />
            <span>スタッフ名からワンタップ入力:</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {DEFAULT_PROFILES.map((staff) => (
              <button
                key={staff.id}
                type="button"
                onClick={() => {
                  if (staff.email) setEmail(staff.email)
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors ${
                  normalizeLoginEmail(email) === staff.email
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {staff.display_name}
              </button>
            ))}
          </div>
        </div>

        {/* ログインフォーム */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Input
              type="text"
              label="ログインID / メールアドレス"
              placeholder="例: chiba または chiba@kenkou.co.jp"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              helperText="※「chiba」などのIDのみでもログインできます（@kenkou.co.jp が自動補完されます）"
            />
          </div>

          <div className="space-y-1">
            <Input
              type="password"
              label="パスワード"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full font-bold mt-2 py-3"
            isLoading={isLoading}
          >
            ログイン
          </Button>
        </form>

        {/* フッター情報 */}
        <div className="text-center pt-2 border-t border-border">
          <p className="text-[11px] text-sub">
            有限会社クリーン健康社 &copy; Clean KENKOU ERP
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
