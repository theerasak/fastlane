/**
 * Unit tests for the "disabled truck company" business rules:
 *
 * Rule 1 — Visibility: agents only see active truck companies.
 *           Admins see all (active + inactive).
 *
 * Rule 2 — Booking guard: a booking cannot be created for a disabled
 *           truck company, regardless of the caller's role.
 *
 * These tests mock at the module level (vi.mock) so they verify the
 * route handlers' own logic, independent of HTTP / MSW infrastructure.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Module mocks (hoisted by Vitest) ──────────────────────────────────────

const mockGetSession = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/auth/session', () => ({ getSession: mockGetSession }))
vi.mock('@/lib/audit', () => ({ writeAuditLog: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/supabase/server', () => ({
  getServerClient: () => ({ from: mockFrom }),
}))

// Import route handlers after mocks are registered
const { GET: getTruckCompanies } = await import('@/app/api/truck-companies/route')
const { POST: createBooking } = await import('@/app/api/bookings/route')

// ── Helpers ───────────────────────────────────────────────────────────────

function makeReq(url: string, init?: RequestInit) {
  return new NextRequest(url, init)
}

const AGENT_SESSION = { id: 'agent-id', email: 'agent@test.com', role: 'agent' }
const ADMIN_SESSION = { id: 'admin-id', email: 'admin@test.com', role: 'admin' }

const ACTIVE_COMPANY = { id: '00000000-0000-0000-0000-000000000020', name: 'Active Co', is_active: true }
const INACTIVE_COMPANY = { id: '00000000-0000-0000-0000-000000000021', name: 'Disabled Co', is_active: false }
const MOCK_BOOKING = {
  id: '00000000-0000-0000-0000-000000000100',
  booking_number: 'BK-001',
  terminal_id: '00000000-0000-0000-0000-000000000010',
  truck_company_id: ACTIVE_COMPANY.id,
  num_trucks: 1,
  fastlane_token: null,
  token_cancelled: false,
  status: 'FILLING-IN',
  created_at: '2026-03-22T00:00:00Z',
  booked_at: null,
  closed_at: null,
}

// ── Rule 1: Truck company visibility ─────────────────────────────────────

describe('Rule 1 — Truck company visibility by role', () => {
  let mockEq: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()

    // Build a query chain where .order() returns a thenable that also
    // exposes .eq() for the agent branch.
    const queryResult = { data: [ACTIVE_COMPANY], error: null }
    mockEq = vi.fn().mockResolvedValue(queryResult)

    // Make the object returned by .order() both awaitable (for admin)
    // and chainable with .eq() (for agent).
    const orderResult = {
      eq: mockEq,
      then: (resolve: Parameters<Promise<unknown>['then']>[0], reject?: Parameters<Promise<unknown>['then']>[1]) =>
        Promise.resolve(queryResult).then(resolve, reject),
    }

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue(orderResult),
      }),
    })
  })

  it('agent: query applies is_active=true filter', async () => {
    mockGetSession.mockResolvedValue(AGENT_SESSION)
    await getTruckCompanies(makeReq('http://localhost/api/truck-companies'))
    expect(mockEq).toHaveBeenCalledWith('is_active', true)
  })

  it('admin: query does NOT apply is_active filter (returns all companies)', async () => {
    mockGetSession.mockResolvedValue(ADMIN_SESSION)
    await getTruckCompanies(makeReq('http://localhost/api/truck-companies'))
    expect(mockEq).not.toHaveBeenCalled()
  })

  it('agent: response is 200 and only contains the filtered data', async () => {
    mockGetSession.mockResolvedValue(AGENT_SESSION)
    const res = await getTruckCompanies(makeReq('http://localhost/api/truck-companies'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.data)).toBe(true)
  })

  it('admin: response is 200', async () => {
    mockGetSession.mockResolvedValue(ADMIN_SESSION)
    const res = await getTruckCompanies(makeReq('http://localhost/api/truck-companies'))
    expect(res.status).toBe(200)
  })

  it('unauthenticated: returns 403 without querying the DB', async () => {
    mockGetSession.mockResolvedValue(null)
    const res = await getTruckCompanies(makeReq('http://localhost/api/truck-companies'))
    expect(res.status).toBe(403)
    expect(mockFrom).not.toHaveBeenCalled()
  })
})

// ── Rule 2: Booking guard for disabled companies ──────────────────────────

describe('Rule 2 — Booking cannot be assigned to a disabled truck company', () => {
  const BOOKING_BODY = {
    booking_number: 'BK-TEST-001',
    terminal_id: '00000000-0000-0000-0000-000000000010',
    truck_company_id: INACTIVE_COMPANY.id,
    num_trucks: 2,
  }

  function setupCompanyMock(company: { is_active: boolean } | null) {
    const singleCompany = vi.fn().mockResolvedValue({ data: company, error: null })
    const singleBooking = vi.fn().mockResolvedValue({ data: MOCK_BOOKING, error: null })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'truck_companies') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ single: singleCompany }),
          }),
        }
      }
      // bookings table (only reached if company check passes)
      return {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ single: singleBooking }),
        }),
      }
    })

    return { singleCompany, singleBooking }
  }

  function postReq(body: object) {
    return makeReq('http://localhost/api/bookings', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 when the selected company is disabled (is_active=false)', async () => {
    mockGetSession.mockResolvedValue(AGENT_SESSION)
    setupCompanyMock(INACTIVE_COMPANY)

    const res = await createBooking(postReq(BOOKING_BODY))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/disabled/i)
  })

  it('returns 400 when the company is disabled, even if caller is admin', async () => {
    mockGetSession.mockResolvedValue(ADMIN_SESSION)
    setupCompanyMock(INACTIVE_COMPANY)

    const res = await createBooking(postReq({ ...BOOKING_BODY, truck_company_id: INACTIVE_COMPANY.id }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/disabled/i)
  })

  it('returns 400 when the company does not exist (null from DB)', async () => {
    mockGetSession.mockResolvedValue(AGENT_SESSION)
    setupCompanyMock(null)

    const res = await createBooking(postReq(BOOKING_BODY))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/disabled/i)
  })

  it('does NOT insert the booking when the company is disabled', async () => {
    mockGetSession.mockResolvedValue(AGENT_SESSION)
    const { singleBooking } = setupCompanyMock(INACTIVE_COMPANY)

    await createBooking(postReq(BOOKING_BODY))
    // The booking insert must never be reached
    expect(singleBooking).not.toHaveBeenCalled()
  })

  it('proceeds and returns 201 when the company is active', async () => {
    mockGetSession.mockResolvedValue(AGENT_SESSION)
    setupCompanyMock(ACTIVE_COMPANY)

    const res = await createBooking(postReq({ ...BOOKING_BODY, truck_company_id: ACTIVE_COMPANY.id }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.booking_number).toBe(MOCK_BOOKING.booking_number)
  })

  it('proceeds and returns 201 for admin with an active company', async () => {
    mockGetSession.mockResolvedValue(ADMIN_SESSION)
    setupCompanyMock(ACTIVE_COMPANY)

    const res = await createBooking(postReq({ ...BOOKING_BODY, truck_company_id: ACTIVE_COMPANY.id }))
    expect(res.status).toBe(201)
  })
})
