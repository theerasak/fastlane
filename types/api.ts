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
}

export interface UpdateUserRequest {
  email?: string
  password?: string
  role?: UserRole
  is_active?: boolean
}

export interface UserResponse {
  id: string
  email: string
  role: UserRole
  is_active: boolean
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
}

export interface UpdateTruckCompanyRequest {
  name?: string
  contact_email?: string
}

export interface TruckCompanyResponse {
  id: string
  name: string
  contact_email: string | null
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
  status: BookingStatus
  created_at: string
  booked_at: string | null
  closed_at: string | null
  terminal_name?: string
  truck_company_name?: string
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
  capacity: number
  last_updated_at: string
  used_count?: number
  remaining_capacity?: number
}

export interface UpdateCapacityRequest {
  hour_slot: number
  capacity: number
  last_updated_at: string
  force?: boolean
}

export interface CapacityConflictResponse {
  code: 'CONFLICT'
  current_value: number
  current_updated_at: string
}

// Registrations
export interface RegistrationResponse {
  id: string
  booking_id: string
  hour_slot: number
  terminal_id: string
  license_plate: string
  is_deleted: boolean
  registered_at: string
  deleted_at: string | null
}

export interface AddPlateRequest {
  license_plate: string
  hour_slot: number
}

export interface EditPlateRequest {
  license_plate: string
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
  booking_date: string  // YYYY-MM-DD derived from created_at
  status: BookingStatus
  token_cancelled: boolean
  registrations: RegistrationResponse[]
  active_count: number
  slot_availability: SlotAvailability[]
}
