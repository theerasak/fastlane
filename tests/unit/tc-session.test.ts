import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { signTcJwt, getTcSession } from '@/lib/auth/tc-session'
import { signJwt } from '@/lib/auth/jwt'
import { TC_COOKIE_NAME, COOKIE_NAME } from '@/lib/constants'

const MOCK_TC_ID = '00000000-0000-0000-0000-000000000020'
const MOCK_TC_NAME = 'Test Trucking Co'

function makeRequestWithCookie(cookieName: string, token: string): NextRequest {
  return new NextRequest('http://localhost/test', {
    headers: { Cookie: `${cookieName}=${token}` },
  })
}

// ── signTcJwt ──────────────────────────────────────────────────────────────

describe('signTcJwt', () => {
  it('creates a JWT string', async () => {
    const token = await signTcJwt({ truck_company_id: MOCK_TC_ID, name: MOCK_TC_NAME })
    expect(typeof token).toBe('string')
    expect(token.split('.').length).toBe(3) // header.payload.sig
  })

  it('encodes tc: true and correct subject in payload', async () => {
    const token = await signTcJwt({ truck_company_id: MOCK_TC_ID, name: MOCK_TC_NAME })
    const [, payloadB64] = token.split('.')
    const decoded = JSON.parse(Buffer.from(payloadB64, 'base64url').toString())
    expect(decoded.tc).toBe(true)
    expect(decoded.sub).toBe(MOCK_TC_ID)
    expect(decoded.name).toBe(MOCK_TC_NAME)
  })

  it('encodes iat and exp claims', async () => {
    const before = Math.floor(Date.now() / 1000)
    const token = await signTcJwt({ truck_company_id: MOCK_TC_ID, name: MOCK_TC_NAME })
    const after = Math.floor(Date.now() / 1000)
    const [, payloadB64] = token.split('.')
    const decoded = JSON.parse(Buffer.from(payloadB64, 'base64url').toString())
    expect(decoded.iat).toBeGreaterThanOrEqual(before)
    expect(decoded.iat).toBeLessThanOrEqual(after)
    expect(decoded.exp).toBeGreaterThan(decoded.iat)
  })
})

// ── getTcSession ───────────────────────────────────────────────────────────

describe('getTcSession', () => {
  it('returns null when no cookie is present', async () => {
    const req = new NextRequest('http://localhost/test')
    const session = await getTcSession(req)
    expect(session).toBeNull()
  })

  it('returns session data for a valid TC JWT', async () => {
    const token = await signTcJwt({ truck_company_id: MOCK_TC_ID, name: MOCK_TC_NAME })
    const req = makeRequestWithCookie(TC_COOKIE_NAME, token)
    const session = await getTcSession(req)
    expect(session).not.toBeNull()
    expect(session!.truck_company_id).toBe(MOCK_TC_ID)
    expect(session!.name).toBe(MOCK_TC_NAME)
  })

  it('returns null for a staff JWT (missing tc: true claim)', async () => {
    const staffToken = await signJwt({ id: 'staff-id', email: 'admin@test.com', role: 'admin' })
    // Staff token placed in the TC cookie slot
    const req = makeRequestWithCookie(TC_COOKIE_NAME, staffToken)
    const session = await getTcSession(req)
    expect(session).toBeNull()
  })

  it('returns null for a tampered token', async () => {
    const token = await signTcJwt({ truck_company_id: MOCK_TC_ID, name: MOCK_TC_NAME })
    const tampered = token.slice(0, -5) + 'XXXXX'
    const req = makeRequestWithCookie(TC_COOKIE_NAME, tampered)
    const session = await getTcSession(req)
    expect(session).toBeNull()
  })

  it('returns null when a staff cookie is set but no TC cookie', async () => {
    const staffToken = await signJwt({ id: 'staff-id', email: 'admin@test.com', role: 'admin' })
    const req = makeRequestWithCookie(COOKIE_NAME, staffToken) // wrong cookie name
    const session = await getTcSession(req)
    expect(session).toBeNull()
  })

  it('returns null for a completely invalid token string', async () => {
    const req = makeRequestWithCookie(TC_COOKIE_NAME, 'not.a.jwt')
    const session = await getTcSession(req)
    expect(session).toBeNull()
  })
})
