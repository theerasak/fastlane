import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { COOKIE_NAME, JWT_TTL_SECONDS } from '@/lib/constants'

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: JWT_TTL_SECONDS,
    path: '/',
  })
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })
}

export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies()
  const cookie = cookieStore.get(COOKIE_NAME)
  return cookie?.value ?? null
}
