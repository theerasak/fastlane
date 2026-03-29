import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getTcSessionFromCookies } from '@/lib/auth/tc-session'
import { getServerClient } from '@/lib/supabase/server'

interface Booking {
  id: string
  booking_number: string
  booking_date: string
  status: string
  fastlane_token: string
  num_trucks: number
  is_privileged_booking: boolean
  port_terminals: { name: string } | null
}

export default async function TcDashboardPage() {
  const session = await getTcSessionFromCookies()
  if (!session) {
    redirect('/register/login')
  }

  const supabase = getServerClient()
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, booking_number, booking_date, status, fastlane_token, num_trucks, is_privileged_booking, port_terminals(name)')
    .eq('truck_company_id', session.truck_company_id)
    .eq('token_cancelled', false)
    .not('fastlane_token', 'is', null)
    .order('booking_date', { ascending: false }) as { data: Booking[] | null }

  const list = bookings ?? []

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Bookings</h1>
            <p className="text-sm text-gray-500 mt-1">{session.name}</p>
          </div>
          <form action="/api/register/auth/logout" method="POST">
            <button
              type="submit"
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Sign out
            </button>
          </form>
        </div>

        {list.length === 0 ? (
          <div className="card text-center py-12 text-gray-500">
            No active bookings assigned to your company.
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((booking) => (
              <Link
                key={booking.id}
                href={`/register/${booking.fastlane_token}`}
                className="card block hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{booking.booking_number}</p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {booking.port_terminals?.name ?? '—'} &middot; {booking.booking_date}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block text-xs font-medium px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                      {booking.status}
                    </span>
                    <p className="text-xs text-gray-400 mt-1">{booking.num_trucks} truck{booking.num_trucks !== 1 ? 's' : ''}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
