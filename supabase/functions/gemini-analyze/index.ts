import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-region, *',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
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

    // 単価マスタのテキスト生成（全角「㎏」は「kg」に正規化）
    const masterListText = masterItems && masterItems.length > 0
      ? masterItems.map((m: any) => {
          const normUnit = (m.unit || '点').replace(/㎏/g, 'kg')
          return `- ${m.name} [カテゴリ:${m.category}] (単位:${normUnit}, 参考単価:¥${m.price}, 推定体積:${m.volume || 0.5}m3)`
        }).join('\n')
      : `- 大型冷蔵庫・冷蔵庫 [カテゴリ:４家電] (単位:台, 参考単価:¥9100, 推定体積:1.2m3)
- 洗濯機 [カテゴリ:４家電] (単位:台, 参考単価:¥7100, 推定体積:0.8m3)
- テレビ [カテゴリ:４家電] (単位:台, 参考単価:¥7100, 推定体積:0.4m3)
- エアコン [カテゴリ:４家電] (単位:台, 参考単価:¥5500, 推定体積:0.5m3)
- ソファー（大） [カテゴリ:その他自社処理] (単位:台, 参考単価:¥2500, 推定体積:1.5m3)
- スプリングマット [カテゴリ:その他自社処理] (単位:台, 参考単価:¥3700, 推定体積:1.8m3)
- 木くず [カテゴリ:その他自社処理] (単位:kg, 参考単価:¥40, 重量制品目)
- 可燃性粗大ごみ [カテゴリ:その他自社処理] (単位:kg, 参考単価:¥45, 重量制品目)
- 雑ゴミ（可燃物など） [カテゴリ:その他自社処理] (単位:kg, 参考単価:¥45, 重量制品目)
- プラスチック類 [カテゴリ:その他自社処理] (単位:kg, 参考単価:¥85, 重量制品目)`

    const prompt = `
あなたは不用品回収・遺品整理・ゴミ屋敷清掃の超高精度・プロ査定AIです。
提供された計${validImages.length}枚の現場写真を隅々まで注意深く確認・解析し、写真に写っている不用品・回収対象品目を正確に特定してください。

【最重要原則：点数制と重量制（kg単価）の厳格な区分】
当社の回収品目には「1点・1台あたりの固定単価品目」と「1kgあたりの重量単価品目」の2種類が存在します。絶対に混同しないでください。

1. **重量制品目（木くず、可燃性粗大ごみ、雑ゴミ、プラスチック類、陶器くず、金属くず等）の査定ルール**
   - **単位は必ず「kg」** としてください。「点」や「個」にしてはいけません。
   - **写真の堆積状況・山積みの規模から、概算の総重量(kg)を推定して "quantity" に数値（例: 50, 100, 200 等）として出力** してください。
     * 目安：ゴミ袋数個分＝約10〜30kg、軽トラ荷台の半分程度の山＝約100〜200kg、山積みの廃木材・角材＝約80〜250kg
   - "unitPrice" にはマスタの1kgあたり単価（木くず: 40円/kg、可燃性粗大ごみ: 45円/kg等）を設定してください。
   - "volume" にはその推定重量全体の概算体積m3（木くず・粗大ゴミの比重目安: 約0.15〜0.25t/m3、100kgなら約0.5m3）を設定してください。

2. **特定品目（家電・家具など）の査定ルール**
   - 冷蔵庫、洗濯機、テレビ、エアコンなどの家電、ソファ、ベッド、椅子、机などの家具は「台」「点」単位で数量をカウントしてください。

3. **【最重要：複数枚写真における重複排除・現場全体の一元算定】**
   - 計${validImages.length}枚の写真は、同一の部屋や現場を異なるアングル・距離から撮影したものです。
   - 別アングルの写真に写っている同一の物品（例: 同じソファ、同じ冷蔵庫、同じ木くずの山）を写真ごとに重複して二重・三重にカウントしてはいけません。
   - 現場全体を見渡して、実際に存在する「ユニークな品目・総重量」として1つに統合して出力してください。

4. **【最重要：再現性のある客観的算定】**
   - 推測で数値を大きく変動させず、写真の占有面積・容積（畳数・高さ・ゴミ袋相当数）に基づき、同じ写真からは常に一貫した安定的な推定値を算出してください。

【社内回収品目・単価マスタリスト】
${masterListText}

【出力フォーマット】
JSON配列(JSON Array)のみを出力してください。マークダウンのコードブロックは使わず、純粋なJSONのみ出力してください。

[
  {
    "name": "品目名 (社内マスタの名称に極力一致させてください。例: 木くず, 可燃性粗大ごみ, 大型冷蔵庫, 洗濯機, ソファー など)",
    "quantity": 数量または推定重量kg(数値。kg品目の場合は推定kg数、家電家具等は点数・台数),
    "unit": "単位 (重量制は 'kg'、家電は '台'、家具等は '点' または '台')",
    "volume": 概算体積m3(数値, 例: 0.5),
    "unitPrice": 1単位あたりの単価円(数値, kg品目なら1kgあたりの単価、個別品目なら1点・台あたりの単価),
    "reason": "AI判定の根拠・メモ (例: 散乱した木材・角材の山積みから約80kgと推定)"
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

    // 利用可能なモデル候補（高負荷503や障害時に自動フォールバック）
    const candidateModels = [
      'gemini-3.5-flash-lite',
      'gemini-3.8-flash',
      'gemini-2.5-flash'
    ]

    let textOutput = ''
    let lastError = ''

    for (const model of candidateModels) {
      try {
        console.log(`Geminiモデル [${model}] で解析を試行中...`)
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.1,
            },
          }),
        })

        if (res.ok) {
          const resJson = await res.json()
          textOutput = resJson.candidates?.[0]?.content?.parts?.[0]?.text || ''
          if (textOutput) {
            console.log(`モデル [${model}] での解析に成功しました`)
            break
          }
        } else {
          const errJson = await res.json().catch(() => ({}))
          lastError = errJson?.error?.message || `HTTP ${res.status}`
          console.warn(`モデル [${model}] 失敗 (${res.status}): ${lastError}`)
        }
      } catch (callErr: any) {
        lastError = callErr.message || String(callErr)
        console.warn(`モデル [${model}] 例外: ${lastError}`)
      }
    }

    if (!textOutput) {
      console.error('全モデルでのGemini解析に失敗:', lastError)
      return new Response(
        JSON.stringify({
          error: `AI解析サーバーが現在混み合っています。(${lastError})。少し時間をおいて再度お試しください。`,
          items: []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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
          error: 'AI解析結果のパースに失敗しました。再度お試しください。',
          items: [],
          rawOutput: cleanJson.substring(0, 200),
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
      JSON.stringify({ error: err.message || 'Internal Edge Function Error', items: [] }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
