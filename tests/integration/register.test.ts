import { describe, it, expect } from 'vitest'
import { server } from '../mocks/server'
import { http, HttpResponse } from 'msw'
import { GET as getBooking, PATCH as updateBookingDate } from '@/app/api/register/[token]/route'
import { POST as addPlate, PATCH as editPlate, DELETE as deletePlate } from '@/app/api/register/[token]/plates/route'
import { createTcRequest, createRequest } from '../helpers/request'
import { mockBooking, mockRegistration, mockSlotCapacity, mockCompany } from '../mocks/db'
import { pgrstNotFound, pgrstSingle } from '../mocks/handlers'

const TOKEN = mockBooking.fastlane_token
const PARAMS = { params: Promise.resolve({ token: TOKEN }) }

// Future booking date so deadline checks pass
const FUTURE_BOOKING_DATE = '2099-12-31'
// Past booking date so deadline checks fail
const PAST_BOOKING_DATE = '2020-01-01'

// ── POST /api/register/[token]/plates ─────────────────────────────────────────

describe('POST /api/register/[token]/plates', () => {
  it('adds a plate and returns 201', async () => {
    const req = await createTcRequest(`http://localhost/api/register/${TOKEN}/plates`, {
      method: 'POST',
      body: { license_plate: 'AB-1234', container_number: 'ABCD1234567', hour_slot: 9 },
    })
    const res = await addPlate(req, PARAMS)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.license_plate).toBe(mockRegistration.license_plate)
  })

  it('returns 401 for unauthenticated request', async () => {
    const req = createRequest(`http://localhost/api/register/${TOKEN}/plates`, {
      method: 'POST',
      body: { license_plate: 'AB-1234', container_number: 'ABCD1234567', hour_slot: 9 },
    })
    const res = await addPlate(req, PARAMS)
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid license plate', async () => {
    const req = await createTcRequest(`http://localhost/api/register/${TOKEN}/plates`, {
      method: 'POST',
      body: { license_plate: '', container_number: 'ABCD1234567', hour_slot: 9 },
    })
    const res = await addPlate(req, PARAMS)
    expect(res.status).toBe(400)
  })

  it('returns 400 when container_number is missing', async () => {
    const req = await createTcRequest(`http://localhost/api/register/${TOKEN}/plates`, {
      method: 'POST',
      body: { license_plate: 'AB-1234', hour_slot: 9 },
    })
    const res = await addPlate(req, PARAMS)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid container_number format (too short)', async () => {
    const req = await createTcRequest(`http://localhost/api/register/${TOKEN}/plates`, {
      method: 'POST',
      body: { license_plate: 'AB-1234', container_number: 'ABC123', hour_slot: 9 },
    })
    const res = await addPlate(req, PARAMS)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid container_number format (digits before letters)', async () => {
    const req = await createTcRequest(`http://localhost/api/register/${TOKEN}/plates`, {
      method: 'POST',
      body: { license_plate: 'AB-1234', container_number: '1234ABCD567', hour_slot: 9 },
    })
    const res = await addPlate(req, PARAMS)
    expect(res.status).toBe(400)
  })

  it('returns 201 and includes container_number in response', async () => {
    const req = await createTcRequest(`http://localhost/api/register/${TOKEN}/plates`, {
      method: 'POST',
      body: { license_plate: 'AB-1234', container_number: 'ABCD1234567', hour_slot: 9 },
    })
    const res = await addPlate(req, PARAMS)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.container_number).toBe('ABCD1234567')
  })

  it('returns 400 for invalid hour_slot', async () => {
    const req = await createTcRequest(`http://localhost/api/register/${TOKEN}/plates`, {
      method: 'POST',
      body: { license_plate: 'AB-1234', hour_slot: 24 },
    })
    const res = await addPlate(req, PARAMS)
    expect(res.status).toBe(400)
  })

  it('returns 404 for unknown token', async () => {
    server.use(
      http.get('https://mock-supabase.test/rest/v1/bookings', () => pgrstNotFound())
    )
    const req = await createTcRequest('http://localhost/api/register/UNKNOWN/plates', {
      method: 'POST',
      body: { license_plate: 'AB-1234', container_number: 'ABCD1234567', hour_slot: 9 },
    })
    const res = await addPlate(req, { params: Promise.resolve({ token: 'UNKNOWN' }) })
    expect(res.status).toBe(404)
  })

  it('returns 403 for cancelled token', async () => {
    server.use(
      http.get('https://mock-supabase.test/rest/v1/bookings', () =>
        pgrstSingle({ ...mockBooking, token_cancelled: true })
      )
    )
    const req = await createTcRequest(`http://localhost/api/register/${TOKEN}/plates`, {
      method: 'POST',
      body: { license_plate: 'AB-1234', container_number: 'ABCD1234567', hour_slot: 9 },
    })
    const res = await addPlate(req, PARAMS)
    expect(res.status).toBe(403)
  })

  it('returns 409 MAX_REACHED when all trucks are registered', async () => {
    // booking has num_trucks=2, override HEAD count to return 2
    server.use(
      http.head('https://mock-supabase.test/rest/v1/fastlane_registrations', () =>
        new HttpResponse(null, {
          status: 200,
          headers: { 'Content-Range': '*/2' }, // count = 2 = num_trucks
        })
      )
    )
    const req = await createTcRequest(`http://localhost/api/register/${TOKEN}/plates`, {
      method: 'POST',
      body: { license_plate: 'XY-9999', container_number: 'ABCD1234567', hour_slot: 9 },
    })
    const res = await addPlate(req, PARAMS)
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe('MAX_REACHED')
  })

  it('returns 409 SLOT_FULL when slot capacity is 0', async () => {
    server.use(
      http.get('https://mock-supabase.test/rest/v1/slot_remaining_capacity', () =>
        pgrstSingle({ ...mockSlotCapacity[9], remaining_capacity_privileged: 0, remaining_capacity_non_privileged: 0 })
      )
    )
    const req = await createTcRequest(`http://localhost/api/register/${TOKEN}/plates`, {
      method: 'POST',
      body: { license_plate: 'XY-9999', container_number: 'ABCD1234567', hour_slot: 9 },
    })
    const res = await addPlate(req, PARAMS)
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe('SLOT_FULL')
  })
})

