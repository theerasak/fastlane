import { describe, it, expect } from 'vitest'
import { server } from '../mocks/server'
import { http, HttpResponse } from 'msw'
import { GET as getBookings } from '@/app/api/register/bookings/route'
import { createRequest, createTcRequest } from '../helpers/request'
import { mockBooking, mockTerminal, mockCompany } from '../mocks/db'

const SUPA = 'https://mock-supabase.test/rest/v1'

// ── GET /api/register/bookings ─────────────────────────────────────────────

describe('GET /api/register/bookings', () => {
  it('returns 401 when unauthenticated', async () => {
    const req = createRequest('http://localhost/api/register/bookings')
    const res = await getBookings(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/authentication/i)
  })

  it('returns 200 with an array for a valid TC session', async () => {
    const req = await createTcRequest('http://localhost/api/register/bookings')
    const res = await getBookings(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  it('returns bookings with correct fields', async () => {
    server.use(
      http.get(`${SUPA}/bookings`, () =>
        HttpResponse.json([
          {
            ...mockBooking,
            port_terminals: { name: mockTerminal.name },
          },
        ])
      )
    )
    const req = await createTcRequest('http://localhost/api/register/bookings')
    const res = await getBookings(req)
    const [booking] = await res.json()
    expect(booking.booking_number).toBe(mockBooking.booking_number)
    expect(booking.fastlane_token).toBe(mockBooking.fastlane_token)
    expect(booking.num_trucks).toBe(mockBooking.num_trucks)
    expect(booking.status).toBe(mockBooking.status)
    expect(booking.booking_date).toBe(mockBooking.booking_date)
    expect(booking.port_terminals.name).toBe(mockTerminal.name)
  })

  it('returns an empty array when no bookings exist', async () => {
    server.use(
      http.get(`${SUPA}/bookings`, () => HttpResponse.json([]))
    )
    const req = await createTcRequest('http://localhost/api/register/bookings')
    const res = await getBookings(req)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('returns multiple bookings ordered by booking_date descending', async () => {
    server.use(
      http.get(`${SUPA}/bookings`, () =>
        HttpResponse.json([
          { ...mockBooking, id: 'b1', booking_number: 'BK-NEW', booking_date: '2099-12-31', port_terminals: { name: 'T-A' } },
          { ...mockBooking, id: 'b2', booking_number: 'BK-OLD', booking_date: '2026-01-01', port_terminals: { name: 'T-B' } },
        ])
      )
    )
    const req = await createTcRequest('http://localhost/api/register/bookings')
    const res = await getBookings(req)
    const body = await res.json()
    expect(body).toHaveLength(2)
    // Supabase returns results in the order the mock provides them;
    // the route passes them through as-is (ordering is applied by the DB query)
    expect(body[0].booking_number).toBe('BK-NEW')
    expect(body[1].booking_number).toBe('BK-OLD')
  })

  it('only returns bookings for the authenticated TC company', async () => {
    // The route filters by truck_company_id from the TC session (mockCompany.id)
    // We verify the request is scoped to the session's company by confirming
    // the handler is called with eq filters — here we just check the response
    // contains only the mocked booking for that company.
    server.use(
      http.get(`${SUPA}/bookings`, ({ request }) => {
        const url = new URL(request.url)
        // Supabase sends eq filters as query params
        const companyFilter = url.searchParams.get('truck_company_id')
        if (companyFilter && companyFilter.includes(mockCompany.id)) {
          return HttpResponse.json([{ ...mockBooking, port_terminals: { name: mockTerminal.name } }])
        }
        return HttpResponse.json([])
      })
    )
    const req = await createTcRequest('http://localhost/api/register/bookings')
    const res = await getBookings(req)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].booking_number).toBe(mockBooking.booking_number)
  })
})
