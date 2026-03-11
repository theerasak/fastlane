import { describe, it, expect } from 'vitest'
import { LicensePlateSchema, AddPlateSchema, EditPlateSchema } from '@/lib/validations/register'

describe('LicensePlateSchema', () => {
  it('accepts valid plates', () => {
    const valid = ['ABC-1234', 'XYZ 999', 'A1', 'TH-1234-AB', '1234567890']
    for (const plate of valid) {
      expect(() => LicensePlateSchema.parse(plate)).not.toThrow()
    }
  })

  it('passes uppercase input unchanged', () => {
    const result = LicensePlateSchema.parse('ABC-123')
    expect(result).toBe('ABC-123')
  })

  it('rejects lowercase input (regex validates before transform)', () => {
    expect(() => LicensePlateSchema.parse('abc-123')).toThrow()
  })

  it('rejects empty string', () => {
    expect(() => LicensePlateSchema.parse('')).toThrow()
  })

  it('rejects plate longer than 20 chars', () => {
    expect(() => LicensePlateSchema.parse('A'.repeat(21))).toThrow()
  })

  it('rejects plates starting with special char', () => {
    expect(() => LicensePlateSchema.parse('-ABC123')).toThrow()
  })

  it('rejects plates with invalid chars like @', () => {
    expect(() => LicensePlateSchema.parse('ABC@123')).toThrow()
  })
})

describe('AddPlateSchema', () => {
  it('accepts valid body', () => {
    const result = AddPlateSchema.parse({ license_plate: 'ABC-1234', hour_slot: 9 })
    expect(result.license_plate).toBe('ABC-1234')
    expect(result.hour_slot).toBe(9)
  })

  it('rejects hour_slot < 0', () => {
    expect(() => AddPlateSchema.parse({ license_plate: 'ABC-1234', hour_slot: -1 })).toThrow()
  })

  it('rejects hour_slot > 23', () => {
    expect(() => AddPlateSchema.parse({ license_plate: 'ABC-1234', hour_slot: 24 })).toThrow()
  })

  it('rejects non-integer hour_slot', () => {
    expect(() => AddPlateSchema.parse({ license_plate: 'ABC-1234', hour_slot: 9.5 })).toThrow()
  })
})

describe('EditPlateSchema', () => {
  it('accepts valid license_plate', () => {
    const result = EditPlateSchema.parse({ license_plate: 'XYZ-99' })
    expect(result.license_plate).toBe('XYZ-99')
  })

  it('rejects missing license_plate', () => {
    expect(() => EditPlateSchema.parse({})).toThrow()
  })
})
