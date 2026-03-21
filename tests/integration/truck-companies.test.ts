import { describe, it, expect } from 'vitest'
import { server } from '../mocks/server'
import { http, HttpResponse } from 'msw'
import { GET as getCompanies, POST as createCompany } from '@/app/api/truck-companies/route'
import {
  GET as getCompany,
  PATCH as patchCompany,
  DELETE as deleteCompany,
} from '@/app/api/truck-companies/[id]/route'
import { createAuthRequest, createRequest } from '../helpers/request'
import { mockCompany, mockInactiveCompany } from '../mocks/db'
import { pgrstNotFound, pgrstSingle } from '../mocks/handlers'

const SUPA = 'https://mock-supabase.test/rest/v1'

// ── GET /api/truck-companies ───────────────────────────────────────────────────

describe('GET /api/truck-companies', () => {
  it('returns 200 with company list including new fields for admin', async () => {
    const req = await createAuthRequest('http://localhost/api/truck-companies', { role: 'admin' })
    const res = await getCompanies(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(Array.isArray(body.data)).toBe(true)
    const company = body.data[0]
    expect(company).toHaveProperty('contact_person')
    expect(company).toHaveProperty('phone')
    expect(company).toHaveProperty('is_active')
  })

  it('returns 200 with new fields for agent', async () => {
    const req = await createAuthRequest('http://localhost/api/truck-companies', { role: 'agent' })
    const res = await getCompanies(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data[0]).toHaveProperty('is_active')
  })

  it('returns 403 for supervisor', async () => {
    const req = await createAuthRequest('http://localhost/api/truck-companies', {
      role: 'supervisor',
    })
    const res = await getCompanies(req)
    expect(res.status).toBe(403)
  })

  it('returns 403 for unauthenticated request', async () => {
    const req = createRequest('http://localhost/api/truck-companies')
    const res = await getCompanies(req)
    expect(res.status).toBe(403)
  })

  it('returns both active and inactive companies', async () => {
    server.use(
      http.get(`${SUPA}/truck_companies`, () =>
        HttpResponse.json([mockCompany, mockInactiveCompany])
      )
    )
    const req = await createAuthRequest('http://localhost/api/truck-companies', { role: 'admin' })
    const res = await getCompanies(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(2)
    const statuses = body.data.map((c: { is_active: boolean }) => c.is_active)
    expect(statuses).toContain(true)
    expect(statuses).toContain(false)
  })
})

// ── POST /api/truck-companies ──────────────────────────────────────────────────

describe('POST /api/truck-companies', () => {
  it('creates a company with contact_person and phone', async () => {
    const req = await createAuthRequest('http://localhost/api/truck-companies', {
      role: 'admin',
      method: 'POST',
      body: {
        name: 'New Logistics Co',
        contact_email: 'new@logistics.com',
        contact_person: 'Bob Manager',
        phone: '+66-2-999-8888',
      },
    })
    const res = await createCompany(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data).toHaveProperty('contact_person')
    expect(body.data).toHaveProperty('phone')
    expect(body.data).toHaveProperty('is_active')
  })

  it('creates a company without optional fields', async () => {
    const req = await createAuthRequest('http://localhost/api/truck-companies', {
      role: 'admin',
      method: 'POST',
      body: { name: 'Minimal Co' },
    })
    const res = await createCompany(req)
    expect(res.status).toBe(201)
  })

  it('returns 400 for missing name', async () => {
    const req = await createAuthRequest('http://localhost/api/truck-companies', {
      role: 'admin',
      method: 'POST',
      body: { contact_email: 'no-name@test.com' },
    })
    const res = await createCompany(req)
    expect(res.status).toBe(400)
  })

  it('returns 403 for agent role', async () => {
    const req = await createAuthRequest('http://localhost/api/truck-companies', {
      role: 'agent',
      method: 'POST',
      body: { name: 'Agent Created Co' },
    })
    const res = await createCompany(req)
    expect(res.status).toBe(403)
  })
})

// ── GET /api/truck-companies/[id] ─────────────────────────────────────────────

describe('GET /api/truck-companies/[id]', () => {
  it('returns company with all new fields', async () => {
    const req = await createAuthRequest(
      `http://localhost/api/truck-companies/${mockCompany.id}`,
      { role: 'admin' }
    )
    const res = await getCompany(req, { params: Promise.resolve({ id: mockCompany.id }) })
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.data).toHaveProperty('contact_person')
    expect(body.data).toHaveProperty('phone')
    expect(body.data).toHaveProperty('is_active')
  })

  it('returns 401 for unauthenticated request', async () => {
    const req = createRequest(`http://localhost/api/truck-companies/${mockCompany.id}`)
    const res = await getCompany(req, { params: Promise.resolve({ id: mockCompany.id }) })
    expect(res.status).toBe(401)
  })

  it('returns 404 for unknown company', async () => {
    server.use(
      http.get(`${SUPA}/truck_companies`, () => pgrstNotFound())
    )
    const req = await createAuthRequest('http://localhost/api/truck-companies/no-such-id', {
      role: 'admin',
    })
    const res = await getCompany(req, { params: Promise.resolve({ id: 'no-such-id' }) })
    expect(res.status).toBe(404)
  })
})

// ── PATCH /api/truck-companies/[id] ───────────────────────────────────────────

describe('PATCH /api/truck-companies/[id]', () => {
  it('can disable a company (is_active=false)', async () => {
    server.use(
      http.patch(`${SUPA}/truck_companies`, () =>
        pgrstSingle({ ...mockCompany, is_active: false })
      )
    )
    const req = await createAuthRequest(
      `http://localhost/api/truck-companies/${mockCompany.id}`,
      { role: 'admin', method: 'PATCH', body: { is_active: false } }
    )
    const res = await patchCompany(req, { params: Promise.resolve({ id: mockCompany.id }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.is_active).toBe(false)
  })

  it('can disable a company when contact_email is null (bug fix: null was rejected by schema)', async () => {
    server.use(
      http.patch(`${SUPA}/truck_companies`, () =>
        pgrstSingle({ ...mockCompany, is_active: false, contact_email: null })
      )
    )
    // Simulates the form submitting name + null contact_email + is_active=false
    const req = await createAuthRequest(
      `http://localhost/api/truck-companies/${mockCompany.id}`,
      {
        role: 'admin',
        method: 'PATCH',
        body: { name: mockCompany.name, contact_email: null, is_active: false },
      }
    )
    const res = await patchCompany(req, { params: Promise.resolve({ id: mockCompany.id }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.is_active).toBe(false)
  })

  it('can re-enable a disabled company (is_active=true)', async () => {
    server.use(
      http.get(`${SUPA}/truck_companies`, () => pgrstSingle(mockInactiveCompany)),
      http.patch(`${SUPA}/truck_companies`, () =>
        pgrstSingle({ ...mockInactiveCompany, is_active: true })
      )
    )
    const req = await createAuthRequest(
      `http://localhost/api/truck-companies/${mockInactiveCompany.id}`,
      { role: 'admin', method: 'PATCH', body: { is_active: true } }
    )
    const res = await patchCompany(req, {
      params: Promise.resolve({ id: mockInactiveCompany.id }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.is_active).toBe(true)
  })

  it('can update contact_person', async () => {
    server.use(
      http.patch(`${SUPA}/truck_companies`, () =>
        pgrstSingle({ ...mockCompany, contact_person: 'New Manager' })
      )
    )
    const req = await createAuthRequest(
      `http://localhost/api/truck-companies/${mockCompany.id}`,
      { role: 'admin', method: 'PATCH', body: { contact_person: 'New Manager' } }
    )
    const res = await patchCompany(req, { params: Promise.resolve({ id: mockCompany.id }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.contact_person).toBe('New Manager')
  })

  it('can update phone number', async () => {
    server.use(
      http.patch(`${SUPA}/truck_companies`, () =>
        pgrstSingle({ ...mockCompany, phone: '+1-800-555-0000' })
      )
    )
    const req = await createAuthRequest(
      `http://localhost/api/truck-companies/${mockCompany.id}`,
      { role: 'admin', method: 'PATCH', body: { phone: '+1-800-555-0000' } }
    )
    const res = await patchCompany(req, { params: Promise.resolve({ id: mockCompany.id }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.phone).toBe('+1-800-555-0000')
  })

  it('returns 403 for agent role', async () => {
    const req = await createAuthRequest(
      `http://localhost/api/truck-companies/${mockCompany.id}`,
      { role: 'agent', method: 'PATCH', body: { name: 'Hacked Name' } }
    )
    const res = await patchCompany(req, { params: Promise.resolve({ id: mockCompany.id }) })
    expect(res.status).toBe(403)
  })

  it('returns 404 for unknown company', async () => {
    server.use(
      http.get(`${SUPA}/truck_companies`, () => pgrstNotFound()),
      http.patch(`${SUPA}/truck_companies`, () => pgrstNotFound())
    )
    const req = await createAuthRequest(
      'http://localhost/api/truck-companies/no-such-id',
      { role: 'admin', method: 'PATCH', body: { name: 'X' } }
    )
    const res = await patchCompany(req, { params: Promise.resolve({ id: 'no-such-id' }) })
    expect(res.status).toBe(404)
  })
})

// ── DELETE /api/truck-companies/[id] ──────────────────────────────────────────

describe('DELETE /api/truck-companies/[id]', () => {
  it('deletes a company and returns 200', async () => {
    const req = await createAuthRequest(
      `http://localhost/api/truck-companies/${mockCompany.id}`,
      { role: 'admin', method: 'DELETE' }
    )
    const res = await deleteCompany(req, { params: Promise.resolve({ id: mockCompany.id }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('can delete a disabled company', async () => {
    server.use(
      http.get(`${SUPA}/truck_companies`, () => pgrstSingle(mockInactiveCompany))
    )
    const req = await createAuthRequest(
      `http://localhost/api/truck-companies/${mockInactiveCompany.id}`,
      { role: 'admin', method: 'DELETE' }
    )
    const res = await deleteCompany(req, {
      params: Promise.resolve({ id: mockInactiveCompany.id }),
    })
    expect(res.status).toBe(200)
  })

  it('returns 400 with helpful message when company has bookings (FK constraint)', async () => {
    server.use(
      http.delete(`${SUPA}/truck_companies`, () =>
        HttpResponse.json(
          { code: '23503', message: 'violates foreign key constraint' },
          { status: 409 }
        )
      )
    )
    const req = await createAuthRequest(
      `http://localhost/api/truck-companies/${mockCompany.id}`,
      { role: 'admin', method: 'DELETE' }
    )
    const res = await deleteCompany(req, { params: Promise.resolve({ id: mockCompany.id }) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/existing bookings/i)
  })

  it('returns 403 for agent role', async () => {
    const req = await createAuthRequest(
      `http://localhost/api/truck-companies/${mockCompany.id}`,
      { role: 'agent', method: 'DELETE' }
    )
    const res = await deleteCompany(req, { params: Promise.resolve({ id: mockCompany.id }) })
    expect(res.status).toBe(403)
  })

  it('returns 403 for supervisor role', async () => {
    const req = await createAuthRequest(
      `http://localhost/api/truck-companies/${mockCompany.id}`,
      { role: 'supervisor', method: 'DELETE' }
    )
    const res = await deleteCompany(req, { params: Promise.resolve({ id: mockCompany.id }) })
    expect(res.status).toBe(403)
  })
})
