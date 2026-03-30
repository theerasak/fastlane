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
    appointment_date: string
    hour_slot: number
    license_plate: string
    container_number: string
    registered_at: string
    bookings: {
      booking_number: string
      terminal_id: string
      truck_companies: { name: string } | null
      port_terminals: { id: string; name: string } | null
    } | null
  }

  function mapRow(r: RawRow) {
    const booking = r.bookings
    return {
      id: r.id,
      terminal_id: booking?.terminal_id ?? '',
      terminal_name: booking?.port_terminals?.name ?? '—',
      booking_date: r.appointment_date,
      hour_slot: r.hour_slot,
      license_plate: r.license_plate,
      container_number: r.container_number,
      registered_at: r.registered_at,
      booking_number: booking?.booking_number ?? '—',
      truck_company_name: booking?.truck_companies?.name ?? '—',
    }
  }

  const raw: RawRow = {
    id: 'row-1',
    appointment_date: '2026-03-29',
    hour_slot: 9,
    license_plate: 'AB-1234',
    container_number: 'ABCD1234567',
    registered_at: '2026-03-29T09:05:00Z',
    bookings: {
      booking_number: 'BK-001',
      terminal_id: 'term-001',
      truck_companies: { name: 'Alpha Logistics' },
      port_terminals: { id: 'term-001', name: 'Terminal A' },
    },
  }

  it('maps all fields including terminal_id, terminal_name and booking_date', () => {
    const result = mapRow(raw)
    expect(result.id).toBe('row-1')
    expect(result.terminal_id).toBe('term-001')
    expect(result.terminal_name).toBe('Terminal A')
    expect(result.booking_date).toBe('2026-03-29')
    expect(result.hour_slot).toBe(9)
    expect(result.license_plate).toBe('AB-1234')
    expect(result.container_number).toBe('ABCD1234567')
    expect(result.booking_number).toBe('BK-001')
    expect(result.truck_company_name).toBe('Alpha Logistics')
  })

  it('uses empty string and em-dash fallback when bookings is null', () => {
    const result = mapRow({ ...raw, bookings: null })
    expect(result.terminal_id).toBe('')
    expect(result.terminal_name).toBe('—')
    expect(result.booking_number).toBe('—')
    expect(result.truck_company_name).toBe('—')
  })

  it('uses em-dash when port_terminals is null', () => {
    const result = mapRow({
      ...raw,
      bookings: { ...raw.bookings!, port_terminals: null },
    })
    expect(result.terminal_name).toBe('—')
  })

  it('uses em-dash fallback when truck_companies is null', () => {
    const result = mapRow({
      ...raw,
      bookings: { ...raw.bookings!, truck_companies: null },
    })
    expect(result.booking_number).toBe('BK-001')
    expect(result.truck_company_name).toBe('—')
  })
})

// ── Sorting ─────────────────────────────────────────────────────────────────

