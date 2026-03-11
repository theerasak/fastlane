import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase/server'
import { handleApiError, ApiError } from '@/lib/api/errors'

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const supabase = getServerClient()

    // Find booking by token
    const { data: booking, error } = await supabase
      .from('bookings')
      .select(`
        id, booking_number, num_trucks, status, token_cancelled, terminal_id, created_at,
        port_terminals(name)
      `)
      .eq('fastlane_token', token)
      .single()

    if (error || !booking) throw ApiError.notFound('Invalid or expired token')

    const bookingDate = booking.created_at.split('T')[0]

    // Get active registrations and slot availability in parallel
    const [{ data: registrations }, { data: slots }] = await Promise.all([
      supabase
        .from('fastlane_registrations')
        .select('id, booking_id, hour_slot, terminal_id, license_plate, is_deleted, registered_at, deleted_at')
        .eq('booking_id', booking.id)
        .eq('is_deleted', false)
        .order('registered_at'),
      supabase
        .from('slot_remaining_capacity')
        .select('hour_slot, remaining_capacity')
        .eq('terminal_id', booking.terminal_id)
        .eq('date', bookingDate)
        .order('hour_slot'),
    ])

    const active_count = (registrations ?? []).length

    return NextResponse.json({
      data: {
        id: booking.id,
        booking_number: booking.booking_number,
        num_trucks: booking.num_trucks,
        terminal_name: (booking.port_terminals as unknown as { name: string } | null)?.name ?? 'Unknown',
        terminal_id: booking.terminal_id,
        booking_date: bookingDate,
        status: booking.status,
        token_cancelled: booking.token_cancelled,
        registrations: registrations ?? [],
        active_count,
        slot_availability: slots ?? [],
      }
    })
  } catch (err) {
    const { error, code, status } = handleApiError(err)
    return NextResponse.json({ error, code }, { status })
  }
}
