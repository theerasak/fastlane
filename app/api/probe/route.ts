import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const res = await fetch('http://192.168.10.246:8001', {
      signal: AbortSignal.timeout(10000),
    })
    const text = await res.text()
    return NextResponse.json({
      ok: true,
      status: res.status,
      headers: Object.fromEntries(res.headers.entries()),
      body: text.slice(0, 2000),
    })
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }, { status: 200 })
  }
}
