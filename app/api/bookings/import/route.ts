import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { handleApiError, ApiError } from '@/lib/api/errors'
import { z } from 'zod'

const ImportItemSchema = z.object({
  booking_number: z.string().min(1).max(50),
  terminal_id: z.string().uuid(),
  truck_company_id: z.string().uuid(),
  num_trucks: z.number().int().min(1).max(999),
})

const ImportSchema = z.object({
  bookings: z.array(ImportItemSchema).min(1).max(500),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req)
    if (!session || (session.role !== 'admin' && session.role !== 'agent')) throw ApiError.forbidden()

    const body = await req.json()
    const parsed = ImportSchema.safeParse(body)
    if (!parsed.success) throw ApiError.badRequest(parsed.error.issues[0]?.message)

    const supabase = getServerClient()

    // Upsert by booking_number (conflict on booking_number)
    const { data, error } = await supabase
      .from('bookings')
      .upsert(parsed.data.bookings, {
        onConflict: 'booking_number',
        ignoreDuplicates: false,
      })
      .select('id, booking_number, status')

    if (error) throw ApiError.internal(error.message)

    return NextResponse.json({
      data: { imported: data?.length ?? 0, bookings: data }
    })
  } catch (err) {
    const { error, code, status } = handleApiError(err)
    return NextResponse.json({ error, code }, { status })
  }
}
