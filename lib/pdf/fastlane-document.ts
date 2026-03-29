import PDFDocument from 'pdfkit'

export interface FastlaneDocumentData {
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

export async function generateFastlaneDocument(data: FastlaneDocumentData): Promise<Buffer> {
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

    // ── Info grid ───────────────────────────────────────────
    function row(label: string, value: string) {
      const y = doc.y
      doc.fontSize(10).font('Helvetica').fillColor('#6b7280').text(label, 60, y, { width: 160 })
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#111827').text(value, 230, y, { width: 305 })
      doc.moveDown(0.9)
    }

    row('Booking Number', data.bookingNumber)
    row('Truck Company', data.truckCompanyName)
    row('Terminal', data.terminalName)
    row('Appointment Date', appointmentDateStr)
    row('Time Slot', HOUR_LABELS[data.hourSlot])
    row('License Plate', data.licensePlate)
    row('Container Number', data.containerNumber)

    doc.moveDown(1)
    doc.moveTo(60, doc.y).lineTo(535, doc.y).strokeColor('#e5e7eb').lineWidth(1).stroke()
    doc.moveDown(1.5)

    // ── Footer note ─────────────────────────────────────────
    doc.fontSize(9).font('Helvetica').fillColor('#9ca3af')
      .text('Please present this document upon arrival at the terminal gate.', { align: 'center' })

    doc.end()
  })
}
