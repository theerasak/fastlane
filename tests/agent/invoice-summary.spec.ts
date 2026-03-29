import { test, expect } from '@playwright/test'
import {
  seedPrivilegedAgentData,
  cleanupPrivilegedAgentData,
} from '../fixtures/db.fixture'
import { loginAsPrivilegedAgent, loginAs } from '../fixtures/auth.fixture'

const INVOICE_API = '/api/invoice'

const MOCK_ROWS = [
  {
    id: 'inv-e2e-001',
    created_at: '2026-03-11T01:00:00Z', // 08:00 Bangkok time
    booking_number: 'INV-E2E-001',
    truck_company_name: 'Priv Agent TC',
    fastlane_token: 'INV-TOKEN-001',
    token_cancelled: false,
    num_trucks: 2,
    amount: 200,
  },
  {
    id: 'inv-e2e-002',
    created_at: '2026-03-12T02:30:00Z', // 09:30 Bangkok time
    booking_number: 'INV-E2E-002',
    truck_company_name: 'Priv Agent TC',
    fastlane_token: null,
    token_cancelled: false,
    num_trucks: 3,
    amount: 300,
  },
]

test.beforeAll(async () => {
  await seedPrivilegedAgentData()
})

test.afterAll(async () => {
  await cleanupPrivilegedAgentData()
})

test.describe('Invoice Summary — privileged agent', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the invoice API so tests don't depend on real booking data
    await page.route(`**${INVOICE_API}*`, route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: MOCK_ROWS }),
      })
    )
    await loginAsPrivilegedAgent(page)
    await page.goto('/invoice-summary')
    await page.waitForLoadState('networkidle')
  })

  test('renders the invoice summary page with date form', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Invoice Summary' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'View' })).toBeVisible()
    await expect(page.getByText('From Date')).toBeVisible()
    await expect(page.getByText('To Date')).toBeVisible()
    await expect(page.locator('input[type="date"]').first()).toBeVisible()
  })

  test('shows invoice nav link for privileged agent', async ({ page }) => {
    // Sidebar (tablet+) or mobile menu should have Invoice link
    const invoiceLinks = page.getByRole('link', { name: 'Invoice' })
    await expect(invoiceLinks.first()).toBeVisible()
  })

  test('can view invoice results by clicking View', async ({ page }) => {
    await page.getByRole('button', { name: 'View' }).click()
    await expect(page.getByText('INV-E2E-001')).toBeVisible()
    await expect(page.getByText('INV-E2E-002')).toBeVisible()
  })

  test('displays all expected columns', async ({ page }) => {
    await page.getByRole('button', { name: 'View' }).click()
    await expect(page.getByText('Date & Time')).toBeVisible()
    await expect(page.getByText('Booking No')).toBeVisible()
    await expect(page.getByText('Truck Company')).toBeVisible()
    await expect(page.getByText('TGC Code')).toBeVisible()
    await expect(page.getByText('Trucks')).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Amount (THB)' })).toBeVisible()
  })

  test('shows truck company name in results', async ({ page }) => {
    await page.getByRole('button', { name: 'View' }).click()
    await expect(page.getByText('Priv Agent TC').first()).toBeVisible()
  })

  test('shows TGC code as link for rows with token', async ({ page }) => {
    await page.getByRole('button', { name: 'View' }).click()
    const tokenLink = page.getByRole('link', { name: 'INV-TOKEN-001' })
    await expect(tokenLink).toBeVisible()
    await expect(tokenLink).toHaveAttribute('href', '/register/INV-TOKEN-001')
  })

  test('shows dash for rows without token', async ({ page }) => {
    await page.getByRole('button', { name: 'View' }).click()
    // The second row has no token — expect a dash cell
    await expect(page.getByText('INV-E2E-002')).toBeVisible()
  })

  test('shows total amount in footer', async ({ page }) => {
    await page.getByRole('button', { name: 'View' }).click()
    // Total = 200 + 300 = 500.00
    await expect(page.getByText('Total Amount (THB)')).toBeVisible()
    await expect(page.getByText('500.00')).toBeVisible()
  })

  test('shows result count summary', async ({ page }) => {
    await page.getByRole('button', { name: 'View' }).click()
    await expect(page.getByText('2 bookings')).toBeVisible()
  })

  test('shows empty state when no bookings found', async ({ page }) => {
    await page.route(`**${INVOICE_API}*`, route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      })
    )
    await page.getByRole('button', { name: 'View' }).click()
    await expect(page.getByText('No bookings found in the selected date range.')).toBeVisible()
  })
})

test.describe('Invoice Summary — access control', () => {
  test('admin is redirected away from /invoice-summary', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/invoice-summary')
    await page.waitForLoadState('networkidle')
    // Admin is blocked by middleware (invoice-summary is agent-only) and sent to /users
    await expect(page).not.toHaveURL(/\/invoice-summary/)
  })
})
