import { z } from 'zod'

// License plate: "00-0000" (2 chars + dash + 4 digits) or "000-0000" (3 chars + dash + 4 digits)
export const LicensePlateSchema = z.string()
  .min(1, 'License plate is required')
  .regex(/^[A-Z0-9]{2,3}-\d{4}$/, 'Format must be XX-0000 or XXX-0000 (e.g. AB-1234 or ABC-1234)')
  .transform(s => s.toUpperCase().trim())

export const AddPlateSchema = z.object({
  license_plate: LicensePlateSchema,
  hour_slot: z.number().int().min(0).max(23),
})

export const EditRegistrationSchema = z.object({
  license_plate: LicensePlateSchema.optional(),
  hour_slot: z.number().int().min(0).max(23).optional(),
}).refine(d => d.license_plate !== undefined || d.hour_slot !== undefined, {
  message: 'At least one of license_plate or hour_slot must be provided',
})

// Backward compatibility alias
export const EditPlateSchema = EditRegistrationSchema
