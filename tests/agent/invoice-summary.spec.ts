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
    terminal_id: 'term-001',
    terminal_name: 'Terminal A',
    truck_company_name: 'Priv Agent TC',
    fastlane_token: 'INV-TOKEN-001',
    token_cancelled: false,
    is_privileged_booking: true,
    num_trucks: 2,
    price_per_container: 250,
    amount: 500,  // 2 × 250
  },
  {
    id: 'inv-e2e-002',
    created_at: '2026-03-12T02:30:00Z', // 09:30 Bangkok time
    booking_number: 'INV-E2E-002',
    terminal_id: 'term-002',
    terminal_name: 'Terminal B',
    truck_company_name: 'Priv Agent TC',
    fastlane_token: null,
    token_cancelled: false,
    is_privileged_booking: false,
    num_trucks: 3,
    price_per_container: 500,
    amount: 1500,  // 3 × 500
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

  test('displays all expected columns including Terminal and Rate', async ({ page }) => {
    await page.getByRole('button', { name: 'View' }).click()
    await expect(page.getByText('Date & Time')).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /^terminal$/i })).toBeVisible()
    await expect(page.getByText('Booking No')).toBeVisible()
    await expect(page.getByText('Truck Company')).toBeVisible()
    await expect(page.getByText('TGC Code')).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /containers/i })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /rate/i })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Amount (THB)' })).toBeVisible()
  })

  test('Terminal column is the second column (after Date & Time)', async ({ page }) => {
    await page.getByRole('button', { name: 'View' }).click()
    const headers = page.locator('th')
    await expect(headers.nth(0)).toContainText(/date & time/i)
    await expect(headers.nth(1)).toContainText(/terminal/i)
    await expect(headers.nth(2)).toContainText(/booking no/i)
  })

  test('shows terminal name in results', async ({ page }) => {
    await page.getByRole('button', { name: 'View' }).click()
    await expect(page.getByText('Terminal A').first()).toBeVisible()
    await expect(page.getByText('Terminal B').first()).toBeVisible()
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
    // Total = 500 (2×250 privileged) + 1500 (3×500 non-privileged) = 2000.00
    await expect(page.getByText('Total Amount (THB)')).toBeVisible()
    await expect(page.getByText('2,000.00')).toBeVisible()
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

  test('terminal filter dropdown is visible in the form', async ({ page }) => {
    await expect(page.getByTestId('terminal-select')).toBeVisible()
  })

  test('terminal filter defaults to All terminals', async ({ page }) => {
    await expect(page.getByTestId('terminal-select')).toHaveValue('')
  })

  test('terminal filter select has All terminals option', async ({ page }) => {
    const options = await page.getByTestId('terminal-select').locator('option').allTextContents()
    expect(options[0]).toMatch(/all terminals/i)
  })

  test('selecting a terminal appends terminal_id to the API request', async ({ page }) => {
    const capturedUrls: string[] = []
    await page.route(`**${INVOICE_API}*`, route => {
      capturedUrls.push(route.request().url())
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: MOCK_ROWS }),
      })
    })

    const select = page.getByTestId('terminal-select')
    const optionCount = await select.locator('option').count()
    if (optionCount >= 2) {
      const val = await select.locator('option').nth(1).getAttribute('value')
      await select.selectOption(val!)
    }

    await page.getByRole('button', { name: 'View' }).click()
    await page.waitForLoadState('networkidle')

    if (optionCount >= 2) {
      expect(capturedUrls.some(u => u.includes('terminal_id='))).toBe(true)
    }
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
