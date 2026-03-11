import { describe, it, expect } from 'vitest'
import { server } from '../mocks/server'
import { http } from 'msw'
import { POST as loginPost } from '@/app/api/auth/login/route'
import { POST as logoutPost } from '@/app/api/auth/logout/route'
import { createRequest } from '../helpers/request'
import { MOCK_PASSWORD, mockAdmin } from '../mocks/db'
import { COOKIE_NAME } from '@/lib/constants'
import { pgrstNotFound } from '../mocks/handlers'

describe('POST /api/auth/login', () => {
  it('returns 200 and sets cookie for valid credentials', async () => {
    const req = createRequest('http://localhost/api/auth/login', {
      method: 'POST',
      body: { email: mockAdmin.email, password: MOCK_PASSWORD },
    })
    const res = await loginPost(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.user.email).toBe(mockAdmin.email)
    expect(body.user.role).toBe('admin')

    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain(COOKIE_NAME)
  })

  it('returns 401 for wrong password', async () => {
    const req = createRequest('http://localhost/api/auth/login', {
      method: 'POST',
      body: { email: mockAdmin.email, password: 'wrongpassword' },
    })
    const res = await loginPost(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toContain('Invalid')
  })

  it('returns 401 for unknown email', async () => {
    server.use(
      http.get('https://mock-supabase.test/rest/v1/users', () => pgrstNotFound())
    )
    const req = createRequest('http://localhost/api/auth/login', {
      method: 'POST',
      body: { email: 'nobody@test.com', password: MOCK_PASSWORD },
    })
    const res = await loginPost(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid request body', async () => {
    const req = createRequest('http://localhost/api/auth/login', {
      method: 'POST',
      body: { email: 'not-an-email', password: '' },
    })
    const res = await loginPost(req)
    expect(res.status).toBe(400)
  })
})

describe('POST /api/auth/logout', () => {
  it('returns 200 and clears the session cookie', async () => {
    const req = createRequest('http://localhost/api/auth/logout', { method: 'POST' })
    const res = await logoutPost(req)
    expect(res.status).toBe(200)

    const setCookie = res.headers.get('set-cookie') ?? ''
    // Cookie should be expired (max-age=0 or expires in the past)
    expect(setCookie).toMatch(/max-age=0|expires=/i)
  })
})
