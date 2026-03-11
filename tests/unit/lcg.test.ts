import { describe, it, expect, vi } from 'vitest'
import { generateLcgToken, generateUniqueToken } from '@/lib/lcg/token'

describe('generateLcgToken', () => {
  it('returns a 12-character string', () => {
    const token = generateLcgToken('00000000-0000-0000-0000-000000000001', 1000)
    expect(token).toHaveLength(12)
  })

  it('returns only uppercase alphanumeric characters (base36)', () => {
    const token = generateLcgToken('00000000-0000-0000-0000-000000000001', 1000)
    expect(token).toMatch(/^[A-Z0-9]{12}$/)
  })

  it('is deterministic for same uuid + timestamp', () => {
    const t1 = generateLcgToken('abc-def-123', 99999)
    const t2 = generateLcgToken('abc-def-123', 99999)
    expect(t1).toBe(t2)
  })

  it('produces different tokens for different timestamps', () => {
    const t1 = generateLcgToken('00000000-0000-0000-0000-000000000001', 1000)
    const t2 = generateLcgToken('00000000-0000-0000-0000-000000000001', 1001)
    expect(t1).not.toBe(t2)
  })

  it('produces different tokens for different uuids', () => {
    const t1 = generateLcgToken('00000000-0000-0000-0000-000000000001', 1000)
    const t2 = generateLcgToken('00000000-0000-0000-0000-000000000002', 1000)
    expect(t1).not.toBe(t2)
  })
})

describe('generateUniqueToken', () => {
  it('returns a token when the first attempt is unique', async () => {
    const isUnique = vi.fn().mockResolvedValue(true)
    const token = await generateUniqueToken('00000000-0000-0000-0000-000000000001', isUnique)
    expect(token).toHaveLength(12)
    expect(isUnique).toHaveBeenCalledTimes(1)
  })

  it('retries until a unique token is found', async () => {
    const isUnique = vi.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
    const token = await generateUniqueToken('00000000-0000-0000-0000-000000000001', isUnique)
    expect(token).toHaveLength(12)
    expect(isUnique).toHaveBeenCalledTimes(3)
  })

  it('throws after maxRetries attempts', async () => {
    const isUnique = vi.fn().mockResolvedValue(false)
    await expect(
      generateUniqueToken('00000000-0000-0000-0000-000000000001', isUnique, 3)
    ).rejects.toThrow('Failed to generate unique token after maximum retries')
    expect(isUnique).toHaveBeenCalledTimes(3)
  })
})
