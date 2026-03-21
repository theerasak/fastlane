import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { handleApiError, ApiError } from '@/lib/api/errors'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  contact_email: z.string().email().optional().or(z.literal('')),
  contact_person: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
})

const TC_FIELDS = 'id, name, contact_email, contact_person, phone, is_active, created_at'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req)
    if (!session || (session.role !== 'admin' && session.role !== 'agent')) throw ApiError.forbidden()

    const supabase = getServerClient()
    const { data, error } = await supabase
      .from('truck_companies')
      .select(TC_FIELDS)
      .order('name')

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
    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success) throw ApiError.badRequest(parsed.error.issues[0]?.message)

    const supabase = getServerClient()
    const { data, error } = await supabase
      .from('truck_companies')
      .insert({
        name: parsed.data.name,
        contact_email: parsed.data.contact_email || null,
        contact_person: parsed.data.contact_person || null,
        phone: parsed.data.phone || null,
      })
      .select(TC_FIELDS)
      .single()

    if (error) throw ApiError.internal(error.message)

    await writeAuditLog({
      table_name: 'truck_companies',
      record_id: data.id,
      action: 'CREATE',
      performed_by: session.id,
      performed_by_email: session.email,
      new_data: { ...data },
    })

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    const { error, code, status } = handleApiError(err)
    return NextResponse.json({ error, code }, { status })
  }
}
