'use client'

import { useState, useEffect, useCallback } from 'react'
import type { CapacitySlotResponse } from '@/types/api'

export function useCapacitySlots(terminalId: string, date: string) {
  const [slots, setSlots] = useState<CapacitySlotResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSlots = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/capacity/${terminalId}/${date}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setSlots(json.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load slots')
    } finally {
      setLoading(false)
    }
  }, [terminalId, date])

  useEffect(() => { fetchSlots() }, [fetchSlots])

  function updateSlotOptimistic(hourSlot: number, capacity: number, lastUpdatedAt: string) {
    setSlots(prev => prev.map(s =>
      s.hour_slot === hourSlot ? { ...s, capacity, last_updated_at: lastUpdatedAt } : s
    ))
  }

  return { slots, loading, error, refetch: fetchSlots, updateSlotOptimistic }
}
