import { describe, it, expect } from 'vitest'

const TOKEN_TTL_DAYS = 60

// ── Expiry date calculation ────────────────────────────────────────────────

describe('token expiry date', () => {
  function calcExpiry(from: Date = new Date()): Date {
    return new Date(from.getTime() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000)
  }

  it('is exactly 60 days after generation', () => {
    const now = new Date('2026-03-29T00:00:00Z')
    const expiry = calcExpiry(now)
    const diffDays = (expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
    expect(diffDays).toBe(60)
  })

  it('produces a future date', () => {
    const now = new Date()
    expect(calcExpiry(now).getTime()).toBeGreaterThan(now.getTime())
  })

  it('produces an ISO string that can round-trip', () => {
    const expiry = calcExpiry()
    const iso = expiry.toISOString()
    expect(new Date(iso).getTime()).toBe(expiry.getTime())
  })
})

// ── Expiry check ───────────────────────────────────────────────────────────

describe('token expiry check', () => {
  const isExpired = (expiresAt: string | null): boolean =>
    expiresAt ? new Date(expiresAt) < new Date() : false

  it('returns false for a far-future expiry', () => {
    expect(isExpired('2099-01-01T00:00:00Z')).toBe(false)
  })

  it('returns true for a past expiry', () => {
    expect(isExpired('2020-01-01T00:00:00Z')).toBe(true)
  })

  it('returns false when token_expires_at is null (no expiry set)', () => {
    expect(isExpired(null)).toBe(false)
  })

  it('returns true for a date 1 millisecond in the past', () => {
    const past = new Date(Date.now() - 1).toISOString()
    expect(isExpired(past)).toBe(true)
  })

  it('returns false for a date 1 hour in the future', () => {
    const future = new Date(Date.now() + 3600_000).toISOString()
    expect(isExpired(future)).toBe(false)
  })
})

// ── Regeneration guard ─────────────────────────────────────────────────────

describe('regeneration guard', () => {
  const canRegenerate = (activeCount: number): boolean => activeCount === 0

  it('allows regeneration when no registrations exist', () => {
    expect(canRegenerate(0)).toBe(true)
  })

  it('blocks regeneration when one registration exists', () => {
    expect(canRegenerate(1)).toBe(false)
  })

  it('blocks regeneration when multiple registrations exist', () => {
    expect(canRegenerate(5)).toBe(false)
  })
})
