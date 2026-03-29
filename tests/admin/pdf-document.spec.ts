import { test, expect } from '@playwright/test'
import { loginAs } from '../fixtures/auth.fixture'
import { createTestSupabaseClient, seedTcTestData, cleanupTcTestData, TC_TEST_TOKEN } from '../fixtures/db.fixture'
import bcrypt from 'bcryptjs'

// ── Seed an admin user + a booking with at least one registration ─────────────

const ADMIN_EMAIL = 'admin@test.com'
const ADMIN_PASSWORD = 'testpass123'

async function seedAdminAndRegistration() {
  const supabase = await createTestSupabaseClient()

  // Ensure admin user exists
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 10)
  await supabase.from('users').upsert(
    { email: ADMIN_EMAIL, password_hash: hash, role: 'admin', is_active: true },
    { onConflict: 'email' }
  )

  // Seed TC data (creates TC_TEST_TOKEN booking with num_trucks=2)
  await seedTcTestData()

  // Find that booking
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, terminal_id, booking_date')
    .eq('fastlane_token', TC_TEST_TOKEN)
    .single()

  if (!booking) return null

  // Add one registration so the "Regenerate Documents" button appears
  const { data: existing } = await supabase
    .from('fastlane_registrations')
    .select('id')
    .eq('booking_id', booking.id)
    .eq('is_deleted', false)

  if (!existing || existing.length === 0) {
    await supabase.from('fastlane_registrations').insert({
      booking_id: booking.id,
      terminal_id: booking.terminal_id,
      appointment_date: booking.booking_date,
      hour_slot: 9,
      license_plate: 'PDF-0001',
      container_number: 'PDFT1234567',
    })
  }

  return booking
}

async function getBookingIdByToken(token: string) {
  const supabase = await createTestSupabaseClient()
  const { data } = await supabase
    .from('bookings')
    .select('id')
    .eq('fastlane_token', token)
    .single()
  return data?.id ?? null
}

test.beforeAll(async () => {
  await seedAdminAndRegistration()
})

test.afterAll(async () => {
  const supabase = await createTestSupabaseClient()
  // Remove the seeded registration
  const { data: booking } = await supabase
    .from('bookings')
    .select('id')
    .eq('fastlane_token', TC_TEST_TOKEN)
    .single()
  if (booking) {
    await supabase.from('fastlane_registrations').delete()
      .eq('booking_id', booking.id)
      .eq('license_plate', 'PDF-0001')
  }
  await cleanupTcTestData()
})

// ── Booking Detail Page — Registered Trucks section ──────────────────────────

test.describe('Admin — Regenerate Documents', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin')
  })

  test('Regenerate Documents button is visible when registrations exist', async ({ page }) => {
    const bookingId = await getBookingIdByToken(TC_TEST_TOKEN)
    expect(bookingId).toBeTruthy()

    await page.goto(`/bookings/${bookingId}`)
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('button', { name: 'Regenerate Documents' })).toBeVisible()
  })

  test('Regenerate Documents button shows loading state when clicked', async ({ page }) => {
    const bookingId = await getBookingIdByToken(TC_TEST_TOKEN)
    expect(bookingId).toBeTruthy()

    await page.goto(`/bookings/${bookingId}`)
    await page.waitForLoadState('networkidle')

    // Intercept the API call to delay it so we can observe loading state
    await page.route(`/api/bookings/${bookingId}/send-documents`, async route => {
      await new Promise(r => setTimeout(r, 300))
      await route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) })
    })

    const btn = page.getByRole('button', { name: /Regenerate Documents/ })
    await btn.click()

    // Button should be disabled while loading
    await expect(btn).toBeDisabled()

    // Wait for it to re-enable after the response
    await expect(btn).toBeEnabled({ timeout: 5000 })
  })

  test('shows success toast after regeneration', async ({ page }) => {
    const bookingId = await getBookingIdByToken(TC_TEST_TOKEN)
    expect(bookingId).toBeTruthy()

    await page.goto(`/bookings/${bookingId}`)
    await page.waitForLoadState('networkidle')

    // Stub the API so we don't need real SMTP
    await page.route(`/api/bookings/${bookingId}/send-documents`, route =>
      route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) })
    )

    await page.getByRole('button', { name: 'Regenerate Documents' }).click()
    await expect(page.getByText(/documents sent/i)).toBeVisible({ timeout: 5000 })
  })

  test('shows error toast when regeneration fails', async ({ page }) => {
    const bookingId = await getBookingIdByToken(TC_TEST_TOKEN)
    expect(bookingId).toBeTruthy()

    await page.goto(`/bookings/${bookingId}`)
    await page.waitForLoadState('networkidle')

    await page.route(`/api/bookings/${bookingId}/send-documents`, route =>
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'SMTP error' }) })
    )

    await page.getByRole('button', { name: 'Regenerate Documents' }).click()
    await expect(page.getByText(/SMTP error|failed/i)).toBeVisible({ timeout: 5000 })
  })

  test('Regenerate Documents button is not visible when there are no registrations', async ({ page }) => {
    // Find the privileged booking (no registrations)
    const supabase = await createTestSupabaseClient()
    const { data: booking } = await supabase
      .from('bookings')
      .select('id')
      .eq('fastlane_token', 'TC-E2E-TOKEN-PRIV')
      .single()

    if (!booking) test.skip()

    await page.goto(`/bookings/${booking!.id}`)
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('button', { name: 'Regenerate Documents' })).not.toBeVisible()
  })
})
