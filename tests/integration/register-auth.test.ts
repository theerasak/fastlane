import { describe, it, expect } from 'vitest'
import { server } from '../mocks/server'
import { http } from 'msw'
import { POST as loginPost } from '@/app/api/register/auth/login/route'
import { POST as logoutPost } from '@/app/api/register/auth/logout/route'
import { createRequest } from '../helpers/request'
import { MOCK_PASSWORD, mockCompany } from '../mocks/db'
import { TC_COOKIE_NAME } from '@/lib/constants'
import { pgrstNotFound, pgrstSingle } from '../mocks/handlers'

// ── POST /api/register/auth/login ─────────────────────────────────────────

describe('POST /api/register/auth/login', () => {
  it('returns 200 and sets TC cookie for valid credentials', async () => {
    const req = createRequest('http://localhost/api/register/auth/login', {
      method: 'POST',
      body: { contact_email: mockCompany.contact_email, password: MOCK_PASSWORD },
    })
    const res = await loginPost(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.name).toBe(mockCompany.name)

    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain(TC_COOKIE_NAME)
  })

  it('returns 401 for wrong password', async () => {
    const req = createRequest('http://localhost/api/register/auth/login', {
      method: 'POST',
      body: { contact_email: mockCompany.contact_email, password: 'wrongpassword' },
    })
    const res = await loginPost(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toContain('Invalid')
  })

  it('returns 401 for unknown email', async () => {
    server.use(
      http.get('https://mock-supabase.test/rest/v1/truck_companies', () => pgrstNotFound())
    )
    const req = createRequest('http://localhost/api/register/auth/login', {
      method: 'POST',
      body: { contact_email: 'nobody@unknown.com', password: MOCK_PASSWORD },
    })
    const res = await loginPost(req)
    expect(res.status).toBe(401)
  })

  it('returns 403 for a disabled company', async () => {
    server.use(
      http.get('https://mock-supabase.test/rest/v1/truck_companies', () =>
        pgrstSingle({ ...mockCompany, is_active: false })
      )
    )
    const req = createRequest('http://localhost/api/register/auth/login', {
      method: 'POST',
      body: { contact_email: mockCompany.contact_email, password: MOCK_PASSWORD },
    })
    const res = await loginPost(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/disabled/i)
  })

  it('returns 401 when company has no password_hash set', async () => {
    server.use(
      http.get('https://mock-supabase.test/rest/v1/truck_companies', () =>
        pgrstSingle({ ...mockCompany, password_hash: null })
      )
    )
    const req = createRequest('http://localhost/api/register/auth/login', {
      method: 'POST',
      body: { contact_email: mockCompany.contact_email, password: MOCK_PASSWORD },
    })
    const res = await loginPost(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toContain('Invalid')
  })

  it('returns 400 for invalid request body (non-email)', async () => {
    const req = createRequest('http://localhost/api/register/auth/login', {
      method: 'POST',
      body: { contact_email: 'not-an-email', password: 'somepass' },
    })
    const res = await loginPost(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when password is empty', async () => {
    const req = createRequest('http://localhost/api/register/auth/login', {
      method: 'POST',
      body: { contact_email: mockCompany.contact_email, password: '' },
    })
    const res = await loginPost(req)
    expect(res.status).toBe(400)
  })
})

// ── POST /api/register/auth/logout ────────────────────────────────────────

describe('POST /api/register/auth/logout', () => {
  it('redirects to /register/login and clears the TC session cookie', async () => {
    const req = createRequest('http://localhost/api/register/auth/logout', { method: 'POST' })
    const res = await logoutPost(req)

    // Logout now redirects (307) to /register/login
    expect(res.status).toBeGreaterThanOrEqual(300)
    expect(res.status).toBeLessThan(400)
    expect(res.headers.get('location')).toMatch(/\/register\/login/)

    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain(TC_COOKIE_NAME)
    expect(setCookie).toMatch(/max-age=0|expires=/i)
  })
})
