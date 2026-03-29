import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase/server'
import { handleApiError, ApiError } from '@/lib/api/errors'
import { AddPlateSchema, EditRegistrationSchema } from '@/lib/validations/register'
import { getTcSession } from '@/lib/auth/tc-session'
import { sendFastlaneDocuments } from '@/lib/email/send-fastlane-documents'

function isWithinDeadline(bookingDate: string, hourSlot: number, bufferHours: number): boolean {
  // slot starts at hourSlot:00 UTC on bookingDate
  const slotMs = new Date(`${bookingDate}T${String(hourSlot).padStart(2, '0')}:00:00Z`).getTime()
  return Date.now() < slotMs - bufferHours * 3600 * 1000
}

async function getBookingByToken(token: string) {
  const supabase = getServerClient()
  const { data, error } = await supabase
    .from('bookings')
    .select('id, num_trucks, status, token_cancelled, terminal_id, booking_date, is_privileged_booking, truck_company_id')
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
    const tcSession = await getTcSession(req)
    if (!tcSession) throw ApiError.unauthorized()

    const { token } = await params
    const booking = await getBookingByToken(token)

    if (booking.truck_company_id !== tcSession.truck_company_id) throw ApiError.forbidden()

    const body = await req.json()
    const parsed = AddPlateSchema.safeParse(body)
    if (!parsed.success) throw ApiError.badRequest(parsed.error.issues[0]?.message)

    const { license_plate, container_number, hour_slot } = parsed.data
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

    // Check: slot has remaining capacity for the booking's date (in the correct pool)
    const bookingDate = (booking as unknown as { booking_date: string }).booking_date
    const { data: slotData, error: slotError } = await supabase
      .from('slot_remaining_capacity')
      .select('remaining_capacity_privileged, remaining_capacity_non_privileged')
      .eq('terminal_id', booking.terminal_id)
      .eq('date', bookingDate)
      .eq('hour_slot', hour_slot)
      .single()

    if (slotError || !slotData) {
      throw ApiError.notFound('Capacity slot not found for this terminal/date/hour. Please contact the booking agent.')
    }

    const remaining = booking.is_privileged_booking
      ? slotData.remaining_capacity_privileged
      : slotData.remaining_capacity_non_privileged

    if (remaining <= 0) {
      throw new ApiError('No remaining capacity in this slot', 409, 'SLOT_FULL')
    }

    // Insert registration — store appointment_date independently so it is
    // not affected if the booking's booking_date is later changed.
    const { data, error } = await supabase
      .from('fastlane_registrations')
      .insert({
        booking_id: booking.id,
        appointment_date: bookingDate,
        hour_slot,
        terminal_id: booking.terminal_id,
        license_plate,
        container_number,
      })
      .select('id, booking_id, appointment_date, hour_slot, terminal_id, license_plate, container_number, is_deleted, registered_at, deleted_at')
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

      // Await document generation so the client knows when docs are ready
      await sendFastlaneDocuments(booking.id)
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    const { error, code, status } = handleApiError(err)
    return NextResponse.json({ error, code }, { status })
  }
}

// PATCH — edit a plate's license_plate and/or hour_slot by registration id
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const tcSession = await getTcSession(req)
    if (!tcSession) throw ApiError.unauthorized()

    const { token } = await params
    const booking = await getBookingByToken(token)

    if (booking.truck_company_id !== tcSession.truck_company_id) throw ApiError.forbidden()

    const { searchParams } = req.nextUrl
    const registrationId = searchParams.get('id')
    if (!registrationId) throw ApiError.badRequest('Registration id is required')

    const body = await req.json()
    const parsed = EditRegistrationSchema.safeParse(body)
    if (!parsed.success) throw ApiError.badRequest(parsed.error.issues[0]?.message)

    const supabase = getServerClient()

    // Fetch current registration — use its own appointment_date (independent of booking_date)
    const { data: currentReg, error: regError } = await supabase
      .from('fastlane_registrations')
      .select('id, appointment_date, hour_slot, license_plate, container_number')
      .eq('id', registrationId)
      .eq('booking_id', booking.id)
      .eq('is_deleted', false)
      .single()

    if (regError || !currentReg) throw ApiError.notFound('Registration not found')

    const appointmentDate = (currentReg as unknown as { appointment_date: string }).appointment_date
    const newHourSlot = parsed.data.hour_slot
    const newLicensePlate = parsed.data.license_plate
    const newContainerNumber = parsed.data.container_number

    const updateFields: Record<string, unknown> = {}

    if (newHourSlot !== undefined && newHourSlot !== currentReg.hour_slot) {
      // Changing slot: must be >12h before the new slot on the registration's appointment_date
      if (!isWithinDeadline(appointmentDate, newHourSlot, 12)) {
        throw new ApiError('Cannot change slot: new slot time must be more than 12 hours in advance', 409, 'DEADLINE_PASSED')
      }

      // Check capacity for new slot on the registration's appointment_date
      const { data: slotData, error: slotError } = await supabase
        .from('slot_remaining_capacity')
        .select('remaining_capacity_privileged, remaining_capacity_non_privileged')
        .eq('terminal_id', booking.terminal_id)
        .eq('date', appointmentDate)
        .eq('hour_slot', newHourSlot)
        .single()

      if (slotError || !slotData) {
        throw ApiError.notFound('Capacity slot not found for this terminal/date/hour.')
      }

      const remaining = booking.is_privileged_booking
        ? slotData.remaining_capacity_privileged
        : slotData.remaining_capacity_non_privileged

      if (remaining <= 0) {
        throw new ApiError('No remaining capacity in the target slot', 409, 'SLOT_FULL')
      }

      updateFields.hour_slot = newHourSlot
    }

    // Container number: locked 12h before slot (using registration's own appointment_date)
    if (newContainerNumber !== undefined) {
      if (!isWithinDeadline(appointmentDate, currentReg.hour_slot, 12)) {
        throw new ApiError('Cannot change container number: less than 12 hours before slot time', 409, 'DEADLINE_PASSED')
      }
      updateFields.container_number = newContainerNumber
    }

    // License plate: locked 1h before slot (using registration's own appointment_date)
    if (newLicensePlate !== undefined) {
      if (!isWithinDeadline(appointmentDate, currentReg.hour_slot, 1)) {
        throw new ApiError('Cannot change plate: slot time must be more than 1 hour in advance', 409, 'DEADLINE_PASSED')
      }
      updateFields.license_plate = newLicensePlate
    }

    if (Object.keys(updateFields).length === 0) {
      throw ApiError.badRequest('No changes provided')
    }

    const { data, error } = await supabase
      .from('fastlane_registrations')
      .update(updateFields)
      .eq('id', registrationId)
      .eq('booking_id', booking.id)
      .eq('is_deleted', false)
      .select('id, booking_id, appointment_date, hour_slot, terminal_id, license_plate, container_number, is_deleted, registered_at, deleted_at')
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
    const tcSession = await getTcSession(req)
    if (!tcSession) throw ApiError.unauthorized()

    const { token } = await params
    const booking = await getBookingByToken(token)

    if (booking.truck_company_id !== tcSession.truck_company_id) throw ApiError.forbidden()

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
