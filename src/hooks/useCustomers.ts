import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Customer } from '../types'

export interface CustomerWithJobCount extends Customer {
  job_count?: number
}

export interface UseCustomersReturn {
  customers: CustomerWithJobCount[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  addCustomer: (customerData: { name: string; phone?: string; address?: string }) => Promise<Customer | null>
  updateCustomer: (customerId: string, updates: Partial<Customer>) => Promise<boolean>
  deleteCustomer: (customerId: string) => Promise<boolean>
}

export const useCustomers = (): UseCustomersReturn => {
  const [customers, setCustomers] = useState<CustomerWithJobCount[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCustomers = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true)
    setError(null)
    try {
      // deleted_at が null の顧客を全て取得
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      if (customerError) {
        throw new Error(customerError.message)
      }

      // 各顧客の案件数を取得
      const { data: jobCounts, error: jobCountError } = await supabase
        .from('jobs')
        .select('customer_id')

      if (jobCountError) {
        console.warn('Failed to fetch job counts:', jobCountError.message)
      }

      const countMap: Record<string, number> = {}
      if (jobCounts) {
        jobCounts.forEach((j) => {
          if (j.customer_id) {
            countMap[j.customer_id] = (countMap[j.customer_id] || 0) + 1
          }
        })
      }

      const enrichedCustomers: CustomerWithJobCount[] = (customerData || []).map((c) => ({
        ...c,
        job_count: countMap[c.id] || 0,
      }))

      setCustomers(enrichedCustomers)
    } catch (err: any) {
      console.error('Failed to fetch customers:', err)
      setError(err.message || '顧客データの取得に失敗しました')
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }, [])

  const addCustomer = useCallback(
    async (customerData: { name: string; phone?: string; address?: string }): Promise<Customer | null> => {
      try {
        const { data, error: insertError } = await supabase
          .from('customers')
          .insert([
            {
              name: customerData.name.trim(),
              phone: customerData.phone?.trim() || null,
              address: customerData.address?.trim() || null,
            },
          ])
          .select()
          .single()

        if (insertError) {
          throw new Error(insertError.message)
        }

        const newCustomer: CustomerWithJobCount = {
          ...(data as Customer),
          job_count: 0,
        }

        setCustomers((prev) => [newCustomer, ...prev.filter((c) => c.id !== newCustomer.id)])
        return newCustomer
      } catch (err: any) {
        console.error('Failed to add customer:', err)
        setError(err.message || '顧客の追加に失敗しました')
        return null
      }
    },
    []
  )

  const updateCustomer = useCallback(
    async (customerId: string, updates: Partial<Customer>): Promise<boolean> => {
      try {
        const allowedKeys = ['name', 'phone', 'address']
        const cleanUpdates: Record<string, any> = {}

        for (const key of Object.keys(updates)) {
          if (allowedKeys.includes(key)) {
            const val = (updates as any)[key]
            cleanUpdates[key] = typeof val === 'string' ? val.trim() || null : val
          }
        }

        const { error: updateError } = await supabase
          .from('customers')
          .update(cleanUpdates)
          .eq('id', customerId)

        if (updateError) {
          throw new Error(updateError.message)
        }

        setCustomers((prev) =>
          prev.map((c) => (c.id === customerId ? { ...c, ...cleanUpdates } : c))
        )
        return true
      } catch (err: any) {
        console.error('Failed to update customer:', err)
        setError(err.message || '顧客情報の更新に失敗しました')
        return false
      }
    },
    []
  )

  const deleteCustomer = useCallback(
    async (customerId: string): Promise<boolean> => {
      try {
        // 論理削除 (deleted_at にタイムスタンプをセット)
        const { error: deleteError } = await supabase
          .from('customers')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', customerId)

        if (deleteError) {
          throw new Error(deleteError.message)
        }

        setCustomers((prev) => prev.filter((c) => c.id !== customerId))
        return true
      } catch (err: any) {
        console.error('Failed to delete customer:', err)
        setError(err.message || '顧客の削除に失敗しました')
        return false
      }
    },
    []
  )

  useEffect(() => {
    fetchCustomers(true)
  }, [fetchCustomers])

  return {
    customers,
    isLoading,
    error,
    refetch: () => fetchCustomers(true),
    addCustomer,
    updateCustomer,
    deleteCustomer,
  }
}
