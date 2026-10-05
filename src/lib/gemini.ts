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
 * 画像（Blob URL または 通常URL）をブラウザ側で約100KB前後に確実・高速圧縮して Base64 変換
 */
async function processImageToBase64(
  url: string,
  maxWidth = 1000,
  maxHeight = 1000
): Promise<{ mimeType: string; data: string }> {
  const response = await fetch(url)
  const blob = await response.blob()

  // 1. createImageBitmap による超高速・安全なリサイズ
  try {
    const tempBitmap = await createImageBitmap(blob)
    let w = tempBitmap.width
    let h = tempBitmap.height

    if (w > maxWidth || h > maxHeight) {
      if (w > h) {
        h = Math.round((h * maxWidth) / w)
        w = maxWidth
      } else {
        w = Math.round((w * maxHeight) / h)
        h = maxHeight
      }
    }

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(tempBitmap, 0, 0, w, h)
      tempBitmap.close()
      // JPEG品質 0.7 で圧縮（1枚あたり約80KB〜150KBに超軽量化）
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
      const commaIdx = dataUrl.indexOf(',')
      const base64 = dataUrl.slice(commaIdx + 1)
      return { mimeType: 'image/jpeg', data: base64 }
    }
    tempBitmap.close()
  } catch (bitmapErr) {
    console.warn('createImageBitmap fallback to FileReader:', bitmapErr)
  }

  // フォールバック: FileReader
  return readBlobAsBase64(blob)
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

export interface AnalyzeQuoteResult {
  items: GeminiDetectedItem[]
  error?: string
}

/**
 * Supabase Edge Function 経由で Gemini API による画像解析を実行
 * (クライアント側APIキー直接保持・送信を完全に排除したセキュア仕様)
 */
export async function analyzeQuoteImagesWithGemini(
  imageUrls: string[],
  _customApiKey?: string,
  onProgress?: (statusText: string) => void,
  masterItems?: ItemPriceMaster[]
): Promise<AnalyzeQuoteResult> {
  if (imageUrls.length === 0) {
    return { items: [] }
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
      console.error('Gemini Edge Function エラー:', error)

      let detailMsg = error.message
      try {
        if ((error as any).context) {
          const errBody = await (error as any).context.json()
          if (errBody?.error) detailMsg = errBody.error
        }
      } catch {
        // ignore
      }

      const userMessage = detailMsg?.includes('GEMINI_API_KEY')
        ? 'AI解析サービスのAPIキーが未設定です。管理者に連絡してください。'
        : detailMsg?.includes('high demand')
          ? '現在AIサーバーが一時的に混み合っています。数秒後にもう一度「✨ AI自動抽出」を押してください。'
          : detailMsg || 'AI画像解析に失敗しました。'

      if (onProgress) {
        onProgress(`⚠️ ${userMessage}`)
      }

      return { items: [], error: userMessage }
    }

    if (data && Array.isArray(data.items) && data.items.length > 0) {
      const items = data.items.map((item: any) => ({
        ...item,
        unit: item.unit || '点',
        reason: item.reason || 'AI画像解析により特定',
      }))
      return { items }
    }

    // AIが品目を検出できなかった場合
    if (onProgress) {
      onProgress('⚠️ 写真から品目を検出できませんでした。')
    }
    return { items: [], error: '写真から品目を検出できませんでした。' }
  } catch (err: any) {
    console.error('Edge Function 接続エラー:', err)
    const detail = err?.message || String(err)
    const errText = `通信エラー: ${detail}`

    if (onProgress) {
      onProgress(`⚠️ ${errText}`)
    }

    return { items: [], error: errText }
  }
}

