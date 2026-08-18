import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY environment variable is not set' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { imageUrls, masterItems } = await req.json()
    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return new Response(
        JSON.stringify({ error: 'imageUrls array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const masterListText = masterItems && masterItems.length > 0
      ? masterItems.map((m: any) => `- ${m.name} [カテゴリ:${m.category}] (単位:${m.unit || '点'}, 参考単価:¥${m.price}, 推定体積:${m.volume || 0.5}m3)`).join('\n')
      : `- 大型冷蔵庫・冷蔵庫 [カテゴリ:家電] (単位:台, 参考単価:¥10000, 推定体積:1.2m3)
- 洗濯機・衣類乾燥機 [カテゴリ:家電] (単位:台, 参考単価:¥6000, 推定体積:0.8m3)
- 液晶テレビ（40インチ以上 / 小型） [カテゴリ:家電] (単位:台, 参考単価:¥4000, 推定体積:0.4m3)
- 衣類乾燥除湿機・除湿機 [カテゴリ:家電] (単位:台, 参考単価:¥3000, 推定体積:0.3m3)
- 2人掛けソファ [カテゴリ:家具] (単位:点, 参考単価:¥8000, 推定体積:1.5m3)
- シングルベッド [カテゴリ:家具] (単位:点, 参考単価:¥9000, 推定体積:1.8m3)
- エアコン [カテゴリ:家電] (単位:台, 参考単価:¥2500, 推定体積:0.5m3)
- 段ボール（Mサイズ相当） [カテゴリ:日用品] (単位:箱, 参考単価:¥800, 推定体積:0.1m3)`

    const prompt = `
あなたは不用品回収・遺品整理・ゴミ屋敷清掃の超高精度・プロ査定AIです。
提供された計${imageUrls.length}枚の現場写真を隅々まで注意深く確認・解析し、写真に写っている不用品・回収対象品目を正確に特定してください。

【最優先：写真に写っている物品の同定】
写真1枚の場合（例: 冷蔵庫の単体写真）は、無理に複数品目を出さず、写真に写っている主要品目（大型冷蔵庫など）を正確に特定してください。

【社内回収品目・単価マスタリスト】
${masterListText}

【出力フォーマット】
JSON配列(JSON Array)のみを出力してください。

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

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
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
    const cleanJson = textOutput.replace(/```json/g, '').replace(/```/g, '').trim()
    const items = JSON.parse(cleanJson)

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
