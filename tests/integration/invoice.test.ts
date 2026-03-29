import { describe, it, expect } from 'vitest'
import { server } from '../mocks/server'
import { http, HttpResponse } from 'msw'
import { GET as getInvoice } from '@/app/api/invoice/route'
import { createAuthRequest, createRequest } from '../helpers/request'
import { mockPrivilegedAgent, mockCompany } from '../mocks/db'
import { pgrstSingle, pgrstNotFound } from '../mocks/handlers'

const SUPA = 'https://mock-supabase.test/rest/v1'

// Booking rows returned by the mock for the privileged agent
const mockInvoiceBookings = [
  {
    id: 'inv-b-001',
    created_at: '2026-03-11T08:00:00Z',
    booking_number: 'BK-INV-001',
    num_trucks: 2,
    fastlane_token: 'TOKEN-001',
    token_cancelled: false,
    truck_companies: { name: 'Alpha Logistics' },
  },
  {
    id: 'inv-b-002',
    created_at: '2026-03-12T09:00:00Z',
    booking_number: 'BK-INV-002',
    num_trucks: 3,
    fastlane_token: null,
    token_cancelled: false,
    truck_companies: { name: 'Zeta Transport' },
  },
]

// ── GET /api/invoice ──────────────────────────────────────────────────────────

describe('GET /api/invoice — auth guards', () => {
  it('returns 403 for unauthenticated request', async () => {
    const req = createRequest('http://localhost/api/invoice?from_date=2026-03-01&to_date=2026-03-31')
    const res = await getInvoice(req)
    expect(res.status).toBe(403)
  })

  it('returns 403 for admin role', async () => {
    const req = await createAuthRequest(
      'http://localhost/api/invoice?from_date=2026-03-01&to_date=2026-03-31',
      { role: 'admin' }
    )
    const res = await getInvoice(req)
    expect(res.status).toBe(403)
  })

  it('returns 403 for supervisor role', async () => {
    const req = await createAuthRequest(
      'http://localhost/api/invoice?from_date=2026-03-01&to_date=2026-03-31',
      { role: 'supervisor' }
    )
    const res = await getInvoice(req)
    expect(res.status).toBe(403)
  })

  it('returns 403 for non-privileged agent', async () => {
    // Default users handler returns mockAdmin (is_privileged: false) for single lookups
    const req = await createAuthRequest(
      'http://localhost/api/invoice?from_date=2026-03-01&to_date=2026-03-31',
      { role: 'agent' }
    )
    const res = await getInvoice(req)
    expect(res.status).toBe(403)
  })
})

describe('GET /api/invoice — input validation', () => {
  beforeEach(() => {
    server.use(
      http.get(`${SUPA}/users`, ({ request }) => {
        const accept = request.headers.get('Accept') ?? ''
        if (accept.includes('vnd.pgrst.object')) return pgrstSingle(mockPrivilegedAgent)
        return HttpResponse.json([mockPrivilegedAgent])
      })
    )
  })

  it('returns 400 when from_date is missing', async () => {
    const req = await createAuthRequest(
      `http://localhost/api/invoice?to_date=2026-03-31`,
      { role: 'agent', userId: mockPrivilegedAgent.id }
    )
    const res = await getInvoice(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/from_date/)
  })

  it('returns 400 when to_date is missing', async () => {
    const req = await createAuthRequest(
      `http://localhost/api/invoice?from_date=2026-03-01`,
      { role: 'agent', userId: mockPrivilegedAgent.id }
    )
    const res = await getInvoice(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/to_date/)
  })

  it('returns 400 for invalid date format', async () => {
    const req = await createAuthRequest(
      `http://localhost/api/invoice?from_date=01-03-2026&to_date=2026-03-31`,
      { role: 'agent', userId: mockPrivilegedAgent.id }
    )
    const res = await getInvoice(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/YYYY-MM-DD/)
  })
})

