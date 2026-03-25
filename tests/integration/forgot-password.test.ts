import { describe, it, expect, vi, beforeEach } from 'vitest'
import { server } from '../mocks/server'
import { http, HttpResponse } from 'msw'
import { POST as forgotPasswordPost } from '@/app/api/auth/forgot-password/route'
import { POST as resetPasswordPost } from '@/app/api/auth/reset-password/route'
import { createRequest } from '../helpers/request'
import { mockAdmin, mockInactiveUser, mockResetToken } from '../mocks/db'
import { pgrstNotFound, pgrstSingle } from '../mocks/handlers'

const SUPA = 'https://mock-supabase.test/rest/v1'

// Mock the email module so no SMTP connection is attempted
const mockSendPasswordResetEmail = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.mock('@/lib/email', () => ({
  sendPasswordResetEmail: mockSendPasswordResetEmail,
}))

// ── POST /api/auth/forgot-password ─────────────────────────────────────────

describe('POST /api/auth/forgot-password', () => {
  beforeEach(() => {
    mockSendPasswordResetEmail.mockReset()
    mockSendPasswordResetEmail.mockResolvedValue(undefined)
  })

  it('returns 200 for a valid active user and sends the reset email', async () => {
    const req = createRequest('http://localhost/api/auth/forgot-password', {
      method: 'POST',
      body: { email: mockAdmin.email },
    })
    const res = await forgotPasswordPost(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.message).toBeTruthy()
    expect(mockSendPasswordResetEmail).toHaveBeenCalledTimes(1)
    expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(
      mockAdmin.email,
      expect.stringContaining('/reset-password/')
    )
  })

  it('returns 200 for an unknown email without sending an email', async () => {
    server.use(
      http.get(`${SUPA}/users`, () => pgrstNotFound())
    )
    const req = createRequest('http://localhost/api/auth/forgot-password', {
      method: 'POST',
      body: { email: 'nobody@example.com' },
    })
    const res = await forgotPasswordPost(req)
    expect(res.status).toBe(200)
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled()
  })

  it('returns 200 for an inactive user without sending an email', async () => {
    server.use(
      http.get(`${SUPA}/users`, ({ request }) => {
        const accept = request.headers.get('Accept') ?? ''
        if (accept.includes('vnd.pgrst.object')) return pgrstSingle(mockInactiveUser)
        return HttpResponse.json([mockInactiveUser])
      })
    )
    const req = createRequest('http://localhost/api/auth/forgot-password', {
      method: 'POST',
      body: { email: mockInactiveUser.email },
    })
    const res = await forgotPasswordPost(req)
    expect(res.status).toBe(200)
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled()
  })

  it('returns 400 for an invalid email format', async () => {
    const req = createRequest('http://localhost/api/auth/forgot-password', {
      method: 'POST',
      body: { email: 'not-an-email' },
    })
    const res = await forgotPasswordPost(req)
    expect(res.status).toBe(400)
  })

  it('still returns 200 when email sending fails (non-fatal)', async () => {
    mockSendPasswordResetEmail.mockRejectedValue(new Error('SMTP error'))
    const req = createRequest('http://localhost/api/auth/forgot-password', {
      method: 'POST',
      body: { email: mockAdmin.email },
    })
    const res = await forgotPasswordPost(req)
    expect(res.status).toBe(200)
  })

  it('invalidates existing unused tokens before creating a new one', async () => {
    const patchCalls: string[] = []
    server.use(
      http.patch(`${SUPA}/password_reset_tokens`, async ({ request }) => {
        patchCalls.push(new URL(request.url).search)
        return HttpResponse.json([])
      })
    )
    const req = createRequest('http://localhost/api/auth/forgot-password', {
      method: 'POST',
      body: { email: mockAdmin.email },
    })
    await forgotPasswordPost(req)
    // Should have patched (expired) old tokens before inserting new one
    expect(patchCalls.length).toBeGreaterThan(0)
  })
})

