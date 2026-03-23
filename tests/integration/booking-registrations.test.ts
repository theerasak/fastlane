import { describe, it, expect } from 'vitest'
import { server } from '../mocks/server'
import { http, HttpResponse } from 'msw'
import {
  GET as getRegistrations,
  POST as addRegistration,
  PATCH as editRegistration,
  DELETE as deleteRegistration,
} from '@/app/api/bookings/[id]/registrations/route'
import { createAuthRequest } from '../helpers/request'
import { mockBooking, mockRegistration } from '../mocks/db'
import { pgrstSingle, pgrstNotFound, pgrstCount } from '../mocks/handlers'

const SUPA = 'https://mock-supabase.test/rest/v1'
const BOOKING_ID = mockBooking.id
const REG_ID = mockRegistration.id
const routeParams = { params: Promise.resolve({ id: BOOKING_ID }) }

// ── GET /api/bookings/[id]/registrations ─────────────────────────────────────

describe('GET /api/bookings/[id]/registrations', () => {
  it('returns 200 with registration list for admin', async () => {
    server.use(
      http.get(`${SUPA}/fastlane_registrations`, () =>
        HttpResponse.json([mockRegistration])
      )
    )
    const req = await createAuthRequest(
      `http://localhost/api/bookings/${BOOKING_ID}/registrations`,
      { role: 'admin' }
    )
    const res = await getRegistrations(req, routeParams)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data[0].license_plate).toBe(mockRegistration.license_plate)
  })

  it('returns 403 for agent', async () => {
    const req = await createAuthRequest(
      `http://localhost/api/bookings/${BOOKING_ID}/registrations`,
      { role: 'agent' }
    )
    const res = await getRegistrations(req, routeParams)
    expect(res.status).toBe(403)
  })

  it('returns 403 for supervisor', async () => {
    const req = await createAuthRequest(
      `http://localhost/api/bookings/${BOOKING_ID}/registrations`,
      { role: 'supervisor' }
    )
    const res = await getRegistrations(req, routeParams)
    expect(res.status).toBe(403)
  })

  it('returns 401 for unauthenticated request', async () => {
    const { createRequest } = await import('../helpers/request')
    const req = createRequest(`http://localhost/api/bookings/${BOOKING_ID}/registrations`)
    const res = await getRegistrations(req, routeParams)
    expect(res.status).toBe(401)
  })

  it('returns empty array when booking has no registrations', async () => {
    const req = await createAuthRequest(
      `http://localhost/api/bookings/${BOOKING_ID}/registrations`,
      { role: 'admin' }
    )
    const res = await getRegistrations(req, routeParams)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
  })
})

// ── POST /api/bookings/[id]/registrations ────────────────────────────────────

