import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'
import { createHash } from 'crypto'

export interface FastlaneDocumentData {
  token: string             // fastlane token (tgc)
  bookingNumber: string
  terminalName: string
  truckCompanyName: string
  appointmentDate: string   // YYYY-MM-DD
  hourSlot: number
  licensePlate: string
  containerNumber: string
}

const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => {
  const h = String(i).padStart(2, '0')
  const h2 = String(i + 1).padStart(2, '0')
  return `${h}:00 – ${h2}:00`
})

/**
 * Builds the pipe-delimited QR payload and appends a SHA-1 check (first 8 hex chars).
 * Format: TOKEN|TERMINAL|BOOKING_NUMBER|CONTAINER|DATE|SLOT|PLATE|CHECK8
 */
function buildQrPayload(data: FastlaneDocumentData): string {
  const fields = [
    data.token,
    data.terminalName,
    data.bookingNumber,
    data.containerNumber,
    data.appointmentDate,
    HOUR_LABELS[data.hourSlot],
    data.licensePlate,
  ]
  const body = fields.join('|')
  const check = createHash('sha1').update(body).digest('hex').slice(0, 8).toUpperCase()
  return `${body}|${check}`
}

export async function generateFastlaneDocument(data: FastlaneDocumentData): Promise<Buffer> {
  // Generate QR PNG before opening the PDF stream
  const qrPayload = buildQrPayload(data)
  const qrPngBuffer = await QRCode.toBuffer(qrPayload, {
    errorCorrectionLevel: 'M',
    type: 'png',
    margin: 1,
    width: 200,
  })

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 60 })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const appointmentDateStr = new Date(data.appointmentDate + 'T00:00:00')
      .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

    // ── Header ──────────────────────────────────────────────
    doc.fontSize(22).font('Helvetica-Bold').text('Fastlane Entry Pass', { align: 'center' })
    doc.moveDown(0.3)
    doc.fontSize(12).font('Helvetica').fillColor('#6b7280').text(data.terminalName, { align: 'center' })
    doc.moveDown(1.5)

    // ── Divider ─────────────────────────────────────────────
    doc.moveTo(60, doc.y).lineTo(535, doc.y).strokeColor('#e5e7eb').lineWidth(1).stroke()
    doc.moveDown(1)

    // ── Two-column layout: info grid (left) + QR code (right) ───
    const gridStartY = doc.y
    const qrSize = 145
    const qrX = 535 - qrSize           // right-aligned within content area
    const gridValueX = 200
    const gridValueWidth = qrX - gridValueX - 15

    function row(label: string, value: string) {
      const y = doc.y
      doc.fontSize(10).font('Helvetica').fillColor('#6b7280').text(label, 60, y, { width: 130 })
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#111827').text(value, gridValueX, y, { width: gridValueWidth })
      doc.moveDown(0.9)
    }

    row('Booking Number', data.bookingNumber)
    row('Truck Company', data.truckCompanyName)
    row('Terminal', data.terminalName)
    row('Appointment Date', appointmentDateStr)
    row('Time Slot', HOUR_LABELS[data.hourSlot])
    row('License Plate', data.licensePlate)
    row('Container Number', data.containerNumber)

    // QR code — vertically centred alongside the info rows
    const gridEndY = doc.y
    const qrY = gridStartY + (gridEndY - gridStartY - qrSize) / 2
    doc.image(qrPngBuffer, qrX, Math.max(gridStartY, qrY), { width: qrSize, height: qrSize })

    // Ensure cursor is below both columns
    if (doc.y < gridStartY + qrSize + 10) {
      doc.y = gridStartY + qrSize + 10
    }

    doc.moveDown(1)
    doc.moveTo(60, doc.y).lineTo(535, doc.y).strokeColor('#e5e7eb').lineWidth(1).stroke()
    doc.moveDown(1)

    // ── QR legend ────────────────────────────────────────────
    doc.fontSize(8).font('Helvetica').fillColor('#9ca3af')
      .text(`QR: ${qrPayload}`, 60, doc.y, { width: 475 })
    doc.moveDown(1)

    // ── Footer note ─────────────────────────────────────────
    doc.fontSize(9).font('Helvetica').fillColor('#9ca3af')
      .text('Please present this document upon arrival at the terminal gate.', { align: 'center' })

    doc.end()
  })
}
