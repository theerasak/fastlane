import { NextRequest } from 'next/server'
import { signJwt } from '@/lib/auth/jwt'
import { COOKIE_NAME } from '@/lib/constants'

type Role = 'admin' | 'agent' | 'supervisor'

/** Creates a NextRequest with a valid session cookie for the given role. */
export async function createAuthRequest(
  url: string,
  options: {
    method?: string
    body?: unknown
    role: Role
    userId?: string
  }
): Promise<NextRequest> {
  const { method = 'GET', body, role, userId = `test-${role}-id` } = options
  const token = await signJwt({ id: userId, email: `${role}@test.com`, role })

  const headers: Record<string, string> = {
    Cookie: `${COOKIE_NAME}=${token}`,
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  return new NextRequest(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

/** Creates a plain (unauthenticated) NextRequest. */
export function createRequest(
  url: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
): NextRequest {
  const { method = 'GET', body, headers = {} } = options
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  return new NextRequest(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}
