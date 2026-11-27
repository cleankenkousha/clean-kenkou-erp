import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface ItemPriceMaster {
  id: string
  category: string
  name: string
  unit: string
  price: number
  volume?: number
}

export const DEFAULT_ITEMS: ItemPriceMaster[] = [
  { id: '1', category: '家具・リビング', name: '2人掛けソファ', unit: '点', price: 8000, volume: 1.5 },
  { id: '2', category: '家電', name: '大型冷蔵庫 (300L以上)', unit: '台', price: 10000, volume: 1.2 },
  { id: '3', category: '家電', name: '洗濯機・衣類乾燥機', unit: '台', price: 6000, volume: 0.8 },
  { id: '4', category: '家具・寝室', name: 'シングルベッド（フレーム・マットレス）', unit: '点', price: 9000, volume: 1.8 },
  { id: '5', category: '家電', name: 'テレビ（40インチ以上）', unit: '台', price: 4000, volume: 0.4 },
  { id: '6', category: '家具・オフィス', name: '学習机 / オフィスデスク', unit: '点', price: 5000, volume: 1.0 },
  { id: '7', category: '日用品・梱包', name: '段ボール（Mサイズ相当）', unit: '箱', price: 800, volume: 0.1 },
  { id: '8', category: '家具・収納', name: 'タンス / チェスト', unit: '点', price: 7000, volume: 1.2 },
  { id: '9', category: '４家電', name: 'エアコン', unit: '台', price: 2500, volume: 0.5 },
  { id: '10', category: 'その他自社処理', name: '木くず', unit: 'kg', price: 40, volume: 0 },
  { id: '11', category: 'その他自社処理', name: '可燃性粗大ごみ', unit: 'kg', price: 45, volume: 0 },
  { id: '12', category: 'その他', name: '可燃物・不用品袋', unit: '袋', price: 500, volume: 0.1 },
]

export interface UsePriceMasterReturn {
  items: ItemPriceMaster[]
  isLoading: boolean
  isSyncing: boolean
  error: string | null
  addItem: (item: Omit<ItemPriceMaster, 'id'>) => Promise<boolean>
  updateItemPrice: (id: string, newPrice: number) => Promise<boolean>
  deleteItem: (id: string) => Promise<boolean>
  moveItemUp: (index: number) => Promise<boolean>
  moveItemDown: (index: number) => Promise<boolean>
  resetToDefaults: () => Promise<boolean>
  syncAllItemsToCloud: () => Promise<{ success: boolean; count: number; message: string }>
  refetch: () => Promise<void>
}


const safeParsePriceMaster = (raw: string | null): ItemPriceMaster[] => {
  if (!raw) return DEFAULT_ITEMS
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : DEFAULT_ITEMS
  } catch {
    return DEFAULT_ITEMS
  }
}

const normalizeUnitValue = (u?: string): string => {
  const s = (u || 'kg').trim()
  if (s === '㎏' || s.toLowerCase() === 'kg') return 'kg'
  if (s === '㎥' || s.toLowerCase() === 'm3') return 'm3'
  return s
}

