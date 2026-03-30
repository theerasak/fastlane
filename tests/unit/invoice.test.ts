import { describe, it, expect } from 'vitest'

// ── Pricing config ───────────────────────────────────────────────────────────

import { PRICE_PER_CONTAINER_PRIVILEGED, PRICE_PER_CONTAINER_NON_PRIVILEGED } from '@/lib/config/pricing'

describe('Pricing config', () => {
  it('privileged price is 250 THB', () => {
    expect(PRICE_PER_CONTAINER_PRIVILEGED).toBe(250)
  })

  it('non-privileged price is 500 THB', () => {
    expect(PRICE_PER_CONTAINER_NON_PRIVILEGED).toBe(500)
  })

  it('privileged price is less than non-privileged price', () => {
    expect(PRICE_PER_CONTAINER_PRIVILEGED).toBeLessThan(PRICE_PER_CONTAINER_NON_PRIVILEGED)
  })
})

// ── Amount calculation ───────────────────────────────────────────────────────

describe('Invoice — amount calculation', () => {
  const calcAmount = (numTrucks: number, isPrivileged: boolean) =>
    numTrucks * (isPrivileged ? PRICE_PER_CONTAINER_PRIVILEGED : PRICE_PER_CONTAINER_NON_PRIVILEGED)

  it('calculates 250 THB per container for privileged booking', () => {
    expect(calcAmount(1, true)).toBe(250)
    expect(calcAmount(2, true)).toBe(500)
    expect(calcAmount(4, true)).toBe(1000)
  })

  it('calculates 500 THB per container for non-privileged booking', () => {
    expect(calcAmount(1, false)).toBe(500)
    expect(calcAmount(2, false)).toBe(1000)
    expect(calcAmount(4, false)).toBe(2000)
  })

  it('returns 0 for 0 trucks regardless of privilege', () => {
    expect(calcAmount(0, true)).toBe(0)
    expect(calcAmount(0, false)).toBe(0)
  })
})

// ── Total amount ─────────────────────────────────────────────────────────────

describe('Invoice — total amount', () => {
  const sumAmounts = (rows: { amount: number }[]) =>
    rows.reduce((sum, r) => sum + r.amount, 0)

  it('sums all row amounts', () => {
    expect(sumAmounts([{ amount: 250 }, { amount: 500 }, { amount: 750 }])).toBe(1500)
  })

  it('returns 0 for empty list', () => {
    expect(sumAmounts([])).toBe(0)
  })

  it('handles mixed privileged and non-privileged rows', () => {
    // 2 privileged containers (2×250) + 1 non-privileged container (1×500)
    expect(sumAmounts([{ amount: 500 }, { amount: 500 }])).toBe(1000)
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

// ── Row mapping ──────────────────────────────────────────────────────────────

describe('Invoice — row mapping', () => {
  type RawBooking = {
    id: string
    created_at: string
    booking_number: string
    num_trucks: number
    terminal_id: string
    is_privileged_booking: boolean
    fastlane_token: string | null
    token_cancelled: boolean
    truck_companies: { name: string } | null
    port_terminals: { id: string; name: string } | null
  }

  function mapRow(b: RawBooking) {
    const pricePerContainer = b.is_privileged_booking
      ? PRICE_PER_CONTAINER_PRIVILEGED
      : PRICE_PER_CONTAINER_NON_PRIVILEGED
    return {
      id: b.id,
      created_at: b.created_at,
      terminal_id: b.terminal_id,
      terminal_name: b.port_terminals?.name ?? '—',
      booking_number: b.booking_number,
      truck_company_name: b.truck_companies?.name ?? '—',
      fastlane_token: b.fastlane_token,
      token_cancelled: b.token_cancelled,
      is_privileged_booking: b.is_privileged_booking,
      num_trucks: b.num_trucks,
      price_per_container: pricePerContainer,
      amount: b.num_trucks * pricePerContainer,
    }
  }

  const rawPriv: RawBooking = {
    id: 'bk-001',
    created_at: '2026-03-11T08:00:00Z',
    booking_number: 'BK-001',
    num_trucks: 2,
    terminal_id: 'term-001',
    is_privileged_booking: true,
    fastlane_token: 'TOKEN-001',
    token_cancelled: false,
    truck_companies: { name: 'Alpha Logistics' },
    port_terminals: { id: 'term-001', name: 'Terminal A' },
  }

  const rawNonPriv: RawBooking = { ...rawPriv, id: 'bk-002', is_privileged_booking: false }

  it('maps terminal_id and terminal_name from port_terminals join', () => {
    const row = mapRow(rawPriv)
    expect(row.terminal_id).toBe('term-001')
    expect(row.terminal_name).toBe('Terminal A')
  })

  it('uses em-dash for terminal_name when port_terminals is null', () => {
    const row = mapRow({ ...rawPriv, port_terminals: null })
    expect(row.terminal_name).toBe('—')
  })

  it('uses 250 THB price and correct amount for privileged booking', () => {
    const row = mapRow(rawPriv)
    expect(row.is_privileged_booking).toBe(true)
    expect(row.price_per_container).toBe(250)
    expect(row.amount).toBe(500) // 2 × 250
  })

  it('uses 500 THB price and correct amount for non-privileged booking', () => {
    const row = mapRow(rawNonPriv)
    expect(row.is_privileged_booking).toBe(false)
    expect(row.price_per_container).toBe(500)
    expect(row.amount).toBe(1000) // 2 × 500
  })

  it('maps all other fields correctly', () => {
    const row = mapRow(rawPriv)
    expect(row.id).toBe('bk-001')
    expect(row.booking_number).toBe('BK-001')
    expect(row.truck_company_name).toBe('Alpha Logistics')
    expect(row.num_trucks).toBe(2)
    expect(row.fastlane_token).toBe('TOKEN-001')
    expect(row.token_cancelled).toBe(false)
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
