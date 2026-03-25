import { http, HttpResponse } from 'msw'
import {
  mockAdmin,
  mockAgent,
  mockTerminal,
  mockBooking,
  mockCompany,
  mockSlots,
  mockSlotCapacity,
  mockRegistration,
  mockResetToken,
} from './db'

const SUPA = 'https://mock-supabase.test/rest/v1'

// ── Helpers ────────────────────────────────────────────────────────────────

/** Returns a single-object response (for .single() calls). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function pgrstSingle(data: any) {
  return HttpResponse.json(data)
}

/** Returns a PostgREST 406 "no rows found" error (for .single() not-found). */
export function pgrstNotFound() {
  return HttpResponse.json(
    {
      code: 'PGRST116',
      details: 'The result contains 0 rows',
      hint: null,
      message: 'JSON object requested, multiple (or no) rows returned',
    },
    { status: 406 }
  )
}

/** Returns a HEAD response with Content-Range header for count queries. */
export function pgrstCount(count: number) {
  return new HttpResponse(null, {
    status: 200,
    headers: { 'Content-Range': `*/${count}` },
  })
}

/** True if the request expects a single PostgREST object (.single()). */
function isSingle(req: Request) {
  return (req.headers.get('Accept') ?? '').includes('vnd.pgrst.object')
}

// ── Default handlers (happy-path) ─────────────────────────────────────────

export const handlers = [
  // ── users ─────────────────────────────────────────────────────────────
  http.head(`${SUPA}/users`, () => pgrstCount(2)),
  http.get(`${SUPA}/users`, ({ request }) => {
    if (isSingle(request)) return pgrstSingle(mockAdmin)
    return HttpResponse.json([mockAdmin, mockAgent])
  }),

  http.post(`${SUPA}/users`, async () => {
    return HttpResponse.json(mockAdmin, { status: 201 })
  }),

  http.patch(`${SUPA}/users`, () => pgrstSingle(mockAdmin)),
  http.delete(`${SUPA}/users`, () => new HttpResponse(null, { status: 204 })),

  // ── port_terminals ────────────────────────────────────────────────────
  http.get(`${SUPA}/port_terminals`, ({ request }) => {
    if (isSingle(request)) return pgrstSingle(mockTerminal)
    return HttpResponse.json([mockTerminal])
  }),

  http.post(`${SUPA}/port_terminals`, async () =>
    HttpResponse.json(mockTerminal, { status: 201 })
  ),

  // ── bookings ──────────────────────────────────────────────────────────
  http.head(`${SUPA}/bookings`, () => pgrstCount(1)),
  http.get(`${SUPA}/bookings`, ({ request }) => {
    if (isSingle(request)) return pgrstSingle(mockBooking)
    return HttpResponse.json([mockBooking])
  }),

  http.post(`${SUPA}/bookings`, async () =>
    HttpResponse.json(mockBooking, { status: 201 })
  ),

  http.patch(`${SUPA}/bookings`, () => pgrstSingle(mockBooking)),

  // ── booking_fill_stats (view) ─────────────────────────────────────────
  http.get(`${SUPA}/booking_fill_stats`, ({ request }) => {
    if (isSingle(request)) return pgrstSingle({ booking_id: mockBooking.id, active_count: 0 })
    return HttpResponse.json([{ booking_id: mockBooking.id, active_count: 0 }])
  }),

  // ── terminal_capacity ─────────────────────────────────────────────────
  http.get(`${SUPA}/terminal_capacity`, ({ request }) => {
    if (isSingle(request)) return pgrstSingle(mockSlots[9])
    return HttpResponse.json(mockSlots)
  }),

  http.post(`${SUPA}/terminal_capacity`, async () =>
    HttpResponse.json(mockSlots)
  ),

  http.patch(`${SUPA}/terminal_capacity`, async () =>
    pgrstSingle({ ...mockSlots[9], capacity_privileged: 3, capacity_non_privileged: 2 })
  ),

  // ── slot_remaining_capacity (view) ────────────────────────────────────
  http.get(`${SUPA}/slot_remaining_capacity`, ({ request }) => {
    if (isSingle(request)) return pgrstSingle(mockSlotCapacity[9])
    return HttpResponse.json(mockSlotCapacity)
  }),

  // ── truck_companies ───────────────────────────────────────────────────
  http.get(`${SUPA}/truck_companies`, ({ request }) => {
    if (isSingle(request)) return pgrstSingle(mockCompany)
    return HttpResponse.json([mockCompany])
  }),

  http.post(`${SUPA}/truck_companies`, async () =>
    HttpResponse.json(mockCompany, { status: 201 })
  ),

  http.patch(`${SUPA}/truck_companies`, () => pgrstSingle(mockCompany)),
  http.delete(`${SUPA}/truck_companies`, () => new HttpResponse(null, { status: 204 })),

  // ── password_reset_tokens ─────────────────────────────────────────────────
  http.get(`${SUPA}/password_reset_tokens`, ({ request }) => {
    if (isSingle(request)) return pgrstSingle(mockResetToken)
    return HttpResponse.json([mockResetToken])
  }),
  http.post(`${SUPA}/password_reset_tokens`, async () =>
    new HttpResponse(null, { status: 201 })
  ),
  http.patch(`${SUPA}/password_reset_tokens`, () => HttpResponse.json([])),

  // ── audit_logs ────────────────────────────────────────────────────────
  http.post(`${SUPA}/audit_logs`, async () => new HttpResponse(null, { status: 201 })),

  // ── audit_log (view alias used in booking detail GET) ─────────────────
  http.get(`${SUPA}/audit_log`, () => HttpResponse.json(null)),

  // ── RPC functions ─────────────────────────────────────────────────────
  http.post(`${SUPA}/rpc/get_agent_booking_ids`, async () =>
    HttpResponse.json([mockBooking.id])
  ),

  http.post(`${SUPA}/rpc/set_booking_created_by`, async () =>
    HttpResponse.json(null)
  ),

  // ── fastlane_registrations ────────────────────────────────────────────
  http.head(`${SUPA}/fastlane_registrations`, () => pgrstCount(0)),
  http.get(`${SUPA}/fastlane_registrations`, () => HttpResponse.json([])),

  http.post(`${SUPA}/fastlane_registrations`, async () =>
    HttpResponse.json(mockRegistration, { status: 201 })
  ),

  http.patch(`${SUPA}/fastlane_registrations`, async () =>
    pgrstSingle({ ...mockRegistration, is_deleted: true })
  ),
]
