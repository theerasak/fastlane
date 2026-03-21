import bcrypt from 'bcryptjs'

// Use rounds=1 for fast test hashing (still valid bcrypt, just low cost)
export const MOCK_PASSWORD = 'testpass123'
export const MOCK_HASH = bcrypt.hashSync(MOCK_PASSWORD, 1)

export const BOOKING_DATE = '2026-03-11'

export const mockAdmin = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'admin@test.com',
  password_hash: MOCK_HASH,
  role: 'admin' as const,
  is_active: true,
  is_privileged: false,
  contact_person: null as string | null,
  phone: null as string | null,
  created_at: '2024-01-01T00:00:00Z',
}

export const mockAgent = {
  id: '00000000-0000-0000-0000-000000000002',
  email: 'agent@test.com',
  password_hash: MOCK_HASH,
  role: 'agent' as const,
  is_active: true,
  is_privileged: false,
  contact_person: 'John Doe' as string | null,
  phone: '+66-81-234-5678' as string | null,
  created_at: '2024-01-01T00:00:00Z',
}

export const mockPrivilegedAgent = {
  id: '00000000-0000-0000-0000-000000000004',
  email: 'agent2@test.com',
  password_hash: MOCK_HASH,
  role: 'agent' as const,
  is_active: true,
  is_privileged: true,
  contact_person: 'Jane Smith' as string | null,
  phone: '+66-81-999-8888' as string | null,
  created_at: '2024-01-01T00:00:00Z',
}

export const mockSupervisor = {
  id: '00000000-0000-0000-0000-000000000003',
  email: 'supervisor@test.com',
  password_hash: MOCK_HASH,
  role: 'supervisor' as const,
  is_active: true,
  is_privileged: false,
  contact_person: null as string | null,
  phone: null as string | null,
  created_at: '2024-01-01T00:00:00Z',
}

export const mockInactiveUser = {
  id: '00000000-0000-0000-0000-000000000005',
  email: 'inactive@test.com',
  password_hash: MOCK_HASH,
  role: 'agent' as const,
  is_active: false,
  is_privileged: false,
  contact_person: null as string | null,
  phone: null as string | null,
  created_at: '2024-01-01T00:00:00Z',
}

export const mockTerminal = {
  id: '00000000-0000-0000-0000-000000000010',
  name: 'Terminal A',
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
}

export const mockCompany = {
  id: '00000000-0000-0000-0000-000000000020',
  name: 'Test Trucking Co',
  contact_email: 'test@trucking.com',
  contact_person: 'Alice Manager' as string | null,
  phone: '+66-2-345-6789' as string | null,
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
}

export const mockInactiveCompany = {
  id: '00000000-0000-0000-0000-000000000021',
  name: 'Inactive Trucking Co',
  contact_email: null as string | null,
  contact_person: null as string | null,
  phone: null as string | null,
  is_active: false,
  created_at: '2024-01-01T00:00:00Z',
}

export const mockBooking = {
  id: '00000000-0000-0000-0000-000000000100',
  booking_number: 'BK-TEST-001',
  terminal_id: mockTerminal.id,
  truck_company_id: mockCompany.id,
  num_trucks: 2,
  fastlane_token: 'TESTTOKEN001',
  token_cancelled: false,
  status: 'FILLING-IN' as const,
  created_at: `${BOOKING_DATE}T08:00:00Z`,
  booked_at: null,
  closed_at: null,
}

// 24 capacity slots for the test terminal on BOOKING_DATE
export const mockSlots = Array.from({ length: 24 }, (_, i) => ({
  id: `slot-${String(i).padStart(2, '0')}`,
  terminal_id: mockTerminal.id,
  date: BOOKING_DATE,
  hour_slot: i,
  capacity: 5,
  last_updated_at: '2026-03-11T07:00:00Z',
  updated_by_api: false,
}))

// Remaining capacity view rows
export const mockSlotCapacity = mockSlots.map(s => ({
  terminal_id: s.terminal_id,
  date: s.date,
  hour_slot: s.hour_slot,
  capacity: s.capacity,
  last_updated_at: s.last_updated_at,
  used_count: 0,
  remaining_capacity: 5,
}))

export const mockRegistration = {
  id: '00000000-0000-0000-0000-000000000200',
  booking_id: mockBooking.id,
  hour_slot: 9,
  terminal_id: mockTerminal.id,
  license_plate: 'ABC-1234',
  is_deleted: false,
  registered_at: '2026-03-11T09:00:00Z',
  deleted_at: null,
}
