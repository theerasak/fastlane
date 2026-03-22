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
  is_privileged: z.boolean().optional(),
  company_name: z.string().max(200).optional().nullable(),
  contact_person: z.string().max(200).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
})

const USER_FIELDS = 'id, email, role, is_active, is_privileged, company_name, contact_person, phone, created_at'

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
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      const fieldLabels: Record<string, string> = {
        email: 'Email', password: 'Password', role: 'Role',
        company_name: 'Company Name', contact_person: 'Contact Person', phone: 'Phone',
      }
      const field = issue?.path[0] ? fieldLabels[issue.path[0] as string] ?? String(issue.path[0]) : null
      const message = field ? `${field}: ${issue?.message}` : (issue?.message ?? 'Invalid input')
      throw ApiError.badRequest(message)
    }

    const { email, password, role, is_privileged, company_name, contact_person, phone } = parsed.data
    const password_hash = await bcrypt.hash(password, 12)

    const supabase = getServerClient()
    const { data, error } = await supabase
      .from('users')
      .insert({
        email: email.toLowerCase(),
        password_hash,
        role,
        is_privileged: role === 'agent' ? (is_privileged ?? false) : false,
        company_name: company_name || null,
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
