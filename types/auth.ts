import type { UserRole } from './database'

export interface JwtPayload {
  sub: string    // user id
  email: string
  role: UserRole
  iat: number
  exp: number
}

export interface SessionUser {
  id: string
  email: string
  role: UserRole
}
