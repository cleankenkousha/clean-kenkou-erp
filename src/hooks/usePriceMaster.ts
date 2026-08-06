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
  { id: '10', category: 'その他', name: '可燃物・不用品袋', unit: '袋', price: 500, volume: 0.1 },
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
  refetch: () => Promise<void>
}


export const usePriceMaster = (): UsePriceMasterReturn => {
  const [items, setItems] = useState<ItemPriceMaster[]>(() => {
    const saved = localStorage.getItem('clean_kenkou_price_master')
    return saved ? JSON.parse(saved) : DEFAULT_ITEMS
  })
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isSyncing, setIsSyncing] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const saveLocalAndState = (newItems: ItemPriceMaster[]) => {
    setItems(newItems)
    localStorage.setItem('clean_kenkou_price_master', JSON.stringify(newItems))
  }

  const fetchPriceMaster = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true)
    setError(null)
    try {
      const { data, error: fetchErr } = await supabase
        .from('price_master')
        .select('*')
        .order('id', { ascending: true })

      if (fetchErr) {
        console.warn('Price master table sync notice (using local fallback if unavailable):', fetchErr.message)
      } else if (data && data.length > 0) {
        const fetchedItems: ItemPriceMaster[] = data.map((d: any) => ({
          id: String(d.id),
          category: d.category || '',
          name: d.name || '',
          unit: d.unit || 'kg',
          price: Number(d.price) || 0,
        }))
        saveLocalAndState(fetchedItems)
      }
    } catch (err: any) {
      console.warn('Failed to sync price master with Supabase:', err)
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }, [])

  const addItem = useCallback(async (itemData: Omit<ItemPriceMaster, 'id'>): Promise<boolean> => {
    setIsSyncing(true)
    const newItem: ItemPriceMaster = {
      id: crypto.randomUUID(),
      ...itemData,
    }
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
        }])

      if (insertErr) {
        console.warn('Cloud insert for price_master encountered notice:', insertErr.message)
      }
      return true
    } catch (err: any) {
      console.warn('Failed to add item to cloud:', err)
      return true
    } finally {
      setIsSyncing(false)
    }
  }, [items])

  const updateItemPrice = useCallback(async (id: string, newPrice: number): Promise<boolean> => {
    setIsSyncing(true)
    const updated = items.map((item) => (item.id === id ? { ...item, price: newPrice } : item))
    saveLocalAndState(updated)

    try {
      const targetItem = updated.find((item) => item.id === id)
      if (targetItem) {
        const { error: updateErr } = await supabase
          .from('price_master')
          .upsert([{
            id: targetItem.id,
            category: targetItem.category,
            name: targetItem.name,
            unit: targetItem.unit,
            price: targetItem.price,
            updated_at: new Date().toISOString(),
          }])

        if (updateErr) {
          console.warn('Cloud update for price_master encountered notice:', updateErr.message)
        }
      }
      return true
    } catch (err: any) {
      console.warn('Failed to update price in cloud:', err)
      return true
    } finally {
      setIsSyncing(false)
    }
  }, [items])

  const deleteItem = useCallback(async (id: string): Promise<boolean> => {
    setIsSyncing(true)
    const updated = items.filter((item) => item.id !== id)
    saveLocalAndState(updated)

    try {
      const { error: deleteErr } = await supabase
        .from('price_master')
        .delete()
        .eq('id', id)

      if (deleteErr) {
        console.warn('Cloud delete for price_master encountered notice:', deleteErr.message)
      }
      return true
    } catch (err: any) {
      console.warn('Failed to delete item in cloud:', err)
      return true
    } finally {
      setIsSyncing(false)
    }
  }, [items])

  const moveItemUp = useCallback(async (index: number): Promise<boolean> => {
    if (index <= 0 || index >= items.length) return false
    const newItems = [...items]
    const temp = newItems[index - 1]
    newItems[index - 1] = newItems[index]
    newItems[index] = temp
    saveLocalAndState(newItems)
    return true
  }, [items])

  const moveItemDown = useCallback(async (index: number): Promise<boolean> => {
    if (index < 0 || index >= items.length - 1) return false
    const newItems = [...items]
    const temp = newItems[index + 1]
    newItems[index + 1] = newItems[index]
    newItems[index] = temp
    saveLocalAndState(newItems)
    return true
  }, [items])

  const resetToDefaults = useCallback(async (): Promise<boolean> => {
    setIsSyncing(true)
    saveLocalAndState(DEFAULT_ITEMS)
    try {
      await supabase.from('price_master').delete().neq('id', '0')
      await supabase.from('price_master').insert(
        DEFAULT_ITEMS.map((item) => ({
          id: item.id,
          category: item.category,
          name: item.name,
          unit: item.unit,
          price: item.price,
        }))
      )
      return true
    } catch (err: any) {
      console.warn('Failed to reset price master on cloud:', err)
      return true
    } finally {
      setIsSyncing(false)
    }
  }, [])

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
    refetch: () => fetchPriceMaster(true),
  }
}

