import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

export async function createTestSupabaseClient() {
  const url = process.env.SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export const TC_TEST_EMAIL = process.env.TEST_TC_EMAIL || 'tc@test.com'
export const TC_TEST_PASSWORD = process.env.TEST_TC_PASSWORD || 'testpass123'
export const TC_TEST_TOKEN = 'TC-E2E-TOKEN-001'
export const TC_DISABLED_EMAIL = 'tc-disabled@test.com'

export async function seedTestData() {
  const supabase = await createTestSupabaseClient()
  const hash = await bcrypt.hash('testpass123', 10)

  // Create test users
  const users = [
    { email: 'admin@test.com', password_hash: hash, role: 'admin' },
    { email: 'agent@test.com', password_hash: hash, role: 'agent' },
    { email: 'supervisor@test.com', password_hash: hash, role: 'supervisor' },
  ]

  for (const user of users) {
    await supabase.from('users').upsert(user, { onConflict: 'email' })
  }

  // Create test terminal
  const { data: terminal } = await supabase
    .from('port_terminals')
    .upsert({ name: 'TEST-TERMINAL-A0', is_active: true }, { onConflict: 'name' })
    .select()
    .single()

  // Create test truck company
  const { data: company } = await supabase
    .from('truck_companies')
    .insert({ name: 'Test Trucking Co', contact_email: 'test@trucking.com' })
    .select()
    .single()

  return { terminal, company }
}

export async function cleanupTestData() {
  const supabase = await createTestSupabaseClient()

  // Remove test bookings and registrations
  const { data: testBookings } = await supabase
    .from('bookings')
    .select('id')
    .like('booking_number', 'TEST-%')

  if (testBookings && testBookings.length > 0) {
    const ids = testBookings.map(b => b.id)
    await supabase.from('fastlane_registrations').delete().in('booking_id', ids)
    await supabase.from('bookings').delete().in('id', ids)
  }

  await supabase.from('port_terminals').delete().eq('name', 'TEST-TERMINAL-A0')
  await supabase.from('truck_companies').delete().eq('name', 'Test Trucking Co')

  const testEmails = ['admin@test.com', 'agent@test.com', 'supervisor@test.com']
  await supabase.from('users').delete().in('email', testEmails)
}

/**
 * Seeds truck company + booking data for E2E registration tests.
 * Returns the created token and company email.
 */
export async function seedTcTestData() {
  const supabase = await createTestSupabaseClient()
  const hash = await bcrypt.hash(TC_TEST_PASSWORD, 10)

  // Find any existing test companies (may have FK-linked bookings from previous runs)
  for (const email of [TC_TEST_EMAIL, TC_DISABLED_EMAIL]) {
    const { data: oldCompanies } = await supabase
      .from('truck_companies').select('id').eq('contact_email', email)
    if (oldCompanies && oldCompanies.length > 0) {
      const companyIds = oldCompanies.map(c => c.id)
      // Delete ALL bookings + registrations linked to these companies
      const { data: oldBookings } = await supabase
        .from('bookings').select('id').in('truck_company_id', companyIds)
      if (oldBookings && oldBookings.length > 0) {
        const bookingIds = oldBookings.map(b => b.id)
        await supabase.from('fastlane_registrations').delete().in('booking_id', bookingIds)
        await supabase.from('bookings').delete().in('id', bookingIds)
      }
      await supabase.from('truck_companies').delete().in('id', companyIds)
    }
  }

  // Active TC with password
  const { data: activeCompany } = await supabase
    .from('truck_companies')
    .insert({ name: 'TC E2E Test Co', contact_email: TC_TEST_EMAIL, password_hash: hash, is_active: true })
    .select()
    .single()

  // Disabled TC with password
  await supabase
    .from('truck_companies')
    .insert({ name: 'TC E2E Disabled Co', contact_email: TC_DISABLED_EMAIL, password_hash: hash, is_active: false })

  // Ensure test terminal exists
  const { data: terminal } = await supabase
    .from('port_terminals')
    .upsert({ name: 'TEST-TERMINAL-A0', is_active: true }, { onConflict: 'name' })
    .select()
    .single()

  if (!activeCompany || !terminal) return null

  // Future booking date (well in advance so all deadline checks pass)
  const futureDate = '2099-12-31'

  // Create booking with a known fastlane_token
  const { data: booking } = await supabase
    .from('bookings')
    .upsert(
      {
        booking_number: 'TEST-TC-E2E-001',
        terminal_id: terminal.id,
        truck_company_id: activeCompany.id,
        num_trucks: 2,
        fastlane_token: TC_TEST_TOKEN,
        token_cancelled: false,
        is_privileged_booking: false,
        status: 'FILLING-IN',
        booking_date: futureDate,
      },
      { onConflict: 'booking_number' }
    )
    .select()
    .single()

  // Privileged booking
  const { data: privilegedBooking } = await supabase
    .from('bookings')
    .upsert(
      {
        booking_number: 'TEST-TC-E2E-PRIV',
        terminal_id: terminal.id,
        truck_company_id: activeCompany.id,
        num_trucks: 1,
        fastlane_token: 'TC-E2E-TOKEN-PRIV',
        token_cancelled: false,
        is_privileged_booking: true,
        status: 'FILLING-IN',
        booking_date: futureDate,
      },
      { onConflict: 'booking_number' }
    )
    .select()
    .single()

  // Seed capacity for the terminal on the future date
  const capacityRows = Array.from({ length: 24 }, (_, i) => ({
    terminal_id: terminal.id,
    date: futureDate,
    hour_slot: i,
    capacity_privileged: 3,
    capacity_non_privileged: 5,
  }))
  await supabase
    .from('terminal_capacity')
    .upsert(capacityRows, { onConflict: 'terminal_id,date,hour_slot' })

  return { activeCompany, terminal, booking, privilegedBooking }
}

/**
 * Seeds two terminals with capacity data for the capacity navigation E2E tests.
 * Returns both terminal IDs and the seeded date.
 */
export async function seedCapacityNavData() {
  const supabase = await createTestSupabaseClient()
  const navDate = '2099-06-15'

  const terminalA = await supabase
    .from('port_terminals')
    .upsert({ name: 'NAV-TERMINAL-A', is_active: true }, { onConflict: 'name' })
    .select()
    .single()

  const terminalB = await supabase
    .from('port_terminals')
    .upsert({ name: 'NAV-TERMINAL-B', is_active: true }, { onConflict: 'name' })
    .select()
    .single()

  if (!terminalA.data || !terminalB.data) return null

  const slotsA = Array.from({ length: 24 }, (_, i) => ({
    terminal_id: terminalA.data!.id,
    date: navDate,
    hour_slot: i,
    capacity_privileged: 2,
    capacity_non_privileged: 3,
  }))
  const slotsB = Array.from({ length: 24 }, (_, i) => ({
    terminal_id: terminalB.data!.id,
    date: navDate,
    hour_slot: i,
    capacity_privileged: 1,
    capacity_non_privileged: 1,
  }))

  await supabase
    .from('terminal_capacity')
    .upsert([...slotsA, ...slotsB], { onConflict: 'terminal_id,date,hour_slot' })

  return { terminalA: terminalA.data, terminalB: terminalB.data, navDate }
}

export async function cleanupCapacityNavData() {
  const supabase = await createTestSupabaseClient()
  for (const name of ['NAV-TERMINAL-A', 'NAV-TERMINAL-B']) {
    const { data: terminal } = await supabase
      .from('port_terminals')
      .select('id')
      .eq('name', name)
      .single()
    if (terminal) {
      await supabase.from('terminal_capacity').delete().eq('terminal_id', terminal.id)
      await supabase.from('port_terminals').delete().eq('id', terminal.id)
    }
  }
}

// ── Privileged Agent E2E fixture ────────────────────────────────────────────

export const PRIV_AGENT_EMAIL = 'priv-agent@test.com'
export const PRIV_AGENT_PASSWORD = 'testpass123'

/**
 * Seeds a privileged agent user for E2E invoice-summary tests.
 * Also seeds two bookings linked to that agent for data verification.
 */
export async function seedPrivilegedAgentData() {
  const supabase = await createTestSupabaseClient()
  const hash = await bcrypt.hash(PRIV_AGENT_PASSWORD, 10)

  // Upsert privileged agent
  const { data: agent } = await supabase
    .from('users')
    .upsert(
      { email: PRIV_AGENT_EMAIL, password_hash: hash, role: 'agent', is_privileged: true, is_active: true },
      { onConflict: 'email' }
    )
    .select('id')
    .single()

  if (!agent) return null

  // Ensure terminal and truck company exist
  const { data: terminal } = await supabase
    .from('port_terminals')
    .upsert({ name: 'TEST-TERMINAL-A0', is_active: true }, { onConflict: 'name' })
    .select()
    .single()

  const { data: company } = await supabase
    .from('truck_companies')
    .upsert(
      { name: 'Priv Agent TC', contact_email: 'privtc@test.com', is_active: true },
      { onConflict: 'contact_email' }
    )
    .select()
    .single()

  if (!terminal || !company) return null

  // Seed two bookings created by the privileged agent
  for (const row of [
    { booking_number: 'INV-E2E-001', num_trucks: 2, fastlane_token: 'INV-TOKEN-001' },
    { booking_number: 'INV-E2E-002', num_trucks: 3, fastlane_token: null },
  ]) {
    await supabase
      .from('bookings')
      .upsert(
        {
          ...row,
          terminal_id: terminal.id,
          truck_company_id: company.id,
          is_privileged_booking: true,
          status: 'FILLING-IN',
          booking_date: '2099-12-31',
          created_by: agent.id,
        },
        { onConflict: 'booking_number' }
      )
  }

  return { agent, terminal, company }
}

export async function cleanupPrivilegedAgentData() {
  const supabase = await createTestSupabaseClient()
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id')
    .like('booking_number', 'INV-E2E-%')
  if (bookings && bookings.length > 0) {
    await supabase.from('bookings').delete().in('id', bookings.map(b => b.id))
  }
  await supabase.from('truck_companies').delete().eq('contact_email', 'privtc@test.com')
  await supabase.from('users').delete().eq('email', PRIV_AGENT_EMAIL)
}

// ── Password Reset E2E fixture ───────────────────────────────────────────────

export const RESET_E2E_EMAIL = 'reset-e2e@test.com'
export const RESET_E2E_PASSWORD = 'testpass123'
// 64-char hex-like tokens for the two E2E reset test scenarios
export const RESET_E2E_TOKEN = '00000000000000000000000000000000000000000000000000000000000e2e01'
export const RESET_FLOW_TOKEN = '00000000000000000000000000000000000000000000000000000000000e2e02'

/**
 * Seeds a test user and two reset tokens for E2E forgot-password tests.
 * - RESET_E2E_TOKEN: valid token for page/validation tests (not consumed by tests)
 * - RESET_FLOW_TOKEN: valid token for the full reset+login flow test
 */
export async function seedPasswordResetData() {
  const supabase = await createTestSupabaseClient()
  const hash = await bcrypt.hash(RESET_E2E_PASSWORD, 10)

  const { data: user } = await supabase
    .from('users')
    .upsert(
      { email: RESET_E2E_EMAIL, password_hash: hash, role: 'agent', is_active: true },
      { onConflict: 'email' }
    )
    .select('id')
    .single()

  if (!user) return null

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()

  // Remove any leftover tokens for this user from previous runs
  await supabase.from('password_reset_tokens').delete().eq('user_id', user.id)

  await supabase.from('password_reset_tokens').insert([
    { user_id: user.id, token: RESET_E2E_TOKEN, expires_at: expiresAt },
    { user_id: user.id, token: RESET_FLOW_TOKEN, expires_at: expiresAt },
  ])

  return { user }
}

export async function cleanupPasswordResetData() {
  const supabase = await createTestSupabaseClient()
  // Tokens cascade-delete when user is deleted
  await supabase.from('users').delete().eq('email', RESET_E2E_EMAIL)
}

export async function cleanupTcTestData() {
  const supabase = await createTestSupabaseClient()

  // Remove TC E2E bookings first (FK constraint)
  const { data: tcBookings } = await supabase
    .from('bookings')
    .select('id')
    .like('booking_number', 'TEST-TC-E2E-%')

  if (tcBookings && tcBookings.length > 0) {
    const ids = tcBookings.map(b => b.id)
    await supabase.from('fastlane_registrations').delete().in('booking_id', ids)
    await supabase.from('bookings').delete().in('id', ids)
  }

  // Remove TC test companies
  await supabase.from('truck_companies').delete().eq('contact_email', TC_TEST_EMAIL)
  await supabase.from('truck_companies').delete().eq('contact_email', TC_DISABLED_EMAIL)
}
