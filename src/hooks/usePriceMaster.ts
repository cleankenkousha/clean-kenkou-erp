import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface ItemPriceMaster {
  id: string
  category: string
  name: string
  unit: string
  price: number
}

export const DEFAULT_ITEMS: ItemPriceMaster[] = [
  { id: '1', category: '組合搬入分', name: '金物・危険物', unit: 'kg', price: 50 },
  { id: '2', category: '組合搬入分', name: '不燃粗大', unit: 'kg', price: 60 },
  { id: '3', category: '組合搬入分', name: 'びん類', unit: 'kg', price: 40 },
  { id: '4', category: '４家電', name: '冷蔵庫（170L以下）', unit: '台', price: 4000 },
  { id: '5', category: '４家電', name: '洗濯機・衣類乾燥機', unit: '台', price: 3000 },
  { id: '6', category: '４家電', name: 'エアコン', unit: '台', price: 2500 },
  { id: '7', category: 'その他自社処理', name: '可燃物', unit: 'kg', price: 45 },
  { id: '8', category: 'その他自社処理', name: '可燃粗大（木製家具等）', unit: 'kg', price: 55 },
  { id: '9', category: 'その他自社処理', name: '混合廃棄物', unit: 'kg', price: 70 },
  { id: '10', category: 'その他自社処理', name: '搬出基本料（2F以上/特殊環境）', unit: '㎥', price: 1500 },
]

export interface UsePriceMasterReturn {
  items: ItemPriceMaster[]
  isLoading: boolean
  isSyncing: boolean
  error: string | null
  addItem: (item: Omit<ItemPriceMaster, 'id'>) => Promise<boolean>
  updateItemPrice: (id: string, newPrice: number) => Promise<boolean>
  deleteItem: (id: string) => Promise<boolean>
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
    resetToDefaults,
    refetch: () => fetchPriceMaster(true),
  }
}
