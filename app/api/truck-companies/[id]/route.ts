import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { handleApiError, ApiError } from '@/lib/api/errors'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'

const UpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  contact_email: z.string().email().optional().or(z.literal('')),
  contact_person: z.string().max(200).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  is_active: z.boolean().optional(),
})

const TC_FIELDS = 'id, name, contact_email, contact_person, phone, is_active, created_at'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(req)
    if (!session) throw ApiError.unauthorized()

    const { id } = await params
    const supabase = getServerClient()
    const { data, error } = await supabase
      .from('truck_companies')
      .select(TC_FIELDS)
      .eq('id', id)
      .single()

    if (error || !data) throw ApiError.notFound('Truck company not found')

    return NextResponse.json({ data })
  } catch (err) {
    const { error, code, status } = handleApiError(err)
    return NextResponse.json({ error, code }, { status })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(req)
    if (!session || session.role !== 'admin') throw ApiError.forbidden()

    const { id } = await params
    const body = await req.json()
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) throw ApiError.badRequest(parsed.error.issues[0]?.message)

    const supabase = getServerClient()

    // Fetch current record for audit old_data
    const { data: before } = await supabase
      .from('truck_companies')
      .select(TC_FIELDS)
      .eq('id', id)
      .single()

    const updates: Record<string, unknown> = {}
    if (parsed.data.name !== undefined) updates.name = parsed.data.name
    if (parsed.data.contact_email !== undefined) updates.contact_email = parsed.data.contact_email || null
    if (parsed.data.contact_person !== undefined) updates.contact_person = parsed.data.contact_person
    if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone
    if (parsed.data.is_active !== undefined) updates.is_active = parsed.data.is_active

    const { data, error } = await supabase
      .from('truck_companies')
      .update(updates)
      .eq('id', id)
      .select(TC_FIELDS)
      .single()

    if (error || !data) throw ApiError.notFound('Truck company not found')

    await writeAuditLog({
      table_name: 'truck_companies',
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

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(req)
    if (!session || session.role !== 'admin') throw ApiError.forbidden()

    const { id } = await params
    const supabase = getServerClient()

    // Fetch before deleting for audit
    const { data: before } = await supabase
      .from('truck_companies')
      .select(TC_FIELDS)
      .eq('id', id)
      .single()

    const { error } = await supabase.from('truck_companies').delete().eq('id', id)

    if (error) throw ApiError.internal(error.message)

    await writeAuditLog({
      table_name: 'truck_companies',
      record_id: id,
      action: 'DELETE',
      performed_by: session.id,
      performed_by_email: session.email,
      old_data: before ? { ...before } : null,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    const { error, code, status } = handleApiError(err)
    return NextResponse.json({ error, code }, { status })
  }
}
