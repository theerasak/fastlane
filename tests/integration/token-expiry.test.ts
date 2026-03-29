import { describe, it, expect } from 'vitest'
import { server } from '../mocks/server'
import { http, HttpResponse } from 'msw'
import { POST as generateToken } from '@/app/api/bookings/[id]/generate-token/route'
import { GET as getBooking } from '@/app/api/bookings/[id]/route'
import { GET as getRegistration } from '@/app/api/register/[token]/route'
import { createAuthRequest, createTcRequest } from '../helpers/request'
import { mockBooking, mockCompany, mockTerminal } from '../mocks/db'
import { pgrstSingle, pgrstCount } from '../mocks/handlers'

const SUPA = 'https://mock-supabase.test/rest/v1'
const BOOKING_PARAMS = { params: Promise.resolve({ id: mockBooking.id }) }
const TOKEN_PARAMS = { params: Promise.resolve({ token: mockBooking.fastlane_token! }) }

/** Override bookings GET so the token uniqueness check always finds no match (token is unique). */
function allowTokenGeneration() {
  server.use(
    http.get(`${SUPA}/bookings`, ({ request }) => {
      const url = new URL(request.url)
      // Uniqueness check queries by fastlane_token — return null to indicate it's available
      if (url.searchParams.has('fastlane_token')) {
        return HttpResponse.json(null, { status: 200 })
      }
      // All other booking queries (fetch by id etc.) return the mock booking
      if (request.headers.get('Accept')?.includes('vnd.pgrst.object')) {
        return pgrstSingle(mockBooking)
      }
      return HttpResponse.json([mockBooking])
    })
  )
}

// ── POST /api/bookings/[id]/generate-token ─────────────────────────────────

describe('POST /api/bookings/[id]/generate-token — expiry', () => {
  it('returns token_expires_at as a future date', async () => {
    allowTokenGeneration()
    const req = await createAuthRequest(
      `http://localhost/api/bookings/${mockBooking.id}/generate-token`,
      { method: 'POST', role: 'agent' }
    )
    const res = await generateToken(req, BOOKING_PARAMS)
    expect(res.status).toBe(200)
    const { data } = await res.json()
    // token_expires_at must be present and parse as a valid future date
    expect(data.token_expires_at).toBeTruthy()
    expect(new Date(data.token_expires_at).getTime()).toBeGreaterThan(Date.now())
  })

  it('returns 400 when the booking already has active registrations', async () => {
    server.use(
      http.get(`${SUPA}/booking_fill_stats`, ({ request }) => {
        if (request.headers.get('Accept')?.includes('vnd.pgrst.object')) {
          return pgrstSingle({ booking_id: mockBooking.id, active_count: 3 })
        }
        return HttpResponse.json([{ booking_id: mockBooking.id, active_count: 3 }])
      })
    )
    const req = await createAuthRequest(
      `http://localhost/api/bookings/${mockBooking.id}/generate-token`,
      { method: 'POST', role: 'agent' }
    )
    const res = await generateToken(req, BOOKING_PARAMS)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/partially used/i)
  })

  it('allows generation when active_count is 0', async () => {
    allowTokenGeneration()
    server.use(
      http.get(`${SUPA}/booking_fill_stats`, ({ request }) => {
        if (request.headers.get('Accept')?.includes('vnd.pgrst.object')) {
          return pgrstSingle({ booking_id: mockBooking.id, active_count: 0 })
        }
        return HttpResponse.json([{ booking_id: mockBooking.id, active_count: 0 }])
      })
    )
    const req = await createAuthRequest(
      `http://localhost/api/bookings/${mockBooking.id}/generate-token`,
      { method: 'POST', role: 'agent' }
    )
    const res = await generateToken(req, BOOKING_PARAMS)
    expect(res.status).toBe(200)
  })
})

// ── GET /api/bookings/[id] — token_expires_at ─────────────────────────────

describe('GET /api/bookings/[id] — token_expires_at', () => {
  it('includes token_expires_at in the booking response', async () => {
    const req = await createAuthRequest(
      `http://localhost/api/bookings/${mockBooking.id}`,
      { role: 'agent' }
    )
    const res = await getBooking(req, BOOKING_PARAMS)
    expect(res.status).toBe(200)
    const { data } = await res.json()
    // mockBooking has token_expires_at = '2099-01-01T00:00:00Z'
    expect(data).toHaveProperty('token_expires_at')
  })

  it('returns null for token_expires_at when the booking has no token', async () => {
    server.use(
      http.get(`${SUPA}/bookings`, ({ request }) => {
        if (request.headers.get('Accept')?.includes('vnd.pgrst.object')) {
          return pgrstSingle({ ...mockBooking, fastlane_token: null, token_expires_at: null })
        }
        return HttpResponse.json([{ ...mockBooking, fastlane_token: null, token_expires_at: null }])
      })
    )
    const req = await createAuthRequest(
      `http://localhost/api/bookings/${mockBooking.id}`,
      { role: 'agent' }
    )
    const res = await getBooking(req, BOOKING_PARAMS)
    const { data } = await res.json()
    expect(data.token_expires_at).toBeNull()
  })
})

// ── GET /api/register/[token] — expired token ──────────────────────────────

describe('GET /api/register/[token] — expiry enforcement', () => {
  const mockBookingWithTerminal = {
    ...mockBooking,
    port_terminals: { name: mockTerminal.name },
    truck_company_id: mockCompany.id,
  }

  it('returns 410 when the token has expired', async () => {
    server.use(
      http.get(`${SUPA}/bookings`, ({ request }) => {
        if (request.headers.get('Accept')?.includes('vnd.pgrst.object')) {
          return pgrstSingle({ ...mockBookingWithTerminal, token_expires_at: '2020-01-01T00:00:00Z' })
        }
        return HttpResponse.json([{ ...mockBookingWithTerminal, token_expires_at: '2020-01-01T00:00:00Z' }])
      })
    )
    const req = await createTcRequest(
      `http://localhost/api/register/${mockBooking.fastlane_token}`
    )
    const res = await getRegistration(req, TOKEN_PARAMS)
    expect(res.status).toBe(410)
    const body = await res.json()
    expect(body.error).toMatch(/expired/i)
  })

  it('returns 200 when the token has not expired', async () => {
    server.use(
      http.get(`${SUPA}/bookings`, ({ request }) => {
        if (request.headers.get('Accept')?.includes('vnd.pgrst.object')) {
          return pgrstSingle({ ...mockBookingWithTerminal, token_expires_at: '2099-01-01T00:00:00Z' })
        }
        return HttpResponse.json([{ ...mockBookingWithTerminal, token_expires_at: '2099-01-01T00:00:00Z' }])
      })
    )
    const req = await createTcRequest(
      `http://localhost/api/register/${mockBooking.fastlane_token}`
    )
    const res = await getRegistration(req, TOKEN_PARAMS)
    expect(res.status).toBe(200)
  })

  it('returns 200 when token_expires_at is null (legacy token with no expiry)', async () => {
    server.use(
      http.get(`${SUPA}/bookings`, ({ request }) => {
        if (request.headers.get('Accept')?.includes('vnd.pgrst.object')) {
          return pgrstSingle({ ...mockBookingWithTerminal, token_expires_at: null })
        }
        return HttpResponse.json([{ ...mockBookingWithTerminal, token_expires_at: null }])
      })
    )
    const req = await createTcRequest(
      `http://localhost/api/register/${mockBooking.fastlane_token}`
    )
    const res = await getRegistration(req, TOKEN_PARAMS)
    expect(res.status).toBe(200)
  })
})
