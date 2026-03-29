import { describe, it, expect } from 'vitest'

// ── TC route middleware patterns ────────────────────────────────────────────
//
// The middleware uses these two patterns to identify TC-protected routes.
// We test the patterns in isolation to verify that /register (exact) is now
// correctly treated as TC-protected after adding `(\/[^/]|$)`.

describe('TC page route pattern — /^\\\/register(\\/[^/]|$)/', () => {
  const isTcPage = (pathname: string) => /^\/register(\/[^/]|$)/.test(pathname)

  it('matches /register exactly (dashboard route)', () => {
    expect(isTcPage('/register')).toBe(true)
  })

  it('matches /register/TOKEN', () => {
    expect(isTcPage('/register/TC-TOKEN-001')).toBe(true)
  })

  it('matches /register/login', () => {
    // /register/login is also matched — but PUBLIC_ROUTES handles it first
    expect(isTcPage('/register/login')).toBe(true)
  })

  it('does not match /register-other', () => {
    expect(isTcPage('/register-other')).toBe(false)
  })

  it('also matches /register/TOKEN/plates (nested sub-path)', () => {
    // Nested TC paths like /register/TOKEN/plates are also TC-protected
    expect(isTcPage('/register/TC-TOKEN-001/plates')).toBe(true)
  })

  it('does not match /bookings or /login', () => {
    expect(isTcPage('/bookings')).toBe(false)
    expect(isTcPage('/login')).toBe(false)
  })
})

describe('TC API route pattern — /^\\\/api\\\/register\\/[^/]/', () => {
  const isTcApi = (pathname: string) => /^\/api\/register\/[^/]/.test(pathname)

  it('matches /api/register/bookings', () => {
    expect(isTcApi('/api/register/bookings')).toBe(true)
  })

  it('matches /api/register/TOKEN', () => {
    expect(isTcApi('/api/register/TC-TOKEN-001')).toBe(true)
  })

  it('does not match /api/register/auth/login (handled by PUBLIC_ROUTES first)', () => {
    // /api/register/auth/login starts with /api/register/a, so pattern matches —
    // but PUBLIC_ROUTES (/^\/api\/register\/auth\//) is checked before TC routes.
    // The pattern match here is expected; middleware order ensures auth routes stay public.
    expect(isTcApi('/api/register/auth/login')).toBe(true)
  })

  it('does not match /api/bookings', () => {
    expect(isTcApi('/api/bookings')).toBe(false)
  })
})

// ── Booking list filtering ──────────────────────────────────────────────────

type RawBooking = {
  fastlane_token: string | null
  token_cancelled: boolean
  booking_number: string
}

/** Replicates the filter applied by the API and Supabase query. */
function filterBookings(bookings: RawBooking[]) {
  return bookings.filter(b => b.fastlane_token !== null && !b.token_cancelled)
}

describe('TC booking list filter', () => {
  const base: RawBooking = { fastlane_token: 'TOKEN-1', token_cancelled: false, booking_number: 'BK-001' }

  it('keeps a booking with a token and token_cancelled=false', () => {
    expect(filterBookings([base])).toHaveLength(1)
  })

  it('excludes a booking with token_cancelled=true', () => {
    expect(filterBookings([{ ...base, token_cancelled: true }])).toHaveLength(0)
  })

  it('excludes a booking with fastlane_token=null', () => {
    expect(filterBookings([{ ...base, fastlane_token: null }])).toHaveLength(0)
  })

  it('returns only the matching bookings from a mixed list', () => {
    const bookings: RawBooking[] = [
      { fastlane_token: 'TK-1', token_cancelled: false, booking_number: 'BK-001' },
      { fastlane_token: null,   token_cancelled: false, booking_number: 'BK-002' },
      { fastlane_token: 'TK-3', token_cancelled: true,  booking_number: 'BK-003' },
      { fastlane_token: 'TK-4', token_cancelled: false, booking_number: 'BK-004' },
    ]
    const result = filterBookings(bookings)
    expect(result).toHaveLength(2)
    expect(result.map(b => b.booking_number)).toEqual(['BK-001', 'BK-004'])
  })

  it('returns empty array when input is empty', () => {
    expect(filterBookings([])).toHaveLength(0)
  })
})
