import { notFound, redirect } from 'next/navigation'
import { getServerClient } from '@/lib/supabase/server'
import { getTcSessionFromCookies } from '@/lib/auth/tc-session'
import { RegistrationForm } from '@/components/register/RegistrationForm'
import { ToastContainer } from '@/components/ui/Toast'
import { StatusBadge } from '@/components/ui/Badge'
import { DEFAULT_SLOT_CAPACITY_PRIVILEGED, DEFAULT_SLOT_CAPACITY_NON_PRIVILEGED } from '@/lib/constants'
import type { BookingPublicInfo } from '@/types/api'

async function ensureCapacityExists(terminalId: string, date: string) {
  const supabase = getServerClient()
  const { data: existing } = await supabase
    .from('terminal_capacity')
    .select('id')
    .eq('terminal_id', terminalId)
    .eq('date', date)
    .limit(1)
  if (existing && existing.length > 0) return
  const rows = Array.from({ length: 24 }, (_, i) => ({
    terminal_id: terminalId,
    date,
    hour_slot: i,
    capacity_privileged: DEFAULT_SLOT_CAPACITY_PRIVILEGED,
    capacity_non_privileged: DEFAULT_SLOT_CAPACITY_NON_PRIVILEGED,
  }))
  await supabase.from('terminal_capacity').insert(rows)
}

interface Props {
  params: Promise<{ token: string }>
}

async function getBookingInfo(token: string): Promise<BookingPublicInfo | null> {
  const tcSession = await getTcSessionFromCookies()
  if (!tcSession) {
    redirect(`/register/login?next=/register/${token}`)
  }

  const supabase = getServerClient()

  const { data: booking, error } = await supabase
    .from('bookings')
    .select(`
      id, booking_number, num_trucks, status, token_cancelled, terminal_id, booking_date,
      is_privileged_booking, truck_company_id, port_terminals(name)
    `)
    .eq('fastlane_token', token)
    .single()

  if (error || !booking) return null

  if (booking.truck_company_id !== tcSession.truck_company_id) return null

  const bookingDate = (booking as unknown as { booking_date: string }).booking_date

  const [{ data: registrations }, { data: slots }] = await Promise.all([
    supabase
      .from('fastlane_registrations')
      .select('id, booking_id, hour_slot, terminal_id, license_plate, container_number, is_deleted, registered_at, deleted_at')
      .eq('booking_id', booking.id)
      .eq('is_deleted', false)
      .order('registered_at'),
    supabase
      .from('slot_remaining_capacity')
      .select('hour_slot, remaining_capacity_privileged, remaining_capacity_non_privileged')
      .eq('terminal_id', booking.terminal_id)
      .eq('date', bookingDate)
      .order('hour_slot'),
  ])

  // Show remaining capacity from the correct pool based on booking privilege
  const isPrivileged = (booking as unknown as { is_privileged_booking: boolean }).is_privileged_booking
  const slot_availability = (slots ?? []).map((s: { hour_slot: number; remaining_capacity_privileged: number; remaining_capacity_non_privileged: number }) => ({
    hour_slot: s.hour_slot,
    remaining_capacity: isPrivileged ? s.remaining_capacity_privileged : s.remaining_capacity_non_privileged,
  }))

  return {
    id: booking.id,
    booking_number: booking.booking_number,
    num_trucks: booking.num_trucks,
    terminal_name: (booking.port_terminals as unknown as { name: string } | null)?.name ?? 'Unknown',
    terminal_id: booking.terminal_id,
    booking_date: bookingDate,
    is_privileged_booking: isPrivileged,
    status: booking.status,
    token_cancelled: booking.token_cancelled,
    registrations: registrations ?? [],
    active_count: (registrations ?? []).length,
    slot_availability,
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
              <p className="text-xs text-gray-500 uppercase tracking-wide">Date</p>
              <p className="font-medium">{new Date(booking.booking_date + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Trucks Allocated</p>
              <p className="font-medium">{booking.num_trucks}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Registered</p>
              <p className="font-medium">{booking.active_count} / {booking.num_trucks}</p>
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

        <RegistrationForm token={token} initialData={booking} />
      </div>
      <ToastContainer />
    </div>
  )
}
