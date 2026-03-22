import { cookies } from 'next/headers'
import { verifyJwt } from '@/lib/auth/jwt'
import { getServerClient } from '@/lib/supabase/server'
import { COOKIE_NAME } from '@/lib/constants'
import { BookingsClient } from '@/components/bookings/BookingsClient'

export default async function BookingsPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  let agentCompanyName: string | undefined

  if (token) {
    const payload = await verifyJwt(token)
    if (payload?.role === 'agent') {
      const supabase = getServerClient()
      const { data } = await supabase
        .from('users')
        .select('company_name')
        .eq('id', payload.sub)
        .single()
      agentCompanyName = (data as { company_name: string | null } | null)?.company_name ?? undefined
    }
  }

  return <BookingsClient agentCompanyName={agentCompanyName} />
}