describe('GET /api/invoice — successful responses', () => {
  beforeEach(() => {
    server.use(
      http.get(`${SUPA}/users`, ({ request }) => {
        const accept = request.headers.get('Accept') ?? ''
        if (accept.includes('vnd.pgrst.object')) return pgrstSingle(mockPrivilegedAgent)
        return HttpResponse.json([mockPrivilegedAgent])
      }),
      http.get(`${SUPA}/bookings`, () => HttpResponse.json(mockInvoiceBookings))
    )
  })

  it('returns 200 with invoice rows for privileged agent', async () => {
    const req = await createAuthRequest(
      `http://localhost/api/invoice?from_date=2026-03-01&to_date=2026-03-31`,
      { role: 'agent', userId: mockPrivilegedAgent.id }
    )
    const res = await getInvoice(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data).toHaveLength(2)
  })

  it('calculates amount as num_trucks × 100', async () => {
    const req = await createAuthRequest(
      `http://localhost/api/invoice?from_date=2026-03-01&to_date=2026-03-31`,
      { role: 'agent', userId: mockPrivilegedAgent.id }
    )
    const res = await getInvoice(req)
    const body = await res.json()
    const row0 = body.data.find((r: { booking_number: string }) => r.booking_number === 'BK-INV-001')
    const row1 = body.data.find((r: { booking_number: string }) => r.booking_number === 'BK-INV-002')
    expect(row0.amount).toBe(200)  // 2 trucks × 100
    expect(row1.amount).toBe(300)  // 3 trucks × 100
  })

  it('returns rows sorted oldest created_at first', async () => {
    const req = await createAuthRequest(
      `http://localhost/api/invoice?from_date=2026-03-01&to_date=2026-03-31`,
      { role: 'agent', userId: mockPrivilegedAgent.id }
    )
    const res = await getInvoice(req)
    const body = await res.json()
    expect(body.data[0].booking_number).toBe('BK-INV-001')
    expect(body.data[1].booking_number).toBe('BK-INV-002')
  })

  it('returns correct shape for each row', async () => {
    const req = await createAuthRequest(
      `http://localhost/api/invoice?from_date=2026-03-01&to_date=2026-03-31`,
      { role: 'agent', userId: mockPrivilegedAgent.id }
    )
    const res = await getInvoice(req)
    const body = await res.json()
    const row = body.data[0]
    expect(row).toHaveProperty('id')
    expect(row).toHaveProperty('created_at')
    expect(row).toHaveProperty('booking_number')
    expect(row).toHaveProperty('truck_company_name')
    expect(row).toHaveProperty('fastlane_token')
    expect(row).toHaveProperty('token_cancelled')
    expect(row).toHaveProperty('num_trucks')
    expect(row).toHaveProperty('amount')
  })

  it('uses — for missing truck company name', async () => {
    server.use(
      http.get(`${SUPA}/bookings`, () =>
        HttpResponse.json([
          { ...mockInvoiceBookings[0], truck_companies: null },
        ])
      )
    )
    const req = await createAuthRequest(
      `http://localhost/api/invoice?from_date=2026-03-01&to_date=2026-03-31`,
      { role: 'agent', userId: mockPrivilegedAgent.id }
    )
    const res = await getInvoice(req)
    const body = await res.json()
    expect(body.data[0].truck_company_name).toBe('—')
  })
})

describe('GET /api/invoice — empty result', () => {
  beforeEach(() => {
    server.use(
      http.get(`${SUPA}/users`, ({ request }) => {
        const accept = request.headers.get('Accept') ?? ''
        if (accept.includes('vnd.pgrst.object')) return pgrstSingle(mockPrivilegedAgent)
        return HttpResponse.json([mockPrivilegedAgent])
      }),
      http.get(`${SUPA}/bookings`, () => HttpResponse.json([]))
    )
  })

  it('returns empty array when no bookings in range', async () => {
    const req = await createAuthRequest(
      `http://localhost/api/invoice?from_date=2020-01-01&to_date=2020-01-31`,
      { role: 'agent', userId: mockPrivilegedAgent.id }
    )
    const res = await getInvoice(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
  })
})
