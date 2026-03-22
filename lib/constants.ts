export const HOUR_SLOTS = Array.from({ length: 24 }, (_, i) => i)

export const HOUR_LABELS = HOUR_SLOTS.map((h) => {
  const from = `${String(h).padStart(2, '0')}:00`
  const to = `${String((h + 1) % 24).padStart(2, '0')}:00`
  return `${from}–${to}`
})

export const DEFAULT_SLOT_CAPACITY_PRIVILEGED = 1
export const DEFAULT_SLOT_CAPACITY_NON_PRIVILEGED = 1

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  'FILLING-IN': 'Filling In',
  BOOKED: 'Booked',
  CLOSED: 'Closed',
}

export const BOOKING_STATUS_COLORS: Record<string, string> = {
  'FILLING-IN': 'bg-yellow-100 text-yellow-800',
  BOOKED: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-700',
}

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  agent: 'Agent',
  supervisor: 'Supervisor',
}

export const COOKIE_NAME = 'fms_session'
export const JWT_TTL_SECONDS = 8 * 60 * 60 // 8 hours

export const CRON_CLOSE_DAYS = 3 // auto-close bookings 3 days after booked_at
