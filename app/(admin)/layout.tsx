import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyJwt } from '@/lib/auth/jwt'
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

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value

  if (!token) redirect('/login')

  const payload = await verifyJwt(token)
  if (!payload) redirect('/login')

  const isAdmin = payload.role === 'admin'
  const isAgent = payload.role === 'agent'

  if (!isAdmin && !isAgent) redirect('/login')

  const mobileItems = isAdmin ? adminMobileItems : agentMobileItems

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile top nav */}
      <MobileMenu items={mobileItems} title="FMS" />

      <div className="flex">
        {/* Sidebar — hidden on mobile, visible tablet+ */}
        <aside className="hidden tablet:flex tablet:flex-col tablet:w-56 tablet:min-h-screen bg-white border-r border-gray-200 fixed top-0 left-0 z-30">
          <AdminNav role={payload.role} />
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
