import { StepsData } from '../components/features/PrintArea'

/**
 * jobs.notes に保存される構造化データ（工程チェックリスト・電子署名・受付メモ・概算見積データ）を
 * 相互破壊せずに安全に読み書きするための正規化ヘルパー
 */
export const STEP_KEYS: (keyof StepsData)[] = [
  'reception',
  'estimate_schedule',
  'estimate_do',
  'estimate_submit',
  'customer_consideration',
  'work_schedule',
  'schedule_confirmed',
  'work_execution',
  'invoice_sent',
]

export interface ParsedJobNotes {
  stepsData: StepsData
  signature: string | null
  receptionNote: string
  quoteData: any | null
  quoteGrandTotal: number
}

export const parseJobNotes = (rawNotes?: string | null): ParsedJobNotes => {
  const empty: ParsedJobNotes = {
    stepsData: {},
    signature: null,
    receptionNote: '',
    quoteData: null,
    quoteGrandTotal: 0,
  }

  if (!rawNotes || !rawNotes.trim()) {
    return empty
  }

  const trimmed = rawNotes.trim()
  let parsed: any = null
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    // プレーンテキスト（電話受付メモやExcel取り込みメモ等）
    return {
      ...empty,
      receptionNote: rawNotes,
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      ...empty,
      receptionNote: rawNotes,
    }
  }

  // 見積データの抽出（新形式 parsed.quoteData またはレガシー parsed.quoteType === 'mobile_ai_quote'）
  const quoteData =
    parsed.quoteData && typeof parsed.quoteData === 'object'
      ? parsed.quoteData
      : parsed.quoteType === 'mobile_ai_quote'
      ? parsed
      : null

  // 工程チェックリストの抽出（見積キーが混入しないよう STEP_KEYS のみ許可）
  const stepsData: StepsData = {}
  const stepSource =
    parsed.stepsData && typeof parsed.stepsData === 'object'
      ? parsed.stepsData
      : parsed

  for (const key of STEP_KEYS) {
    if (stepSource[key] && typeof stepSource[key] === 'object') {
      stepsData[key] = stepSource[key]
    }
  }

  // 署名データの抽出
  const signature: string | null =
    typeof parsed.signature === 'string' && parsed.signature.length > 0
      ? parsed.signature
      : typeof quoteData?.signature === 'string' && quoteData.signature.length > 0
      ? quoteData.signature
      : null

  // 受付メモの抽出
  const receptionNote: string =
    typeof parsed.receptionNote === 'string' ? parsed.receptionNote : ''

  // 事前見積合計金額の抽出
  const quoteGrandTotal: number =
    typeof quoteData?.grandTotal === 'number'
      ? quoteData.grandTotal
      : typeof parsed.grandTotal === 'number'
      ? parsed.grandTotal
      : 0

  return {
    stepsData,
    signature,
    receptionNote,
    quoteData,
    quoteGrandTotal,
  }
}

export interface MergeJobNotesPatch {
  stepsData?: StepsData
  signature?: string | null
  quoteData?: any
  receptionNote?: string
}

export const mergeJobNotes = (
  existingRawNotes: string | null | undefined,
  patch: MergeJobNotesPatch
): string => {
  const current = parseJobNotes(existingRawNotes)

  const nextStepsData =
    patch.stepsData !== undefined ? patch.stepsData : current.stepsData
  const nextSignature =
    patch.signature !== undefined ? patch.signature : current.signature
  const nextReceptionNote =
    patch.receptionNote !== undefined ? patch.receptionNote : current.receptionNote
  const nextQuoteData =
    patch.quoteData !== undefined ? patch.quoteData : current.quoteData

  const merged: Record<string, any> = {
    stepsData: nextStepsData || {},
  }

  if (nextSignature !== null && nextSignature !== undefined && nextSignature !== '') {
    merged.signature = nextSignature
  } else {
    merged.signature = null
  }

  if (nextReceptionNote && nextReceptionNote.trim()) {
    merged.receptionNote = nextReceptionNote
  }

  if (nextQuoteData && typeof nextQuoteData === 'object') {
    const cleanQuoteData = { ...nextQuoteData }
    // 新形式として quoteData に保持しつつ、レガシー参照互換のためトップレベルにも主要項目を展開
    merged.quoteData = cleanQuoteData
    merged.quoteType = 'mobile_ai_quote'
    merged.items = cleanQuoteData.items ?? []
    merged.itemsSubtotal = cleanQuoteData.itemsSubtotal ?? 0
    merged.baseFee = cleanQuoteData.baseFee ?? 0
    merged.expenses = cleanQuoteData.expenses ?? 0
    merged.workExpenses = cleanQuoteData.workExpenses ?? 0
    merged.floorLevel = cleanQuoteData.floorLevel
    merged.hasCarryOut = cleanQuoteData.hasCarryOut
    merged.autoStairFee = cleanQuoteData.autoStairFee ?? 0
    merged.disassemblyFee = cleanQuoteData.disassemblyFee ?? 0
    merged.appliedPack = cleanQuoteData.appliedPack ?? 'none'
    merged.totalVolume = cleanQuoteData.totalVolume ?? 0
    merged.volumeWorkFee = cleanQuoteData.volumeWorkFee ?? 0
    merged.workFeePerM3 = cleanQuoteData.workFeePerM3 ?? 1500
    merged.grandTotal = cleanQuoteData.grandTotal ?? 0
    merged.notes = cleanQuoteData.notes ?? ''
  }

  return JSON.stringify(merged)
}
