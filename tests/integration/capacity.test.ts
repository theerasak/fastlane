import { describe, it, expect } from 'vitest'
import { server } from '../mocks/server'
import { http, HttpResponse } from 'msw'
import { GET as getCapacity, PATCH as patchCapacity } from '@/app/api/capacity/[terminalId]/[date]/route'
import { createAuthRequest, createRequest } from '../helpers/request'
import { mockTerminal, mockSlots, BOOKING_DATE } from '../mocks/db'

const SUPA = 'https://mock-supabase.test/rest/v1'

// Future date so PATCH date-validation always passes
const FUTURE_DATE = '2099-12-31'

const GET_PARAMS = {
  params: Promise.resolve({ terminalId: mockTerminal.id, date: BOOKING_DATE }),
}

const PATCH_PARAMS = {
  params: Promise.resolve({ terminalId: mockTerminal.id, date: FUTURE_DATE }),
}

// ── GET /api/capacity/[terminalId]/[date] ─────────────────────────────────────

describe('GET /api/capacity/[terminalId]/[date]', () => {
  it('returns 24 slots for supervisor', async () => {
    const req = await createAuthRequest(
      `http://localhost/api/capacity/${mockTerminal.id}/${BOOKING_DATE}`,
      { role: 'supervisor' }
    )
    const res = await getCapacity(req, GET_PARAMS)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.data)).toBe(true)
  })

  it('returns 24 slots for admin', async () => {
    const req = await createAuthRequest(
      `http://localhost/api/capacity/${mockTerminal.id}/${BOOKING_DATE}`,
      { role: 'admin' }
    )
    const res = await getCapacity(req, GET_PARAMS)
    expect(res.status).toBe(200)
  })

  it('slots include split capacity fields', async () => {
    const req = await createAuthRequest(
      `http://localhost/api/capacity/${mockTerminal.id}/${BOOKING_DATE}`,
      { role: 'supervisor' }
    )
    const res = await getCapacity(req, GET_PARAMS)
    expect(res.status).toBe(200)
    const body = await res.json()
    const slot = body.data[0]
    expect(slot).toHaveProperty('capacity_privileged')
    expect(slot).toHaveProperty('capacity_non_privileged')
    expect(slot).toHaveProperty('used_count_privileged')
    expect(slot).toHaveProperty('used_count_non_privileged')
  })

  it('returns 401 for unauthenticated request', async () => {
    const req = createRequest(
      `http://localhost/api/capacity/${mockTerminal.id}/${BOOKING_DATE}`
    )
    const res = await getCapacity(req, GET_PARAMS)
    expect(res.status).toBe(401)
  })

  it('returns 404 when terminal does not exist', async () => {
    server.use(
      http.get(`${SUPA}/port_terminals`, () =>
        HttpResponse.json(
          { code: 'PGRST116', message: 'no rows', details: '', hint: null },
          { status: 406 }
        )
      )
    )
    const req = await createAuthRequest(
      `http://localhost/api/capacity/nonexistent-id/${BOOKING_DATE}`,
      { role: 'supervisor' }
    )
    const res = await getCapacity(req, {
      params: Promise.resolve({ terminalId: 'nonexistent-id', date: BOOKING_DATE }),
    })
    expect(res.status).toBe(404)
  })
})

// ── PATCH /api/capacity/[terminalId]/[date] ───────────────────────────────────

