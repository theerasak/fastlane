'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

interface NavItem {
  href: string
  label: string
}

interface MobileMenuProps {
  items: NavItem[]
  title?: string
}

export function MobileMenu({ items, title = 'Menu' }: MobileMenuProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <div className="tablet:hidden">
      <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
        <span className="font-bold text-gray-900">{title}</span>
        <button
          onClick={() => setOpen(!open)}
          className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
          aria-label="Toggle menu"
        >
          {open ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {open && (
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="p-2 space-y-1">
            {items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={[
                    'block px-4 py-2 rounded-lg text-sm font-medium',
                    isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50',
                  ].join(' ')}
                >
                  {item.label}
                </Link>
              )
            })}
            <button
              onClick={handleLogout}
              className="block w-full text-left px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
