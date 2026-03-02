import { NextRequest } from 'next/server'
import { verifyJwt } from './jwt'
import type { SessionUser } from '@/types/auth'
import { COOKIE_NAME } from '@/lib/constants'

export async function getSession(req: NextRequest): Promise<SessionUser | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) return null

  const payload = await verifyJwt(token)
  if (!payload) return null

  return {
    id: payload.sub,
    email: payload.email,
    role: payload.role,
  }
}

export async function requireSession(req: NextRequest): Promise<SessionUser> {
  const session = await getSession(req)
  if (!session) {
    throw new Error('Unauthorized')
  }
  return session
}
