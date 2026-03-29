import nodemailer from 'nodemailer'
import { getServerClient } from '@/lib/supabase/server'
import { generateFastlaneDocument } from '@/lib/pdf/fastlane-document'

function getTransporter() {
  const host = process.env.SMTP_HOST
  const port = parseInt(process.env.SMTP_PORT ?? '587')
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!host || !user || !pass) return null
  return nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } })
}

/**
 * Generates a PDF entry pass for every active registration on a booking
 * and emails them to the truck company's contact_email.
 * Silently skips if SMTP is not configured or there is no contact email.
 */
export async function sendFastlaneDocuments(bookingId: string): Promise<void> {
  const transporter = getTransporter()
  if (!transporter) return // SMTP not configured — skip silently

  const supabase = getServerClient()

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, booking_number, terminal_id, fastlane_token, port_terminals(name), truck_companies(name, contact_email)')
    .eq('id', bookingId)
    .single()

  if (!booking) return

  const terminalName = (booking.port_terminals as unknown as { name: string } | null)?.name ?? 'Unknown'
  const company = booking.truck_companies as unknown as { name: string; contact_email: string | null } | null
  const truckCompanyName = company?.name ?? ''
  const toEmail = company?.contact_email
  if (!toEmail) return // No email on file — skip silently

  const { data: regs } = await supabase
    .from('fastlane_registrations')
    .select('id, appointment_date, hour_slot, license_plate, container_number')
    .eq('booking_id', bookingId)
    .eq('is_deleted', false)
    .order('appointment_date')
    .order('hour_slot')

  if (!regs || regs.length === 0) return

  const attachments = await Promise.all(
    regs.map(async (reg) => {
      const appointmentDate = (reg as unknown as { appointment_date: string }).appointment_date
      const pdfBuffer = await generateFastlaneDocument({
        token: (booking as unknown as { fastlane_token: string }).fastlane_token ?? '',
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

  const from = process.env.SMTP_FROM || process.env.SMTP_USER
  try {
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
  } catch (err) {
    // Email delivery failed (e.g. suppressed recipient, SMTP error).
    // PDFs are still available for download via the website — do not rethrow.
    console.error(`[sendFastlaneDocuments] Email delivery failed for booking ${booking.booking_number}:`, err)
  }
}
