import { supabase } from './supabase'

export type ActivityActionType =
  | 'login'
  | 'logout'
  | 'job_create'
  | 'job_update'
  | 'account_update'
  | string

export interface ActivityLog {
  id: string
  profile_id: string | null
  staff_name: string
  staff_email: string | null
  action_type: ActivityActionType
  description: string
  metadata?: Record<string, any>
  created_at: string
}

/**
 * 現在ログイン中のユーザーに対応する Profile 情報（氏名・ID・メール）を取得して操作履歴を記録する
 */
export async function recordActivityLog(params: {
  actionType: ActivityActionType
  description: string
  profileId?: string | null
  staffName?: string | null
  staffEmail?: string | null
  metadata?: Record<string, any>
}): Promise<void> {
  try {
    let profileId = params.profileId || null
    let staffName = params.staffName || ''
    let staffEmail = params.staffEmail || null

    if (!staffName || !staffEmail) {
      const { data: userData } = await supabase.auth.getUser()
      const authUser = userData?.user
      if (authUser) {
        staffEmail = staffEmail || authUser.email || null

        // profiles テーブルから該当スタッフを検索
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, display_name, email, auth_user_id')

        if (profilesData && profilesData.length > 0) {
          const matched =
            profilesData.find((p) => p.auth_user_id === authUser.id) ||
            profilesData.find((p) => p.id === authUser.id) ||
            (authUser.email
              ? profilesData.find((p) => p.email?.toLowerCase() === authUser.email?.toLowerCase())
              : undefined)

          if (matched) {
            profileId = profileId || matched.id
            staffName = staffName || matched.display_name || authUser.email?.split('@')[0] || 'スタッフ'
          }
        }

        if (!staffName) {
          staffName =
            authUser.user_metadata?.display_name ||
            authUser.email?.split('@')[0] ||
            'ログインユーザー'
        }
      }
    }

    await supabase.from('activity_logs').insert([
      {
        profile_id: profileId,
        staff_name: staffName || 'スタッフ',
        staff_email: staffEmail,
        action_type: params.actionType,
        description: params.description,
        metadata: params.metadata || {},
      },
    ])

    // ログインアクションの場合は profiles.last_login_at も更新
    if (params.actionType === 'login' && profileId) {
      await supabase
        .from('profiles')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', profileId)
    }
  } catch (err) {
    console.warn('Activity log recording warning:', err)
  }
}

