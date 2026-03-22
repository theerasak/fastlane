import { NextResponse } from 'next/server'
import { clearTcSessionCookie } from '@/lib/auth/cookies'

export async function POST() {
  const response = NextResponse.json({ ok: true })
  clearTcSessionCookie(response)
  return response
}
