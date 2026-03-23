import { z } from 'zod'

// License plate: "00-0000" (2 chars + dash + 4 digits) or "000-0000" (3 chars + dash + 4 digits)
export const LicensePlateSchema = z.string()
  .min(1, 'License plate is required')
  .regex(/^[A-Z0-9]{2,3}-\d{4}$/, 'Format must be XX-0000 or XXX-0000 (e.g. AB-1234 or ABC-1234)')
  .transform(s => s.toUpperCase().trim())

// Container number: 4 uppercase letters + 7 digits = 11 chars (e.g. ABCD1234567)
export const ContainerNumberSchema = z.string()
  .min(1, 'Container number is required')
  .regex(/^[A-Z]{4}\d{7}$/, 'Format must be 4 letters + 7 digits (e.g. ABCD1234567)')
  .transform(s => s.toUpperCase().trim())

export const AddPlateSchema = z.object({
  license_plate: LicensePlateSchema,
  container_number: ContainerNumberSchema,
  hour_slot: z.number().int().min(0).max(23),
})

export const EditRegistrationSchema = z.object({
  license_plate: LicensePlateSchema.optional(),
  container_number: ContainerNumberSchema.optional(),
  hour_slot: z.number().int().min(0).max(23).optional(),
}).refine(
  d => d.license_plate !== undefined || d.container_number !== undefined || d.hour_slot !== undefined,
  { message: 'At least one of license_plate, container_number, or hour_slot must be provided' },
)

// Backward compatibility alias
export const EditPlateSchema = EditRegistrationSchema
