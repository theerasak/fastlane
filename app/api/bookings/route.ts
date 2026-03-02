import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { handleApiError, ApiError } from '@/lib/api/errors'
import { z } from 'zod'

const CreateBookingSchema = z.object({
  booking_number: z.string().min(1).max(50),
  terminal_id: z.string().uuid(),
  truck_company_id: z.string().uuid(),
  num_trucks: z.number().int().min(1).max(999),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req)
    if (!session || (session.role !== 'admin' && session.role !== 'agent')) throw ApiError.forbidden()

    const { searchParams } = req.nextUrl
    const bookingNumber = searchParams.get('booking_number')

    const supabase = getServerClient()
    let query = supabase
      .from('bookings')
      .select(`
        id, booking_number, terminal_id, truck_company_id, num_trucks,
        fastlane_token, token_cancelled, status, created_at, booked_at, closed_at,
        port_terminals(name),
        truck_companies(name)
      `)
      .order('created_at', { ascending: false })

    if (bookingNumber) {
      query = query.ilike('booking_number', `%${bookingNumber}%`)
    }

    const { data, error } = await query

    if (error) throw ApiError.internal(error.message)

    // Flatten joined data and get fill stats
    const bookingIds = (data ?? []).map((b: { id: string }) => b.id)
    let fillStats: Array<{ booking_id: string; active_count: number }> = []
    if (bookingIds.length > 0) {
      const { data: stats } = await supabase
        .from('booking_fill_stats')
        .select('booking_id, active_count')
        .in('booking_id', bookingIds)
      fillStats = stats ?? []
    }

    const statsMap = Object.fromEntries(fillStats.map(s => [s.booking_id, s.active_count]))

    const formatted = (data ?? []).map((b: Record<string, unknown>) => ({
      ...b,
      terminal_name: (b.port_terminals as { name: string } | null)?.name,
      truck_company_name: (b.truck_companies as { name: string } | null)?.name,
      active_count: statsMap[b.id as string] ?? 0,
      port_terminals: undefined,
      truck_companies: undefined,
    }))

    return NextResponse.json({ data: formatted })
  } catch (err) {
    const { error, code, status } = handleApiError(err)
    return NextResponse.json({ error, code }, { status })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req)
    if (!session || (session.role !== 'admin' && session.role !== 'agent')) throw ApiError.forbidden()

    const body = await req.json()
    const parsed = CreateBookingSchema.safeParse(body)
    if (!parsed.success) throw ApiError.badRequest(parsed.error.issues[0]?.message)

    const supabase = getServerClient()
    const { data, error } = await supabase
      .from('bookings')
      .insert(parsed.data)
      .select('id, booking_number, terminal_id, truck_company_id, num_trucks, fastlane_token, token_cancelled, status, created_at, booked_at, closed_at')
      .single()

    if (error) {
      if (error.code === '23505') throw ApiError.conflict('Booking number already exists')
      throw ApiError.internal(error.message)
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    const { error, code, status } = handleApiError(err)
    return NextResponse.json({ error, code }, { status })
  }
}
