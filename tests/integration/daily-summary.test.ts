import { describe, it, expect } from 'vitest'
import { server } from '../mocks/server'
import { http, HttpResponse } from 'msw'
import { GET as getDailySummary } from '@/app/api/daily-summary/route'
import { createAuthRequest, createRequest } from '../helpers/request'
import { mockBooking, mockRegistration, mockTerminal, mockCompany } from '../mocks/db'

const SUPA = 'https://mock-supabase.test/rest/v1'
const DATE = '2026-03-29'

const mockTerminalB = {
  id: '00000000-0000-0000-0000-000000000011',
  name: 'Terminal B',
  is_active: true,
}

/** A registration row with embedded bookings + truck_companies + port_terminals as Supabase returns. */
const mockSummaryRow = {
  ...mockRegistration,
  appointment_date: DATE,
  bookings: {
    booking_number: mockBooking.booking_number,
    terminal_id: mockTerminal.id,
    truck_companies: { name: mockCompany.name },
    port_terminals: { id: mockTerminal.id, name: mockTerminal.name },
  },
}

// ── GET /api/daily-summary — auth ─────────────────────────────────────────

describe('GET /api/daily-summary — auth', () => {
  it('returns 403 for unauthenticated request', async () => {
    const req = createRequest(`http://localhost/api/daily-summary?date=${DATE}`)
    const res = await getDailySummary(req)
    expect(res.status).toBe(403)
  })

  it('returns 403 for admin role', async () => {
    const req = await createAuthRequest(`http://localhost/api/daily-summary?date=${DATE}`, { role: 'admin' })
    const res = await getDailySummary(req)
    expect(res.status).toBe(403)
  })

  it('returns 403 for agent role', async () => {
    const req = await createAuthRequest(`http://localhost/api/daily-summary?date=${DATE}`, { role: 'agent' })
    const res = await getDailySummary(req)
    expect(res.status).toBe(403)
  })

  it('returns 200 for supervisor role', async () => {
    server.use(
      http.get(`${SUPA}/fastlane_registrations`, () => HttpResponse.json([]))
    )
    const req = await createAuthRequest(`http://localhost/api/daily-summary?date=${DATE}`, { role: 'supervisor' })
    const res = await getDailySummary(req)
    expect(res.status).toBe(200)
  })
})

// ── GET /api/daily-summary — validation ──────────────────────────────────

describe('GET /api/daily-summary — validation', () => {
  it('returns 400 when date param is missing', async () => {
    const req = await createAuthRequest('http://localhost/api/daily-summary', { role: 'supervisor' })
    const res = await getDailySummary(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/date/i)
  })

  it('returns 400 for an invalid date format', async () => {
    const req = await createAuthRequest('http://localhost/api/daily-summary?date=not-a-date', { role: 'supervisor' })
    const res = await getDailySummary(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/YYYY-MM-DD/i)
  })

  it('returns 400 for a datetime string instead of a date', async () => {
    const req = await createAuthRequest(`http://localhost/api/daily-summary?date=2026-03-29T00:00:00Z`, { role: 'supervisor' })
    const res = await getDailySummary(req)
    expect(res.status).toBe(400)
  })
})

// ── GET /api/daily-summary — data ────────────────────────────────────────

