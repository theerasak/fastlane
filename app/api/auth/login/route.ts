import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getServerClient } from '@/lib/supabase/server'
import { signJwt } from '@/lib/auth/jwt'
import { setSessionCookie } from '@/lib/auth/cookies'
import { z } from 'zod'

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = LoginSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const { email, password } = parsed.data
    const supabase = getServerClient()

    // Look up user
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, password_hash, role, is_active')
      .eq('email', email.toLowerCase())
      .single()

    if (error || !user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    if (!user.is_active) {
      return NextResponse.json({ error: 'Account is disabled' }, { status: 403 })
    }

    // Compare password
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    // Sign JWT
    const token = await signJwt({ id: user.id, email: user.email, role: user.role })

    const response = NextResponse.json({
      user: { id: user.id, email: user.email, role: user.role },
    })

    setSessionCookie(response, token)

    return response
  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