// ── PATCH /api/register/[token]/plates ───────────────────────────────────────

describe('PATCH /api/register/[token]/plates', () => {
  it('edits a plate and returns 200', async () => {
    // Use future booking_date so 1h deadline check passes
    server.use(
      http.get('https://mock-supabase.test/rest/v1/bookings', () =>
        pgrstSingle({ ...mockBooking, booking_date: FUTURE_BOOKING_DATE })
      ),
      http.get('https://mock-supabase.test/rest/v1/fastlane_registrations', () =>
        pgrstSingle({ ...mockRegistration })
      )
    )
    const url = `http://localhost/api/register/${TOKEN}/plates?id=${mockRegistration.id}`
    const req = await createTcRequest(url, {
      method: 'PATCH',
      body: { license_plate: 'NE-9999' },
    })
    const res = await editPlate(req, PARAMS)
    expect(res.status).toBe(200)
  })

  it('returns 401 for unauthenticated request', async () => {
    const url = `http://localhost/api/register/${TOKEN}/plates?id=${mockRegistration.id}`
    const req = createRequest(url, {
      method: 'PATCH',
      body: { license_plate: 'NE-9999' },
    })
    const res = await editPlate(req, PARAMS)
    expect(res.status).toBe(401)
  })

  it('returns 400 when id param is missing', async () => {
    const req = await createTcRequest(`http://localhost/api/register/${TOKEN}/plates`, {
      method: 'PATCH',
      body: { license_plate: 'NE-9999' },
    })
    const res = await editPlate(req, PARAMS)
    expect(res.status).toBe(400)
  })
})

// ── DELETE /api/register/[token]/plates ──────────────────────────────────────

