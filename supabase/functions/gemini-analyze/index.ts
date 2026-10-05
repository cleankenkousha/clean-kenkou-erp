import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// 許可するオリジンのリスト（環境変数またはデフォルト値）
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

// デフォルトの許可オリジン（環境変数未設定時のフォールバック）
const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
]

/**
 * リクエスト元オリジンが許可リストに含まれるかチェックし、
 * CORS ヘッダーを返す。許可されないオリジンには空文字を返す。
 */
function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || ''
  const allowList = ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : DEFAULT_ORIGINS

  // Netlifyの本番URLパターン（*.netlify.app）も許可
  const isAllowed =
    allowList.includes(origin) ||
    origin.endsWith('.netlify.app')

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowList[0] || '',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

// 画像URLの最大数（悪用防止）
const MAX_IMAGE_URLS = 10
// 画像の最大サイズ（バイト）: 10MB
const MAX_IMAGE_SIZE = 10 * 1024 * 1024

/**
 * 画像URLからBase64データを取得する
 * Gemini API の inlineData 形式で返す
 */
async function fetchImageAsBase64(url: string): Promise<{ mimeType: string; data: string } | null> {
  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'image/*' },
    })

    if (!response.ok) {
      console.warn(`画像取得失敗 (HTTP ${response.status}): ${url}`)
      return null
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg'
    const arrayBuffer = await response.arrayBuffer()

    // サイズチェック
    if (arrayBuffer.byteLength > MAX_IMAGE_SIZE) {
      console.warn(`画像サイズ超過 (${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)}MB): ${url}`)
      return null
    }

    // ArrayBuffer → Base64 変換
    const uint8Array = new Uint8Array(arrayBuffer)
    let binary = ''
    for (let i = 0; i < uint8Array.byteLength; i++) {
      binary += String.fromCharCode(uint8Array[i])
    }
    const base64Data = btoa(binary)

    // MIME タイプの正規化
    const mimeType = contentType.split(';')[0].trim()
    const validMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    const safeMimeType = validMimeTypes.includes(mimeType) ? mimeType : 'image/jpeg'

    return { mimeType: safeMimeType, data: base64Data }
  } catch (err) {
    console.warn(`画像取得例外: ${url}`, err)
    return null
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Gemini APIキーの取得（Supabase Edge Function の環境変数から）
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY environment variable is not set' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // リクエストボディの解析 (Base64直接送信 または imageUrls)
    const { images, imageUrls, masterItems } = await req.json()

    let validImages: { mimeType: string; data: string }[] = []

    if (images && Array.isArray(images) && images.length > 0) {
      if (images.length > MAX_IMAGE_URLS) {
        return new Response(
          JSON.stringify({ error: `画像は最大${MAX_IMAGE_URLS}枚までです（${images.length}枚指定されました）` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      validImages = images
        .filter((img: any) => img && typeof img.data === 'string' && img.data.length > 0)
        .map((img: any) => ({
          mimeType: typeof img.mimeType === 'string' ? img.mimeType : 'image/jpeg',
          data: img.data,
        }))
    } else if (imageUrls && Array.isArray(imageUrls) && imageUrls.length > 0) {
      // 画像URL数の制限チェック
      if (imageUrls.length > MAX_IMAGE_URLS) {
        return new Response(
          JSON.stringify({ error: `画像は最大${MAX_IMAGE_URLS}枚までです（${imageUrls.length}枚指定されました）` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // 画像データの取得（並列処理）
      const imageResults = await Promise.all(
        imageUrls.map((url: string) => fetchImageAsBase64(url))
      )
      validImages = imageResults.filter((img): img is { mimeType: string; data: string } => img !== null)
    } else {
      return new Response(
        JSON.stringify({ error: '画像データ(images または imageUrls)が必要です' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (validImages.length === 0) {
      return new Response(
        JSON.stringify({ error: '画像データの取得・解析に失敗しました。画像が有効であることを確認してください。' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 単価マスタのテキスト生成
    const masterListText = masterItems && masterItems.length > 0
      ? masterItems.map((m: any) => `- ${m.name} [カテゴリ:${m.category}] (単位:${m.unit || '点'}, 参考単価:¥${m.price}, 推定体積:${m.volume || 0.5}m3)`).join('\n')
      : `- 大型冷蔵庫・冷蔵庫 [カテゴリ:家電] (単位:台, 参考単価:¥10000, 推定体積:1.2m3)
- 洗濯機・衣類乾燥機 [カテゴリ:家電] (単位:台, 参考単価:¥6000, 推定体積:0.8m3)
- 液晶テレビ（40インチ以上 / 小型） [カテゴリ:家電] (単位:台, 参考単価:¥4000, 推定体積:0.4m3)
- 2人掛けソファ [カテゴリ:家具] (単位:点, 参考単価:¥8000, 推定体積:1.5m3)
- シングルベッド [カテゴリ:家具] (単位:点, 参考単価:¥9000, 推定体積:1.8m3)
- エアコン [カテゴリ:家電] (単位:台, 参考単価:¥2500, 推定体積:0.5m3)
- 段ボール（Mサイズ相当） [カテゴリ:日用品] (単位:箱, 参考単価:¥800, 推定体積:0.1m3)`

    const prompt = `
あなたは不用品回収・遺品整理・ゴミ屋敷清掃の超高精度・プロ査定AIです。
提供された計${validImages.length}枚の現場写真を隅々まで注意深く確認・解析し、写真に写っている不用品・回収対象品目を正確に特定してください。

【最優先：写真に写っている物品の同定】
写真1枚の場合（例: 冷蔵庫の単体写真）は、無理に複数品目を出さず、写真に写っている主要品目（大型冷蔵庫など）を正確に特定してください。

【社内回収品目・単価マスタリスト】
${masterListText}

【出力フォーマット】
JSON配列(JSON Array)のみを出力してください。マークダウンのコードブロックは使わず、純粋なJSONのみ出力してください。

[
  {
    "name": "品目名 (例: 大型冷蔵庫, 液晶テレビ, 2人掛けソファ, 洗濯機, 段ボール など)",
    "quantity": 数量(数値),
    "unit": "単位 (例: 台, 点, 箱, 袋, kg, 本, 枚, m3, 個)",
    "volume": 1点あたりの推定体積m3(数値, 例: 0.3),
    "unitPrice": 1点あたりの目安回収単価円(数値, 例: 3000),
    "reason": "AI判定の根拠・メモ"
  }
]
`

    // Gemini API リクエストの構築（画像データを含む）
    const parts: any[] = [{ text: prompt }]

    // 画像をinlineData形式で追加
    for (const img of validImages) {
      parts.push({
        inlineData: {
          mimeType: img.mimeType,
          data: img.data,
        },
      })
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts,
          },
        ],
        // レスポンスをJSON形式に限定
        generationConfig: {
          responseMimeType: 'application/json',
        },
      }),
    })

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}))
      return new Response(
        JSON.stringify({ error: errJson?.error?.message || `Gemini API returned HTTP ${res.status}` }),
        { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const resJson = await res.json()
    const textOutput = resJson.candidates?.[0]?.content?.parts?.[0]?.text || ''

    // JSONパース（コードブロックの除去を含む安全なパース）
    const cleanJson = textOutput
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim()

    let items: any[]
    try {
      items = JSON.parse(cleanJson)
    } catch (parseErr) {
      console.error('Gemini API レスポンスの JSON パースに失敗:', cleanJson.substring(0, 500))
      return new Response(
        JSON.stringify({
          error: 'AI解析結果の解析に失敗しました。再度お試しください。',
          rawOutput: cleanJson.substring(0, 200),
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // レスポンスのバリデーション
    if (!Array.isArray(items)) {
      items = [items] // オブジェクト単体が返った場合は配列に変換
    }

    return new Response(JSON.stringify({ items }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Internal Edge Function Error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
