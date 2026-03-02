import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { handleApiError, ApiError } from '@/lib/api/errors'
import { z } from 'zod'

const UpdateTerminalSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  is_active: z.boolean().optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(req)
    if (!session) throw ApiError.unauthorized()

    const { id } = await params
    const supabase = getServerClient()
    const { data, error } = await supabase
      .from('port_terminals')
      .select('id, name, is_active, created_at')
      .eq('id', id)
      .single()

    if (error || !data) throw ApiError.notFound('Terminal not found')

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
    const parsed = UpdateTerminalSchema.safeParse(body)
    if (!parsed.success) throw ApiError.badRequest(parsed.error.issues[0]?.message)

    const supabase = getServerClient()
    const { data, error } = await supabase
      .from('port_terminals')
      .update(parsed.data)
      .eq('id', id)
      .select('id, name, is_active, created_at')
      .single()

    if (error || !data) throw ApiError.notFound('Terminal not found')

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
    const { error } = await supabase.from('port_terminals').delete().eq('id', id)

    if (error) throw ApiError.internal(error.message)

    return NextResponse.json({ ok: true })
  } catch (err) {
    const { error, code, status } = handleApiError(err)
    return NextResponse.json({ error, code }, { status })
  }
}
