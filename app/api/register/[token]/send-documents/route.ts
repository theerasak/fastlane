import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase/server'
import { handleApiError, ApiError } from '@/lib/api/errors'
import { getTcSession } from '@/lib/auth/tc-session'
import { sendFastlaneDocuments } from '@/lib/email/send-fastlane-documents'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const tcSession = await getTcSession(req)
    if (!tcSession) throw ApiError.unauthorized()

    const { token } = await params
    const supabase = getServerClient()

    const { data: booking } = await supabase
      .from('bookings')
      .select('id, truck_company_id')
      .eq('fastlane_token', token)
      .single()

    if (!booking) throw ApiError.notFound('Invalid token')
    if (booking.truck_company_id !== tcSession.truck_company_id) throw ApiError.forbidden()

    await sendFastlaneDocuments(booking.id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    const { error, code, status } = handleApiError(err)
    return NextResponse.json({ error, code }, { status })
  }
}