describe('POST /api/bookings/[id]/registrations', () => {
  it('adds a registration as admin and returns 201', async () => {
    server.use(
      http.get(`${SUPA}/bookings`, ({ request }) => {
        if (request.headers.get('Accept')?.includes('vnd.pgrst.object')) {
          return pgrstSingle({ ...mockBooking, status: 'FILLING-IN' })
        }
        return HttpResponse.json([mockBooking])
      }),
      http.head(`${SUPA}/fastlane_registrations`, () => pgrstCount(1))
    )
    const req = await createAuthRequest(
      `http://localhost/api/bookings/${BOOKING_ID}/registrations`,
      {
        role: 'admin',
        method: 'POST',
        body: { license_plate: 'XY-9999', container_number: 'ABCD1234567', hour_slot: 10 },
      }
    )
    const res = await addRegistration(req, routeParams)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data).toHaveProperty('license_plate')
  })

  it('returns 403 for agent', async () => {
    const req = await createAuthRequest(
      `http://localhost/api/bookings/${BOOKING_ID}/registrations`,
      { role: 'agent', method: 'POST', body: { license_plate: 'XY-9999', container_number: 'ABCD1234567', hour_slot: 10 } }
    )
    const res = await addRegistration(req, routeParams)
    expect(res.status).toBe(403)
  })

  it('returns 400 when booking is CLOSED', async () => {
    server.use(
      http.get(`${SUPA}/bookings`, ({ request }) => {
        if (request.headers.get('Accept')?.includes('vnd.pgrst.object')) {
          return pgrstSingle({ ...mockBooking, status: 'CLOSED' })
        }
        return HttpResponse.json([mockBooking])
      })
    )
    const req = await createAuthRequest(
      `http://localhost/api/bookings/${BOOKING_ID}/registrations`,
      {
        role: 'admin',
        method: 'POST',
        body: { license_plate: 'ZZ-0001', container_number: 'ABCD1234567', hour_slot: 8 },
      }
    )
    const res = await addRegistration(req, routeParams)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/closed/i)
  })

  it('returns 404 when booking does not exist', async () => {
    server.use(
      http.get(`${SUPA}/bookings`, ({ request }) => {
        if (request.headers.get('Accept')?.includes('vnd.pgrst.object')) {
          return pgrstNotFound()
        }
        return HttpResponse.json([])
      })
    )
    const req = await createAuthRequest(
      `http://localhost/api/bookings/${BOOKING_ID}/registrations`,
      {
        role: 'admin',
        method: 'POST',
        body: { license_plate: 'ZZ-0002', container_number: 'ABCD1234567', hour_slot: 8 },
      }
    )
    const res = await addRegistration(req, routeParams)
    expect(res.status).toBe(404)
  })

  it('returns 400 for missing license_plate', async () => {
    const req = await createAuthRequest(
      `http://localhost/api/bookings/${BOOKING_ID}/registrations`,
      {
        role: 'admin',
        method: 'POST',
        body: { hour_slot: 10 },
      }
    )
    const res = await addRegistration(req, routeParams)
    expect(res.status).toBe(400)
  })

  it('auto-transitions booking to BOOKED when count reaches num_trucks', async () => {
    // num_trucks=1, so inserting 1 registration should trigger status update
    let bookingUpdated = false
    server.use(
      http.get(`${SUPA}/bookings`, ({ request }) => {
        if (request.headers.get('Accept')?.includes('vnd.pgrst.object')) {
          return pgrstSingle({ ...mockBooking, status: 'FILLING-IN', num_trucks: 1 })
        }
        return HttpResponse.json([mockBooking])
      }),
      http.head(`${SUPA}/fastlane_registrations`, () => pgrstCount(1)),
      http.patch(`${SUPA}/bookings`, async () => {
        bookingUpdated = true
        return pgrstSingle({ ...mockBooking, status: 'BOOKED' })
      })
    )
    const req = await createAuthRequest(
      `http://localhost/api/bookings/${BOOKING_ID}/registrations`,
      {
        role: 'admin',
        method: 'POST',
        body: { license_plate: 'AA-0001', container_number: 'ABCD1234567', hour_slot: 9 },
      }
    )
    const res = await addRegistration(req, routeParams)
    expect(res.status).toBe(201)
    expect(bookingUpdated).toBe(true)
  })

  it('does NOT auto-transition when count is below num_trucks', async () => {
    let bookingUpdated = false
    server.use(
      http.get(`${SUPA}/bookings`, ({ request }) => {
        if (request.headers.get('Accept')?.includes('vnd.pgrst.object')) {
          return pgrstSingle({ ...mockBooking, status: 'FILLING-IN', num_trucks: 3 })
        }
        return HttpResponse.json([mockBooking])
      }),
      http.head(`${SUPA}/fastlane_registrations`, () => pgrstCount(1)),
      http.patch(`${SUPA}/bookings`, async () => {
        bookingUpdated = true
        return pgrstSingle(mockBooking)
      })
    )
    const req = await createAuthRequest(
      `http://localhost/api/bookings/${BOOKING_ID}/registrations`,
      {
        role: 'admin',
        method: 'POST',
        body: { license_plate: 'BB-0001', container_number: 'ABCD1234567', hour_slot: 9 },
      }
    )
    const res = await addRegistration(req, routeParams)
    expect(res.status).toBe(201)
    expect(bookingUpdated).toBe(false)
  })
})

// ── PATCH /api/bookings/[id]/registrations ───────────────────────────────────

describe('PATCH /api/bookings/[id]/registrations', () => {
  const patchUrl = `http://localhost/api/bookings/${BOOKING_ID}/registrations?id=${REG_ID}`

  it('updates license_plate for admin', async () => {
    server.use(
      http.patch(`${SUPA}/fastlane_registrations`, () =>
        pgrstSingle({ ...mockRegistration, license_plate: 'NEW-9999' })
      )
    )
    const req = await createAuthRequest(patchUrl, {
      role: 'admin',
      method: 'PATCH',
      body: { license_plate: 'NEW-9999' },
    })
    const res = await editRegistration(req, routeParams)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.license_plate).toBe('NEW-9999')
  })

  it('updates hour_slot for admin', async () => {
    server.use(
      http.patch(`${SUPA}/fastlane_registrations`, () =>
        pgrstSingle({ ...mockRegistration, hour_slot: 14 })
      )
    )
    const req = await createAuthRequest(patchUrl, {
      role: 'admin',
      method: 'PATCH',
      body: { hour_slot: 14 },
    })
    const res = await editRegistration(req, routeParams)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.hour_slot).toBe(14)
  })

  it('returns 400 when missing registration id query param', async () => {
    const req = await createAuthRequest(
      `http://localhost/api/bookings/${BOOKING_ID}/registrations`,
      { role: 'admin', method: 'PATCH', body: { license_plate: 'XY-1111' } }
    )
    const res = await editRegistration(req, routeParams)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/missing registration id/i)
  })

  it('returns 403 for agent', async () => {
    const req = await createAuthRequest(patchUrl, {
      role: 'agent',
      method: 'PATCH',
      body: { license_plate: 'XY-1111' },
    })
    const res = await editRegistration(req, routeParams)
    expect(res.status).toBe(403)
  })
})

