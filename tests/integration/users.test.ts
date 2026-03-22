import { describe, it, expect } from 'vitest'
import { server } from '../mocks/server'
import { http, HttpResponse } from 'msw'
import { GET as getUsers, POST as createUser } from '@/app/api/users/route'
import { GET as getUser, PATCH as patchUser, DELETE as deleteUser } from '@/app/api/users/[id]/route'
import { createAuthRequest, createRequest } from '../helpers/request'
import { mockAdmin, mockAgent, mockPrivilegedAgent, mockInactiveUser } from '../mocks/db'
import { pgrstNotFound, pgrstSingle } from '../mocks/handlers'

const SUPA = 'https://mock-supabase.test/rest/v1'

// ── GET /api/users ─────────────────────────────────────────────────────────────

describe('GET /api/users', () => {
  it('returns 200 with user list including new fields for admin', async () => {
    const req = await createAuthRequest('http://localhost/api/users', { role: 'admin' })
    const res = await getUsers(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(Array.isArray(body.data)).toBe(true)
    const user = body.data[0]
    expect(user).toHaveProperty('is_privileged')
    expect(user).toHaveProperty('contact_person')
    expect(user).toHaveProperty('phone')
  })

  it('returns 403 for agent role', async () => {
    const req = await createAuthRequest('http://localhost/api/users', { role: 'agent' })
    const res = await getUsers(req)
    expect(res.status).toBe(403)
  })

  it('returns 403 for supervisor role', async () => {
    const req = await createAuthRequest('http://localhost/api/users', { role: 'supervisor' })
    const res = await getUsers(req)
    expect(res.status).toBe(403)
  })

  it('returns 403 for unauthenticated request', async () => {
    const req = createRequest('http://localhost/api/users')
    const res = await getUsers(req)
    expect(res.status).toBe(403)
  })

  it('does not expose is_privileged to non-admin roles', async () => {
    // Agents cannot even access /api/users — 403 means the field is never returned
    const req = await createAuthRequest('http://localhost/api/users', { role: 'agent' })
    const res = await getUsers(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body).not.toHaveProperty('data')
  })
})

// ── POST /api/users ────────────────────────────────────────────────────────────

describe('POST /api/users', () => {
  it('creates a user with contact_person and phone', async () => {
    const req = await createAuthRequest('http://localhost/api/users', {
      role: 'admin',
      method: 'POST',
      body: {
        email: 'new@test.com',
        password: 'password123',
        role: 'agent',
        contact_person: 'John Doe',
        phone: '+66-81-111-2222',
      },
    })
    const res = await createUser(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data).toHaveProperty('is_privileged')
    expect(body.data).toHaveProperty('contact_person')
    expect(body.data).toHaveProperty('phone')
  })

  it('creates a user without optional fields', async () => {
    const req = await createAuthRequest('http://localhost/api/users', {
      role: 'admin',
      method: 'POST',
      body: { email: 'minimal@test.com', password: 'pass123', role: 'agent' },
    })
    const res = await createUser(req)
    expect(res.status).toBe(201)
  })

  it('returns 400 for invalid email', async () => {
    const req = await createAuthRequest('http://localhost/api/users', {
      role: 'admin',
      method: 'POST',
      body: { email: 'not-an-email', password: 'pass123', role: 'agent' },
    })
    const res = await createUser(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for password shorter than 6 chars', async () => {
    const req = await createAuthRequest('http://localhost/api/users', {
      role: 'admin',
      method: 'POST',
      body: { email: 'new@test.com', password: '123', role: 'agent' },
    })
    const res = await createUser(req)
    expect(res.status).toBe(400)
  })

  it('returns 403 for non-admin', async () => {
    const req = await createAuthRequest('http://localhost/api/users', {
      role: 'agent',
      method: 'POST',
      body: { email: 'x@test.com', password: 'pass123', role: 'agent' },
    })
    const res = await createUser(req)
    expect(res.status).toBe(403)
  })

  it('returns 409 when email already exists', async () => {
    server.use(
      http.post(`${SUPA}/users`, async () =>
        HttpResponse.json(
          { code: '23505', message: 'duplicate key' },
          { status: 409 }
        )
      )
    )
    const req = await createAuthRequest('http://localhost/api/users', {
      role: 'admin',
      method: 'POST',
      body: { email: 'admin@test.com', password: 'pass123', role: 'agent' },
    })
    const res = await createUser(req)
    expect(res.status).toBe(409)
  })
})

// ── GET /api/users/[id] ────────────────────────────────────────────────────────

describe('GET /api/users/[id]', () => {
  it('returns user with all new fields for admin', async () => {
    const req = await createAuthRequest(`http://localhost/api/users/${mockAgent.id}`, {
      role: 'admin',
    })
    const res = await getUser(req, { params: Promise.resolve({ id: mockAgent.id }) })
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.data).toHaveProperty('is_privileged')
    expect(body.data).toHaveProperty('contact_person')
    expect(body.data).toHaveProperty('phone')
  })

  it('returns 403 for non-admin', async () => {
    const req = await createAuthRequest(`http://localhost/api/users/${mockAdmin.id}`, {
      role: 'agent',
    })
    const res = await getUser(req, { params: Promise.resolve({ id: mockAdmin.id }) })
    expect(res.status).toBe(403)
  })

  it('returns 404 for unknown user', async () => {
    server.use(
      http.get(`${SUPA}/users`, () => pgrstNotFound())
    )
    const req = await createAuthRequest('http://localhost/api/users/nonexistent-id', {
      role: 'admin',
    })
    const res = await getUser(req, { params: Promise.resolve({ id: 'nonexistent-id' }) })
    expect(res.status).toBe(404)
  })
})

// ── PATCH /api/users/[id] ──────────────────────────────────────────────────────

describe('PATCH /api/users/[id]', () => {
  it('can set is_privileged=true on an agent', async () => {
    server.use(
      http.patch(`${SUPA}/users`, () => pgrstSingle({ ...mockAgent, is_privileged: true }))
    )
    const req = await createAuthRequest(`http://localhost/api/users/${mockAgent.id}`, {
      role: 'admin',
      method: 'PATCH',
      body: { is_privileged: true },
    })
    const res = await patchUser(req, { params: Promise.resolve({ id: mockAgent.id }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.is_privileged).toBe(true)
  })

  it('can disable a user (set is_active=false)', async () => {
    server.use(
      http.patch(`${SUPA}/users`, () => pgrstSingle({ ...mockAgent, is_active: false }))
    )
    const req = await createAuthRequest(`http://localhost/api/users/${mockAgent.id}`, {
      role: 'admin',
      method: 'PATCH',
      body: { is_active: false },
    })
    const res = await patchUser(req, { params: Promise.resolve({ id: mockAgent.id }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.is_active).toBe(false)
  })

  it('can re-enable a disabled user (set is_active=true)', async () => {
    server.use(
      http.get(`${SUPA}/users`, () => pgrstSingle(mockInactiveUser)),
      http.patch(`${SUPA}/users`, () => pgrstSingle({ ...mockInactiveUser, is_active: true }))
    )
    const req = await createAuthRequest(`http://localhost/api/users/${mockInactiveUser.id}`, {
      role: 'admin',
      method: 'PATCH',
      body: { is_active: true },
    })
    const res = await patchUser(req, { params: Promise.resolve({ id: mockInactiveUser.id }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.is_active).toBe(true)
  })

  it('can update contact_person and phone', async () => {
    server.use(
      http.patch(`${SUPA}/users`, () =>
        pgrstSingle({ ...mockAgent, contact_person: 'New Contact', phone: '+1-555-0000' })
      )
    )
    const req = await createAuthRequest(`http://localhost/api/users/${mockAgent.id}`, {
      role: 'admin',
      method: 'PATCH',
      body: { contact_person: 'New Contact', phone: '+1-555-0000' },
    })
    const res = await patchUser(req, { params: Promise.resolve({ id: mockAgent.id }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.contact_person).toBe('New Contact')
    expect(body.data.phone).toBe('+1-555-0000')
  })

  it('returns 403 for non-admin', async () => {
    const req = await createAuthRequest(`http://localhost/api/users/${mockAgent.id}`, {
      role: 'agent',
      method: 'PATCH',
      body: { is_active: false },
    })
    const res = await patchUser(req, { params: Promise.resolve({ id: mockAgent.id }) })
    expect(res.status).toBe(403)
  })

  it('returns 400 for invalid field values', async () => {
    const req = await createAuthRequest(`http://localhost/api/users/${mockAgent.id}`, {
      role: 'admin',
      method: 'PATCH',
      body: { email: 'not-an-email' },
    })
    const res = await patchUser(req, { params: Promise.resolve({ id: mockAgent.id }) })
    expect(res.status).toBe(400)
  })
})

// ── DELETE /api/users/[id] ─────────────────────────────────────────────────────

describe('DELETE /api/users/[id]', () => {
  it('deletes a user and returns 200', async () => {
    const req = await createAuthRequest(`http://localhost/api/users/${mockAgent.id}`, {
      role: 'admin',
      method: 'DELETE',
    })
    const res = await deleteUser(req, { params: Promise.resolve({ id: mockAgent.id }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('returns 400 when trying to delete own account', async () => {
    const req = await createAuthRequest(`http://localhost/api/users/${mockAdmin.id}`, {
      role: 'admin',
      userId: mockAdmin.id, // same user trying to delete themselves
      method: 'DELETE',
    })
    const res = await deleteUser(req, { params: Promise.resolve({ id: mockAdmin.id }) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/cannot delete/i)
  })

  it('returns 403 for non-admin', async () => {
    const req = await createAuthRequest(`http://localhost/api/users/${mockAdmin.id}`, {
      role: 'agent',
      method: 'DELETE',
    })
    const res = await deleteUser(req, { params: Promise.resolve({ id: mockAdmin.id }) })
    expect(res.status).toBe(403)
  })
})

// ── is_privileged visibility ───────────────────────────────────────────────────

describe('is_privileged field visibility', () => {
  it('is included in admin GET /api/users response', async () => {
    const req = await createAuthRequest('http://localhost/api/users', { role: 'admin' })
    const res = await getUsers(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    // Every user in the list should have is_privileged
    for (const user of body.data) {
      expect(user).toHaveProperty('is_privileged')
    }
  })

  it('privileged agent has is_privileged=true in admin response', async () => {
    server.use(
      http.get(`${SUPA}/users`, () => HttpResponse.json([mockPrivilegedAgent]))
    )
    const req = await createAuthRequest('http://localhost/api/users', { role: 'admin' })
    const res = await getUsers(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data[0].is_privileged).toBe(true)
  })

  it('agent receives 403 and cannot see any user data including is_privileged', async () => {
    const req = await createAuthRequest('http://localhost/api/users', { role: 'agent' })
    const res = await getUsers(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.data).toBeUndefined()
  })
})

// ── POST /api/users — null optional fields (bug fix) ──────────────────────────

describe('POST /api/users — null optional fields accepted', () => {
  it('accepts null contact_person, phone, company_name without 400 error', async () => {
    const req = await createAuthRequest('http://localhost/api/users', {
      role: 'admin',
      method: 'POST',
      body: {
        email: 'nullfields@test.com',
        password: 'pass123',
        role: 'agent',
        contact_person: null,
        phone: null,
        company_name: null,
      },
    })
    const res = await createUser(req)
    expect(res.status).toBe(201)
  })

  it('accepts absent optional fields (undefined) without 400 error', async () => {
    const req = await createAuthRequest('http://localhost/api/users', {
      role: 'admin',
      method: 'POST',
      body: { email: 'nooptional@test.com', password: 'pass123', role: 'supervisor' },
    })
    const res = await createUser(req)
    expect(res.status).toBe(201)
  })

  it('returns human-readable 400 message for invalid email field', async () => {
    const req = await createAuthRequest('http://localhost/api/users', {
      role: 'admin',
      method: 'POST',
      body: { email: 'bad', password: 'pass123', role: 'agent' },
    })
    const res = await createUser(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    // Error message should mention the field, not raw Zod internals
    expect(typeof body.error).toBe('string')
    expect(body.error.length).toBeGreaterThan(0)
  })
})

// ── POST /api/users — is_privileged for new agent (bug fix) ───────────────────

describe('POST /api/users — is_privileged flag for new agent', () => {
  it('creates agent with is_privileged=true when flag is set', async () => {
    server.use(
      http.post(`${SUPA}/users`, async () =>
        HttpResponse.json({ ...mockAgent, is_privileged: true }, { status: 201 })
      )
    )
    const req = await createAuthRequest('http://localhost/api/users', {
      role: 'admin',
      method: 'POST',
      body: {
        email: 'priv@test.com',
        password: 'pass123',
        role: 'agent',
        is_privileged: true,
      },
    })
    const res = await createUser(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.is_privileged).toBe(true)
  })

  it('creates agent with is_privileged=false by default', async () => {
    const req = await createAuthRequest('http://localhost/api/users', {
      role: 'admin',
      method: 'POST',
      body: { email: 'nonpriv@test.com', password: 'pass123', role: 'agent' },
    })
    const res = await createUser(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    // default mock returns is_privileged: false
    expect(body.data.is_privileged).toBe(false)
  })
})

// ── login blocks inactive users ────────────────────────────────────────────────

describe('Disabled user login', () => {
  it('disabled user (is_active=false) cannot log in', async () => {
    server.use(
      http.get(`${SUPA}/users`, () => pgrstSingle(mockInactiveUser))
    )
    const { POST: loginPost } = await import('@/app/api/auth/login/route')
    const { createRequest: cr } = await import('../helpers/request')
    const req = cr('http://localhost/api/auth/login', {
      method: 'POST',
      body: { email: mockInactiveUser.email, password: 'testpass123' },
    })
    const res = await loginPost(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/disabled/i)
  })
})
