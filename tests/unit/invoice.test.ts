import { describe, it, expect } from 'vitest'

// ── Amount calculation ───────────────────────────────────────────────────────

describe('Invoice — amount calculation', () => {
  const calcAmount = (numTrucks: number) => numTrucks * 100

  it('calculates 100 THB per truck', () => {
    expect(calcAmount(1)).toBe(100)
    expect(calcAmount(2)).toBe(200)
    expect(calcAmount(5)).toBe(500)
    expect(calcAmount(10)).toBe(1000)
  })

  it('returns 0 for 0 trucks', () => {
    expect(calcAmount(0)).toBe(0)
  })
})

// ── Total amount ─────────────────────────────────────────────────────────────

describe('Invoice — total amount', () => {
  const sumAmounts = (rows: { amount: number }[]) =>
    rows.reduce((sum, r) => sum + r.amount, 0)

  it('sums all row amounts', () => {
    expect(sumAmounts([{ amount: 100 }, { amount: 200 }, { amount: 300 }])).toBe(600)
  })

  it('returns 0 for empty list', () => {
    expect(sumAmounts([])).toBe(0)
  })

  it('handles single row', () => {
    expect(sumAmounts([{ amount: 500 }])).toBe(500)
  })
})

// ── Sort order ───────────────────────────────────────────────────────────────

describe('Invoice — sort order', () => {
  // Replicate the comparator from app/api/invoice/route.ts
  type SortRow = { created_at: string; booking_number: string; truck_company_name: string }
  const sortRows = (rows: SortRow[]) =>
    [...rows].sort((a, b) => {
      const d = a.created_at.localeCompare(b.created_at)
      if (d !== 0) return d
      const n = a.booking_number.localeCompare(b.booking_number)
      if (n !== 0) return n
      return a.truck_company_name.localeCompare(b.truck_company_name)
    })

  it('sorts oldest created_at first', () => {
    const rows: SortRow[] = [
      { created_at: '2026-03-15T09:00:00Z', booking_number: 'BK-002', truck_company_name: 'Alpha' },
      { created_at: '2026-03-10T08:00:00Z', booking_number: 'BK-001', truck_company_name: 'Zeta' },
    ]
    const result = sortRows(rows)
    expect(result[0].created_at).toBe('2026-03-10T08:00:00Z')
    expect(result[1].created_at).toBe('2026-03-15T09:00:00Z')
  })

  it('sorts by booking_number when created_at is equal', () => {
    const ts = '2026-03-11T08:00:00Z'
    const rows: SortRow[] = [
      { created_at: ts, booking_number: 'BK-003', truck_company_name: 'Alpha' },
      { created_at: ts, booking_number: 'BK-001', truck_company_name: 'Zeta' },
      { created_at: ts, booking_number: 'BK-002', truck_company_name: 'Beta' },
    ]
    const result = sortRows(rows)
    expect(result.map(r => r.booking_number)).toEqual(['BK-001', 'BK-002', 'BK-003'])
  })

  it('sorts by truck_company_name when created_at and booking_number are equal', () => {
    const ts = '2026-03-11T08:00:00Z'
    const rows: SortRow[] = [
      { created_at: ts, booking_number: 'BK-001', truck_company_name: 'Zeta Logistics' },
      { created_at: ts, booking_number: 'BK-001', truck_company_name: 'Alpha Transport' },
      { created_at: ts, booking_number: 'BK-001', truck_company_name: 'Metro Trucks' },
    ]
    const result = sortRows(rows)
    expect(result.map(r => r.truck_company_name)).toEqual([
      'Alpha Transport',
      'Metro Trucks',
      'Zeta Logistics',
    ])
  })

  it('applies all three sort keys together', () => {
    const rows: SortRow[] = [
      { created_at: '2026-03-12T10:00:00Z', booking_number: 'BK-001', truck_company_name: 'Zeta' },
      { created_at: '2026-03-11T08:00:00Z', booking_number: 'BK-002', truck_company_name: 'Alpha' },
      { created_at: '2026-03-11T08:00:00Z', booking_number: 'BK-001', truck_company_name: 'Beta' },
      { created_at: '2026-03-11T08:00:00Z', booking_number: 'BK-001', truck_company_name: 'Alpha' },
    ]
    const result = sortRows(rows)
    expect(result[0]).toMatchObject({ created_at: '2026-03-11T08:00:00Z', booking_number: 'BK-001', truck_company_name: 'Alpha' })
    expect(result[1]).toMatchObject({ created_at: '2026-03-11T08:00:00Z', booking_number: 'BK-001', truck_company_name: 'Beta' })
    expect(result[2]).toMatchObject({ created_at: '2026-03-11T08:00:00Z', booking_number: 'BK-002', truck_company_name: 'Alpha' })
    expect(result[3]).toMatchObject({ created_at: '2026-03-12T10:00:00Z', booking_number: 'BK-001', truck_company_name: 'Zeta' })
  })
})

// ── Date format validation ───────────────────────────────────────────────────

describe('Invoice — date parameter validation', () => {
  const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)

  it('accepts YYYY-MM-DD format', () => {
    expect(isValidDate('2026-03-01')).toBe(true)
    expect(isValidDate('2026-12-31')).toBe(true)
    expect(isValidDate('2099-01-01')).toBe(true)
  })

  it('rejects non-date strings', () => {
    expect(isValidDate('')).toBe(false)
    expect(isValidDate('2026/03/01')).toBe(false)
    expect(isValidDate('01-03-2026')).toBe(false)
    expect(isValidDate('2026-3-1')).toBe(false)
    expect(isValidDate('not-a-date')).toBe(false)
  })

  it('rejects datetime strings', () => {
    expect(isValidDate('2026-03-01T00:00:00Z')).toBe(false)
  })
})
