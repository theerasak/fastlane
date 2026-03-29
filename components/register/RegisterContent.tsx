'use client'

import { useState } from 'react'
import { RegistrationForm } from './RegistrationForm'
import { StatusBadge } from '@/components/ui/Badge'
import type { BookingPublicInfo } from '@/types/api'

interface RegisterContentProps {
  token: string
  booking: BookingPublicInfo
}

export function RegisterContent({ token, booking }: RegisterContentProps) {
  const [activeCount, setActiveCount] = useState(booking.active_count)

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
      </div>

      <RegistrationForm token={token} initialData={booking} onActiveCountChange={setActiveCount} />
    </>
  )
}
