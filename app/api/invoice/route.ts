import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { handleApiError, ApiError } from '@/lib/api/errors'

export interface InvoiceRow {
  id: string
  created_at: string
  booking_number: string
  truck_company_name: string
  fastlane_token: string | null
  token_cancelled: boolean
  num_trucks: number
  amount: number
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req)
    if (!session || session.role !== 'agent') throw ApiError.forbidden()

    const supabase = getServerClient()

    const { data: user } = await supabase
      .from('users')
      .select('is_privileged')
      .eq('id', session.id)
      .single()

    if (!user?.is_privileged) throw ApiError.forbidden()

    const { searchParams } = req.nextUrl
    const fromDate = searchParams.get('from_date')
    const toDate = searchParams.get('to_date')

    if (!fromDate || !toDate) throw ApiError.badRequest('from_date and to_date are required')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
      throw ApiError.badRequest('Dates must be in YYYY-MM-DD format')
    }

    // Use Bangkok (UTC+7) boundaries for the selected dates
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        id, created_at, booking_number, num_trucks,
        fastlane_token, token_cancelled,
        truck_companies(name)
      `)
      .eq('created_by', session.id)
      .gte('created_at', `${fromDate}T00:00:00+07:00`)
      .lte('created_at', `${toDate}T23:59:59.999+07:00`)

    if (error) throw ApiError.internal(error.message)

    const rows: InvoiceRow[] = (data ?? []).map((b: Record<string, unknown>) => ({
      id: b.id as string,
      created_at: b.created_at as string,
      booking_number: b.booking_number as string,
      truck_company_name: (b.truck_companies as { name: string } | null)?.name ?? '—',
      fastlane_token: b.fastlane_token as string | null,
      token_cancelled: b.token_cancelled as boolean,
      num_trucks: b.num_trucks as number,
      amount: (b.num_trucks as number) * 100,
    }))

    rows.sort((a, b) => {
      const d = a.created_at.localeCompare(b.created_at)
      if (d !== 0) return d
      const n = a.booking_number.localeCompare(b.booking_number)
      if (n !== 0) return n
      return a.truck_company_name.localeCompare(b.truck_company_name)
    })

    return NextResponse.json({ data: rows })
  } catch (err) {
    const { error, code, status } = handleApiError(err)
    return NextResponse.json({ error, code }, { status })
  }
}
