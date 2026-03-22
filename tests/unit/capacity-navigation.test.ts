import { describe, it, expect } from 'vitest'
import { shiftDate } from '@/lib/utils/date'

describe('shiftDate', () => {
  it('advances one day forward', () => {
    expect(shiftDate('2099-12-31', 1)).toBe('2100-01-01')
  })

  it('goes one day back', () => {
    expect(shiftDate('2099-12-31', -1)).toBe('2099-12-30')
  })

  it('crosses month boundary forward', () => {
    expect(shiftDate('2026-01-31', 1)).toBe('2026-02-01')
  })

  it('crosses month boundary backward', () => {
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('crosses year boundary forward', () => {
    expect(shiftDate('2025-12-31', 1)).toBe('2026-01-01')
  })

  it('crosses year boundary backward', () => {
    expect(shiftDate('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('handles leap year day correctly', () => {
    expect(shiftDate('2024-02-28', 1)).toBe('2024-02-29')
    expect(shiftDate('2024-02-29', 1)).toBe('2024-03-01')
  })

  it('skips multiple days forward', () => {
    expect(shiftDate('2026-03-22', 7)).toBe('2026-03-29')
  })

  it('skips multiple days backward', () => {
    expect(shiftDate('2026-03-22', -7)).toBe('2026-03-15')
  })

  it('returns same date when shift is 0', () => {
    expect(shiftDate('2026-03-22', 0)).toBe('2026-03-22')
  })

  it('always returns YYYY-MM-DD format', () => {
    const result = shiftDate('2026-01-05', 1)
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('produces the correct result regardless of local timezone offset', () => {
    // The key invariant: shiftDate('X', 1) followed by shiftDate(result, -1) === 'X'
    const original = '2026-07-15'
    const next = shiftDate(original, 1)
    const back = shiftDate(next, -1)
    expect(back).toBe(original)
  })
})
