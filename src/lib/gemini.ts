import { ItemPriceMaster } from '../hooks/usePriceMaster'
import { supabase } from './supabase'

export interface GeminiDetectedItem {
  name: string
  quantity: number
  unit: string
  volume: number
  unitPrice: number
  reason?: string
}


/**
 * APIキーの診断 (Edge Function サーバーサイド管理のためクライアント直接接続不要)
 */
export async function validateGeminiApiKey(_apiKey: string): Promise<{ valid: boolean; message: string }> {
  return { valid: true, message: '🔒 Gemini APIキーはSupabase Edge Functionサーバーサイドで安全に管理されています。' }
}

/**
 * Supabase Edge Function 経由で Gemini API による画像解析を実行
 * (クライアント側APIキー直接保持・送信を完全に排除したセキュア仕様)
 *
 * Edge Function がエラーの場合は空配列を返し、ユーザーに手動入力を促す。
 * 偽のAI解析結果は返さない。
 */
export async function analyzeQuoteImagesWithGemini(
  imageUrls: string[],
  _customApiKey?: string,
  onProgress?: (statusText: string) => void,
  masterItems?: ItemPriceMaster[]
): Promise<GeminiDetectedItem[]> {
  if (imageUrls.length === 0) {
    return []
  }

  if (onProgress) {
    onProgress(`全${imageUrls.length}枚の現場写真をEdge Function経由で安全に解析中...`)
  }

  try {
    const { data, error } = await supabase.functions.invoke('gemini-analyze', {
      body: { imageUrls, masterItems },
    })

    if (error) {
      // Edge Function のエラー詳細をログに記録
      console.error('Gemini Edge Function エラー:', error.message)

      // ユーザー向けの分かりやすいエラーメッセージ
      const userMessage = error.message?.includes('GEMINI_API_KEY')
        ? 'AI解析サービスのAPIキーが未設定です。管理者に連絡してください。'
        : error.message?.includes('画像')
          ? error.message
          : 'AI画像解析に失敗しました。品目を手動で入力してください。'

      if (onProgress) {
        onProgress(`⚠️ ${userMessage}`)
      }

      // エラー時は空配列を返す（偽のAI結果を返さない）
      return []
    }

    if (data && Array.isArray(data.items) && data.items.length > 0) {
      return data.items.map((item: any) => ({
        ...item,
        unit: item.unit || '点',
        reason: item.reason || 'AI画像解析により特定',
      }))
    }

    // AIが品目を検出できなかった場合
    if (onProgress) {
      onProgress('AI解析で品目を検出できませんでした。写真を確認し、品目を手動で入力してください。')
    }
    return []
  } catch (err: any) {
    console.error('Edge Function 接続エラー:', err)

    if (onProgress) {
      onProgress('⚠️ AI解析サービスに接続できません。ネットワークを確認するか、品目を手動で入力してください。')
    }

    // 接続エラー時も空配列を返す（偽の結果を返さない）
    return []
  }
}
