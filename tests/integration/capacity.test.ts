import { describe, it, expect } from 'vitest'
import { server } from '../mocks/server'
import { http, HttpResponse } from 'msw'
import { GET as getCapacity, PATCH as patchCapacity } from '@/app/api/capacity/[terminalId]/[date]/route'
import { createAuthRequest, createRequest } from '../helpers/request'
import { mockTerminal, mockSlots, BOOKING_DATE } from '../mocks/db'

const PARAMS = {
  params: Promise.resolve({ terminalId: mockTerminal.id, date: BOOKING_DATE }),
}

// ── GET /api/capacity/[terminalId]/[date] ─────────────────────────────────────

describe('GET /api/capacity/[terminalId]/[date]', () => {
  it('returns 24 slots for supervisor', async () => {
    const req = await createAuthRequest(
      `http://localhost/api/capacity/${mockTerminal.id}/${BOOKING_DATE}`,
      { role: 'supervisor' }
    )
    const res = await getCapacity(req, PARAMS)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.data)).toBe(true)
  })

  it('returns 24 slots for admin', async () => {
    const req = await createAuthRequest(
      `http://localhost/api/capacity/${mockTerminal.id}/${BOOKING_DATE}`,
      { role: 'admin' }
    )
    const res = await getCapacity(req, PARAMS)
    expect(res.status).toBe(200)
  })

  it('returns 401 for unauthenticated request', async () => {
    const req = createRequest(
      `http://localhost/api/capacity/${mockTerminal.id}/${BOOKING_DATE}`
    )
    const res = await getCapacity(req, PARAMS)
    expect(res.status).toBe(401)
  })

  it('returns 404 when terminal does not exist', async () => {
    server.use(
      http.get('https://mock-supabase.test/rest/v1/port_terminals', () =>
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
    capacity: 3,
    last_updated_at: mockSlots[9].last_updated_at,
  }

  it('updates capacity for supervisor', async () => {
    const req = await createAuthRequest(
      `http://localhost/api/capacity/${mockTerminal.id}/${BOOKING_DATE}`,
      { role: 'supervisor', method: 'PATCH', body: validBody }
    )
    const res = await patchCapacity(req, PARAMS)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.capacity).toBe(3)
  })

  it('returns 403 for agent', async () => {
    const req = await createAuthRequest(
      `http://localhost/api/capacity/${mockTerminal.id}/${BOOKING_DATE}`,
      { role: 'agent', method: 'PATCH', body: validBody }
    )
    const res = await patchCapacity(req, PARAMS)
    expect(res.status).toBe(403)
  })

  it('returns 409 on optimistic lock conflict', async () => {
    server.use(
      http.get('https://mock-supabase.test/rest/v1/terminal_capacity', () =>
        HttpResponse.json({
          id: mockSlots[9].id,
          capacity: 5,
          last_updated_at: '2026-03-11T10:00:00Z', // different from sent value
        })
      )
    )

    const req = await createAuthRequest(
      `http://localhost/api/capacity/${mockTerminal.id}/${BOOKING_DATE}`,
      {
        role: 'supervisor',
        method: 'PATCH',
        body: { ...validBody, last_updated_at: '2026-03-11T07:00:00Z' }, // stale value
      }
    )
    const res = await patchCapacity(req, PARAMS)
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe('CONFLICT')
    expect(typeof body.current_value).toBe('number')
  })

  it('force=true bypasses optimistic lock', async () => {
    server.use(
      http.get('https://mock-supabase.test/rest/v1/terminal_capacity', () =>
        HttpResponse.json({
          id: mockSlots[9].id,
          capacity: 5,
          last_updated_at: '2026-03-11T10:00:00Z',
        })
      )
    )

    const req = await createAuthRequest(
      `http://localhost/api/capacity/${mockTerminal.id}/${BOOKING_DATE}`,
      {
        role: 'supervisor',
        method: 'PATCH',
        body: { ...validBody, last_updated_at: '2026-03-11T07:00:00Z', force: true },
      }
    )
    const res = await patchCapacity(req, PARAMS)
    expect(res.status).toBe(200)
  })

  it('returns 400 for invalid capacity value', async () => {
    const req = await createAuthRequest(
      `http://localhost/api/capacity/${mockTerminal.id}/${BOOKING_DATE}`,
      {
        role: 'supervisor',
        method: 'PATCH',
        body: { hour_slot: 9, capacity: -1, last_updated_at: mockSlots[9].last_updated_at },
      }
    )
    const res = await patchCapacity(req, PARAMS)
    expect(res.status).toBe(400)
  })
})
