'use client'

import { useState } from 'react'
import { RegistrationForm } from './RegistrationForm'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { showToast } from '@/components/ui/Toast'
import type { BookingPublicInfo } from '@/types/api'

interface RegisterContentProps {
  token: string
  booking: BookingPublicInfo
}

export function RegisterContent({ token, booking }: RegisterContentProps) {
  const [activeCount, setActiveCount] = useState(booking.active_count)
  const [sending, setSending] = useState(false)

  const isFull = activeCount >= booking.num_trucks

  async function handleSendDocuments() {
    setSending(true)
    try {
      const res = await fetch(`/api/register/${token}/send-documents`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { showToast(json.error || 'Failed to send documents', 'error'); return }
      showToast(`Documents sent to ${json.sent_to}`, 'success')
    } catch {
      showToast('Network error', 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <div className="card mb-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Booking</p>
            <p className="font-medium font-mono">{booking.booking_number}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Status</p>
            <StatusBadge status={booking.status} />
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Date</p>
            <p className="font-medium">{new Date(booking.booking_date + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Trucks Allocated</p>
            <p className="font-medium">{booking.num_trucks}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Registered</p>
            <p className="font-medium" data-testid="registered-count">{activeCount} / {booking.num_trucks}</p>
          </div>
          {booking.is_privileged_booking && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Payment</p>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                Paid by Agent
              </span>
            </div>
          )}
        </div>

        {isFull && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <Button
              onClick={handleSendDocuments}
              loading={sending}
              className="w-full"
              data-testid="send-documents-btn"
            >
              Email Fastlane Documents
            </Button>
            <p className="text-xs text-gray-400 text-center mt-2">
              Sends one PDF entry pass per truck to your company email.
            </p>
          </div>
        )}
      </div>

      <RegistrationForm token={token} initialData={booking} onActiveCountChange={setActiveCount} />
    </>
  )
}
