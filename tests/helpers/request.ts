import { NextRequest } from 'next/server'
import { signJwt } from '@/lib/auth/jwt'
import { signTcJwt } from '@/lib/auth/tc-session'
import { COOKIE_NAME, TC_COOKIE_NAME } from '@/lib/constants'
import { mockCompany } from '../mocks/db'

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

/** Creates a NextRequest with a valid TC session cookie for the mock company. */
export async function createTcRequest(
  url: string,
  options: { method?: string; body?: unknown } = {}
): Promise<NextRequest> {
  const { method = 'GET', body } = options
  const token = await signTcJwt({ truck_company_id: mockCompany.id, name: mockCompany.name })
  const headers: Record<string, string> = { Cookie: `${TC_COOKIE_NAME}=${token}` }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  return new NextRequest(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}
