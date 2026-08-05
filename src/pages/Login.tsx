import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Activity, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Input, Button } from '../components/ui'

export const Login: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: Location })?.from?.pathname || '/'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!email.trim() || !password.trim()) {
      setErrorMessage('メールアドレスとパスワードを入力してください。')
      return
    }

    setIsLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setErrorMessage('メールアドレスまたはパスワードが正しくありません。')
        } else {
          setErrorMessage(error.message || 'ログイン中にエラーが発生しました。')
        }
        return
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
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs font-medium flex items-center space-x-2 animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ログインフォーム */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Input
              type="email"
              label="メールアドレス"
              placeholder="example@kenkou.co.jp"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
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
