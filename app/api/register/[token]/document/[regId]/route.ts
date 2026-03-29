import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase/server'
import { handleApiError, ApiError } from '@/lib/api/errors'
import { getTcSession } from '@/lib/auth/tc-session'
import { generateFastlaneDocument } from '@/lib/pdf/fastlane-document'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string; regId: string }> }
) {
  try {
    const tcSession = await getTcSession(req)
    if (!tcSession) throw ApiError.unauthorized()

    const { token, regId } = await params
    const supabase = getServerClient()

    // Fetch booking by token (scope to TC)
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, booking_number, terminal_id, truck_company_id, is_privileged_booking, port_terminals(name), truck_companies(name)')
      .eq('fastlane_token', token)
      .single()

    if (!booking) throw ApiError.notFound('Invalid token')
    if (booking.truck_company_id !== tcSession.truck_company_id) throw ApiError.forbidden()

    // Fetch the specific registration
    const { data: reg } = await supabase
      .from('fastlane_registrations')
      .select('id, appointment_date, hour_slot, license_plate, container_number, is_deleted')
      .eq('id', regId)
      .eq('booking_id', booking.id)
      .eq('is_deleted', false)
      .single()

    if (!reg) throw ApiError.notFound('Registration not found')

    const terminalName = (booking.port_terminals as unknown as { name: string } | null)?.name ?? 'Unknown'
    const truckCompanyName = (booking.truck_companies as unknown as { name: string } | null)?.name ?? tcSession.name

    const pdfBuffer = await generateFastlaneDocument({
      bookingNumber: booking.booking_number,
      terminalName,
      truckCompanyName,
      appointmentDate: (reg as unknown as { appointment_date: string }).appointment_date,
      hourSlot: reg.hour_slot,
      licensePlate: reg.license_plate,
      containerNumber: reg.container_number,
    })

    const filename = `fastlane-${booking.booking_number}-${reg.license_plate}-${reg.container_number}.pdf`
      .replace(/[^a-zA-Z0-9\-_.]/g, '_')

    return new Response(pdfBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    const { error, code, status } = handleApiError(err)
    return NextResponse.json({ error, code }, { status })
  }
}
