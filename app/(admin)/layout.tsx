import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyJwt } from '@/lib/auth/jwt'
import { getServerClient } from '@/lib/supabase/server'
import { COOKIE_NAME } from '@/lib/constants'
import { AdminNav } from '@/components/layout/AdminNav'
import { MobileMenu } from '@/components/layout/MobileMenu'
import { ToastContainer } from '@/components/ui/Toast'

const adminMobileItems = [
  { href: '/users', label: 'Users' },
  { href: '/terminals', label: 'Terminals' },
  { href: '/truck-companies', label: 'Truck Companies' },
  { href: '/bookings', label: 'Bookings' },
]

const agentMobileItems = [
  { href: '/bookings', label: 'Bookings' },
  { href: '/import', label: 'Import' },
]

const agentPrivilegedMobileItems = [
  { href: '/bookings', label: 'Bookings' },
  { href: '/import', label: 'Import' },
  { href: '/invoice-summary', label: 'Invoice' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value

  if (!token) redirect('/login')

  const payload = await verifyJwt(token)
  if (!payload) redirect('/login')

  const isAdmin = payload.role === 'admin'
  const isAgent = payload.role === 'agent'

  if (!isAdmin && !isAgent) redirect('/login')

  let companyName: string | undefined
  let isPrivileged = false
  if (isAgent) {
    const supabase = getServerClient()
    const { data } = await supabase
      .from('users')
      .select('company_name, is_privileged')
      .eq('id', payload.sub)
      .single()
    companyName = (data as { company_name: string | null; is_privileged: boolean } | null)?.company_name ?? undefined
    isPrivileged = (data as { company_name: string | null; is_privileged: boolean } | null)?.is_privileged ?? false
  }

  const mobileItems = isAdmin
    ? adminMobileItems
    : isPrivileged ? agentPrivilegedMobileItems : agentMobileItems

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile top nav */}
      <MobileMenu items={mobileItems} title={companyName ?? 'FMS'} />

      <div className="flex">
        {/* Sidebar — hidden on mobile, visible tablet+ */}
        <aside className="hidden tablet:flex tablet:flex-col tablet:w-56 tablet:min-h-screen bg-white border-r border-gray-200 fixed top-0 left-0 z-30">
          <AdminNav role={payload.role} companyName={companyName} isPrivileged={isPrivileged} />
        </aside>

        {/* Main content */}
        <main className="flex-1 tablet:ml-56 p-4 tablet:p-6">
          {children}
        </main>
      </div>

      <ToastContainer />
    </div>
  )
}
