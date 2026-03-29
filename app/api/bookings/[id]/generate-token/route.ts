import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { handleApiError, ApiError } from '@/lib/api/errors'
import { generateUniqueToken } from '@/lib/lcg/token'

const TOKEN_TTL_DAYS = 60

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(req)
    if (!session || (session.role !== 'admin' && session.role !== 'agent')) throw ApiError.forbidden()

    const { id } = await params
    const supabase = getServerClient()

    // Verify booking exists
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('id, fastlane_token, token_cancelled, status')
      .eq('id', id)
      .single()

    if (fetchError || !booking) throw ApiError.notFound('Booking not found')

    // Block regeneration if any active registrations exist
    const { data: fillData } = await supabase
      .from('booking_fill_stats')
      .select('active_count')
      .eq('booking_id', id)
      .single()

    if ((fillData?.active_count ?? 0) > 0) {
      throw ApiError.badRequest('Cannot regenerate: the link has already been partially used.')
    }

    // Generate a unique token
    const token = await generateUniqueToken(id, async (candidate) => {
      const { data } = await supabase
        .from('bookings')
        .select('id')
        .eq('fastlane_token', candidate)
        .maybeSingle()
      return !data
    })

    const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()

    // Update booking with token, expiry, reset cancelled flag
    const { data, error } = await supabase
      .from('bookings')
      .update({ fastlane_token: token, token_cancelled: false, token_expires_at: expiresAt })
      .eq('id', id)
      .select('id, fastlane_token, token_cancelled, token_expires_at')
      .single()

    if (error || !data) throw ApiError.internal('Failed to save token')

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    const registrationUrl = `${appUrl}/register/${token}`

    return NextResponse.json({ data: { ...data, registration_url: registrationUrl } })
  } catch (err) {
    const { error, code, status } = handleApiError(err)
    return NextResponse.json({ error, code }, { status })
  }
}
