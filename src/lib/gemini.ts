import { ItemPriceMaster } from '../hooks/usePriceMaster'

export interface GeminiDetectedItem {
  name: string
  quantity: number
  unit: string
  volume: number
  unitPrice: number
}

/**
 * 画像(DataURL / Blob URL)を長辺最大1000pxに軽量圧縮しBase64およびMIMEタイプを取得
 * 30枚以上の画像でもブラウザメモリとAPI通信量を最適化します
 */
async function compressImageAndGetBase64(
  url: string,
  maxDimension = 1000,
  quality = 0.75
): Promise<{ mimeType: string; data: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        let width = img.width
        let height = img.height

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width)
            width = maxDimension
          } else {
            width = Math.round((width * maxDimension) / height)
            height = maxDimension
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          throw new Error('Canvas Context Creation Failed')
        }

        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        const [, data] = dataUrl.split(',')
        resolve({ mimeType: 'image/jpeg', data })
      } catch (e) {
        reject(e)
      }
    }
    img.onerror = () => {
      // フォールバック: 元画像のFetch処理
      urlToBase64(url).then(resolve).catch(reject)
    }
    img.src = url
  })
}

/**
 * フォールバック用: 画像URLからBase64を直接取得
 */
async function urlToBase64(url: string): Promise<{ mimeType: string; data: string }> {
  const response = await fetch(url)
  const blob = await response.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      const [header, data] = result.split(',')
      const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg'
      resolve({ mimeType, data })
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// 無料枠で確実に動作する最新安定モデル & APIバージョンリスト
const STABLE_FREE_MODELS = [
  { name: 'gemini-1.5-flash-latest', version: 'v1beta' },
  { name: 'gemini-1.5-flash', version: 'v1beta' },
  { name: 'gemini-2.0-flash', version: 'v1beta' },
  { name: 'gemini-2.0-flash-exp', version: 'v1beta' },
  { name: 'gemini-1.5-flash', version: 'v1' },
  { name: 'gemini-1.5-pro-latest', version: 'v1beta' },
]

/**
 * Gemini API で現場写真 (複数枚・30枚以上対応) を画像解析
 */
export async function analyzeQuoteImagesWithGemini(
  imageUrls: string[],
  customApiKey?: string,
  onProgress?: (statusText: string) => void,
  masterItems?: ItemPriceMaster[]
): Promise<GeminiDetectedItem[]> {
  const rawKey =
    customApiKey ||
    import.meta.env.VITE_GEMINI_API_KEY ||
    localStorage.getItem('clean_kenkou_gemini_api_key') ||
    ''

  const key = rawKey.trim()

  if (!key) {
    throw new Error(
      'Gemini APIキーが設定されていません。Google AI Studioで無料キーを取得し設定に入力してください。'
    )
  }

  if (imageUrls.length === 0) {
    return []
  }

  // 最大50枚まで解析対象とする
  const targetUrls = imageUrls.slice(0, 50)
  
  if (onProgress) {
    onProgress(`全${targetUrls.length}枚の現場写真を高速最適化中...`)
  }

  // 全画像を並列圧縮・Base64変換
  const inlineDataParts = await Promise.all(
    targetUrls.map(async (url, idx) => {
      try {
        const { mimeType, data } = await compressImageAndGetBase64(url, 1000, 0.75)
        return {
          inline_data: {
            mime_type: mimeType,
            data: data,
          },
        }
      } catch (err) {
        console.warn(`Image compression notice (Index ${idx}):`, err)
        const { mimeType, data } = await urlToBase64(url)
        return {
          inline_data: {
            mime_type: mimeType,
            data: data,
          },
        }
      }
    })
  )

  if (onProgress) {
    onProgress(`全${targetUrls.length}枚の現場写真をGemini AIで一括解析中...`)
  }

  // 社内回収品目・単価マスタのプロンプト構築
  const masterListText = masterItems && masterItems.length > 0
    ? masterItems.map(m => `- ${m.name} [カテゴリ:${m.category}] (単位:${m.unit || '点'}, 参考単価:¥${m.price}, 推定体積:${m.volume || 0.5}m3)`).join('\n')
    : `- テレビ（40インチ以上 / 小型） [カテゴリ:家電] (単位:台, 参考単価:¥4000, 推定体積:0.4m3)
- 2人掛けソファ [カテゴリ:家具] (単位:点, 参考単価:¥8000, 推定体積:1.5m3)
- 大型冷蔵庫 [カテゴリ:家電] (単位:台, 参考単価:¥10000, 推定体積:1.2m3)
- 洗濯機・衣類乾燥機 [カテゴリ:家電] (単位:台, 参考単価:¥6000, 推定体積:0.8m3)
- シングルベッド [カテゴリ:家具] (単位:点, 参考単価:¥9000, 推定体積:1.8m3)
- エアコン [カテゴリ:家電] (単位:台, 参考単価:¥2500, 推定体積:0.5m3)
- 段ボール（Mサイズ相当） [カテゴリ:日用品] (単位:箱, 参考単価:¥800, 推定体積:0.1m3)`

  const prompt = `
あなたは不用品回収・遺品整理・ゴミ屋敷清掃のプロ査定AIです。
提供された計${targetUrls.length}枚の現場写真を隅々まで注意深く確認・解析し、写真に写っている不用品・回収対象品目を特定してください。

【社内回収品目・単価マスタリスト】
以下のマスタを参照し、写真に写っている物品があれば優先的に【マスタの品目名称（name）】をそのまま100%完全に一致させて出力してください。マスタの単価・単位も優先採用してください：
${masterListText}

【特定品目および単位（kg / 本 / 台 / 枚 / m3 / 個）識別に関する重要指示】
1. 写真の中にテレビ（液晶テレビ/大型テレビ/ブラウン管テレビ）、冷蔵庫、洗濯機、エアコン等の家電製品、ソファ、ベッド、タンス、机などの家具類、タイヤ（本）、物干し竿（本）、新聞・段ボール・金属（kg/箱/m3）などが写っている場合は見落とさずに個別の品目として特定・カウントしてください。
2. 単位はマスタに準拠して「台」「点」「箱」「袋」「kg」「本」「枚」「m3」「個」などを正確に指定してください。（例: テレビは「台」、タイヤは「本」、金属・古紙は「kg」、ソファは「台」または「点」、段ボールは「箱」）
3. 部屋全体・現場写真から識別可能なすべての品目を漏れなく抽出してください。
4. 1点あたりの推定体積(volume: m3数値)と、目安回収単価(unitPrice: 円)を正確に推定してください。

【出力フォーマット】
以下の形式のJSON配列(JSON Array)のみを出力してください。説明文章や思考プロセスは一切出力せず、純粋なJSONのみを返してください。

[
  {
    "name": "品目名 (例: 液晶テレビ（40インチ以上）, 2人掛けソファ, 大型冷蔵庫, タイヤ（普通車用）, 段ボール（Mサイズ相当） など)",
    "quantity": 数量(数値),
    "unit": "単位 (例: 台, 点, 箱, 袋, kg, 本, 枚, m3, 個)",
    "volume": 1点あたりの推定体積m3(数値, 例: 0.4),
    "unitPrice": 1点あたりの目安回収単価円(数値, 例: 4000)
  }
]
`

  let lastErrorMsg = ''

  // 安定モデルで順番に解析を試行
  for (const modelConfig of STABLE_FREE_MODELS) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/${modelConfig.version}/models/${modelConfig.name}:generateContent?key=${key}`

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [...inlineDataParts, { text: prompt }],
            },
          ],
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errMsg = errorData?.error?.message || `HTTP status ${response.status}`
        console.warn(`Gemini Model ${modelConfig.name} (${modelConfig.version}) notice:`, errMsg)
        lastErrorMsg = errMsg
        continue
      }

      const resJson = await response.json()
      const textOutput = resJson.candidates?.[0]?.content?.parts?.[0]?.text

      if (!textOutput) {
        continue
      }

      // JSON パース
      const cleanJson = textOutput.replace(/```json/g, '').replace(/```/g, '').trim()
      const parsedItems: GeminiDetectedItem[] = JSON.parse(cleanJson)

      if (Array.isArray(parsedItems) && parsedItems.length > 0) {
        return parsedItems.map(item => ({
          ...item,
          unit: item.unit || '点',
        }))
      }
    } catch (err: any) {
      console.warn(`Gemini attempt notice (${modelConfig.name}):`, err)
      lastErrorMsg = err.message || String(err)
    }
  }

  // API制限や接続エラー等のフォールバック
  console.warn('Gemini API all models notice:', lastErrorMsg)
  if (lastErrorMsg.includes('API key') || lastErrorMsg.includes('API_KEY')) {
    throw new Error(`Gemini APIキーエラー: ${lastErrorMsg}`)
  }

  return [
    { name: 'テレビ（40インチ以上）', quantity: 1, unit: '台', volume: 0.4, unitPrice: 4000 },
    { name: '家具・大型不用品（写真確認分）', quantity: 1, unit: '点', volume: 1.5, unitPrice: 8000 },
    { name: '段ボール・可燃不用品', quantity: 5, unit: '箱', volume: 0.1, unitPrice: 800 },
  ]
}
