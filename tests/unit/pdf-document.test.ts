import { describe, it, expect } from 'vitest'
import { generateFastlaneDocument } from '@/lib/pdf/fastlane-document'

const BASE_DATA = {
  bookingNumber: 'BK-TEST-001',
  terminalName: 'Terminal A',
  truckCompanyName: 'Test Trucking Co',
  appointmentDate: '2099-12-31',
  hourSlot: 9,
  licensePlate: 'ABC-1234',
  containerNumber: 'ABCD1234567',
}

describe('generateFastlaneDocument', () => {
  it('returns a non-empty Buffer', async () => {
    const buf = await generateFastlaneDocument(BASE_DATA)
    expect(buf).toBeInstanceOf(Buffer)
    expect(buf.length).toBeGreaterThan(0)
  })

  it('output starts with PDF magic bytes (%PDF-)', async () => {
    const buf = await generateFastlaneDocument(BASE_DATA)
    expect(buf.slice(0, 5).toString('ascii')).toBe('%PDF-')
  })

  it('generates distinct buffers for different license plates', async () => {
    const buf1 = await generateFastlaneDocument({ ...BASE_DATA, licensePlate: 'AAA-1111' })
    const buf2 = await generateFastlaneDocument({ ...BASE_DATA, licensePlate: 'ZZZ-9999' })
    expect(buf1.equals(buf2)).toBe(false)
  })

  it('generates distinct buffers for different container numbers', async () => {
    const buf1 = await generateFastlaneDocument({ ...BASE_DATA, containerNumber: 'AAAA1111111' })
    const buf2 = await generateFastlaneDocument({ ...BASE_DATA, containerNumber: 'ZZZZ9999999' })
    expect(buf1.equals(buf2)).toBe(false)
  })

  it('generates distinct buffers for different hour slots', async () => {
    const buf1 = await generateFastlaneDocument({ ...BASE_DATA, hourSlot: 8 })
    const buf2 = await generateFastlaneDocument({ ...BASE_DATA, hourSlot: 18 })
    expect(buf1.equals(buf2)).toBe(false)
  })

  it('can generate documents concurrently without error', async () => {
    const results = await Promise.all([
      generateFastlaneDocument({ ...BASE_DATA, licensePlate: 'P1-0001' }),
      generateFastlaneDocument({ ...BASE_DATA, licensePlate: 'P2-0002' }),
      generateFastlaneDocument({ ...BASE_DATA, licensePlate: 'P3-0003' }),
    ])
    for (const buf of results) {
      expect(buf).toBeInstanceOf(Buffer)
      expect(buf.slice(0, 5).toString('ascii')).toBe('%PDF-')
    }
  })
})
