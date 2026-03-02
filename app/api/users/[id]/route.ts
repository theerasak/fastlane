import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { handleApiError, ApiError } from '@/lib/api/errors'
import { z } from 'zod'

const UpdateUserSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['admin', 'agent', 'supervisor']).optional(),
  is_active: z.boolean().optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(req)
    if (!session || session.role !== 'admin') throw ApiError.forbidden()

    const { id } = await params
    const supabase = getServerClient()
    const { data, error } = await supabase
      .from('users')
      .select('id, email, role, is_active, created_at')
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

    const updates: Record<string, unknown> = {}
    if (parsed.data.email) updates.email = parsed.data.email.toLowerCase()
    if (parsed.data.role) updates.role = parsed.data.role
    if (parsed.data.is_active !== undefined) updates.is_active = parsed.data.is_active
    if (parsed.data.password) updates.password_hash = await bcrypt.hash(parsed.data.password, 12)

    const supabase = getServerClient()
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select('id, email, role, is_active, created_at')
      .single()

    if (error || !data) throw ApiError.notFound('User not found')

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
    const { error } = await supabase.from('users').delete().eq('id', id)

    if (error) throw ApiError.internal(error.message)

    return NextResponse.json({ ok: true })
  } catch (err) {
    const { error, code, status } = handleApiError(err)
    return NextResponse.json({ error, code }, { status })
  }
}
