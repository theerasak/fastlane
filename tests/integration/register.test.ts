import { describe, it, expect } from 'vitest'
import { server } from '../mocks/server'
import { http, HttpResponse } from 'msw'
import { POST as addPlate, PATCH as editPlate, DELETE as deletePlate } from '@/app/api/register/[token]/plates/route'
import { createTcRequest, createRequest } from '../helpers/request'
import { mockBooking, mockRegistration, mockSlotCapacity } from '../mocks/db'
import { pgrstNotFound, pgrstSingle } from '../mocks/handlers'

const TOKEN = mockBooking.fastlane_token
const PARAMS = { params: Promise.resolve({ token: TOKEN }) }

// Future booking date so deadline checks pass
const FUTURE_BOOKING_DATE = '2099-12-31'

// ── POST /api/register/[token]/plates ─────────────────────────────────────────

describe('POST /api/register/[token]/plates', () => {
  it('adds a plate and returns 201', async () => {
    const req = await createTcRequest(`http://localhost/api/register/${TOKEN}/plates`, {
      method: 'POST',
      body: { license_plate: 'AB-1234', hour_slot: 9 },
    })
    const res = await addPlate(req, PARAMS)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.license_plate).toBe(mockRegistration.license_plate)
  })

  it('returns 401 for unauthenticated request', async () => {
    const req = createRequest(`http://localhost/api/register/${TOKEN}/plates`, {
      method: 'POST',
      body: { license_plate: 'AB-1234', hour_slot: 9 },
    })
    const res = await addPlate(req, PARAMS)
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid license plate', async () => {
    const req = await createTcRequest(`http://localhost/api/register/${TOKEN}/plates`, {
      method: 'POST',
      body: { license_plate: '', hour_slot: 9 },
    })
    const res = await addPlate(req, PARAMS)
    expect(res.status).toBe(400)
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
      body: { license_plate: 'AB-1234', hour_slot: 9 },
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
      body: { license_plate: 'AB-1234', hour_slot: 9 },
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
      body: { license_plate: 'XY-9999', hour_slot: 9 },
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
      body: { license_plate: 'XY-9999', hour_slot: 9 },
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
