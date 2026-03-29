import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyJwt } from '@/lib/auth/jwt'
import { COOKIE_NAME } from '@/lib/constants'
import { MobileMenu } from '@/components/layout/MobileMenu'
import { ToastContainer } from '@/components/ui/Toast'
import Link from 'next/link'
import { AdminNav } from '@/components/layout/AdminNav'

const supervisorMobileItems = [
  { href: '/capacity', label: 'Capacity' },
  { href: '/daily-summary', label: 'Daily Summary' },
]

export default async function SupervisorLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value

  if (!token) redirect('/login')

  const payload = await verifyJwt(token)
  if (!payload) redirect('/login')

  if (payload.role !== 'supervisor' && payload.role !== 'admin') redirect('/login')

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileMenu items={supervisorMobileItems} title="FMS — Capacity" />

      <div className="flex">
        <aside className="hidden tablet:flex tablet:flex-col tablet:w-56 tablet:min-h-screen bg-white border-r border-gray-200 fixed top-0 left-0 z-30">
          <div className="p-4 border-b border-gray-200">
            <h1 className="text-lg font-bold text-gray-900">FMS</h1>
            <p className="text-xs text-gray-500 mt-0.5">Capacity Management</p>
          </div>
          <nav className="flex-1 p-3 space-y-1">
            <Link href="/capacity" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Capacity
            </Link>
            <Link href="/daily-summary" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Daily Summary
            </Link>
          </nav>
          <div className="p-3 border-t border-gray-200">
            <form action="/api/auth/logout" method="POST">
              <button type="submit" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 w-full">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>
            </form>
          </div>
        </aside>
        <main className="flex-1 tablet:ml-56 p-4 tablet:p-6">
          {children}
        </main>
      </div>

      <ToastContainer />
    </div>
  )
}
