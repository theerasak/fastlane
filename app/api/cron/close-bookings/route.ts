import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase/server'
import { CRON_CLOSE_DAYS } from '@/lib/constants'

export async function POST(req: NextRequest) {
  // Verify cron secret
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getServerClient()
  const cutoff = new Date(Date.now() - CRON_CLOSE_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('bookings')
    .update({ status: 'CLOSED', closed_at: new Date().toISOString() })
    .eq('status', 'BOOKED')
    .lt('booked_at', cutoff)
    .select('id, booking_number')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ closed: data?.length ?? 0, bookings: data })
}
