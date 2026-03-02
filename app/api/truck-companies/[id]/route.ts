import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { handleApiError, ApiError } from '@/lib/api/errors'
import { z } from 'zod'

const UpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  contact_email: z.string().email().optional().or(z.literal('')),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(req)
    if (!session) throw ApiError.unauthorized()

    const { id } = await params
    const supabase = getServerClient()
    const { data, error } = await supabase
      .from('truck_companies')
      .select('id, name, contact_email, created_at')
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

    const updates: Record<string, unknown> = {}
    if (parsed.data.name !== undefined) updates.name = parsed.data.name
    if (parsed.data.contact_email !== undefined) updates.contact_email = parsed.data.contact_email || null

    const supabase = getServerClient()
    const { data, error } = await supabase
      .from('truck_companies')
      .update(updates)
      .eq('id', id)
      .select('id, name, contact_email, created_at')
      .single()

    if (error || !data) throw ApiError.notFound('Truck company not found')

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
    const { error } = await supabase.from('truck_companies').delete().eq('id', id)

    if (error) throw ApiError.internal(error.message)

    return NextResponse.json({ ok: true })
  } catch (err) {
    const { error, code, status } = handleApiError(err)
    return NextResponse.json({ error, code }, { status })
  }
}
