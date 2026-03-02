import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase/server'
import { handleApiError, ApiError } from '@/lib/api/errors'
import { AddPlateSchema, EditPlateSchema } from '@/lib/validations/register'
import { z } from 'zod'

async function getBookingByToken(token: string) {
  const supabase = getServerClient()
  const { data, error } = await supabase
    .from('bookings')
    .select('id, num_trucks, status, token_cancelled, terminal_id')
    .eq('fastlane_token', token)
    .single()

  if (error || !data) throw ApiError.notFound('Invalid or expired token')
  if (data.token_cancelled) throw ApiError.forbidden('This registration link has been cancelled')
  if (data.status === 'CLOSED') throw ApiError.forbidden('This booking is closed')

  return data
}

// POST — add a new plate
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const booking = await getBookingByToken(token)

    const body = await req.json()
    const parsed = AddPlateSchema.safeParse(body)
    if (!parsed.success) throw ApiError.badRequest(parsed.error.issues[0]?.message)

    const { license_plate, hour_slot } = parsed.data
    const supabase = getServerClient()

    // Check: not over num_trucks limit
    const { count } = await supabase
      .from('fastlane_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('booking_id', booking.id)
      .eq('is_deleted', false)

    if ((count ?? 0) >= booking.num_trucks) {
      throw new ApiError('Maximum truck registrations reached', 409, 'MAX_REACHED')
    }

    // Check: slot has remaining capacity
    const { data: slotData, error: slotError } = await supabase
      .from('slot_remaining_capacity')
      .select('remaining_capacity')
      .eq('terminal_id', booking.terminal_id)
      .eq('hour_slot', hour_slot)
      .single()

    if (slotError || !slotData) {
      throw ApiError.notFound('Capacity slot not found for this terminal/hour')
    }

    if (slotData.remaining_capacity <= 0) {
      throw new ApiError('No remaining capacity in this slot', 409, 'SLOT_FULL')
    }

    // Insert registration
    const { data, error } = await supabase
      .from('fastlane_registrations')
      .insert({
        booking_id: booking.id,
        hour_slot,
        terminal_id: booking.terminal_id,
        license_plate,
      })
      .select('id, booking_id, hour_slot, terminal_id, license_plate, is_deleted, registered_at, deleted_at')
      .single()

    if (error) throw ApiError.internal(error.message)

    // Auto-update booking status to BOOKED when all trucks registered
    const { count: newCount } = await supabase
      .from('fastlane_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('booking_id', booking.id)
      .eq('is_deleted', false)

    if ((newCount ?? 0) >= booking.num_trucks) {
      await supabase
        .from('bookings')
        .update({ status: 'BOOKED', booked_at: new Date().toISOString() })
        .eq('id', booking.id)
        .eq('status', 'FILLING-IN')
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    const { error, code, status } = handleApiError(err)
    return NextResponse.json({ error, code }, { status })
  }
}

// PATCH — edit a plate's license_plate by registration id
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const booking = await getBookingByToken(token)

    const { searchParams } = req.nextUrl
    const registrationId = searchParams.get('id')
    if (!registrationId) throw ApiError.badRequest('Registration id is required')

    const body = await req.json()
    const parsed = EditPlateSchema.safeParse(body)
    if (!parsed.success) throw ApiError.badRequest(parsed.error.issues[0]?.message)

    const supabase = getServerClient()
    const { data, error } = await supabase
      .from('fastlane_registrations')
      .update({ license_plate: parsed.data.license_plate })
      .eq('id', registrationId)
      .eq('booking_id', booking.id)
      .eq('is_deleted', false)
      .select('id, booking_id, hour_slot, terminal_id, license_plate, is_deleted, registered_at, deleted_at')
      .single()

    if (error || !data) throw ApiError.notFound('Registration not found')

    return NextResponse.json({ data })
  } catch (err) {
    const { error, code, status } = handleApiError(err)
    return NextResponse.json({ error, code }, { status })
  }
}

// DELETE — soft-delete a registration
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const booking = await getBookingByToken(token)

    const { searchParams } = req.nextUrl
    const registrationId = searchParams.get('id')
    if (!registrationId) throw ApiError.badRequest('Registration id is required')

    const supabase = getServerClient()
    const { data, error } = await supabase
      .from('fastlane_registrations')
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq('id', registrationId)
      .eq('booking_id', booking.id)
      .eq('is_deleted', false)
      .select('id')
      .single()

    if (error || !data) throw ApiError.notFound('Registration not found or already deleted')

    // Revert booking to FILLING-IN if not fully filled
    const { count } = await supabase
      .from('fastlane_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('booking_id', booking.id)
      .eq('is_deleted', false)

    if ((count ?? 0) < booking.num_trucks) {
      await supabase
        .from('bookings')
        .update({ status: 'FILLING-IN', booked_at: null })
        .eq('id', booking.id)
        .eq('status', 'BOOKED')
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const { error, code, status } = handleApiError(err)
    return NextResponse.json({ error, code }, { status })
  }
}