describe('DELETE /api/register/[token]/plates', () => {
  it('soft-deletes a plate and returns 200', async () => {
    const url = `http://localhost/api/register/${TOKEN}/plates?id=${mockRegistration.id}`
    const req = await createTcRequest(url, { method: 'DELETE' })
    const res = await deletePlate(req, PARAMS)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('returns 401 for unauthenticated request', async () => {
    const url = `http://localhost/api/register/${TOKEN}/plates?id=${mockRegistration.id}`
    const req = createRequest(url, { method: 'DELETE' })
    const res = await deletePlate(req, PARAMS)
    expect(res.status).toBe(401)
  })

  it('returns 400 when id param is missing', async () => {
    const req = await createTcRequest(`http://localhost/api/register/${TOKEN}/plates`, {
      method: 'DELETE',
    })
    const res = await deletePlate(req, PARAMS)
    expect(res.status).toBe(400)
  })
})

// ── GET /api/register/[token] ─────────────────────────────────────────────

describe('GET /api/register/[token]', () => {
  it('returns booking info for authenticated TC session', async () => {
    const req = await createTcRequest(`http://localhost/api/register/${TOKEN}`)
    const res = await getBooking(req, PARAMS)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.booking_number).toBe(mockBooking.booking_number)
    expect(body.data.num_trucks).toBe(mockBooking.num_trucks)
    expect(body.data.booking_date).toBe(mockBooking.booking_date)
    expect(Array.isArray(body.data.slot_availability)).toBe(true)
  })

  it('returns 401 for unauthenticated request', async () => {
    const req = createRequest(`http://localhost/api/register/${TOKEN}`)
    const res = await getBooking(req, PARAMS)
    expect(res.status).toBe(401)
  })

  it('returns 404 for unknown token', async () => {
    server.use(
      http.get('https://mock-supabase.test/rest/v1/bookings', () => pgrstNotFound())
    )
    const req = await createTcRequest('http://localhost/api/register/UNKNOWN')
    const res = await getBooking(req, { params: Promise.resolve({ token: 'UNKNOWN' }) })
    expect(res.status).toBe(404)
  })

  it('returns 403 when booking belongs to a different company', async () => {
    server.use(
      http.get('https://mock-supabase.test/rest/v1/bookings', () =>
        pgrstSingle({ ...mockBooking, truck_company_id: '00000000-0000-0000-0000-000000009999' })
      )
    )
    const req = await createTcRequest(`http://localhost/api/register/${TOKEN}`)
    const res = await getBooking(req, PARAMS)
    expect(res.status).toBe(403)
  })

  it('maps slot availability from non-privileged pool for non-privileged booking', async () => {
    // mockBooking.is_privileged_booking = false by default
    const req = await createTcRequest(`http://localhost/api/register/${TOKEN}`)
    const res = await getBooking(req, PARAMS)
    expect(res.status).toBe(200)
    const body = await res.json()
    const slot9 = body.data.slot_availability.find((s: { hour_slot: number }) => s.hour_slot === 9)
    expect(slot9?.remaining_capacity).toBe(mockSlotCapacity[9].remaining_capacity_non_privileged)
  })

  it('maps slot availability from privileged pool for privileged booking', async () => {
    server.use(
      http.get('https://mock-supabase.test/rest/v1/bookings', () =>
        pgrstSingle({ ...mockBooking, is_privileged_booking: true })
      )
    )
    const req = await createTcRequest(`http://localhost/api/register/${TOKEN}`)
    const res = await getBooking(req, PARAMS)
    expect(res.status).toBe(200)
    const body = await res.json()
    const slot9 = body.data.slot_availability.find((s: { hour_slot: number }) => s.hour_slot === 9)
    expect(slot9?.remaining_capacity).toBe(mockSlotCapacity[9].remaining_capacity_privileged)
  })

  it('includes is_privileged_booking flag in response', async () => {
    server.use(
      http.get('https://mock-supabase.test/rest/v1/bookings', () =>
        pgrstSingle({ ...mockBooking, is_privileged_booking: true })
      )
    )
    const req = await createTcRequest(`http://localhost/api/register/${TOKEN}`)
    const res = await getBooking(req, PARAMS)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.is_privileged_booking).toBe(true)
  })
})

// ── PATCH /api/register/[token] (booking date) ────────────────────────────

