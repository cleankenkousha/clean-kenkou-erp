import { ItemPriceMaster } from '../hooks/usePriceMaster'

export interface GeminiDetectedItem {
  name: string
  quantity: number
  unit: string
  volume: number
  unitPrice: number
  reason?: string
}

/**
 * 画像(DataURL / Blob URL)を長辺最大1000pxに軽量圧縮しBase64およびMIMEタイプを取得
 * タイムアウト(4秒)およびBlob処理のフリーズ防止を完全実装
 */
async function compressImageAndGetBase64(
  url: string,
  maxDimension = 1000,
  quality = 0.75
): Promise<{ mimeType: string; data: string }> {
  // Blob URL または Data URL の場合は直接 urlToBase64 で高速安全取得を優先
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    try {
      const directData = await urlToBase64(url)
      if (directData && directData.data) {
        return directData
      }
    } catch {
      // フォールバック継続
    }
  }

  return new Promise((resolve, reject) => {
    let isSettled = false

    const timer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true
        urlToBase64(url).then(resolve).catch(reject)
      }
    }, 4000)

    const img = new Image()
    // 外部HTTP/HTTPS画像の場合のみ crossOrigin を設定
    if (url.startsWith('http://') || url.startsWith('https://')) {
      img.crossOrigin = 'anonymous'
    }

    img.onload = () => {
      if (isSettled) return
      isSettled = true
      clearTimeout(timer)
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
          urlToBase64(url).then(resolve).catch(reject)
          return
        }

        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        const [, data] = dataUrl.split(',')
        resolve({ mimeType: 'image/jpeg', data })
      } catch (e) {
        urlToBase64(url).then(resolve).catch(reject)
      }
    }

    img.onerror = () => {
      if (isSettled) return
      isSettled = true
      clearTimeout(timer)
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

// Google AI Studio 無料枠・標準枠で確実に動作するモデルリスト (v1betaのみ)
const STABLE_FREE_MODELS = [
  { name: 'gemini-1.5-flash', version: 'v1beta' },
  { name: 'gemini-2.0-flash', version: 'v1beta' },
  { name: 'gemini-1.5-pro', version: 'v1beta' },
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
      'Gemini APIキーが設定されていません。システム設定でGemini APIキーを入力してください。'
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

  // 全画像を並列圧縮・Base64変換 (タイムアウト保護付き)
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
    : `- 衣類乾燥除湿機・除湿機 [カテゴリ:家電] (単位:台, 参考単価:¥3000, 推定体積:0.3m3)
- 液晶テレビ（40インチ以上 / 小型） [カテゴリ:家電] (単位:台, 参考単価:¥4000, 推定体積:0.4m3)
- 2人掛けソファ [カテゴリ:家具] (単位:点, 参考単価:¥8000, 推定体積:1.5m3)
- 大型冷蔵庫 [カテゴリ:家電] (単位:台, 参考単価:¥10000, 推定体積:1.2m3)
- 洗濯機・衣類乾燥機 [カテゴリ:家電] (単位:台, 参考単価:¥6000, 推定体積:0.8m3)
- シングルベッド [カテゴリ:家具] (単位:点, 参考単価:¥9000, 推定体積:1.8m3)
- エアコン [カテゴリ:家電] (単位:台, 参考単価:¥2500, 推定体積:0.5m3)
- 段ボール（Mサイズ相当） [カテゴリ:日用品] (単位:箱, 参考単価:¥800, 推定体積:0.1m3)`

  const prompt = `
あなたは不用品回収・遺品整理・ゴミ屋敷清掃の超高精度・プロ査定AIです。
提供された計${targetUrls.length}枚の現場写真を隅々まで注意深く確認・解析し、写真に写っている不用品・回収対象品目を正確に特定してください。

【★最優先指示：銘板・定格表示シール・型番ステッカーのテキスト解読 (OCR)】
1. 写真の中に、製品の「定格銘板（型式・型番ラベル、仕様シール、メーカーロゴ等）」のアップ写真が含まれている場合は、最優先でそこに印字された文字（メーカー名・品名・型式番号）を精密に読み取ってください。
   （例: 「コロナ 衣類乾燥除湿機 BD-H102」のラベル写真の場合、テレビや別の家電ではなく「衣類乾燥除湿機」または「除湿機」として正確に同定してください。）
2. 銘板写真と外観全体写真を組み合わせて照合し、品目を誤認識しないよう極めて慎重に判断してください。

【社内回収品目・単価マスタリスト】
以下の社内マスタを参照し、写真に写っている物品（銘板の読み取り結果含む）がマスタのいずれかの品目に対応する場合は、優先的に【マスタの品目名称（name）】を完全一致または最も適したマスタ名称で出力してください。マスタの単価・単位も優先採用してください：
${masterListText}

【特定品目および単位（kg / 本 / 台 / 枚 / m3 / 個）識別に関する重要指示】
1. 家電（テレビ、冷蔵庫、洗濯機、除湿機、加湿器、空気清浄機、エアコン、電子レンジ等）、家具（ソファ、ベッド、タンス、机等）、日用品・不用品（タイヤ、物干し竿、段ボール、古紙・金属等）を写真ごとに漏れなく特定・カウントしてください。
2. 単位はマスタに準拠して「台」「点」「箱」「袋」「kg」「本」「枚」「m3」「個」などを正確に指定してください。
3. 写真から認識した品目のみを抽出してください。
4. 1点あたりの推定体積(volume: m3数値)と, 目安回収単価(unitPrice: 円)を正確に推定してください。

【出力フォーマット】
以下の形式のJSON配列(JSON Array)のみを出力してください。説明文章やマークダウンの補足は一切含めず、純粋なJSON配列のみを返してください。

[
  {
    "name": "品目名 (例: 衣類乾燥除湿機, 液晶テレビ, 2人掛けソファ, 大型冷蔵庫, タイヤ（普通車用）, 段ボール など)",
    "quantity": 数量(数値),
    "unit": "単位 (例: 台, 点, 箱, 袋, kg, 本, 枚, m3, 個)",
    "volume": 1点あたりの推定体積m3(数値, 例: 0.3),
    "unitPrice": 1点あたりの目安回収単価円(数値, 例: 3000),
    "reason": "AI判定の根拠・メモ (例: 銘板ラベル読取「コロナ BD-H102」 / 状態良好・高年式のため買取候補 / 写真外観から40インチ超液晶テレビと推定 など)"
  }
]
`

  let lastErrorMsg = ''

  // 安定モデルで順番に解析を試行 (各APIリクエストに15秒のタイムアウトを設定)
  for (const modelConfig of STABLE_FREE_MODELS) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/${modelConfig.version}/models/${modelConfig.name}:generateContent?key=${key}`

      const controller = new AbortController()
      const fetchTimeout = setTimeout(() => controller.abort(), 15000)

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              parts: [...inlineDataParts, { text: prompt }],
            },
          ],
        }),
      }).finally(() => clearTimeout(fetchTimeout))

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
          reason: item.reason || (item.name.includes('銘板') ? '銘板情報から高精度判別' : 'AI画像解析により特定'),
        }))
      }
    } catch (err: any) {
      console.warn(`Gemini attempt notice (${modelConfig.name}):`, err)
      lastErrorMsg = err.name === 'AbortError' ? 'API応答タイムアウト(15秒)' : (err.message || String(err))
    }
  }

  // API制限やエラーが発生した場合のハンドリング
  console.error('Gemini API Error:', lastErrorMsg)
  if (lastErrorMsg.includes('API key') || lastErrorMsg.includes('API_KEY')) {
    throw new Error('Gemini APIキーが無効か未設定です。設定画面で正しいGemini APIキーを入力してください。')
  }

  throw new Error(
    `Gemini AI解析に失敗しました (${lastErrorMsg || '接続タイムアウトまたはネットワークエラー'})。`
  )
}
