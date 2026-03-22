import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getServerClient } from '@/lib/supabase/server'
import { signTcJwt } from '@/lib/auth/tc-session'
import { setTcSessionCookie } from '@/lib/auth/cookies'
import { z } from 'zod'

const LoginSchema = z.object({
  contact_email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = LoginSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const { contact_email, password } = parsed.data
    const supabase = getServerClient()

    const { data: company } = await supabase
      .from('truck_companies')
      .select('id, name, password_hash, is_active')
      .eq('contact_email', contact_email.toLowerCase())
      .single()

    if (!company || !company.password_hash) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    if (!company.is_active) {
      return NextResponse.json({ error: 'This account has been disabled. Please contact your agent.' }, { status: 403 })
    }

    const valid = await bcrypt.compare(password, company.password_hash)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const token = await signTcJwt({ truck_company_id: company.id, name: company.name })
    const response = NextResponse.json({ ok: true, name: company.name })
    setTcSessionCookie(response, token)
    return response
  } catch (err) {
    console.error('TC login error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
