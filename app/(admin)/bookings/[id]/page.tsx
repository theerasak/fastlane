'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { StatusBadge } from '@/components/ui/Badge'
import { PageSpinner } from '@/components/ui/Spinner'
import { showToast } from '@/components/ui/Toast'
import { FastlaneUrlCard } from '@/components/bookings/FastlaneUrlCard'
import type { BookingResponse } from '@/types/api'

export default function BookingDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const router = useRouter()
  const [booking, setBooking] = useState<BookingResponse | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchBooking() {
    try {
      const res = await fetch(`/api/bookings/${id}`)
      const json = await res.json()
      if (!res.ok) { showToast(json.error || 'Failed to load', 'error'); return }
      setBooking(json.data)
    } catch { showToast('Network error', 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchBooking() }, [id])

  if (loading) return <PageSpinner />
  if (!booking) return <div className="text-gray-500">Booking not found.</div>

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">← Back</button>
        <h1 className="text-xl font-bold text-gray-900">Booking {booking.booking_number}</h1>
        <StatusBadge status={booking.status} />
      </div>

      <div className="card grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Terminal</p>
          <p className="font-medium">{booking.terminal_name || booking.terminal_id}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Truck Company</p>
          <p className="font-medium">{booking.truck_company_name || booking.truck_company_id}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Trucks Allocated</p>
          <p className="font-medium">{booking.num_trucks}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Registered</p>
          <p className="font-medium">{booking.active_count ?? 0} / {booking.num_trucks}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Created</p>
          <p className="font-medium">{new Date(booking.created_at).toLocaleString()}</p>
        </div>
        {booking.booked_at && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Booked At</p>
            <p className="font-medium">{new Date(booking.booked_at).toLocaleString()}</p>
          </div>
        )}
      </div>

      <FastlaneUrlCard
        token={booking.fastlane_token}
        tokenCancelled={booking.token_cancelled}
        bookingId={booking.id}
        onTokenGenerated={(token) => setBooking(prev => prev ? { ...prev, fastlane_token: token, token_cancelled: false } : prev)}
        onCancelled={() => setBooking(prev => prev ? { ...prev, token_cancelled: true } : prev)}
      />
    </div>
  )
}
