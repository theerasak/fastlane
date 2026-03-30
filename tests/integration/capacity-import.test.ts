import { describe, it, expect } from 'vitest'
import { server } from '../mocks/server'
import { http, HttpResponse } from 'msw'
import { POST as importCsv } from '@/app/api/capacity/import/route'
import { createAuthRequest, createRequest } from '../helpers/request'
import { mockTerminal } from '../mocks/db'

const SUPA = 'https://mock-supabase.test/rest/v1'

const FUTURE_DATE = '2099-12-31'
const PAST_DATE   = '2020-01-01'

// ── Helpers ───────────────────────────────────────────────────────────────────

function csvRequest(role: Parameters<typeof createAuthRequest>[1]['role'], csvText: string) {
  const formData = new FormData()
  formData.append('file', new Blob([csvText], { type: 'text/csv' }), 'test.csv')
  return createAuthRequest('http://localhost/api/capacity/import', {
    method: 'POST',
    role,
    // body must be FormData — pass raw so createAuthRequest doesn't JSON-encode it
  }).then(req => {
    // Rebuild with FormData body (createAuthRequest doesn't support FormData natively)
    const { headers } = req
    const cookie = headers.get('Cookie') ?? ''
    return new (require('next/server').NextRequest)('http://localhost/api/capacity/import', {
      method: 'POST',
      headers: { Cookie: cookie },
      body: formData,
    })
  })
}

const VALID_CSV = [
  'terminal_name,date,hour_slot,capacity_privileged,capacity_non_privileged',
  `${mockTerminal.name},${FUTURE_DATE},8,3,5`,
  `${mockTerminal.name},${FUTURE_DATE},9,2,4`,
].join('\n')

// ── Auth ──────────────────────────────────────────────────────────────────────

describe('POST /api/capacity/import — auth', () => {
  it('returns 403 for admin', async () => {
    const req = await csvRequest('admin', VALID_CSV)
    const res = await importCsv(req)
    expect(res.status).toBe(403)
  })

  it('returns 403 for agent', async () => {
    const req = await csvRequest('agent', VALID_CSV)
    const res = await importCsv(req)
    expect(res.status).toBe(403)
  })

  it('returns 403 for unauthenticated request', async () => {
    const formData = new FormData()
    formData.append('file', new Blob([VALID_CSV], { type: 'text/csv' }), 'test.csv')
    const { NextRequest } = await import('next/server')
    const req = new NextRequest('http://localhost/api/capacity/import', {
      method: 'POST',
      body: formData,
    })
    const res = await importCsv(req)
    expect(res.status).toBe(403)
  })
})

// ── Happy path ────────────────────────────────────────────────────────────────

describe('POST /api/capacity/import — success', () => {
  beforeEach(() => {
    server.use(
      http.get(`${SUPA}/port_terminals`, () => HttpResponse.json([mockTerminal])),
      http.post(`${SUPA}/terminal_capacity`, () => HttpResponse.json([]))
    )
  })

  it('returns 200 with imported count for supervisor', async () => {
    const req = await csvRequest('supervisor', VALID_CSV)
    const res = await importCsv(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.imported).toBe(2)
  })

  it('returns empty errors array on clean import', async () => {
    const req = await csvRequest('supervisor', VALID_CSV)
    const res = await importCsv(req)
    const body = await res.json()
    expect(body.errors).toEqual([])
  })

  it('imports a single row correctly', async () => {
    const csv = [
      'terminal_name,date,hour_slot,capacity_privileged,capacity_non_privileged',
      `${mockTerminal.name},${FUTURE_DATE},10,5,10`,
    ].join('\n')
    const req = await csvRequest('supervisor', csv)
    const res = await importCsv(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.imported).toBe(1)
  })
})

// ── Validation errors ────────────────────────────────────────────────────────

describe('POST /api/capacity/import — validation errors', () => {
  it('returns 422 for empty file', async () => {
    const req = await csvRequest('supervisor', '')
    const res = await importCsv(req)
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.errors[0].message).toMatch(/empty/i)
  })

  it('returns 422 for missing required columns', async () => {
    const req = await csvRequest('supervisor', 'terminal_name,date\nTerminal A,2099-12-31')
    const res = await importCsv(req)
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.errors[0].message).toMatch(/missing columns/i)
  })

  it('returns 422 when all rows are invalid', async () => {
    const csv = [
      'terminal_name,date,hour_slot,capacity_privileged,capacity_non_privileged',
      `${mockTerminal.name},${PAST_DATE},8,3,5`,
    ].join('\n')
    const req = await csvRequest('supervisor', csv)
    const res = await importCsv(req)
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.errors.length).toBeGreaterThan(0)
  })

  it('returns 422 when terminal not found in DB', async () => {
    server.use(
      http.get(`${SUPA}/port_terminals`, () => HttpResponse.json([]))
    )
    const req = await csvRequest('supervisor', VALID_CSV)
    const res = await importCsv(req)
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.errors.some((e: { message: string }) => e.message.match(/terminal not found/i))).toBe(true)
  })
})

// ── Partial import ────────────────────────────────────────────────────────────

describe('POST /api/capacity/import — partial import', () => {
  beforeEach(() => {
    server.use(
      http.get(`${SUPA}/port_terminals`, () => HttpResponse.json([mockTerminal])),
      http.post(`${SUPA}/terminal_capacity`, () => HttpResponse.json([]))
    )
  })

  it('imports valid rows and reports errors for invalid rows', async () => {
    const csv = [
      'terminal_name,date,hour_slot,capacity_privileged,capacity_non_privileged',
      `${mockTerminal.name},${FUTURE_DATE},8,3,5`,   // valid
      `${mockTerminal.name},${PAST_DATE},9,3,5`,     // past date — error
      `${mockTerminal.name},${FUTURE_DATE},10,2,4`,  // valid
    ].join('\n')
    const req = await csvRequest('supervisor', csv)
    const res = await importCsv(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.imported).toBe(2)
    expect(body.errors).toHaveLength(1)
    expect(body.errors[0].message).toMatch(/past/i)
  })

  it('includes line numbers in row errors', async () => {
    const csv = [
      'terminal_name,date,hour_slot,capacity_privileged,capacity_non_privileged',
      `${mockTerminal.name},${FUTURE_DATE},8,3,5`,
      `${mockTerminal.name},${PAST_DATE},9,3,5`,
    ].join('\n')
    const req = await csvRequest('supervisor', csv)
    const res = await importCsv(req)
    const body = await res.json()
    expect(body.errors[0].line).toBe(3) // line 3 in the file (header=1, valid=2, bad=3)
  })
})

// ── Missing file ──────────────────────────────────────────────────────────────

describe('POST /api/capacity/import — missing file', () => {
  it('returns 400 when no file is attached', async () => {
    const { NextRequest } = await import('next/server')
    const { signJwt } = await import('@/lib/auth/jwt')
    const { COOKIE_NAME } = await import('@/lib/constants')
    const token = await signJwt({ id: 'sup-id', email: 'supervisor@test.com', role: 'supervisor' })
    const formData = new FormData() // no file field
    const req = new NextRequest('http://localhost/api/capacity/import', {
      method: 'POST',
      headers: { Cookie: `${COOKIE_NAME}=${token}` },
      body: formData,
    })
    const res = await importCsv(req)
    expect(res.status).toBe(400)
  })
})
