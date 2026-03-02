'use client'

import { useState, useEffect, useCallback } from 'react'
import type { BookingResponse } from '@/types/api'

export function useBookings(filter?: string) {
  const [bookings, setBookings] = useState<BookingResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const url = new URL('/api/bookings', window.location.origin)
      if (filter) url.searchParams.set('booking_number', filter)
      const res = await fetch(url.toString())
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setBookings(json.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load bookings')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { fetch_() }, [fetch_])

  return { bookings, loading, error, refetch: fetch_ }
}