describe('PATCH /api/capacity/[terminalId]/[date]', () => {
  const validBody = {
    hour_slot: 9,
    capacity_privileged: 3,
    capacity_non_privileged: 2,
    last_updated_at: mockSlots[9].last_updated_at,
  }

  it('updates capacity for supervisor', async () => {
    server.use(
      http.get(`${SUPA}/terminal_capacity`, () =>
        HttpResponse.json({
          id: mockSlots[9].id,
          capacity_privileged: 3,
          capacity_non_privileged: 2,
          last_updated_at: mockSlots[9].last_updated_at,
        })
      )
    )
    const req = await createAuthRequest(
      `http://localhost/api/capacity/${mockTerminal.id}/${FUTURE_DATE}`,
      { role: 'supervisor', method: 'PATCH', body: validBody }
    )
    const res = await patchCapacity(req, PATCH_PARAMS)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.capacity_privileged).toBe(3)
    expect(body.data.capacity_non_privileged).toBe(2)
  })

  it('returns 403 for agent', async () => {
    const req = await createAuthRequest(
      `http://localhost/api/capacity/${mockTerminal.id}/${FUTURE_DATE}`,
      { role: 'agent', method: 'PATCH', body: validBody }
    )
    const res = await patchCapacity(req, PATCH_PARAMS)
    expect(res.status).toBe(403)
  })

  it('returns 400 when date is in the past', async () => {
    const req = await createAuthRequest(
      `http://localhost/api/capacity/${mockTerminal.id}/${BOOKING_DATE}`,
      { role: 'supervisor', method: 'PATCH', body: validBody }
    )
    const res = await patchCapacity(req, {
      params: Promise.resolve({ terminalId: mockTerminal.id, date: BOOKING_DATE }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/past/i)
  })

  it('returns 400 when privileged capacity is below current usage', async () => {
    server.use(
      http.get(`${SUPA}/terminal_capacity`, () =>
        HttpResponse.json({
          id: mockSlots[9].id,
          capacity_privileged: 3,
          capacity_non_privileged: 2,
          last_updated_at: mockSlots[9].last_updated_at,
        })
      ),
      http.get(`${SUPA}/slot_remaining_capacity`, () =>
        HttpResponse.json({
          used_count_privileged: 2,
          used_count_non_privileged: 0,
          remaining_capacity_privileged: 1,
          remaining_capacity_non_privileged: 2,
        })
      )
    )
    const req = await createAuthRequest(
      `http://localhost/api/capacity/${mockTerminal.id}/${FUTURE_DATE}`,
      {
        role: 'supervisor',
        method: 'PATCH',
        body: { ...validBody, capacity_privileged: 1, capacity_non_privileged: 2 }, // 1 < 2 used
      }
    )
    const res = await patchCapacity(req, PATCH_PARAMS)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/privileged capacity/i)
  })

  it('returns 400 when non-privileged capacity is below current usage', async () => {
    server.use(
      http.get(`${SUPA}/terminal_capacity`, () =>
        HttpResponse.json({
          id: mockSlots[9].id,
          capacity_privileged: 3,
          capacity_non_privileged: 2,
          last_updated_at: mockSlots[9].last_updated_at,
        })
      ),
      http.get(`${SUPA}/slot_remaining_capacity`, () =>
        HttpResponse.json({
          used_count_privileged: 0,
          used_count_non_privileged: 3,
          remaining_capacity_privileged: 3,
          remaining_capacity_non_privileged: -1,
        })
      )
    )
    const req = await createAuthRequest(
      `http://localhost/api/capacity/${mockTerminal.id}/${FUTURE_DATE}`,
      {
        role: 'supervisor',
        method: 'PATCH',
        body: { ...validBody, capacity_privileged: 3, capacity_non_privileged: 2 }, // 2 < 3 used
      }
    )
    const res = await patchCapacity(req, PATCH_PARAMS)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/non-privileged capacity/i)
  })

  it('returns 409 on optimistic lock conflict', async () => {
    server.use(
      http.get(`${SUPA}/terminal_capacity`, () =>
        HttpResponse.json({
          id: mockSlots[9].id,
          capacity_privileged: 3,
          capacity_non_privileged: 2,
          last_updated_at: '2099-12-31T10:00:00Z', // different from sent value
        })
      )
    )

    const req = await createAuthRequest(
      `http://localhost/api/capacity/${mockTerminal.id}/${FUTURE_DATE}`,
      {
        role: 'supervisor',
        method: 'PATCH',
        body: { ...validBody, last_updated_at: mockSlots[9].last_updated_at }, // stale value
      }
    )
    const res = await patchCapacity(req, PATCH_PARAMS)
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe('CONFLICT')
    expect(typeof body.current_capacity_privileged).toBe('number')
    expect(typeof body.current_capacity_non_privileged).toBe('number')
  })

  it('force=true bypasses optimistic lock', async () => {
    server.use(
      http.get(`${SUPA}/terminal_capacity`, () =>
        HttpResponse.json({
          id: mockSlots[9].id,
          capacity_privileged: 3,
          capacity_non_privileged: 2,
          last_updated_at: '2099-12-31T10:00:00Z',
        })
      )
    )

    const req = await createAuthRequest(
      `http://localhost/api/capacity/${mockTerminal.id}/${FUTURE_DATE}`,
      {
        role: 'supervisor',
        method: 'PATCH',
        body: { ...validBody, last_updated_at: mockSlots[9].last_updated_at, force: true },
      }
    )
    const res = await patchCapacity(req, PATCH_PARAMS)
    expect(res.status).toBe(200)
  })

  it('returns 400 for invalid capacity value', async () => {
    const req = await createAuthRequest(
      `http://localhost/api/capacity/${mockTerminal.id}/${FUTURE_DATE}`,
      {
        role: 'supervisor',
        method: 'PATCH',
        body: { hour_slot: 9, capacity_privileged: -1, capacity_non_privileged: 2, last_updated_at: mockSlots[9].last_updated_at },
      }
    )
    const res = await patchCapacity(req, PATCH_PARAMS)
    expect(res.status).toBe(400)
  })
})
