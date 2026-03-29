import { describe, it, expect, vi } from 'vitest'
import { server } from '../mocks/server'
import { http, HttpResponse } from 'msw'
import { GET as getDocument } from '@/app/api/register/[token]/document/[regId]/route'
import { POST as sendDocuments } from '@/app/api/bookings/[id]/send-documents/route'
import { createAuthRequest, createTcRequest, createRequest } from '../helpers/request'
import { mockBooking, mockRegistration, mockCompany, mockTerminal } from '../mocks/db'
import { pgrstSingle, pgrstNotFound } from '../mocks/handlers'

const SUPA = 'https://mock-supabase.test/rest/v1'
const TOKEN = mockBooking.fastlane_token
const REG_ID = mockRegistration.id
const BOOKING_ID = mockBooking.id

const DOC_PARAMS = { params: Promise.resolve({ token: TOKEN, regId: REG_ID }) }
const SEND_PARAMS = { params: Promise.resolve({ id: BOOKING_ID }) }

// Mock pdfkit so integration tests don't need the real font files
vi.mock('@/lib/pdf/fastlane-document', () => ({
  generateFastlaneDocument: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.4 mock')),
}))

// Mock the email sender so no SMTP is needed
vi.mock('@/lib/email/send-fastlane-documents', () => ({
  sendFastlaneDocuments: vi.fn().mockResolvedValue(undefined),
}))

// ── GET /api/register/[token]/document/[regId] ───────────────────────────────

describe('GET /api/register/[token]/document/[regId]', () => {
  beforeEach(() => {
    server.use(
      http.get(`${SUPA}/fastlane_registrations`, ({ request }) =>
        pgrstSingle({ ...mockRegistration, appointment_date: '2099-12-31' })
      )
    )
  })

  it('returns 200 with PDF content-type for valid TC request', async () => {
    const req = await createTcRequest(
      `http://localhost/api/register/${TOKEN}/document/${REG_ID}`
    )
    const res = await getDocument(req, DOC_PARAMS)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
  })

  it('returns content-disposition with filename', async () => {
    const req = await createTcRequest(
      `http://localhost/api/register/${TOKEN}/document/${REG_ID}`
    )
    const res = await getDocument(req, DOC_PARAMS)
    const disposition = res.headers.get('Content-Disposition') ?? ''
    expect(disposition).toContain('attachment')
    expect(disposition).toContain('.pdf')
  })

  it('returns 401 without TC session', async () => {
    const req = createRequest(
      `http://localhost/api/register/${TOKEN}/document/${REG_ID}`
    )
    const res = await getDocument(req, DOC_PARAMS)
    expect(res.status).toBe(401)
  })

  it('returns 403 when TC session belongs to a different company', async () => {
    server.use(
      http.get(`${SUPA}/bookings`, () =>
        pgrstSingle({ ...mockBooking, truck_company_id: '00000000-0000-0000-0000-000000009999' })
      )
    )
    const req = await createTcRequest(
      `http://localhost/api/register/${TOKEN}/document/${REG_ID}`
    )
    const res = await getDocument(req, DOC_PARAMS)
    expect(res.status).toBe(403)
  })

  it('returns 404 for unknown token', async () => {
    server.use(
      http.get(`${SUPA}/bookings`, () => pgrstNotFound())
    )
    const req = await createTcRequest(
      `http://localhost/api/register/BADTOKEN/document/${REG_ID}`
    )
    const res = await getDocument(
      req,
      { params: Promise.resolve({ token: 'BADTOKEN', regId: REG_ID }) }
    )
    expect(res.status).toBe(404)
  })

  it('returns 404 when registration is deleted', async () => {
    server.use(
      http.get(`${SUPA}/fastlane_registrations`, () => pgrstNotFound())
    )
    const req = await createTcRequest(
      `http://localhost/api/register/${TOKEN}/document/${REG_ID}`
    )
    const res = await getDocument(req, DOC_PARAMS)
    expect(res.status).toBe(404)
  })

  it('filename includes booking number, plate and container number', async () => {
    const req = await createTcRequest(
      `http://localhost/api/register/${TOKEN}/document/${REG_ID}`
    )
    const res = await getDocument(req, DOC_PARAMS)
    const disposition = res.headers.get('Content-Disposition') ?? ''
    expect(disposition).toContain(mockBooking.booking_number)
    expect(disposition).toContain(mockRegistration.license_plate)
    expect(disposition).toContain(mockRegistration.container_number)
  })
})

