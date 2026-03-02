import { BOOKING_STATUS_COLORS, BOOKING_STATUS_LABELS } from '@/lib/constants'
import type { BookingStatus } from '@/types/database'

interface BadgeProps {
  status: BookingStatus
}

export function StatusBadge({ status }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${BOOKING_STATUS_COLORS[status]}`}>
      {BOOKING_STATUS_LABELS[status] ?? status}
    </span>
  )
}

interface RoleBadgeProps {
  role: string
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-800',
  agent: 'bg-blue-100 text-blue-800',
  supervisor: 'bg-orange-100 text-orange-800',
}

export function RoleBadge({ role }: RoleBadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[role] ?? 'bg-gray-100 text-gray-700'}`}>
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  )
}
