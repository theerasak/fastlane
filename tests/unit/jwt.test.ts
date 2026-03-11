import { describe, it, expect } from 'vitest'
import { signJwt, verifyJwt } from '@/lib/auth/jwt'

const testUser = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'admin@test.com',
  role: 'admin' as const,
}

describe('signJwt', () => {
  it('returns a JWT string', async () => {
    const token = await signJwt(testUser)
    expect(typeof token).toBe('string')
    // JWTs have 3 base64url parts separated by dots
    expect(token.split('.')).toHaveLength(3)
  })
})

describe('verifyJwt', () => {
  it('returns payload for a valid token', async () => {
    const token = await signJwt(testUser)
    const payload = await verifyJwt(token)

    expect(payload).not.toBeNull()
    expect(payload!.sub).toBe(testUser.id)
    expect(payload!.email).toBe(testUser.email)
    expect(payload!.role).toBe(testUser.role)
    expect(typeof payload!.iat).toBe('number')
    expect(typeof payload!.exp).toBe('number')
  })

  it('returns null for a tampered token', async () => {
    const token = await signJwt(testUser)
    const tampered = token.slice(0, -5) + 'XXXXX'
    const payload = await verifyJwt(tampered)
    expect(payload).toBeNull()
  })

  it('returns null for a garbage string', async () => {
    const payload = await verifyJwt('not.a.token')
    expect(payload).toBeNull()
  })

  it('exp is approximately 8 hours after iat', async () => {
    const token = await signJwt(testUser)
    const payload = await verifyJwt(token)
    expect(payload!.exp - payload!.iat).toBe(8 * 60 * 60)
  })
})
