import { describe, it, expect } from 'vitest'
import { LicensePlateSchema, AddPlateSchema, EditPlateSchema } from '@/lib/validations/register'

describe('LicensePlateSchema', () => {
  it('accepts valid plates', () => {
    const valid = ['AB-1234', 'ABC-1234', 'XY-9999', 'A1-0000']
    for (const plate of valid) {
      expect(() => LicensePlateSchema.parse(plate)).not.toThrow()
    }
  })

  it('passes uppercase input unchanged', () => {
    const result = LicensePlateSchema.parse('ABC-1234')
    expect(result).toBe('ABC-1234')
  })

  it('rejects lowercase input (regex validates before transform)', () => {
    expect(() => LicensePlateSchema.parse('abc-1234')).toThrow()
  })

  it('rejects empty string', () => {
    expect(() => LicensePlateSchema.parse('')).toThrow()
  })

  it('rejects plates not matching format (too short digits)', () => {
    expect(() => LicensePlateSchema.parse('AB-123')).toThrow()
  })

  it('rejects plates starting with special char', () => {
    expect(() => LicensePlateSchema.parse('-ABC1234')).toThrow()
  })

  it('rejects plates with invalid chars like @', () => {
    expect(() => LicensePlateSchema.parse('AB@1234')).toThrow()
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
    const result = EditPlateSchema.parse({ license_plate: 'XY-9999' })
    expect(result.license_plate).toBe('XY-9999')
  })

  it('accepts valid hour_slot only', () => {
    const result = EditPlateSchema.parse({ hour_slot: 10 })
    expect(result.hour_slot).toBe(10)
  })

  it('accepts both license_plate and hour_slot', () => {
    const result = EditPlateSchema.parse({ license_plate: 'AB-1234', hour_slot: 5 })
    expect(result.license_plate).toBe('AB-1234')
    expect(result.hour_slot).toBe(5)
  })

  it('rejects when both license_plate and hour_slot are missing', () => {
    expect(() => EditPlateSchema.parse({})).toThrow()
  })
})
