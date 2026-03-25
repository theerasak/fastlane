import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getServerClient } from '@/lib/supabase/server'
import { z } from 'zod'

const Schema = z.object({
  token: z.string().min(1),
  password: z.string().min(10, 'Password must be at least 10 characters'),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = Schema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid request'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const { token, password } = parsed.data
    const supabase = getServerClient()

    // Find valid, unused, non-expired token
    const { data: resetToken } = await supabase
      .from('password_reset_tokens')
      .select('id, user_id, expires_at, used_at')
      .eq('token', token)
      .single()

    if (!resetToken) {
      return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 })
    }

    if (resetToken.used_at) {
      return NextResponse.json({ error: 'This reset link has already been used' }, { status: 400 })
    }

    if (new Date(resetToken.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This reset link has expired' }, { status: 400 })
    }

    // Hash new password
    const password_hash = await bcrypt.hash(password, 12)

    // Update user password
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash })
      .eq('id', resetToken.user_id)

    if (updateError) {
      console.error('Password update error:', updateError)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    // Mark token as used
    await supabase
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', resetToken.id)

    return NextResponse.json({ message: 'Password updated successfully' })
  } catch (err) {
    console.error('Reset password error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
