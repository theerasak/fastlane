import { NextRequest, NextResponse } from 'next/server'
import { clearTcSessionCookie } from '@/lib/auth/cookies'

export async function POST(req: NextRequest) {
  const response = NextResponse.redirect(new URL('/register/login', req.url))
  clearTcSessionCookie(response)
  return response
}
