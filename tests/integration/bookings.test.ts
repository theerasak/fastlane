import { describe, it, expect } from 'vitest'
import { GET as getBookings, POST as createBooking } from '@/app/api/bookings/route'
import { GET as getBooking, PATCH as patchBooking } from '@/app/api/bookings/[id]/route'
import { createAuthRequest, createRequest } from '../helpers/request'
import { mockBooking, mockTerminal, mockCompany } from '../mocks/db'

// ── GET /api/bookings ─────────────────────────────────────────────────────────

describe('GET /api/bookings', () => {
  it('returns 200 with booking list for admin', async () => {
    const req = await createAuthRequest('http://localhost/api/bookings', { role: 'admin' })
    const res = await getBookings(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data[0].booking_number).toBe(mockBooking.booking_number)
  })

  it('returns 200 with booking list for agent', async () => {
    const req = await createAuthRequest('http://localhost/api/bookings', { role: 'agent' })
    const res = await getBookings(req)
    expect(res.status).toBe(200)
  })

  it('returns 403 for supervisor', async () => {
    const req = await createAuthRequest('http://localhost/api/bookings', { role: 'supervisor' })
    const res = await getBookings(req)
    expect(res.status).toBe(403)
  })

  it('returns 403 for unauthenticated request', async () => {
    const req = createRequest('http://localhost/api/bookings')
    const res = await getBookings(req)
    expect(res.status).toBe(403)
  })
})

// ── POST /api/bookings ────────────────────────────────────────────────────────

describe('POST /api/bookings', () => {
  const newBooking = {
    booking_number: 'BK-NEW-001',
    terminal_id: mockTerminal.id,
    truck_company_id: mockCompany.id,
    num_trucks: 2,
  }

  it('creates a booking as admin', async () => {
    const req = await createAuthRequest('http://localhost/api/bookings', {
      role: 'admin',
      method: 'POST',
      body: newBooking,
    })
    const res = await createBooking(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.booking_number).toBe(mockBooking.booking_number) // mock returns mockBooking
  })

  it('creates a booking as agent', async () => {
    const req = await createAuthRequest('http://localhost/api/bookings', {
      role: 'agent',
      method: 'POST',
      body: newBooking,
    })
    const res = await createBooking(req)
    expect(res.status).toBe(201)
  })

  it('returns 403 for supervisor', async () => {
    const req = await createAuthRequest('http://localhost/api/bookings', {
      role: 'supervisor',
      method: 'POST',
      body: newBooking,
    })
    const res = await createBooking(req)
    expect(res.status).toBe(403)
  })

  it('returns 400 for missing required fields', async () => {
    const req = await createAuthRequest('http://localhost/api/bookings', {
      role: 'admin',
      method: 'POST',
      body: { booking_number: 'BK-001' }, // missing terminal_id, truck_company_id, num_trucks
    })
    const res = await createBooking(req)
    expect(res.status).toBe(400)
  })
})

// ── GET /api/bookings/[id] ────────────────────────────────────────────────────

describe('GET /api/bookings/[id]', () => {
  it('returns booking detail for admin', async () => {
    const req = await createAuthRequest(`http://localhost/api/bookings/${mockBooking.id}`, {
      role: 'admin',
    })
    const res = await getBooking(req, { params: Promise.resolve({ id: mockBooking.id }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.id).toBe(mockBooking.id)
  })

  it('returns 403 for supervisor', async () => {
    const req = await createAuthRequest(`http://localhost/api/bookings/${mockBooking.id}`, {
      role: 'supervisor',
    })
    const res = await getBooking(req, { params: Promise.resolve({ id: mockBooking.id }) })
    expect(res.status).toBe(403)
  })
})

// ── PATCH /api/bookings/[id] ──────────────────────────────────────────────────

describe('PATCH /api/bookings/[id]', () => {
  it('updates booking status for admin', async () => {
    const req = await createAuthRequest(`http://localhost/api/bookings/${mockBooking.id}`, {
      role: 'admin',
      method: 'PATCH',
      body: { status: 'BOOKED' },
    })
    const res = await patchBooking(req, { params: Promise.resolve({ id: mockBooking.id }) })
    expect(res.status).toBe(200)
  })

  it('returns 403 for supervisor', async () => {
    const req = await createAuthRequest(`http://localhost/api/bookings/${mockBooking.id}`, {
      role: 'supervisor',
      method: 'PATCH',
      body: { status: 'CLOSED' },
    })
    const res = await patchBooking(req, { params: Promise.resolve({ id: mockBooking.id }) })
    expect(res.status).toBe(403)
  })
})
