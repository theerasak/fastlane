import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase/server'
import { handleApiError, ApiError } from '@/lib/api/errors'
import { getTcSession } from '@/lib/auth/tc-session'

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const tcSession = await getTcSession(req)
    if (!tcSession) throw ApiError.unauthorized()

    const { token } = await params
    const supabase = getServerClient()

    // Find booking by token
    const { data: booking, error } = await supabase
      .from('bookings')
      .select(`
        id, booking_number, num_trucks, status, token_cancelled, terminal_id, booking_date,
        is_privileged_booking, truck_company_id, port_terminals(name)
      `)
      .eq('fastlane_token', token)
      .single()

    if (error || !booking) throw ApiError.notFound('Invalid or expired token')

    if (booking.truck_company_id !== tcSession.truck_company_id) throw ApiError.forbidden()

    const bookingDate = (booking as unknown as { booking_date: string }).booking_date

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
        .select('hour_slot, remaining_capacity_privileged, remaining_capacity_non_privileged')
        .eq('terminal_id', booking.terminal_id)
        .eq('date', bookingDate)
        .order('hour_slot'),
    ])

    const active_count = (registrations ?? []).length

    // Show remaining capacity from the correct pool based on booking privilege
    const isPrivileged = (booking as unknown as { is_privileged_booking: boolean }).is_privileged_booking
    const slot_availability = (slots ?? []).map((s: { hour_slot: number; remaining_capacity_privileged: number; remaining_capacity_non_privileged: number }) => ({
      hour_slot: s.hour_slot,
      remaining_capacity: isPrivileged ? s.remaining_capacity_privileged : s.remaining_capacity_non_privileged,
    }))

    return NextResponse.json({
      data: {
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
        active_count,
        slot_availability,
      }
    })
  } catch (err) {
    const { error, code, status } = handleApiError(err)
    return NextResponse.json({ error, code }, { status })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const tcSession = await getTcSession(req)
    if (!tcSession) throw ApiError.unauthorized()

    const { token } = await params
    const supabase = getServerClient()

    const { data: booking } = await supabase
      .from('bookings')
      .select('id, truck_company_id, status, token_cancelled')
      .eq('fastlane_token', token)
      .single()

    if (!booking) throw ApiError.notFound('Invalid token')
    if (booking.token_cancelled) throw ApiError.forbidden('This link has been cancelled')
    if (booking.truck_company_id !== tcSession.truck_company_id) throw ApiError.forbidden()

    const body = await req.json()
    const { booking_date } = body
    if (!booking_date || !/^\d{4}-\d{2}-\d{2}$/.test(booking_date)) {
      throw ApiError.badRequest('Invalid booking_date format')
    }

    // booking_date must be today or future
    const today = new Date().toISOString().split('T')[0]
    if (booking_date < today) throw ApiError.badRequest('Booking date cannot be in the past')

    const { data, error } = await supabase
      .from('bookings')
      .update({ booking_date })
      .eq('id', booking.id)
      .select('id, booking_date')
      .single()

    if (error || !data) throw ApiError.internal('Failed to update booking date')

    return NextResponse.json({ data })
  } catch (err) {
    const { error, code, status } = handleApiError(err)
    return NextResponse.json({ error, code }, { status })
  }
}
