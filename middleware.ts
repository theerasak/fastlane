import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { TC_COOKIE_NAME } from '@/lib/constants'
import type { UserRole } from '@/types/database'

const ROUTE_ROLES: Array<{ pattern: RegExp; roles: UserRole[] }> = [
  { pattern: /^\/(users|terminals|truck-companies)/, roles: ['admin'] },
  { pattern: /^\/(bookings|import)/, roles: ['admin', 'agent'] },
  { pattern: /^\/invoice-summary/, roles: ['agent'] },
  { pattern: /^\/(capacity|daily-summary)/, roles: ['supervisor'] },
]

const PUBLIC_ROUTES = [
  /^\/login$/,
  /^\/forgot-password$/,
  /^\/reset-password\//,
  /^\/register\/login$/,
  /^\/api\/auth\//,
  /^\/api\/register\/auth\//,
  /^\/api\/cron\//,
  /^\/api\/probe$/,
  /^\/_next\//,
  /^\/favicon/,
]

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((r) => r.test(pathname))
}

function getRequiredRoles(pathname: string): UserRole[] | null {
  for (const { pattern, roles } of ROUTE_ROLES) {
    if (pattern.test(pathname)) return roles
  }
  return null
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (isPublicRoute(pathname)) return NextResponse.next()

  // TC-protected: /register dashboard, /register/[token] pages and /api/register/[token]/* APIs
  const isTcRoute = /^\/register(\/[^/]|$)/.test(pathname) || /^\/api\/register\/[^/]/.test(pathname)
  if (isTcRoute) {
    const tcToken = req.cookies.get(TC_COOKIE_NAME)?.value
    if (!tcToken) {
      // For page routes, redirect to login; for API routes, return 401
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
      }
      const loginUrl = new URL('/register/login', req.url)
      loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
    }
    return NextResponse.next()
  }

  // Staff routes: require admin/agent/supervisor session
  const session = await getSession(req)
  if (!session) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  const requiredRoles = getRequiredRoles(pathname)
  if (requiredRoles && !requiredRoles.includes(session.role)) {
    return NextResponse.redirect(new URL(getDefaultRoute(session.role), req.url))
  }

  return NextResponse.next()
}

function getDefaultRoute(role: UserRole): string {
  switch (role) {
    case 'admin': return '/users'
    case 'agent': return '/bookings'
    case 'supervisor': return '/capacity'
    default: return '/login'
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
