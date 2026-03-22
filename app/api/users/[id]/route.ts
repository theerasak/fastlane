import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { handleApiError, ApiError } from '@/lib/api/errors'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'

const UpdateUserSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['admin', 'agent', 'supervisor']).optional(),
  is_active: z.boolean().optional(),
  is_privileged: z.boolean().optional(),
  company_name: z.string().max(200).optional().nullable(),
  contact_person: z.string().max(200).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
})

const USER_FIELDS = 'id, email, role, is_active, is_privileged, company_name, contact_person, phone, created_at'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(req)
    if (!session || session.role !== 'admin') throw ApiError.forbidden()

    const { id } = await params
    const supabase = getServerClient()
    const { data, error } = await supabase
      .from('users')
      .select(USER_FIELDS)
      .eq('id', id)
      .single()

    if (error || !data) throw ApiError.notFound('User not found')

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
    const parsed = UpdateUserSchema.safeParse(body)
    if (!parsed.success) throw ApiError.badRequest(parsed.error.issues[0]?.message)

    const supabase = getServerClient()

    // Fetch current record for audit old_data
    const { data: before } = await supabase
      .from('users')
      .select(USER_FIELDS)
      .eq('id', id)
      .single()

    const updates: Record<string, unknown> = {}
    if (parsed.data.email) updates.email = parsed.data.email.toLowerCase()
    if (parsed.data.role) updates.role = parsed.data.role
    if (parsed.data.is_active !== undefined) updates.is_active = parsed.data.is_active
    if (parsed.data.is_privileged !== undefined) updates.is_privileged = parsed.data.is_privileged
    if (parsed.data.company_name !== undefined) updates.company_name = parsed.data.company_name
    if (parsed.data.contact_person !== undefined) updates.contact_person = parsed.data.contact_person
    if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone
    if (parsed.data.password) updates.password_hash = await bcrypt.hash(parsed.data.password, 12)

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select(USER_FIELDS)
      .single()

    if (error || !data) throw ApiError.notFound('User not found')

    await writeAuditLog({
      table_name: 'users',
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
    if (id === session.id) throw ApiError.badRequest('Cannot delete your own account')

    const supabase = getServerClient()

    // Fetch before deleting for audit
    const { data: before } = await supabase
      .from('users')
      .select(USER_FIELDS)
      .eq('id', id)
      .single()

    const { error } = await supabase.from('users').delete().eq('id', id)

    if (error) throw ApiError.internal(error.message)

    await writeAuditLog({
      table_name: 'users',
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
