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
 * 画像（Blob URL または 通常URL）をブラウザ側で軽量リサイズして Base64 データに変換する
 */
async function processImageToBase64(
  url: string,
  maxWidth = 1200,
  maxHeight = 1200
): Promise<{ mimeType: string; data: string }> {
  const response = await fetch(url)
  const blob = await response.blob()

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    const objectUrl = URL.createObjectURL(blob)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      let width = img.width
      let height = img.height

      if (width > maxWidth || height > maxHeight) {
        if (width > height) {
          height = Math.round((height * maxWidth) / width)
          width = maxWidth
        } else {
          width = Math.round((width * maxHeight) / height)
          height = maxHeight
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        readBlobAsBase64(blob).then(resolve).catch(reject)
        return
      }

      ctx.drawImage(img, 0, 0, width, height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
      const [header, base64] = dataUrl.split(',')
      const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg'
      resolve({ mimeType, data: base64 })
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      readBlobAsBase64(blob).then(resolve).catch(reject)
    }

    img.src = objectUrl
  })
}

function readBlobAsBase64(blob: Blob): Promise<{ mimeType: string; data: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      const [header, data] = result.split(',')
      const mimeType = header.match(/:(.*?);/)?.[1] || blob.type || 'image/jpeg'
      resolve({ mimeType, data })
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
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
    onProgress(`全${imageUrls.length}枚の現場写真をAI用に最適化中...`)
  }

  try {
    // ブラウザ側でBlob/URL画像をBase64に変換・圧縮（最大10枚）
    const images = await Promise.all(
      imageUrls.slice(0, 10).map((url) => processImageToBase64(url))
    )

    if (onProgress) {
      onProgress(`全${images.length}枚の現場写真をEdge Function経由で安全に解析中...`)
    }

    const { data, error } = await supabase.functions.invoke('gemini-analyze', {
      body: { images, masterItems },
    })

    if (error) {
      // Edge Function のエラー詳細をログに記録
      console.error('Gemini Edge Function エラー:', error)

      // 詳細メッセージの取得試行
      let detailMsg = error.message
      try {
        if ((error as any).context) {
          const errBody = await (error as any).context.json()
          if (errBody?.error) detailMsg = errBody.error
        }
      } catch {
        // ignore
      }

      // ユーザー向けの分かりやすいエラーメッセージ
      const userMessage = detailMsg?.includes('GEMINI_API_KEY')
        ? 'AI解析サービスのAPIキーが未設定です。管理者に連絡してください。'
        : detailMsg?.includes('high demand')
          ? '現在AIサービスが一時的に混み合っています。数秒後にもう一度「✨ AI自動抽出」を押してください。'
          : detailMsg || 'AI画像解析に失敗しました。品目を手動で入力してください。'

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
