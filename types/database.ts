export type UserRole = 'admin' | 'agent' | 'supervisor'
export type BookingStatus = 'FILLING-IN' | 'BOOKED' | 'CLOSED'

export interface DbUser {
  id: string
  email: string
  password_hash: string
  role: UserRole
  is_active: boolean
  is_privileged: boolean
  contact_person: string | null
  phone: string | null
  created_at: string
}

export interface DbPortTerminal {
  id: string
  name: string
  is_active: boolean
  created_at: string
}

export interface DbTruckCompany {
  id: string
  name: string
  contact_email: string | null
  contact_person: string | null
  phone: string | null
  is_active: boolean
  created_at: string
}

export interface DbAuditLog {
  id: string
  table_name: string
  record_id: string
  action: 'CREATE' | 'UPDATE' | 'DELETE'
  performed_by: string | null
  performed_by_email: string
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  created_at: string
}

export interface DbTerminalCapacity {
  id: string
  terminal_id: string
  date: string
  hour_slot: number
  capacity_privileged: number
  capacity_non_privileged: number
  last_updated_at: string
  updated_by_api: boolean
}

export interface DbBooking {
  id: string
  booking_number: string
  terminal_id: string
  truck_company_id: string
  num_trucks: number
  fastlane_token: string | null
  token_cancelled: boolean
  is_privileged_booking: boolean
  status: BookingStatus
  created_at: string
  booked_at: string | null
  closed_at: string | null
}

export interface DbFastlaneRegistration {
  id: string
  booking_id: string
  hour_slot: number
  terminal_id: string
  license_plate: string
  container_number: string
  is_deleted: boolean
  registered_at: string
  deleted_at: string | null
}

// View types
export interface BookingFillStat {
  booking_id: string
  booking_number: string
  num_trucks: number
  active_count: number
  status: BookingStatus
}

export interface SlotRemainingCapacity {
  terminal_id: string
  date: string
  hour_slot: number
  capacity_privileged: number
  capacity_non_privileged: number
  last_updated_at: string
  used_count_privileged: number
  used_count_non_privileged: number
  remaining_capacity_privileged: number
  remaining_capacity_non_privileged: number
}

// Joined types
export interface BookingWithRelations extends DbBooking {
  port_terminals?: DbPortTerminal
  truck_companies?: DbTruckCompany
}
