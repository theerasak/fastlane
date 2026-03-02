import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import type { UserRole } from '@/types/database'

// Route access matrix
const ROUTE_ROLES: Array<{ pattern: RegExp; roles: UserRole[] }> = [
  { pattern: /^\/(users|terminals|truck-companies)/, roles: ['admin'] },
  { pattern: /^\/(bookings|import)/, roles: ['admin', 'agent'] },
  { pattern: /^\/capacity/, roles: ['supervisor'] },
]

const PUBLIC_ROUTES = [
  /^\/login$/,
  /^\/api\/auth\//,
  /^\/register\//,
  /^\/api\/register\//,
  /^\/api\/cron\//,
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

  // Allow public routes without auth
  if (isPublicRoute(pathname)) {
    return NextResponse.next()
  }

  // All other routes require a valid session
  const session = await getSession(req)

  if (!session) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Check role-specific access
  const requiredRoles = getRequiredRoles(pathname)
  if (requiredRoles && !requiredRoles.includes(session.role)) {
    // Redirect to their default page
    return NextResponse.redirect(new URL(getDefaultRoute(session.role), req.url))
  }

  return NextResponse.next()
}

function getDefaultRoute(role: UserRole): string {
  switch (role) {
    case 'admin':
      return '/users'
    case 'agent':
      return '/bookings'
    case 'supervisor':
      return '/capacity'
    default:
      return '/login'
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
