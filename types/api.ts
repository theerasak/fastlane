import type { BookingStatus, UserRole } from './database'

// Generic API response wrapper
export interface ApiResponse<T> {
  data?: T
  error?: string
  code?: string
}

// Auth
export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  user: {
    id: string
    email: string
    role: UserRole
  }
}

// Users
export interface CreateUserRequest {
  email: string
  password: string
  role: UserRole
  company_name?: string
  contact_person?: string
  phone?: string
}

export interface UpdateUserRequest {
  email?: string
  password?: string
  role?: UserRole
  is_active?: boolean
  is_privileged?: boolean
  company_name?: string | null
  contact_person?: string | null
  phone?: string | null
}

export interface UserResponse {
  id: string
  email: string
  role: UserRole
  is_active: boolean
  is_privileged: boolean
  company_name: string | null
  contact_person: string | null
  phone: string | null
  created_at: string
}

// Terminals
export interface CreateTerminalRequest {
  name: string
}

export interface UpdateTerminalRequest {
  name?: string
  is_active?: boolean
}

export interface TerminalResponse {
  id: string
  name: string
  is_active: boolean
  created_at: string
}

// Truck Companies
export interface CreateTruckCompanyRequest {
  name: string
  contact_email?: string
  contact_person?: string
  phone?: string
}

export interface UpdateTruckCompanyRequest {
  name?: string
  contact_email?: string
  contact_person?: string
  phone?: string
  is_active?: boolean
}

export interface TruckCompanyResponse {
  id: string
  name: string
  contact_email: string | null
  contact_person: string | null
  phone: string | null
  is_active: boolean
  created_at: string
}

// Bookings
export interface CreateBookingRequest {
  booking_number: string
  terminal_id: string
  truck_company_id: string
  num_trucks: number
}

export interface UpdateBookingRequest {
  status?: BookingStatus
}

export interface BookingResponse {
  id: string
  booking_number: string
  terminal_id: string
  truck_company_id: string
  num_trucks: number
  fastlane_token: string | null
  token_cancelled: boolean
  token_expires_at: string | null
  is_privileged_booking: boolean
  status: BookingStatus
  booking_date?: string
  created_at: string
  booked_at: string | null
  closed_at: string | null
  created_by: string | null
  terminal_name?: string
  truck_company_name?: string
  agent_email?: string | null
  agent_company_name?: string | null
  active_count?: number
}

export interface ImportBookingItem {
  booking_number: string
  terminal_id: string
  truck_company_id: string
  num_trucks: number
}

// Capacity
export interface CapacitySlotResponse {
  id: string
  terminal_id: string
  date: string
  hour_slot: number
  capacity_privileged: number
  capacity_non_privileged: number
  last_updated_at: string
  used_count_privileged?: number
  used_count_non_privileged?: number
  remaining_capacity_privileged?: number
  remaining_capacity_non_privileged?: number
}

export interface UpdateCapacityRequest {
  hour_slot: number
  capacity_privileged: number
  capacity_non_privileged: number
  last_updated_at: string
  force?: boolean
}

export interface CapacityConflictResponse {
  code: 'CONFLICT'
  current_capacity_privileged: number
  current_capacity_non_privileged: number
  current_updated_at: string
}

// Registrations
export interface RegistrationResponse {
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

export interface AddPlateRequest {
  license_plate: string
  container_number: string
  hour_slot: number
}

export interface EditPlateRequest {
  license_plate?: string
  container_number?: string
}

export interface SlotAvailability {
  hour_slot: number
  remaining_capacity: number
}

export interface BookingPublicInfo {
  id: string
  booking_number: string
  num_trucks: number
  terminal_name: string
  terminal_id: string
  booking_date: string  // YYYY-MM-DD
  is_privileged_booking: boolean
  status: BookingStatus
  token_cancelled: boolean
  registrations: RegistrationResponse[]
  active_count: number
  slot_availability: SlotAvailability[]
}
