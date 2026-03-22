import { NextRequest } from 'next/server'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { TC_COOKIE_NAME, JWT_TTL_SECONDS } from '@/lib/constants'

export interface TcSession {
  truck_company_id: string
  name: string
}

function getSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is not set')
  return new TextEncoder().encode(secret)
}

export async function signTcJwt(session: TcSession): Promise<string> {
  const secret = getSecret()
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({ name: session.name, tc: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(session.truck_company_id)
    .setIssuedAt(now)
    .setExpirationTime(now + JWT_TTL_SECONDS)
    .sign(secret)
}

async function verifyTcJwt(token: string): Promise<{ truck_company_id: string; name: string } | null> {
  try {
    const secret = getSecret()
    const { payload } = await jwtVerify(token, secret)
    if (!payload.tc) return null  // ensure it's a TC token, not a staff token
    return { truck_company_id: payload.sub as string, name: payload.name as string }
  } catch {
    return null
  }
}

/** For API route handlers (NextRequest) */
export async function getTcSession(req: NextRequest): Promise<TcSession | null> {
  const token = req.cookies.get(TC_COOKIE_NAME)?.value
  if (!token) return null
  return verifyTcJwt(token)
}

/** For server components (uses next/headers cookies) */
export async function getTcSessionFromCookies(): Promise<TcSession | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(TC_COOKIE_NAME)?.value
  if (!token) return null
  return verifyTcJwt(token)
}
