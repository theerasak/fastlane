export type UserRole = 'admin' | 'agent' | 'supervisor'
export type BookingStatus = 'FILLING-IN' | 'BOOKED' | 'CLOSED'

export interface DbUser {
  id: string
  email: string
  password_hash: string
  role: UserRole
  is_active: boolean
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
  created_at: string
}

export interface DbTerminalCapacity {
  id: string
  terminal_id: string
  date: string
  hour_slot: number
  capacity: number
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
  capacity: number
  last_updated_at: string
  used_count: number
  remaining_capacity: number
}

// Joined types
export interface BookingWithRelations extends DbBooking {
  port_terminals?: DbPortTerminal
  truck_companies?: DbTruckCompany
}
