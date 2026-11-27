import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-region, *',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'SUPABASE_URL または SUPABASE_SERVICE_ROLE_KEY が設定されていません。' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1. Authorization ヘッダーの JWT トークンを検証（未ログインでの不正呼び出しを遮断）
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: '認証トークンがありません。再度ログインしてから操作してください。' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '').trim()

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { data: callerData, error: callerErr } = await supabaseAdmin.auth.getUser(token)
    if (callerErr || !callerData?.user) {
      return new Response(
        JSON.stringify({ error: '認証セッションが無効です。再度ログインしてください。' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const callerUser = callerData.user

    // 2. 呼び出し元ユーザーの権限チェック
    // すでに admin に auth_user_id が紐付いている場合は admin のみ許可（初回セットアップ時はログイン済みユーザーに許可）
    const { data: allProfiles } = await supabaseAdmin
      .from('profiles')
      .select('id, auth_user_id, email, role, display_name')

    const profilesList = allProfiles || []
    const callerProfile =
      profilesList.find((p) => p.auth_user_id === callerUser.id) ||
      profilesList.find((p) => p.id === callerUser.id) ||
      (callerUser.email
        ? profilesList.find((p) => p.email?.toLowerCase() === callerUser.email?.toLowerCase())
        : undefined)

    const hasConfiguredAdmin = profilesList.some(
      (p) => p.role === 'admin' && Boolean(p.auth_user_id)
    )

    if (hasConfiguredAdmin && callerProfile?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'この操作は管理者（admin）権限を持つスタッフのみ実行できます。' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const { action, profileId, authUserId, email, password, displayName, role, actorName, actorEmail } = body

    if (action === 'set_staff_account') {
      const normalizedEmail = (email || '').trim().toLowerCase()
      const cleanPassword = (password || '').trim()

      if (!normalizedEmail || !normalizedEmail.includes('@')) {
        return new Response(
          JSON.stringify({ error: '有効なメールアドレス形式（例: chiba@kenkou.co.jp）を入力してください。' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!cleanPassword || cleanPassword.length < 6) {
        return new Response(
          JSON.stringify({ error: 'パスワードは6文字以上で入力してください。' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // 既存の Auth ユーザー一覧から該当メールアドレスまたは auth_user_id を検索
      const { data: usersData, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      })

      if (listErr) {
        return new Response(
          JSON.stringify({ error: `ユーザー一覧の取得に失敗しました: ${listErr.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // 対象 profile の現在の auth_user_id も確認
      let existingAuthUserId: string | null = null
      if (profileId) {
        const targetProf = profilesList.find((p) => p.id === profileId)
        if (targetProf?.auth_user_id) {
          existingAuthUserId = targetProf.auth_user_id
        }
      }

      const matchedUser =
        usersData.users.find((u) => u.email?.toLowerCase() === normalizedEmail) ||
        (existingAuthUserId ? usersData.users.find((u) => u.id === existingAuthUserId) : undefined)

      let finalAuthUserId = ''
      let isCreated = false

      if (matchedUser) {
        const { data: updatedUser, error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
          matchedUser.id,
          {
            email: normalizedEmail,
            password: cleanPassword,
            email_confirm: true,
            user_metadata: {
              ...matchedUser.user_metadata,
              display_name: displayName || matchedUser.user_metadata?.display_name || normalizedEmail.split('@')[0],
              role: role || matchedUser.user_metadata?.role || 'operator',
            },
          }
        )

        if (updateErr || !updatedUser.user) {
          return new Response(
            JSON.stringify({ error: `アカウント更新に失敗しました: ${updateErr?.message || '不明'}` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        finalAuthUserId = updatedUser.user.id
      } else {
        const { data: createdUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: normalizedEmail,
          password: cleanPassword,
          email_confirm: true,
          user_metadata: {
            display_name: displayName || normalizedEmail.split('@')[0],
            role: role || 'operator',
          },
        })

        if (createErr || !createdUser.user) {
          return new Response(
            JSON.stringify({ error: `アカウント作成に失敗しました: ${createErr?.message || '不明'}` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        finalAuthUserId = createdUser.user.id
        isCreated = true
      }

      // public.profiles テーブルを更新
      if (profileId) {
        await supabaseAdmin
          .from('profiles')
          .update({
            email: normalizedEmail,
            auth_user_id: finalAuthUserId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', profileId)
      }

      // 操作履歴 (activity_logs) に記録
      await supabaseAdmin.from('activity_logs').insert([
        {
          profile_id: callerProfile?.id || profileId || null,
          staff_name: callerProfile?.display_name || actorName || displayName || '管理者',
          staff_email: callerUser.email || actorEmail || normalizedEmail,
          action_type: 'account_update',
          description: `スタッフ「${displayName || normalizedEmail}」(${normalizedEmail}) のログインパスワードを${isCreated ? '新規発行' : '更新'}しました`,
          metadata: {
            target_profile_id: profileId,
            target_email: normalizedEmail,
            is_new_account: isCreated,
            operated_by_user_id: callerUser.id,
          },
        },
      ])

      return new Response(
        JSON.stringify({
          success: true,
          authUserId: finalAuthUserId,
          email: normalizedEmail,
          isCreated,
          message: `✅ ${displayName || normalizedEmail} さんのログイン設定（${normalizedEmail}）を保存しました！`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'delete_staff_account') {
      const targetProfile = profileId
        ? profilesList.find((p) => p.id === profileId)
        : undefined
      const targetAuthUserId = authUserId || targetProfile?.auth_user_id || null

      // ガード1: 自己削除禁止
      if (
        (targetAuthUserId && targetAuthUserId === callerUser.id) ||
        (targetProfile && callerProfile && targetProfile.id === callerProfile.id)
      ) {
        return new Response(
          JSON.stringify({ error: '現在ログイン中の自分自身のアカウントは削除できません。' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // ガード2: 最後の管理者アカウント保護
      const configuredAdmins = profilesList.filter(
        (p) => p.role === 'admin' && Boolean(p.auth_user_id)
      )
      if (
        targetProfile?.role === 'admin' &&
        Boolean(targetProfile?.auth_user_id) &&
        configuredAdmins.length <= 1
      ) {
        return new Response(
          JSON.stringify({ error: '最後の管理者アカウントは削除できません。' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (targetAuthUserId) {
        const { error: deleteUserErr } = await supabaseAdmin.auth.admin.deleteUser(targetAuthUserId)
        if (
          deleteUserErr &&
          !/not found|404/i.test(deleteUserErr.message || '') &&
          (deleteUserErr as any).status !== 404
        ) {
          return new Response(
            JSON.stringify({ error: `認証アカウントの削除に失敗しました: ${deleteUserErr.message}` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }

      // 操作履歴 (activity_logs) に記録
      await supabaseAdmin.from('activity_logs').insert([
        {
          profile_id: callerProfile?.id || null,
          staff_name: callerProfile?.display_name || actorName || '管理者',
          staff_email: callerUser.email || actorEmail || null,
          action_type: 'account_delete',
          description: `スタッフ「${displayName || targetProfile?.display_name || email || '不明'}」の認証アカウントを削除しました`,
          metadata: {
            target_profile_id: profileId || null,
            deleted_auth_user_id: targetAuthUserId,
            target_email: email || targetProfile?.email || null,
            operated_by_user_id: callerUser.id,
          },
        },
      ])

      return new Response(
        JSON.stringify({
          success: true,
          deletedAuthUserId: targetAuthUserId,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: `未対応のアクションです: ${action}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Internal Server Error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
