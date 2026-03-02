import { z } from 'zod'

// License plate: 1-20 chars, alphanumeric + hyphens/spaces, uppercase
export const LicensePlateSchema = z.string()
  .min(1, 'License plate is required')
  .max(20, 'License plate must be 20 characters or less')
  .regex(/^[A-Z0-9][A-Z0-9\s\-]*[A-Z0-9]$|^[A-Z0-9]$/, 'Invalid license plate format')
  .transform(s => s.toUpperCase().trim())

export const AddPlateSchema = z.object({
  license_plate: LicensePlateSchema,
  hour_slot: z.number().int().min(0).max(23),
})

export const EditPlateSchema = z.object({
  license_plate: LicensePlateSchema,
})
