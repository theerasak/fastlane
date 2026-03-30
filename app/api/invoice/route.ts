import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { handleApiError, ApiError } from '@/lib/api/errors'
import { PRICE_PER_CONTAINER_PRIVILEGED, PRICE_PER_CONTAINER_NON_PRIVILEGED } from '@/lib/config/pricing'

export interface InvoiceRow {
  id: string
  created_at: string
  terminal_id: string
  terminal_name: string
  booking_number: string
  truck_company_name: string
  fastlane_token: string | null
  token_cancelled: boolean
  is_privileged_booking: boolean
  num_trucks: number
  price_per_container: number
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
    const terminalId = searchParams.get('terminal_id')

    if (!fromDate || !toDate) throw ApiError.badRequest('from_date and to_date are required')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
      throw ApiError.badRequest('Dates must be in YYYY-MM-DD format')
    }

    // Use Bangkok (UTC+7) boundaries for the selected dates
    let query = supabase
      .from('bookings')
      .select(`
        id, created_at, booking_number, num_trucks, terminal_id, is_privileged_booking,
        fastlane_token, token_cancelled,
        truck_companies(name),
        port_terminals(id, name)
      `)
      .eq('created_by', session.id)
      .gte('created_at', `${fromDate}T00:00:00+07:00`)
      .lte('created_at', `${toDate}T23:59:59.999+07:00`)

    if (terminalId) {
      query = query.eq('terminal_id', terminalId)
    }

    const { data, error } = await query

    if (error) throw ApiError.internal(error.message)

    const rows: InvoiceRow[] = (data ?? []).map((b: Record<string, unknown>) => {
      const isPrivileged = b.is_privileged_booking as boolean
      const numTrucks = b.num_trucks as number
      const pricePerContainer = isPrivileged ? PRICE_PER_CONTAINER_PRIVILEGED : PRICE_PER_CONTAINER_NON_PRIVILEGED
      return {
        id: b.id as string,
        created_at: b.created_at as string,
        terminal_id: b.terminal_id as string,
        terminal_name: (b.port_terminals as { id: string; name: string } | null)?.name ?? '—',
        booking_number: b.booking_number as string,
        truck_company_name: (b.truck_companies as { name: string } | null)?.name ?? '—',
        fastlane_token: b.fastlane_token as string | null,
        token_cancelled: b.token_cancelled as boolean,
        is_privileged_booking: isPrivileged,
        num_trucks: numTrucks,
        price_per_container: pricePerContainer,
        amount: numTrucks * pricePerContainer,
      }
    })

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
