import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

export async function createTestSupabaseClient() {
  const url = process.env.SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

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