// ── DELETE /api/bookings/[id]/registrations ──────────────────────────────────

describe('DELETE /api/bookings/[id]/registrations', () => {
  const deleteUrl = `http://localhost/api/bookings/${BOOKING_ID}/registrations?id=${REG_ID}`

  it('soft-deletes registration for admin', async () => {
    server.use(
      http.head(`${SUPA}/fastlane_registrations`, () => pgrstCount(1)),
      http.get(`${SUPA}/bookings`, ({ request }) => {
        if (request.headers.get('Accept')?.includes('vnd.pgrst.object')) {
          return pgrstSingle({ ...mockBooking, status: 'BOOKED', num_trucks: 2 })
        }
        return HttpResponse.json([mockBooking])
      })
    )
    const req = await createAuthRequest(deleteUrl, {
      role: 'admin',
      method: 'DELETE',
    })
    const res = await deleteRegistration(req, routeParams)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toBeNull()
  })

  it('returns 400 when missing registration id query param', async () => {
    const req = await createAuthRequest(
      `http://localhost/api/bookings/${BOOKING_ID}/registrations`,
      { role: 'admin', method: 'DELETE' }
    )
    const res = await deleteRegistration(req, routeParams)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/missing registration id/i)
  })

  it('returns 403 for agent', async () => {
    const req = await createAuthRequest(deleteUrl, {
      role: 'agent',
      method: 'DELETE',
    })
    const res = await deleteRegistration(req, routeParams)
    expect(res.status).toBe(403)
  })

  it('returns 403 for supervisor', async () => {
    const req = await createAuthRequest(deleteUrl, {
      role: 'supervisor',
      method: 'DELETE',
    })
    const res = await deleteRegistration(req, routeParams)
    expect(res.status).toBe(403)
  })

  it('reverts booking to FILLING-IN when count drops below num_trucks', async () => {
    let bookingReverted = false
    server.use(
      http.head(`${SUPA}/fastlane_registrations`, () => pgrstCount(0)),
      http.get(`${SUPA}/bookings`, ({ request }) => {
        if (request.headers.get('Accept')?.includes('vnd.pgrst.object')) {
          return pgrstSingle({ ...mockBooking, status: 'BOOKED', num_trucks: 1 })
        }
        return HttpResponse.json([mockBooking])
      }),
      http.patch(`${SUPA}/bookings`, async () => {
        bookingReverted = true
        return pgrstSingle({ ...mockBooking, status: 'FILLING-IN' })
      })
    )
    const req = await createAuthRequest(deleteUrl, {
      role: 'admin',
      method: 'DELETE',
    })
    const res = await deleteRegistration(req, routeParams)
    expect(res.status).toBe(200)
    expect(bookingReverted).toBe(true)
  })

  it('does NOT revert booking when status is not BOOKED', async () => {
    let bookingPatched = false
    server.use(
      http.head(`${SUPA}/fastlane_registrations`, () => pgrstCount(0)),
      http.get(`${SUPA}/bookings`, ({ request }) => {
        if (request.headers.get('Accept')?.includes('vnd.pgrst.object')) {
          return pgrstSingle({ ...mockBooking, status: 'FILLING-IN', num_trucks: 2 })
        }
        return HttpResponse.json([mockBooking])
      }),
      http.patch(`${SUPA}/bookings`, async () => {
        bookingPatched = true
        return pgrstSingle(mockBooking)
      })
    )
    const req = await createAuthRequest(deleteUrl, {
      role: 'admin',
      method: 'DELETE',
    })
    const res = await deleteRegistration(req, routeParams)
    expect(res.status).toBe(200)
    expect(bookingPatched).toBe(false)
  })
})
