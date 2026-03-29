import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { getServerClient } from '@/lib/supabase/server'
import { handleApiError, ApiError } from '@/lib/api/errors'
import { getTcSession } from '@/lib/auth/tc-session'
import { generateFastlaneDocument } from '@/lib/pdf/fastlane-document'

function getTransporter() {
  const host = process.env.SMTP_HOST
  const port = parseInt(process.env.SMTP_PORT ?? '587')
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!host || !user || !pass) throw new ApiError('Email service is not configured', 503, 'EMAIL_NOT_CONFIGURED')
  return nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const tcSession = await getTcSession(req)
    if (!tcSession) throw ApiError.unauthorized()

    const { token } = await params
    const supabase = getServerClient()

    // Fetch booking + company email
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, booking_number, num_trucks, terminal_id, truck_company_id, is_privileged_booking, port_terminals(name), truck_companies(name, contact_email)')
      .eq('fastlane_token', token)
      .single()

    if (!booking) throw ApiError.notFound('Invalid token')
    if (booking.truck_company_id !== tcSession.truck_company_id) throw ApiError.forbidden()

    const terminalName = (booking.port_terminals as unknown as { name: string } | null)?.name ?? 'Unknown'
    const company = booking.truck_companies as unknown as { name: string; contact_email: string | null } | null
    const truckCompanyName = company?.name ?? tcSession.name
    const toEmail = company?.contact_email
    if (!toEmail) throw new ApiError('No contact email set for this truck company. Please contact the booking agent.', 400, 'NO_EMAIL')

    // Fetch all active registrations
    const { data: regs } = await supabase
      .from('fastlane_registrations')
      .select('id, appointment_date, hour_slot, license_plate, container_number')
      .eq('booking_id', booking.id)
      .eq('is_deleted', false)
      .order('appointment_date')
      .order('hour_slot')

    if (!regs || regs.length === 0) throw new ApiError('No active registrations to send', 400, 'NO_REGISTRATIONS')
    if (regs.length < booking.num_trucks) throw new ApiError('Registration is not complete yet', 400, 'INCOMPLETE')

    // Generate PDFs
    const attachments = await Promise.all(
      regs.map(async (reg) => {
        const appointmentDate = (reg as unknown as { appointment_date: string }).appointment_date
        const pdfBuffer = await generateFastlaneDocument({
          bookingNumber: booking.booking_number,
          terminalName,
          truckCompanyName,
          appointmentDate,
          hourSlot: reg.hour_slot,
          licensePlate: reg.license_plate,
          containerNumber: reg.container_number,
        })
        const filename = `fastlane-${booking.booking_number}-${reg.license_plate}-${reg.container_number}.pdf`
          .replace(/[^a-zA-Z0-9\-_.]/g, '_')
        return { filename, content: pdfBuffer, contentType: 'application/pdf' }
      })
    )

    // Send email
    const transporter = getTransporter()
    const from = process.env.SMTP_FROM || process.env.SMTP_USER
    await transporter.sendMail({
      from,
      to: toEmail,
      subject: `Fastlane Entry Documents — ${booking.booking_number}`,
      text: [
        `Dear ${truckCompanyName},`,
        '',
        `Please find attached your fastlane entry documents for booking ${booking.booking_number} at ${terminalName}.`,
        '',
        `${attachments.length} document(s) attached — one per registered truck.`,
        '',
        'Please present the relevant document at the terminal gate on your appointment date.',
      ].join('\n'),
      attachments,
    })

    return NextResponse.json({ ok: true, sent_to: toEmail, count: attachments.length })
  } catch (err) {
    const { error, code, status } = handleApiError(err)
    return NextResponse.json({ error, code }, { status })
  }
}
