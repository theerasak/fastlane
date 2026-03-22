import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { handleApiError, ApiError } from '@/lib/api/errors'

const SELECT_FIELDS = 'id, booking_id, hour_slot, terminal_id, license_plate, is_deleted, registered_at, deleted_at'

const AddRegSchema = z.object({
  license_plate: z.string().min(1).max(20),
  hour_slot: z.number().int().min(0).max(23),
})

const EditRegSchema = z.object({
  license_plate: z.string().min(1).max(20).optional(),
  hour_slot: z.number().int().min(0).max(23).optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(req)
    if (!session) throw ApiError.unauthorized()
    if (session.role !== 'admin') throw ApiError.forbidden()

    const { id: booking_id } = await params
    const supabase = getServerClient()

    const { data, error } = await supabase
      .from('fastlane_registrations')
      .select(SELECT_FIELDS)
      .eq('booking_id', booking_id)
      .eq('is_deleted', false)
      .order('registered_at', { ascending: true })

    if (error) throw ApiError.internal(error.message)

    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    const { error, code, status } = handleApiError(err)
    return NextResponse.json({ error, code }, { status })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(req)
    if (!session) throw ApiError.unauthorized()
    if (session.role !== 'admin') throw ApiError.forbidden()

    const { id: booking_id } = await params
    const body = await req.json()
    const parsed = AddRegSchema.safeParse(body)
    if (!parsed.success) throw ApiError.badRequest(parsed.error.issues[0]?.message)

    const supabase = getServerClient()

    // Validate booking exists and is not CLOSED
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, status, num_trucks, terminal_id')
      .eq('id', booking_id)
      .single()

    if (bookingError || !booking) throw ApiError.notFound('Booking not found')
    if (booking.status === 'CLOSED') throw ApiError.badRequest('Cannot add registrations to a closed booking')

    const { data: reg, error: insertError } = await supabase
      .from('fastlane_registrations')
      .insert({
        booking_id,
        terminal_id: booking.terminal_id,
        license_plate: parsed.data.license_plate,
        hour_slot: parsed.data.hour_slot,
      })
      .select(SELECT_FIELDS)
      .single()

    if (insertError || !reg) throw ApiError.internal(insertError?.message ?? 'Failed to insert')

    // Count active registrations and auto-update booking status to BOOKED if full
    const { count } = await supabase
      .from('fastlane_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('booking_id', booking_id)
      .eq('is_deleted', false)

    if ((count ?? 0) >= booking.num_trucks && booking.status !== 'BOOKED') {
      await supabase
        .from('bookings')
        .update({ status: 'BOOKED', booked_at: new Date().toISOString() })
        .eq('id', booking_id)
    }

    return NextResponse.json({ data: reg }, { status: 201 })
  } catch (err) {
    const { error, code, status } = handleApiError(err)
    return NextResponse.json({ error, code }, { status })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(req)
    if (!session) throw ApiError.unauthorized()
    if (session.role !== 'admin') throw ApiError.forbidden()

    const { id: booking_id } = await params
    const { searchParams } = new URL(req.url)
    const regId = searchParams.get('id')
    if (!regId) throw ApiError.badRequest('Missing registration id query param')

    const body = await req.json()
    const parsed = EditRegSchema.safeParse(body)
    if (!parsed.success) throw ApiError.badRequest(parsed.error.issues[0]?.message)
    if (!parsed.data.license_plate && parsed.data.hour_slot === undefined) {
      throw ApiError.badRequest('Nothing to update')
    }

    const supabase = getServerClient()

    const updates: Record<string, unknown> = {}
    if (parsed.data.license_plate !== undefined) updates.license_plate = parsed.data.license_plate
    if (parsed.data.hour_slot !== undefined) updates.hour_slot = parsed.data.hour_slot

    const { data, error } = await supabase
      .from('fastlane_registrations')
      .update(updates)
      .eq('id', regId)
      .eq('booking_id', booking_id)
      .eq('is_deleted', false)
      .select(SELECT_FIELDS)
      .single()

    if (error || !data) throw ApiError.notFound('Registration not found')

    return NextResponse.json({ data })
  } catch (err) {
    const { error, code, status } = handleApiError(err)
    return NextResponse.json({ error, code }, { status })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(req)
    if (!session) throw ApiError.unauthorized()
    if (session.role !== 'admin') throw ApiError.forbidden()

    const { id: booking_id } = await params
    const { searchParams } = new URL(req.url)
    const regId = searchParams.get('id')
    if (!regId) throw ApiError.badRequest('Missing registration id query param')

    const supabase = getServerClient()

    const { error } = await supabase
      .from('fastlane_registrations')
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq('id', regId)
      .eq('booking_id', booking_id)
      .eq('is_deleted', false)

    if (error) throw ApiError.notFound('Registration not found')

    // Count remaining active registrations
    const { count } = await supabase
      .from('fastlane_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('booking_id', booking_id)
      .eq('is_deleted', false)

    // Get booking to check num_trucks and status
    const { data: booking } = await supabase
      .from('bookings')
      .select('status, num_trucks')
      .eq('id', booking_id)
      .single()

    // Revert to FILLING-IN if count drops below num_trucks
    if (booking && booking.status === 'BOOKED' && (count ?? 0) < booking.num_trucks) {
      await supabase
        .from('bookings')
        .update({ status: 'FILLING-IN', booked_at: null })
        .eq('id', booking_id)
    }

    return NextResponse.json({ data: null })
  } catch (err) {
    const { error, code, status } = handleApiError(err)
    return NextResponse.json({ error, code }, { status })
  }
}
