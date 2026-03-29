import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { handleApiError, ApiError } from '@/lib/api/errors'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'

const UpdateBookingSchema = z.object({
  status: z.enum(['FILLING-IN', 'BOOKED', 'CLOSED']).optional(),
  num_trucks: z.number().int().min(1).optional(),
  truck_company_id: z.string().uuid().optional(),
  is_privileged_booking: z.boolean().optional(),
  created_by: z.string().uuid().nullable().optional(),
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
        fastlane_token, token_cancelled, token_expires_at, status, created_at, booked_at, closed_at,
        is_privileged_booking, booking_date,
        port_terminals(name),
        truck_companies(name)
      `)
      .eq('id', id)
      .single()

    if (error || !data) throw ApiError.notFound('Booking not found')

    // Get fill stats and creator info in parallel
    const [{ data: fillData }, { data: auditEntry }] = await Promise.all([
      supabase.from('booking_fill_stats').select('active_count').eq('booking_id', id).single(),
      supabase.from('audit_log').select('performed_by, performed_by_email').eq('table_name', 'bookings').eq('record_id', id).eq('action', 'CREATE').maybeSingle(),
    ])

    // Look up agent details from creator
    let agentEmail: string | null = auditEntry?.performed_by_email ?? null
    let agentCompanyName: string | null = null
    let createdBy: string | null = auditEntry?.performed_by ?? null
    if (auditEntry?.performed_by) {
      const { data: agentUser } = await supabase.from('users').select('id, email, company_name').eq('id', auditEntry.performed_by).single()
      if (agentUser) {
        agentEmail = agentUser.email
        agentCompanyName = agentUser.company_name ?? null
      }
    }

    return NextResponse.json({
      data: {
        ...data,
        terminal_name: (data.port_terminals as unknown as { name: string } | null)?.name,
        truck_company_name: (data.truck_companies as unknown as { name: string } | null)?.name,
        active_count: fillData?.active_count ?? 0,
        agent_email: agentEmail,
        agent_company_name: agentCompanyName,
        created_by: createdBy,
        is_privileged_booking: (data as unknown as { is_privileged_booking: boolean }).is_privileged_booking,
        booking_date: (data as unknown as { booking_date: string }).booking_date,
        token_expires_at: (data as unknown as { token_expires_at: string | null }).token_expires_at ?? null,
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

    // Admin-only fields
    if (session.role !== 'admin') {
      if (parsed.data.truck_company_id !== undefined ||
          parsed.data.is_privileged_booking !== undefined ||
          parsed.data.created_by !== undefined) {
        throw ApiError.forbidden()
      }
    }

    const newCreatedBy = parsed.data.created_by
    const updates: Record<string, unknown> = {}
    if (parsed.data.status !== undefined) updates.status = parsed.data.status
    if (parsed.data.num_trucks !== undefined) updates.num_trucks = parsed.data.num_trucks
    if (parsed.data.truck_company_id !== undefined) updates.truck_company_id = parsed.data.truck_company_id
    if (parsed.data.is_privileged_booking !== undefined) updates.is_privileged_booking = parsed.data.is_privileged_booking
    if (parsed.data.status === 'BOOKED') updates.booked_at = new Date().toISOString()
    if (parsed.data.status === 'CLOSED') updates.closed_at = new Date().toISOString()
    // created_by is handled via RPC (not direct PostgREST update)

    const supabase = getServerClient()

    const { data: before } = await supabase
      .from('bookings')
      .select('id, booking_number, status, num_trucks, is_privileged_booking, booking_date, created_at, booked_at, closed_at')
      .eq('id', id)
      .single()

    const { data, error } = await supabase
      .from('bookings')
      .update(updates)
      .eq('id', id)
      .select('id, booking_number, terminal_id, truck_company_id, num_trucks, fastlane_token, token_cancelled, status, is_privileged_booking, booking_date, created_at, booked_at, closed_at')
      .single()

    if (error || !data) throw ApiError.notFound('Booking not found')

    // Update created_by via RPC if changed
    if (newCreatedBy !== undefined) {
      await supabase.rpc('set_booking_created_by', { p_id: id, p_user_id: newCreatedBy })
    }

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
