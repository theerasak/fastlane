import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { getServerClient } from '@/lib/supabase/server'
import { sendPasswordResetEmail } from '@/lib/email'
import { z } from 'zod'

const Schema = z.object({
  email: z.string().email(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = Schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    const { email } = parsed.data
    const supabase = getServerClient()

    // Look up user — always return success to prevent email enumeration
    const { data: user } = await supabase
      .from('users')
      .select('id, email, is_active')
      .eq('email', email.toLowerCase())
      .single()

    if (user && user.is_active) {
      // Expire any existing unused tokens for this user
      await supabase
        .from('password_reset_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .is('used_at', null)

      const token = randomBytes(32).toString('hex')
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

      await supabase.from('password_reset_tokens').insert({
        user_id: user.id,
        token,
        expires_at: expiresAt.toISOString(),
      })

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      const resetUrl = `${appUrl}/reset-password/${token}`

      try {
        await sendPasswordResetEmail(user.email, resetUrl)
      } catch (emailErr) {
        console.error('Failed to send password reset email:', emailErr)
        // Token was created; continue so we don't leak user existence via error response
      }
    }

    // Always respond with success
    return NextResponse.json({ message: 'If that email is registered, a reset link has been sent.' })
  } catch (err) {
    console.error('Forgot password error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
