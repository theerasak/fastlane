import { SignJWT, jwtVerify } from 'jose'
import type { JwtPayload, SessionUser } from '@/types/auth'
import { JWT_TTL_SECONDS } from '@/lib/constants'

function getSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET environment variable is not set')
  return new TextEncoder().encode(secret)
}

export async function signJwt(user: SessionUser): Promise<string> {
  const secret = getSecret()
  const now = Math.floor(Date.now() / 1000)

  return new SignJWT({
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt(now)
    .setExpirationTime(now + JWT_TTL_SECONDS)
    .sign(secret)
}

export async function verifyJwt(token: string): Promise<JwtPayload | null> {
  try {
    const secret = getSecret()
    const { payload } = await jwtVerify(token, secret)

    return {
      sub: payload.sub as string,
      email: payload.email as string,
      role: payload.role as JwtPayload['role'],
      iat: payload.iat as number,
      exp: payload.exp as number,
    }
  } catch {
    return null
  }
}