describe('daily-summary row sort order', () => {
  type SortRow = {
    terminal_name: string
    booking_date: string
    hour_slot: number
    container_number: string
    license_plate: string
  }

  const sort = (rows: SortRow[]) =>
    [...rows].sort((a, b) => {
      const t = a.terminal_name.localeCompare(b.terminal_name)
      if (t !== 0) return t
      const d = a.booking_date.localeCompare(b.booking_date)
      if (d !== 0) return d
      if (a.hour_slot !== b.hour_slot) return a.hour_slot - b.hour_slot
      const c = a.container_number.localeCompare(b.container_number)
      if (c !== 0) return c
      return a.license_plate.localeCompare(b.license_plate)
    })

  const row = (terminal_name: string, booking_date: string, hour_slot: number, container_number: string, license_plate: string): SortRow =>
    ({ terminal_name, booking_date, hour_slot, container_number, license_plate })

  it('sorts by terminal_name ascending as primary key', () => {
    const rows = [
      row('Terminal C', '2026-03-29', 9, 'AAAA1111111', 'AA-0001'),
      row('Terminal A', '2026-03-29', 9, 'AAAA1111111', 'AA-0001'),
      row('Terminal B', '2026-03-29', 9, 'AAAA1111111', 'AA-0001'),
    ]
    expect(sort(rows).map(r => r.terminal_name)).toEqual(['Terminal A', 'Terminal B', 'Terminal C'])
  })

  it('sorts by booking_date within same terminal', () => {
    const rows = [
      row('Terminal A', '2026-04-01', 9, 'AAAA1111111', 'AA-0001'),
      row('Terminal A', '2026-03-29', 9, 'AAAA1111111', 'AA-0001'),
      row('Terminal A', '2026-03-30', 9, 'AAAA1111111', 'AA-0001'),
    ]
    expect(sort(rows).map(r => r.booking_date)).toEqual(['2026-03-29', '2026-03-30', '2026-04-01'])
  })

  it('sorts by hour_slot when terminal and booking_date are equal', () => {
    const rows = [
      row('Terminal A', '2026-03-29', 14, 'AAAA1111111', 'AA-0001'),
      row('Terminal A', '2026-03-29', 8,  'AAAA1111111', 'AA-0001'),
      row('Terminal A', '2026-03-29', 10, 'AAAA1111111', 'AA-0001'),
    ]
    expect(sort(rows).map(r => r.hour_slot)).toEqual([8, 10, 14])
  })

  it('sorts by container_number when terminal, date and hour are equal', () => {
    const rows = [
      row('Terminal A', '2026-03-29', 9, 'ZZZZ9999999', 'AA-0001'),
      row('Terminal A', '2026-03-29', 9, 'AAAA1111111', 'AA-0001'),
      row('Terminal A', '2026-03-29', 9, 'MMMM5555555', 'AA-0001'),
    ]
    expect(sort(rows).map(r => r.container_number)).toEqual(['AAAA1111111', 'MMMM5555555', 'ZZZZ9999999'])
  })

  it('sorts by license_plate as final tiebreaker', () => {
    const rows = [
      row('Terminal A', '2026-03-29', 9, 'AAAA1111111', 'ZZ-9999'),
      row('Terminal A', '2026-03-29', 9, 'AAAA1111111', 'AA-0001'),
      row('Terminal A', '2026-03-29', 9, 'AAAA1111111', 'MM-5555'),
    ]
    expect(sort(rows).map(r => r.license_plate)).toEqual(['AA-0001', 'MM-5555', 'ZZ-9999'])
  })

  it('rows from different terminals are grouped by terminal regardless of date', () => {
    const rows = [
      row('Terminal B', '2026-03-29', 9, 'AAAA1111111', 'AA-0001'),
      row('Terminal A', '2026-04-01', 9, 'AAAA1111111', 'AA-0001'),
      row('Terminal A', '2026-03-29', 9, 'AAAA1111111', 'AA-0001'),
    ]
    const result = sort(rows)
    expect(result[0].terminal_name).toBe('Terminal A')
    expect(result[1].terminal_name).toBe('Terminal A')
    expect(result[2].terminal_name).toBe('Terminal B')
    expect(result[0].booking_date).toBe('2026-03-29')
    expect(result[1].booking_date).toBe('2026-04-01')
  })

  it('applies all five sort keys together', () => {
    const rows = [
      row('Terminal B', '2026-03-29', 9,  'AAAA1111111', 'AA-0001'),
      row('Terminal A', '2026-03-30', 9,  'AAAA1111111', 'AA-0001'),
      row('Terminal A', '2026-03-29', 10, 'AAAA1111111', 'AA-0001'),
      row('Terminal A', '2026-03-29', 9,  'ZZZZ9999999', 'AA-0001'),
      row('Terminal A', '2026-03-29', 9,  'AAAA1111111', 'ZZ-9999'),
      row('Terminal A', '2026-03-29', 9,  'AAAA1111111', 'AA-0001'),
    ]
    const result = sort(rows)
    expect(result[0]).toMatchObject({ terminal_name: 'Terminal A', booking_date: '2026-03-29', hour_slot: 9,  container_number: 'AAAA1111111', license_plate: 'AA-0001' })
    expect(result[1]).toMatchObject({ terminal_name: 'Terminal A', booking_date: '2026-03-29', hour_slot: 9,  container_number: 'AAAA1111111', license_plate: 'ZZ-9999' })
    expect(result[2]).toMatchObject({ terminal_name: 'Terminal A', booking_date: '2026-03-29', hour_slot: 9,  container_number: 'ZZZZ9999999', license_plate: 'AA-0001' })
    expect(result[3]).toMatchObject({ terminal_name: 'Terminal A', booking_date: '2026-03-29', hour_slot: 10, container_number: 'AAAA1111111', license_plate: 'AA-0001' })
    expect(result[4]).toMatchObject({ terminal_name: 'Terminal A', booking_date: '2026-03-30', hour_slot: 9,  container_number: 'AAAA1111111', license_plate: 'AA-0001' })
    expect(result[5]).toMatchObject({ terminal_name: 'Terminal B', booking_date: '2026-03-29', hour_slot: 9,  container_number: 'AAAA1111111', license_plate: 'AA-0001' })
  })
})
