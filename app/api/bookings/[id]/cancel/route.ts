import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { handleApiError, ApiError } from '@/lib/api/errors'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(req)
    if (!session || (session.role !== 'admin' && session.role !== 'agent')) throw ApiError.forbidden()

    const { id } = await params
    const supabase = getServerClient()

    // Verify booking exists
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('id, fastlane_token')
      .eq('id', id)
      .single()

    if (fetchError || !booking) throw ApiError.notFound('Booking not found')

    // Cancel the token
    const { error: cancelError } = await supabase
      .from('bookings')
      .update({ token_cancelled: true })
      .eq('id', id)

    if (cancelError) throw ApiError.internal(cancelError.message)

    // Soft-delete all active registrations for this booking
    const { error: regError } = await supabase
      .from('fastlane_registrations')
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq('booking_id', id)
      .eq('is_deleted', false)

    if (regError) throw ApiError.internal(regError.message)

    return NextResponse.json({ ok: true })
  } catch (err) {
    const { error, code, status } = handleApiError(err)
    return NextResponse.json({ error, code }, { status })
  }
}
