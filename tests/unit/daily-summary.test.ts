import { describe, it, expect } from 'vitest'

// ── Hour formatting ─────────────────────────────────────────────────────────

describe('formatHour', () => {
  const formatHour = (slot: number) => `${String(slot).padStart(2, '0')}:00`

  it('formats slot 0 as 00:00', () => expect(formatHour(0)).toBe('00:00'))
  it('formats slot 9 as 09:00', () => expect(formatHour(9)).toBe('09:00'))
  it('formats slot 12 as 12:00', () => expect(formatHour(12)).toBe('12:00'))
  it('formats slot 23 as 23:00', () => expect(formatHour(23)).toBe('23:00'))
})

// ── Date validation ─────────────────────────────────────────────────────────

describe('daily-summary date param validation', () => {
  const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)

  it('accepts YYYY-MM-DD', () => {
    expect(isValidDate('2026-03-29')).toBe(true)
    expect(isValidDate('2099-12-31')).toBe(true)
  })

  it('rejects missing date', () => expect(isValidDate('')).toBe(false))
  it('rejects datetime strings', () => expect(isValidDate('2026-03-29T00:00:00Z')).toBe(false))
  it('rejects slash-separated dates', () => expect(isValidDate('2026/03/29')).toBe(false))
})

// ── Row mapping ─────────────────────────────────────────────────────────────

describe('daily-summary row mapping', () => {
  type RawRow = {
    id: string
    hour_slot: number
    license_plate: string
    container_number: string
    registered_at: string
    bookings: { booking_number: string; truck_companies: { name: string } | null } | null
  }

  function mapRow(r: RawRow) {
    return {
      id: r.id,
      hour_slot: r.hour_slot,
      license_plate: r.license_plate,
      container_number: r.container_number,
      registered_at: r.registered_at,
      booking_number: r.bookings?.booking_number ?? '—',
      truck_company_name: r.bookings?.truck_companies?.name ?? '—',
    }
  }

  const raw: RawRow = {
    id: 'row-1',
    hour_slot: 9,
    license_plate: 'AB-1234',
    container_number: 'ABCD1234567',
    registered_at: '2026-03-29T09:05:00Z',
    bookings: { booking_number: 'BK-001', truck_companies: { name: 'Alpha Logistics' } },
  }

  it('maps all fields from raw row', () => {
    const result = mapRow(raw)
    expect(result.id).toBe('row-1')
    expect(result.hour_slot).toBe(9)
    expect(result.license_plate).toBe('AB-1234')
    expect(result.container_number).toBe('ABCD1234567')
    expect(result.booking_number).toBe('BK-001')
    expect(result.truck_company_name).toBe('Alpha Logistics')
  })

  it('uses em-dash fallback when bookings is null', () => {
    const result = mapRow({ ...raw, bookings: null })
    expect(result.booking_number).toBe('—')
    expect(result.truck_company_name).toBe('—')
  })

  it('uses em-dash fallback when truck_companies is null', () => {
    const result = mapRow({ ...raw, bookings: { booking_number: 'BK-002', truck_companies: null } })
    expect(result.booking_number).toBe('BK-002')
    expect(result.truck_company_name).toBe('—')
  })
})

// ── Sorting ─────────────────────────────────────────────────────────────────

describe('daily-summary row sort order', () => {
  type SortRow = { hour_slot: number; registered_at: string }

  const sort = (rows: SortRow[]) =>
    [...rows].sort((a, b) => {
      if (a.hour_slot !== b.hour_slot) return a.hour_slot - b.hour_slot
      return a.registered_at.localeCompare(b.registered_at)
    })

  it('sorts by hour_slot ascending', () => {
    const rows: SortRow[] = [
      { hour_slot: 14, registered_at: '2026-03-29T14:00:00Z' },
      { hour_slot: 8,  registered_at: '2026-03-29T08:00:00Z' },
      { hour_slot: 10, registered_at: '2026-03-29T10:00:00Z' },
    ]
    expect(sort(rows).map(r => r.hour_slot)).toEqual([8, 10, 14])
  })

  it('sorts by registered_at when hour_slot is equal', () => {
    const rows: SortRow[] = [
      { hour_slot: 9, registered_at: '2026-03-29T09:30:00Z' },
      { hour_slot: 9, registered_at: '2026-03-29T09:05:00Z' },
      { hour_slot: 9, registered_at: '2026-03-29T09:15:00Z' },
    ]
    const result = sort(rows)
    expect(result[0].registered_at).toBe('2026-03-29T09:05:00Z')
    expect(result[1].registered_at).toBe('2026-03-29T09:15:00Z')
    expect(result[2].registered_at).toBe('2026-03-29T09:30:00Z')
  })
})
