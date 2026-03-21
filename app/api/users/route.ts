import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { handleApiError, ApiError } from '@/lib/api/errors'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'

const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['admin', 'agent', 'supervisor']),
  contact_person: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
})

const USER_FIELDS = 'id, email, role, is_active, is_privileged, contact_person, phone, created_at'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req)
    if (!session || session.role !== 'admin') throw ApiError.forbidden()

    const supabase = getServerClient()
    const { data, error } = await supabase
      .from('users')
      .select(USER_FIELDS)
      .order('created_at', { ascending: false })

    if (error) throw ApiError.internal(error.message)

    return NextResponse.json({ data })
  } catch (err) {
    const { error, code, status } = handleApiError(err)
    return NextResponse.json({ error, code }, { status })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req)
    if (!session || session.role !== 'admin') throw ApiError.forbidden()

    const body = await req.json()
    const parsed = CreateUserSchema.safeParse(body)
    if (!parsed.success) throw ApiError.badRequest(parsed.error.issues[0]?.message)

    const { email, password, role, contact_person, phone } = parsed.data
    const password_hash = await bcrypt.hash(password, 12)

    const supabase = getServerClient()
    const { data, error } = await supabase
      .from('users')
      .insert({
        email: email.toLowerCase(),
        password_hash,
        role,
        contact_person: contact_person || null,
        phone: phone || null,
      })
      .select(USER_FIELDS)
      .single()

    if (error) {
      if (error.code === '23505') throw ApiError.conflict('Email already exists')
      throw ApiError.internal(error.message)
    }

    await writeAuditLog({
      table_name: 'users',
      record_id: data.id,
      action: 'CREATE',
      performed_by: session.id,
      performed_by_email: session.email,
      new_data: { id: data.id, email: data.email, role: data.role, is_active: data.is_active, is_privileged: data.is_privileged },
    })

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    const { error, code, status } = handleApiError(err)
    return NextResponse.json({ error, code }, { status })
  }
}
