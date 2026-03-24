import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyJwt } from '@/lib/auth/jwt'
import { getServerClient } from '@/lib/supabase/server'
import { COOKIE_NAME } from '@/lib/constants'
import { InvoiceClient } from '@/components/invoice/InvoiceClient'

export default async function InvoicePage() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) redirect('/login')

  const payload = await verifyJwt(token)
  if (!payload || payload.role !== 'agent') redirect('/bookings')

  const supabase = getServerClient()
  const { data: user } = await supabase
    .from('users')
    .select('is_privileged')
    .eq('id', payload.sub)
    .single()

  if (!user?.is_privileged) redirect('/bookings')

  return <InvoiceClient />
}