export const usePriceMaster = (): UsePriceMasterReturn => {
  const [items, setItems] = useState<ItemPriceMaster[]>(() => {
    return safeParsePriceMaster(localStorage.getItem('clean_kenkou_price_master'))
  })
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isSyncing, setIsSyncing] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const saveLocalAndState = (newItems: ItemPriceMaster[]) => {
    setItems(newItems)
    try {
      localStorage.setItem('clean_kenkou_price_master', JSON.stringify(newItems))
    } catch (e) {
      console.warn('localStorage save failed:', e)
    }
  }

  const fetchPriceMaster = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true)
    setError(null)
    try {
      const { data, error: fetchErr } = await supabase
        .from('price_master')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })

      if (fetchErr) {
        console.warn('Price master table sync notice (using local fallback if unavailable):', fetchErr.message)
        setError(fetchErr.message)
      } else if (data && data.length > 0) {
        // 既存のローカル情報から volume を引き継ぐマップ（DBに volume が無いレガシー行向け）
        const currentSaved = safeParsePriceMaster(localStorage.getItem('clean_kenkou_price_master'))
        const volumeMap = new Map<string, number>()
        currentSaved.forEach((item) => {
          if (item.volume !== undefined) volumeMap.set(item.name, item.volume)
        })
        DEFAULT_ITEMS.forEach((item) => {
          if (item.volume !== undefined && !volumeMap.has(item.name)) {
            volumeMap.set(item.name, item.volume)
          }
        })

        const fetchedItems: ItemPriceMaster[] = data.map((d: any) => {
          const normUnit = normalizeUnitValue(d.unit)
          const dbVol =
            d.volume !== null && d.volume !== undefined ? Number(d.volume) : undefined
          const fallbackVol =
            normUnit === 'kg' ? 0 : volumeMap.get(d.name) ?? 0.5
          return {
            id: String(d.id),
            category: d.category || '',
            name: d.name || '',
            unit: normUnit,
            price: Number(d.price) || 0,
            volume: dbVol !== undefined && !Number.isNaN(dbVol) ? dbVol : fallbackVol,
          }
        })
        saveLocalAndState(fetchedItems)
      }
    } catch (err: any) {
      console.warn('Failed to sync price master with Supabase:', err)
      setError(err.message || '単価マスタの取得に失敗しました')
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }, [])

  const addItem = useCallback(async (itemData: Omit<ItemPriceMaster, 'id'>): Promise<boolean> => {
    setIsSyncing(true)
    setError(null)
    const normUnit = normalizeUnitValue(itemData.unit)
    const resolvedVolume =
      itemData.volume !== undefined ? itemData.volume : normUnit === 'kg' ? 0 : 0.4
    const newItem: ItemPriceMaster = {
      id: crypto.randomUUID(),
      ...itemData,
      unit: normUnit,
      volume: resolvedVolume,
    }

    const previousItems = items
    const nextOrder = items.length
    const updated = [...items, newItem]
    saveLocalAndState(updated)

    try {
      const { error: insertErr } = await supabase
        .from('price_master')
        .insert([{
          id: newItem.id,
          category: newItem.category,
          name: newItem.name,
          unit: newItem.unit,
          price: newItem.price,
          volume: resolvedVolume,
          sort_order: nextOrder,
        }])

      if (insertErr) {
        saveLocalAndState(previousItems)
        setError(`単価追加に失敗しました: ${insertErr.message}`)
        return false
      }
      return true
    } catch (err: any) {
      saveLocalAndState(previousItems)
      setError(err.message || '単価追加に失敗しました')
      return false
    } finally {
      setIsSyncing(false)
    }
  }, [items])

  const updateItemPrice = useCallback(async (id: string, newPrice: number): Promise<boolean> => {
    setIsSyncing(true)
    setError(null)
    const targetIndex = items.findIndex((item) => item.id === id)
    if (targetIndex === -1) {
      setIsSyncing(false)
      return false
    }

    const previousItems = items
    const updatedTarget: ItemPriceMaster = { ...items[targetIndex], price: newPrice }
    const updated = items.map((item) => (item.id === id ? updatedTarget : item))
    saveLocalAndState(updated)

    try {
      const { error: updateErr } = await supabase
        .from('price_master')
        .upsert([{
          id: updatedTarget.id,
          category: updatedTarget.category,
          name: updatedTarget.name,
          unit: updatedTarget.unit,
          price: updatedTarget.price,
          volume: updatedTarget.volume ?? 0,
          sort_order: targetIndex,
          updated_at: new Date().toISOString(),
        }])

      if (updateErr) {
        saveLocalAndState(previousItems)
        setError(`単価更新に失敗しました: ${updateErr.message}`)
        return false
      }
      return true
    } catch (err: any) {
      saveLocalAndState(previousItems)
      setError(err.message || '単価更新に失敗しました')
      return false
    } finally {
      setIsSyncing(false)
    }
  }, [items])

  const deleteItem = useCallback(async (id: string): Promise<boolean> => {
    setIsSyncing(true)
    setError(null)
    const previousItems = items
    const updated = items.filter((item) => item.id !== id)
    saveLocalAndState(updated)

    try {
      const { error: deleteErr } = await supabase
        .from('price_master')
        .delete()
        .eq('id', id)

      if (deleteErr) {
        saveLocalAndState(previousItems)
        setError(`品目削除に失敗しました: ${deleteErr.message}`)
        return false
      }
      return true
    } catch (err: any) {
      saveLocalAndState(previousItems)
      setError(err.message || '品目削除に失敗しました')
      return false
    } finally {
      setIsSyncing(false)
    }
  }, [items])

  const moveItemUp = useCallback(async (index: number): Promise<boolean> => {
    if (index <= 0 || index >= items.length) return false
    const previousItems = items
    const newItems = [...items]
    const temp = newItems[index - 1]
    newItems[index - 1] = newItems[index]
    newItems[index] = temp
    saveLocalAndState(newItems)

    try {
      const targetA = newItems[index - 1]
      const targetB = newItems[index]
      const { error: upsertErr } = await supabase.from('price_master').upsert([
        {
          id: targetA.id,
          category: targetA.category,
          name: targetA.name,
          unit: targetA.unit,
          price: targetA.price,
          volume: targetA.volume ?? 0,
          sort_order: index - 1,
          updated_at: new Date().toISOString(),
        },
        {
          id: targetB.id,
          category: targetB.category,
          name: targetB.name,
          unit: targetB.unit,
          price: targetB.price,
          volume: targetB.volume ?? 0,
          sort_order: index,
          updated_at: new Date().toISOString(),
        },
      ])
      if (upsertErr) {
        saveLocalAndState(previousItems)
        setError(`並び替えの保存に失敗しました: ${upsertErr.message}`)
        return false
      }
      return true
    } catch (err: any) {
      saveLocalAndState(previousItems)
      setError(err.message || '並び替えの保存に失敗しました')
      return false
    }
  }, [items])

  const moveItemDown = useCallback(async (index: number): Promise<boolean> => {
    if (index < 0 || index >= items.length - 1) return false
    const previousItems = items
    const newItems = [...items]
    const temp = newItems[index + 1]
    newItems[index + 1] = newItems[index]
    newItems[index] = temp
    saveLocalAndState(newItems)

    try {
      const targetA = newItems[index]
      const targetB = newItems[index + 1]
      const { error: upsertErr } = await supabase.from('price_master').upsert([
        {
          id: targetA.id,
          category: targetA.category,
          name: targetA.name,
          unit: targetA.unit,
          price: targetA.price,
          volume: targetA.volume ?? 0,
          sort_order: index,
          updated_at: new Date().toISOString(),
        },
        {
          id: targetB.id,
          category: targetB.category,
          name: targetB.name,
          unit: targetB.unit,
          price: targetB.price,
          volume: targetB.volume ?? 0,
          sort_order: index + 1,
          updated_at: new Date().toISOString(),
        },
      ])
      if (upsertErr) {
        saveLocalAndState(previousItems)
        setError(`並び替えの保存に失敗しました: ${upsertErr.message}`)
        return false
      }
      return true
    } catch (err: any) {
      saveLocalAndState(previousItems)
      setError(err.message || '並び替えの保存に失敗しました')
      return false
    }
  }, [items])

  const resetToDefaults = useCallback(async (): Promise<boolean> => {
    setIsSyncing(true)
    setError(null)
    const previousItems = items
    saveLocalAndState(DEFAULT_ITEMS)
    try {
      const { error: delErr } = await supabase.from('price_master').delete().neq('id', '')
      if (delErr) throw new Error(delErr.message)

      const { error: insErr } = await supabase.from('price_master').insert(
        DEFAULT_ITEMS.map((item, idx) => ({
          id: item.id,
          category: item.category,
          name: item.name,
          unit: item.unit,
          price: item.price,
          volume: item.volume ?? 0,
          sort_order: idx,
        }))
      )
      if (insErr) throw new Error(insErr.message)
      return true
    } catch (err: any) {
      saveLocalAndState(previousItems)
      setError(err.message || '初期マスタの復元に失敗しました')
      return false
    } finally {
      setIsSyncing(false)
    }
  }, [items])

  const syncAllItemsToCloud = useCallback(async (): Promise<{ success: boolean; count: number; message: string }> => {
    setIsSyncing(true)
    setError(null)
    try {
      if (items.length === 0) {
        return { success: false, count: 0, message: '同期対象の品目データがありません。' }
      }

      // 現在画面に表示・保持されている全品目を price_master テーブルへ一括 upsert
      const payload = items.map((item, idx) => ({
        id: item.id,
        category: item.category,
        name: item.name,
        unit: item.unit,
        price: item.price,
        volume: item.volume ?? 0,
        sort_order: idx,
        updated_at: new Date().toISOString(),
      }))

      const { error: upsertErr } = await supabase
        .from('price_master')
        .upsert(payload)

      if (upsertErr) {
        throw new Error(upsertErr.message)
      }

      return {
        success: true,
        count: items.length,
        message: `現在ローカルにある全${items.length}件の単価品目をクラウド（Supabase）へ同期しました！Netlify本番環境および全端末に反映されます。`,
      }
    } catch (err: any) {
      console.error('Failed to sync all price items to cloud:', err)
      setError(err.message || 'クラウド同期に失敗しました')
      return {
        success: false,
        count: 0,
        message: `クラウド同期エラー: ${err.message || 'Supabaseへの保存に失敗しました'}`,
      }
    } finally {
      setIsSyncing(false)
    }
  }, [items])

  useEffect(() => {
    fetchPriceMaster(true)
  }, [fetchPriceMaster])

  return {
    items,
    isLoading,
    isSyncing,
    error,
    addItem,
    updateItemPrice,
    deleteItem,
    moveItemUp,
    moveItemDown,
    resetToDefaults,
    syncAllItemsToCloud,
    refetch: () => fetchPriceMaster(true),
  }
}

