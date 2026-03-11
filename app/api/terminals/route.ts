import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { handleApiError, ApiError } from '@/lib/api/errors'
import { z } from 'zod'

const CreateTerminalSchema = z.object({
  name: z.string().min(1).max(100),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req)
    if (!session || (session.role !== 'admin' && session.role !== 'agent' && session.role !== 'supervisor')) throw ApiError.forbidden()

    const supabase = getServerClient()
    const { data, error } = await supabase
      .from('port_terminals')
      .select('id, name, is_active, created_at')
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
    const parsed = CreateTerminalSchema.safeParse(body)
    if (!parsed.success) throw ApiError.badRequest(parsed.error.issues[0]?.message)

    const supabase = getServerClient()
    const { data, error } = await supabase
      .from('port_terminals')
      .insert({ name: parsed.data.name })
      .select('id, name, is_active, created_at')
      .single()

    if (error) {
      if (error.code === '23505') throw ApiError.conflict('Terminal name already exists')
      throw ApiError.internal(error.message)
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    const { error, code, status } = handleApiError(err)
    return NextResponse.json({ error, code }, { status })
  }
}