// ── POST /api/bookings/[id]/send-documents ────────────────────────────────────

describe('POST /api/bookings/[id]/send-documents', () => {
  beforeEach(() => {
    server.use(
      http.get(`${SUPA}/fastlane_registrations`, () =>
        HttpResponse.json([{ ...mockRegistration, appointment_date: '2099-12-31' }])
      ),
      http.get(`${SUPA}/bookings`, ({ request }) =>
        pgrstSingle({
          ...mockBooking,
          port_terminals: { name: mockTerminal.name },
          truck_companies: { name: mockCompany.name, contact_email: mockCompany.contact_email },
        })
      )
    )
  })

  it('returns 200 for admin', async () => {
    const req = await createAuthRequest(
      `http://localhost/api/bookings/${BOOKING_ID}/send-documents`,
      { method: 'POST', role: 'admin' }
    )
    const res = await sendDocuments(req, SEND_PARAMS)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it('returns 403 for agent', async () => {
    const req = await createAuthRequest(
      `http://localhost/api/bookings/${BOOKING_ID}/send-documents`,
      { method: 'POST', role: 'agent' }
    )
    const res = await sendDocuments(req, SEND_PARAMS)
    expect(res.status).toBe(403)
  })

  it('returns 403 for supervisor', async () => {
    const req = await createAuthRequest(
      `http://localhost/api/bookings/${BOOKING_ID}/send-documents`,
      { method: 'POST', role: 'supervisor' }
    )
    const res = await sendDocuments(req, SEND_PARAMS)
    expect(res.status).toBe(403)
  })

  it('returns 403 without any session', async () => {
    const req = createRequest(
      `http://localhost/api/bookings/${BOOKING_ID}/send-documents`,
      { method: 'POST' }
    )
    const res = await sendDocuments(req, SEND_PARAMS)
    expect(res.status).toBe(403)
  })
})

// ── POST /api/register/[token]/plates — docs_failed flag ─────────────────────

describe('POST /api/register/[token]/plates — document generation failure', () => {
  it('returns 201 with docs_failed:true when sendFastlaneDocuments throws', async () => {
    const { sendFastlaneDocuments } = await import('@/lib/email/send-fastlane-documents')
    vi.mocked(sendFastlaneDocuments).mockRejectedValueOnce(new Error('SMTP unavailable'))

    // Pre-check: 0 active registrations (below limit)
    // Post-insert: count equals num_trucks → triggers doc send
    let headCallCount = 0
    server.use(
      http.head(`${SUPA}/fastlane_registrations`, () => {
        headCallCount++
        const count = headCallCount === 1 ? 0 : mockBooking.num_trucks
        return new HttpResponse(null, {
          status: 200,
          headers: { 'Content-Range': `*/${count}` },
        })
      }),
      http.get(`${SUPA}/slot_remaining_capacity`, () =>
        pgrstSingle({ remaining_capacity_privileged: 5, remaining_capacity_non_privileged: 5 })
      )
    )

    const { POST: addPlate } = await import('@/app/api/register/[token]/plates/route')
    const req = await createTcRequest(`http://localhost/api/register/${TOKEN}/plates`, {
      method: 'POST',
      body: { license_plate: 'AB-1234', container_number: 'ABCD1234567', hour_slot: 9 },
    })
    const res = await addPlate(req, { params: Promise.resolve({ token: TOKEN }) })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data).toBeDefined()
    expect(body.docs_failed).toBe(true)
  })
})
