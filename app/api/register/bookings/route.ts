import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase/server'
import { getTcSession } from '@/lib/auth/tc-session'

export async function GET(req: NextRequest) {
  try {
    const session = await getTcSession(req)
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = getServerClient()
    const { data, error } = await supabase
      .from('bookings')
      .select('id, booking_number, booking_date, status, fastlane_token, num_trucks, is_privileged_booking, port_terminals(name)')
      .eq('truck_company_id', session.truck_company_id)
      .eq('token_cancelled', false)
      .not('fastlane_token', 'is', null)
      .order('booking_date', { ascending: false })

    if (error) throw error

    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('GET /api/register/bookings error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
