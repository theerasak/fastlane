import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { handleApiError, ApiError } from '@/lib/api/errors'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'

const UpdateBookingSchema = z.object({
  status: z.enum(['FILLING-IN', 'BOOKED', 'CLOSED']).optional(),
  num_trucks: z.number().int().min(1).optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(req)
    if (!session || (session.role !== 'admin' && session.role !== 'agent')) throw ApiError.forbidden()

    const { id } = await params
    const supabase = getServerClient()
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        id, booking_number, terminal_id, truck_company_id, num_trucks,
        fastlane_token, token_cancelled, status, created_at, booked_at, closed_at,
        port_terminals(name),
        truck_companies(name)
      `)
      .eq('id', id)
      .single()

    if (error || !data) throw ApiError.notFound('Booking not found')

    const { data: fillData } = await supabase
      .from('booking_fill_stats')
      .select('active_count')
      .eq('booking_id', id)
      .single()

    return NextResponse.json({
      data: {
        ...data,
        terminal_name: (data.port_terminals as unknown as { name: string } | null)?.name,
        truck_company_name: (data.truck_companies as unknown as { name: string } | null)?.name,
        active_count: fillData?.active_count ?? 0,
        port_terminals: undefined,
        truck_companies: undefined,
      }
    })
  } catch (err) {
    const { error, code, status } = handleApiError(err)
    return NextResponse.json({ error, code }, { status })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(req)
    if (!session || (session.role !== 'admin' && session.role !== 'agent')) throw ApiError.forbidden()

    const { id } = await params
    const body = await req.json()
    const parsed = UpdateBookingSchema.safeParse(body)
    if (!parsed.success) throw ApiError.badRequest(parsed.error.issues[0]?.message)

    const updates: Record<string, unknown> = { ...parsed.data }
    if (parsed.data.status === 'BOOKED') updates.booked_at = new Date().toISOString()
    if (parsed.data.status === 'CLOSED') updates.closed_at = new Date().toISOString()

    const supabase = getServerClient()

    const { data: before } = await supabase
      .from('bookings')
      .select('id, booking_number, status, num_trucks, created_at, booked_at, closed_at')
      .eq('id', id)
      .single()

    const { data, error } = await supabase
      .from('bookings')
      .update(updates)
      .eq('id', id)
      .select('id, booking_number, terminal_id, truck_company_id, num_trucks, fastlane_token, token_cancelled, status, created_at, booked_at, closed_at')
      .single()

    if (error || !data) throw ApiError.notFound('Booking not found')

    await writeAuditLog({
      table_name: 'bookings',
      record_id: id,
      action: 'UPDATE',
      performed_by: session.id,
      performed_by_email: session.email,
      old_data: before ? { ...before } : null,
      new_data: { ...data },
    })

    return NextResponse.json({ data })
  } catch (err) {
    const { error, code, status } = handleApiError(err)
    return NextResponse.json({ error, code }, { status })
  }
}