describe('GET /api/daily-summary — data', () => {
  it('returns an empty array when no registrations exist', async () => {
    server.use(
      http.get(`${SUPA}/fastlane_registrations`, () => HttpResponse.json([]))
    )
    const req = await createAuthRequest(`http://localhost/api/daily-summary?date=${DATE}`, { role: 'supervisor' })
    const res = await getDailySummary(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
  })

  it('returns rows with terminal_id and terminal_name fields', async () => {
    server.use(
      http.get(`${SUPA}/fastlane_registrations`, () => HttpResponse.json([mockSummaryRow]))
    )
    const req = await createAuthRequest(`http://localhost/api/daily-summary?date=${DATE}`, { role: 'supervisor' })
    const res = await getDailySummary(req)
    const { data } = await res.json()
    expect(data).toHaveLength(1)
    const row = data[0]
    expect(row.terminal_id).toBe(mockTerminal.id)
    expect(row.terminal_name).toBe(mockTerminal.name)
  })

  it('returns rows with the expected fields including booking_date (mapped from appointment_date)', async () => {
    server.use(
      http.get(`${SUPA}/fastlane_registrations`, () => HttpResponse.json([mockSummaryRow]))
    )
    const req = await createAuthRequest(`http://localhost/api/daily-summary?date=${DATE}`, { role: 'supervisor' })
    const res = await getDailySummary(req)
    const { data } = await res.json()
    expect(data).toHaveLength(1)
    const row = data[0]
    expect(row.booking_date).toBe(DATE)
    expect(row.hour_slot).toBe(mockRegistration.hour_slot)
    expect(row.license_plate).toBe(mockRegistration.license_plate)
    expect(row.container_number).toBe(mockRegistration.container_number)
    expect(row.booking_number).toBe(mockBooking.booking_number)
    expect(row.truck_company_name).toBe(mockCompany.name)
  })

  it('uses em-dash when port_terminals is null', async () => {
    server.use(
      http.get(`${SUPA}/fastlane_registrations`, () =>
        HttpResponse.json([{
          ...mockSummaryRow,
          bookings: { ...mockSummaryRow.bookings, port_terminals: null },
        }])
      )
    )
    const req = await createAuthRequest(`http://localhost/api/daily-summary?date=${DATE}`, { role: 'supervisor' })
    const res = await getDailySummary(req)
    const { data } = await res.json()
    expect(data[0].terminal_name).toBe('—')
  })

  it('uses em-dash fallback for missing truck company name', async () => {
    server.use(
      http.get(`${SUPA}/fastlane_registrations`, () =>
        HttpResponse.json([{
          ...mockSummaryRow,
          bookings: { ...mockSummaryRow.bookings, truck_companies: null },
        }])
      )
    )
    const req = await createAuthRequest(`http://localhost/api/daily-summary?date=${DATE}`, { role: 'supervisor' })
    const res = await getDailySummary(req)
    const { data } = await res.json()
    expect(data[0].truck_company_name).toBe('—')
  })

  it('sorts by terminal_name then hour_slot then container_number then license_plate', async () => {
    const rowB = { ...mockSummaryRow, id: 'r-b', bookings: { ...mockSummaryRow.bookings, port_terminals: { id: mockTerminalB.id, name: 'Terminal B' } } }
    const rows = [
      { ...mockSummaryRow, id: 'r1', hour_slot: 10, container_number: 'ZZZZ9999999', license_plate: 'ZZ-9999' },
      { ...rowB,           id: 'r-b2', hour_slot: 9,  container_number: 'AAAA1111111', license_plate: 'AA-0001' },
      { ...mockSummaryRow, id: 'r2', hour_slot: 9,  container_number: 'MMMM5555555', license_plate: 'AA-0001' },
      { ...mockSummaryRow, id: 'r3', hour_slot: 9,  container_number: 'AAAA1111111', license_plate: 'ZZ-9999' },
      { ...mockSummaryRow, id: 'r4', hour_slot: 9,  container_number: 'AAAA1111111', license_plate: 'AA-0001' },
    ]
    server.use(
      http.get(`${SUPA}/fastlane_registrations`, () => HttpResponse.json(rows))
    )
    const req = await createAuthRequest(`http://localhost/api/daily-summary?date=${DATE}`, { role: 'supervisor' })
    const res = await getDailySummary(req)
    const { data } = await res.json()
    // Terminal A rows come before Terminal B
    expect(data[0].id).toBe('r4')
    expect(data[1].id).toBe('r3')
    expect(data[2].id).toBe('r2')
    expect(data[3].id).toBe('r1')
    expect(data[4].id).toBe('r-b2')
  })

  it('returns multiple rows', async () => {
    const row2 = {
      ...mockSummaryRow,
      id: 'row-2',
      hour_slot: 14,
      license_plate: 'XY-9999',
      container_number: 'WXYZ9876543',
    }
    server.use(
      http.get(`${SUPA}/fastlane_registrations`, () =>
        HttpResponse.json([mockSummaryRow, row2])
      )
    )
    const req = await createAuthRequest(`http://localhost/api/daily-summary?date=${DATE}`, { role: 'supervisor' })
    const res = await getDailySummary(req)
    const { data } = await res.json()
    expect(data).toHaveLength(2)
  })
})

// ── GET /api/daily-summary — terminal_id filter ───────────────────────────

describe('GET /api/daily-summary — terminal_id filter', () => {
  it('passes terminal_id filter to the query when provided', async () => {
    let capturedUrl = ''
    server.use(
      http.get(`${SUPA}/fastlane_registrations`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json([])
      })
    )
    const req = await createAuthRequest(
      `http://localhost/api/daily-summary?date=${DATE}&terminal_id=${mockTerminal.id}`,
      { role: 'supervisor' }
    )
    const res = await getDailySummary(req)
    expect(res.status).toBe(200)
    // Supabase appends the filter as a query param
    expect(capturedUrl).toContain('terminal_id')
  })

  it('returns 200 with empty data when terminal has no registrations', async () => {
    server.use(
      http.get(`${SUPA}/fastlane_registrations`, () => HttpResponse.json([]))
    )
    const req = await createAuthRequest(
      `http://localhost/api/daily-summary?date=${DATE}&terminal_id=${mockTerminalB.id}`,
      { role: 'supervisor' }
    )
    const res = await getDailySummary(req)
    expect(res.status).toBe(200)
    const { data } = await res.json()
    expect(data).toEqual([])
  })

  it('returns 200 without filtering when terminal_id param is absent', async () => {
    server.use(
      http.get(`${SUPA}/fastlane_registrations`, () => HttpResponse.json([mockSummaryRow]))
    )
    const req = await createAuthRequest(
      `http://localhost/api/daily-summary?date=${DATE}`,
      { role: 'supervisor' }
    )
    const res = await getDailySummary(req)
    expect(res.status).toBe(200)
    const { data } = await res.json()
    expect(data).toHaveLength(1)
  })
})