// ── POST /api/auth/reset-password ──────────────────────────────────────────

describe('POST /api/auth/reset-password', () => {
  it('returns 200 and updates the password for a valid token', async () => {
    const req = createRequest('http://localhost/api/auth/reset-password', {
      method: 'POST',
      body: { token: mockResetToken.token, password: 'newpassword123' },
    })
    const res = await resetPasswordPost(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.message).toBeTruthy()
  })

  it('returns 400 for an invalid (not found) token', async () => {
    server.use(
      http.get(`${SUPA}/password_reset_tokens`, () => pgrstNotFound())
    )
    const req = createRequest('http://localhost/api/auth/reset-password', {
      method: 'POST',
      body: { token: 'nonexistent-token', password: 'newpassword123' },
    })
    const res = await resetPasswordPost(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid|expired/i)
  })

  it('returns 400 for an already-used token', async () => {
    server.use(
      http.get(`${SUPA}/password_reset_tokens`, ({ request }) => {
        const accept = request.headers.get('Accept') ?? ''
        if (accept.includes('vnd.pgrst.object')) {
          return pgrstSingle({ ...mockResetToken, used_at: '2026-03-25T00:00:00Z' })
        }
        return HttpResponse.json([])
      })
    )
    const req = createRequest('http://localhost/api/auth/reset-password', {
      method: 'POST',
      body: { token: mockResetToken.token, password: 'newpassword123' },
    })
    const res = await resetPasswordPost(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/already been used/i)
  })

  it('returns 400 for an expired token', async () => {
    server.use(
      http.get(`${SUPA}/password_reset_tokens`, ({ request }) => {
        const accept = request.headers.get('Accept') ?? ''
        if (accept.includes('vnd.pgrst.object')) {
          return pgrstSingle({ ...mockResetToken, expires_at: '2020-01-01T00:00:00Z' })
        }
        return HttpResponse.json([])
      })
    )
    const req = createRequest('http://localhost/api/auth/reset-password', {
      method: 'POST',
      body: { token: mockResetToken.token, password: 'newpassword123' },
    })
    const res = await resetPasswordPost(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/expired/i)
  })

  it('returns 400 when password is fewer than 10 characters', async () => {
    const req = createRequest('http://localhost/api/auth/reset-password', {
      method: 'POST',
      body: { token: mockResetToken.token, password: 'short' },
    })
    const res = await resetPasswordPost(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/10 characters/i)
  })

  it('returns 400 when password is exactly 9 characters', async () => {
    const req = createRequest('http://localhost/api/auth/reset-password', {
      method: 'POST',
      body: { token: mockResetToken.token, password: '123456789' },
    })
    const res = await resetPasswordPost(req)
    expect(res.status).toBe(400)
  })

  it('returns 200 when password is exactly 10 characters', async () => {
    const req = createRequest('http://localhost/api/auth/reset-password', {
      method: 'POST',
      body: { token: mockResetToken.token, password: '1234567890' },
    })
    const res = await resetPasswordPost(req)
    expect(res.status).toBe(200)
  })

  it('returns 400 when token is missing', async () => {
    const req = createRequest('http://localhost/api/auth/reset-password', {
      method: 'POST',
      body: { password: 'newpassword123' },
    })
    const res = await resetPasswordPost(req)
    expect(res.status).toBe(400)
  })

  it('marks the token as used after a successful reset', async () => {
    const patchedIds: string[] = []
    server.use(
      http.patch(`${SUPA}/password_reset_tokens`, async ({ request }) => {
        patchedIds.push(new URL(request.url).search)
        return HttpResponse.json([])
      })
    )
    const req = createRequest('http://localhost/api/auth/reset-password', {
      method: 'POST',
      body: { token: mockResetToken.token, password: 'newpassword123' },
    })
    await resetPasswordPost(req)
    expect(patchedIds.length).toBeGreaterThan(0)
  })
})