describe('PATCH /api/register/[token] (booking date)', () => {
  it('updates booking_date and returns 200', async () => {
    server.use(
      http.patch('https://mock-supabase.test/rest/v1/bookings', () =>
        pgrstSingle({ id: mockBooking.id, booking_date: FUTURE_BOOKING_DATE })
      )
    )
    const req = await createTcRequest(`http://localhost/api/register/${TOKEN}`, {
      method: 'PATCH',
      body: { booking_date: FUTURE_BOOKING_DATE },
    })
    const res = await updateBookingDate(req, PARAMS)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.booking_date).toBe(FUTURE_BOOKING_DATE)
  })

  it('returns 401 for unauthenticated request', async () => {
    const req = createRequest(`http://localhost/api/register/${TOKEN}`, {
      method: 'PATCH',
      body: { booking_date: FUTURE_BOOKING_DATE },
    })
    const res = await updateBookingDate(req, PARAMS)
    expect(res.status).toBe(401)
  })

  it('returns 400 for a past date', async () => {
    const req = await createTcRequest(`http://localhost/api/register/${TOKEN}`, {
      method: 'PATCH',
      body: { booking_date: PAST_BOOKING_DATE },
    })
    const res = await updateBookingDate(req, PARAMS)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid date format', async () => {
    const req = await createTcRequest(`http://localhost/api/register/${TOKEN}`, {
      method: 'PATCH',
      body: { booking_date: '31/12/2099' },
    })
    const res = await updateBookingDate(req, PARAMS)
    expect(res.status).toBe(400)
  })

  it('returns 403 for a cancelled token', async () => {
    server.use(
      http.get('https://mock-supabase.test/rest/v1/bookings', () =>
        pgrstSingle({ ...mockBooking, token_cancelled: true })
      )
    )
    const req = await createTcRequest(`http://localhost/api/register/${TOKEN}`, {
      method: 'PATCH',
      body: { booking_date: FUTURE_BOOKING_DATE },
    })
    const res = await updateBookingDate(req, PARAMS)
    expect(res.status).toBe(403)
  })

  it('returns 403 when booking belongs to a different company', async () => {
    server.use(
      http.get('https://mock-supabase.test/rest/v1/bookings', () =>
        pgrstSingle({ ...mockBooking, truck_company_id: '00000000-0000-0000-0000-000000009999' })
      )
    )
    const req = await createTcRequest(`http://localhost/api/register/${TOKEN}`, {
      method: 'PATCH',
      body: { booking_date: FUTURE_BOOKING_DATE },
    })
    const res = await updateBookingDate(req, PARAMS)
    expect(res.status).toBe(403)
  })
})

// ── Time restriction tests for PATCH plates ───────────────────────────────

