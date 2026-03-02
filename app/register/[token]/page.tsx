import { notFound } from 'next/navigation'
import { getServerClient } from '@/lib/supabase/server'
import { RegistrationForm } from '@/components/register/RegistrationForm'
import { ToastContainer } from '@/components/ui/Toast'
import { StatusBadge } from '@/components/ui/Badge'
import type { BookingPublicInfo } from '@/types/api'

interface Props {
  params: Promise<{ token: string }>
}

async function getBookingInfo(token: string): Promise<BookingPublicInfo | null> {
  const supabase = getServerClient()

  const { data: booking, error } = await supabase
    .from('bookings')
    .select(`
      id, booking_number, num_trucks, status, token_cancelled,
      port_terminals(name)
    `)
    .eq('fastlane_token', token)
    .single()

  if (error || !booking) return null

  const { data: registrations } = await supabase
    .from('fastlane_registrations')
    .select('id, booking_id, hour_slot, terminal_id, license_plate, is_deleted, registered_at, deleted_at')
    .eq('booking_id', booking.id)
    .eq('is_deleted', false)
    .order('registered_at')

  return {
    id: booking.id,
    booking_number: booking.booking_number,
    num_trucks: booking.num_trucks,
    terminal_name: (booking.port_terminals as unknown as { name: string } | null)?.name ?? 'Unknown',
    status: booking.status,
    token_cancelled: booking.token_cancelled,
    registrations: registrations ?? [],
    active_count: (registrations ?? []).length,
  }
}

export default async function RegisterPage({ params }: Props) {
  const { token } = await params
  const booking = await getBookingInfo(token)

  if (!booking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid Token</h1>
          <p className="text-gray-500 text-sm">This registration link is invalid or does not exist.</p>
        </div>
        <ToastContainer />
      </div>
    )
  }

  if (booking.token_cancelled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link Cancelled</h1>
          <p className="text-gray-500 text-sm">
            This fastlane registration link has been cancelled. Please contact the booking agent for a new link.
          </p>
        </div>
        <ToastContainer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Fastlane Registration</h1>
          <p className="text-gray-500 text-sm mt-1">{booking.terminal_name}</p>
        </div>

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
              <p className="text-xs text-gray-500 uppercase tracking-wide">Trucks Allocated</p>
              <p className="font-medium">{booking.num_trucks}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Registered</p>
              <p className="font-medium">{booking.active_count} / {booking.num_trucks}</p>
            </div>
          </div>
        </div>

        <RegistrationForm token={token} initialData={booking} />
      </div>
      <ToastContainer />
    </div>
  )
}
