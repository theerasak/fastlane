import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { handleApiError, ApiError } from '@/lib/api/errors'

export interface DailySummaryRow {
  id: string
  booking_date: string
  hour_slot: number
  license_plate: string
  container_number: string
  registered_at: string
  booking_number: string
  truck_company_name: string
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req)
    if (!session || session.role !== 'supervisor') throw ApiError.forbidden()

    const date = req.nextUrl.searchParams.get('date')
    if (!date) throw ApiError.badRequest('date is required')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw ApiError.badRequest('date must be in YYYY-MM-DD format')
    }

    const supabase = getServerClient()
    const { data, error } = await supabase
      .from('fastlane_registrations')
      .select(`
        id, appointment_date, hour_slot, license_plate, container_number, registered_at,
        bookings!inner(booking_number, truck_companies!inner(name))
      `)
      .eq('is_deleted', false)
      .eq('appointment_date', date)

    if (error) throw ApiError.internal(error.message)

    const rows: DailySummaryRow[] = (data ?? []).map((r: Record<string, unknown>) => {
      const booking = r.bookings as { booking_number: string; truck_companies: { name: string } | null } | null
      return {
        id: r.id as string,
        booking_date: r.appointment_date as string,
        hour_slot: r.hour_slot as number,
        license_plate: r.license_plate as string,
        container_number: r.container_number as string,
        registered_at: r.registered_at as string,
        booking_number: booking?.booking_number ?? '—',
        truck_company_name: booking?.truck_companies?.name ?? '—',
      }
    })

    rows.sort((a, b) => {
      const d = a.booking_date.localeCompare(b.booking_date)
      if (d !== 0) return d
      if (a.hour_slot !== b.hour_slot) return a.hour_slot - b.hour_slot
      const c = a.container_number.localeCompare(b.container_number)
      if (c !== 0) return c
      return a.license_plate.localeCompare(b.license_plate)
    })

    return NextResponse.json({ data: rows })
  } catch (err) {
    const { error, code, status } = handleApiError(err)
    return NextResponse.json({ error, code }, { status })
  }
}