describe('PATCH /api/register/[token]/plates — time restrictions', () => {
  it('returns 409 DEADLINE_PASSED when changing slot within 12h', async () => {
    // booking_date in the past → deadline check fails for slot change
    server.use(
      http.get('https://mock-supabase.test/rest/v1/bookings', () =>
        pgrstSingle({ ...mockBooking, booking_date: PAST_BOOKING_DATE, truck_company_id: mockCompany.id })
      ),
      http.get('https://mock-supabase.test/rest/v1/fastlane_registrations', () =>
        pgrstSingle({ ...mockRegistration })
      )
    )
    const url = `http://localhost/api/register/${TOKEN}/plates?id=${mockRegistration.id}`
    const req = await createTcRequest(url, {
      method: 'PATCH',
      body: { hour_slot: 10 }, // changing to a different slot
    })
    const res = await editPlate(req, PARAMS)
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe('DEADLINE_PASSED')
  })

  it('returns 409 DEADLINE_PASSED when changing plate within 1h of slot', async () => {
    // booking_date in the past → 1h deadline check fails for plate-only change
    server.use(
      http.get('https://mock-supabase.test/rest/v1/bookings', () =>
        pgrstSingle({ ...mockBooking, booking_date: PAST_BOOKING_DATE, truck_company_id: mockCompany.id })
      ),
      http.get('https://mock-supabase.test/rest/v1/fastlane_registrations', () =>
        pgrstSingle({ ...mockRegistration })
      )
    )
    const url = `http://localhost/api/register/${TOKEN}/plates?id=${mockRegistration.id}`
    const req = await createTcRequest(url, {
      method: 'PATCH',
      body: { license_plate: 'NE-9999' }, // plate-only change
    })
    const res = await editPlate(req, PARAMS)
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe('DEADLINE_PASSED')
  })

  it('allows plate change when >1h before slot', async () => {
    // Future booking date → deadline passes
    server.use(
      http.get('https://mock-supabase.test/rest/v1/bookings', () =>
        pgrstSingle({ ...mockBooking, booking_date: FUTURE_BOOKING_DATE, truck_company_id: mockCompany.id })
      ),
      http.get('https://mock-supabase.test/rest/v1/fastlane_registrations', () =>
        pgrstSingle({ ...mockRegistration })
      )
    )
    const url = `http://localhost/api/register/${TOKEN}/plates?id=${mockRegistration.id}`
    const req = await createTcRequest(url, {
      method: 'PATCH',
      body: { license_plate: 'NE-9999' },
    })
    const res = await editPlate(req, PARAMS)
    expect(res.status).toBe(200)
  })

  it('allows slot change when >12h before slot', async () => {
    server.use(
      http.get('https://mock-supabase.test/rest/v1/bookings', () =>
        pgrstSingle({ ...mockBooking, booking_date: FUTURE_BOOKING_DATE, truck_company_id: mockCompany.id })
      ),
      http.get('https://mock-supabase.test/rest/v1/fastlane_registrations', () =>
        pgrstSingle({ ...mockRegistration })
      )
    )
    const url = `http://localhost/api/register/${TOKEN}/plates?id=${mockRegistration.id}`
    const req = await createTcRequest(url, {
      method: 'PATCH',
      body: { hour_slot: 10 }, // changing slot, well in advance
    })
    const res = await editPlate(req, PARAMS)
    expect(res.status).toBe(200)
  })

  it('returns 409 DEADLINE_PASSED when changing container_number within 12h', async () => {
    server.use(
      http.get('https://mock-supabase.test/rest/v1/bookings', () =>
        pgrstSingle({ ...mockBooking, booking_date: PAST_BOOKING_DATE, truck_company_id: mockCompany.id })
      ),
      http.get('https://mock-supabase.test/rest/v1/fastlane_registrations', () =>
        pgrstSingle({ ...mockRegistration })
      )
    )
    const url = `http://localhost/api/register/${TOKEN}/plates?id=${mockRegistration.id}`
    const req = await createTcRequest(url, {
      method: 'PATCH',
      body: { container_number: 'ZZZZ9999999' },
    })
    const res = await editPlate(req, PARAMS)
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe('DEADLINE_PASSED')
  })

  it('allows container_number change when >12h before slot', async () => {
    server.use(
      http.get('https://mock-supabase.test/rest/v1/bookings', () =>
        pgrstSingle({ ...mockBooking, booking_date: FUTURE_BOOKING_DATE, truck_company_id: mockCompany.id })
      ),
      http.get('https://mock-supabase.test/rest/v1/fastlane_registrations', () =>
        pgrstSingle({ ...mockRegistration })
      ),
      http.patch('https://mock-supabase.test/rest/v1/fastlane_registrations', () =>
        pgrstSingle({ ...mockRegistration, container_number: 'ZZZZ9999999' })
      )
    )
    const url = `http://localhost/api/register/${TOKEN}/plates?id=${mockRegistration.id}`
    const req = await createTcRequest(url, {
      method: 'PATCH',
      body: { container_number: 'ZZZZ9999999' },
    })
    const res = await editPlate(req, PARAMS)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.container_number).toBe('ZZZZ9999999')
  })

  it('allows plate change but blocks container_number change in same request within 12h', async () => {
    // Within 12h: plate change (also past 1h) blocked, container_number blocked
    server.use(
      http.get('https://mock-supabase.test/rest/v1/bookings', () =>
        pgrstSingle({ ...mockBooking, booking_date: PAST_BOOKING_DATE, truck_company_id: mockCompany.id })
      ),
      http.get('https://mock-supabase.test/rest/v1/fastlane_registrations', () =>
        pgrstSingle({ ...mockRegistration })
      )
    )
    const url = `http://localhost/api/register/${TOKEN}/plates?id=${mockRegistration.id}`
    const req = await createTcRequest(url, {
      method: 'PATCH',
      body: { license_plate: 'NE-9999', container_number: 'ZZZZ9999999' },
    })
    const res = await editPlate(req, PARAMS)
    // container_number check happens first — 409 DEADLINE_PASSED
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('DEADLINE_PASSED')
  })
})
