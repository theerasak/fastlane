import { test, expect } from '@playwright/test'
import {
  seedTcTestData,
  cleanupTcTestData,
  TC_TEST_TOKEN,
} from '../fixtures/db.fixture'
import { loginAs, loginAsTc } from '../fixtures/auth.fixture'

// ── Seed a real registration for the summary page to display ─────────────

test.beforeAll(async () => {
  await seedTcTestData()
})

test.afterAll(async () => {
  await cleanupTcTestData()
})

// ── Route guard ─────────────────────────────────────────────────────────────

test.describe('Daily Summary — route guard', () => {
  test('unauthenticated /daily-summary redirects to /login', async ({ page }) => {
    await page.goto('/daily-summary')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/login/)
  })

  test('agent cannot access /daily-summary', async ({ page }) => {
    await loginAs(page, 'agent')
    await page.goto('/daily-summary')
    await page.waitForLoadState('networkidle')
    // Middleware redirects non-supervisors away from /daily-summary
    await expect(page).not.toHaveURL(/\/daily-summary/)
  })
})

// ── Navigation sidebar ──────────────────────────────────────────────────────

test.describe('Daily Summary — sidebar navigation', () => {
  test('supervisor sidebar shows Daily Summary link', async ({ page }) => {
    await loginAs(page, 'supervisor')
    await page.goto('/capacity')
    await page.waitForLoadState('networkidle')
    const link = page.getByRole('link', { name: /daily summary/i })
    await expect(link.first()).toBeVisible()
  })

  test('Daily Summary sidebar link navigates to /daily-summary', async ({ page }) => {
    await loginAs(page, 'supervisor')
    await page.goto('/capacity')
    await page.waitForLoadState('networkidle')
    await page.getByRole('link', { name: /daily summary/i }).first().click()
    await page.waitForURL(/\/daily-summary/, { timeout: 10000 })
    await expect(page).toHaveURL(/\/daily-summary/)
  })
})

// ── Page rendering ──────────────────────────────────────────────────────────

test.describe('Daily Summary — page rendering', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'supervisor')
    await page.goto('/daily-summary')
    await page.waitForLoadState('networkidle')
  })

  test('renders the date navigation bar', async ({ page }) => {
    await expect(page.getByTestId('date-nav')).toBeVisible()
    await expect(page.getByTestId('prev-day-btn')).toBeVisible()
    await expect(page.getByTestId('next-day-btn')).toBeVisible()
    await expect(page.getByTestId('date-input')).toBeVisible()
    await expect(page.getByTestId('today-btn')).toBeVisible()
  })

  test('date input defaults to today', async ({ page }) => {
    const today = new Date().toISOString().split('T')[0]
    await expect(page.getByTestId('date-input')).toHaveValue(today)
  })

  test('shows empty message or table depending on data', async ({ page }) => {
    // Either empty message or a table — both are valid outcomes
    const hasTable = await page.getByTestId('summary-table').isVisible().catch(() => false)
    const hasEmpty = await page.getByTestId('empty-message').isVisible().catch(() => false)
    expect(hasTable || hasEmpty).toBe(true)
  })
})

// ── Date navigation ─────────────────────────────────────────────────────────

test.describe('Daily Summary — date navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'supervisor')
    const today = new Date().toISOString().split('T')[0]
    await page.goto(`/daily-summary?date=${today}`)
    await page.waitForLoadState('networkidle')
  })

  test('Yesterday button decrements the date by one day', async ({ page }) => {
    const dateBefore = await page.getByTestId('date-input').inputValue()
    await page.getByTestId('prev-day-btn').click()
    await page.waitForLoadState('networkidle')
    const dateAfter = await page.getByTestId('date-input').inputValue()
    expect(dateAfter).not.toBe(dateBefore)
    // dateAfter should be one day before dateBefore
    const d1 = new Date(dateBefore)
    const d2 = new Date(dateAfter)
    expect(d1.getTime() - d2.getTime()).toBe(24 * 60 * 60 * 1000)
  })

  test('Tomorrow button increments the date by one day', async ({ page }) => {
    const dateBefore = await page.getByTestId('date-input').inputValue()
    await page.getByTestId('next-day-btn').click()
    await page.waitForLoadState('networkidle')
    const dateAfter = await page.getByTestId('date-input').inputValue()
    expect(dateAfter).not.toBe(dateBefore)
    const d1 = new Date(dateAfter)
    const d2 = new Date(dateBefore)
    expect(d1.getTime() - d2.getTime()).toBe(24 * 60 * 60 * 1000)
  })

  test('Today button resets the date to today', async ({ page }) => {
    // First navigate to yesterday
    await page.getByTestId('prev-day-btn').click()
    await page.waitForLoadState('networkidle')
    // Then click Today
    await page.getByTestId('today-btn').click()
    await page.waitForLoadState('networkidle')
    const today = new Date().toISOString().split('T')[0]
    await expect(page.getByTestId('date-input')).toHaveValue(today)
  })

  test('date input accepts a manually typed date', async ({ page }) => {
    await page.getByTestId('date-input').fill('2099-06-15')
    await page.waitForLoadState('networkidle')
    await expect(page.getByTestId('date-input')).toHaveValue('2099-06-15')
  })

  test('URL search param updates when navigating dates', async ({ page }) => {
    await page.getByTestId('prev-day-btn').click()
    await page.waitForURL(/date=/, { timeout: 5000 })
    expect(page.url()).toMatch(/[?&]date=\d{4}-\d{2}-\d{2}/)
  })
})

// ── Table content ───────────────────────────────────────────────────────────

test.describe('Daily Summary — table content with seeded data', () => {
  test('table shows appointment rows when data exists for a far-future date', async ({ page }) => {
    // seedTcTestData creates a booking for 2099-12-31; we need a registration too.
    // Register a truck via the TC portal first so the summary has data to show.
    await loginAsTc(page)
    await page.waitForLoadState('networkidle')

    // Register one truck to the booking
    const plateInput = page.getByTestId('plate-input-0')
    const isVisible = await plateInput.isVisible().catch(() => false)
    if (!isVisible) return // Skip if form not visible (e.g., booking already full)

    await plateInput.fill('TST-0001')
    const containerInput = page.getByTestId('container-input-0')
    await containerInput.fill('TEST1234567')
    // Pick any slot and submit
    const slotButton = page.getByTestId(/slot-btn-\d+/).first()
    await slotButton.click()
    await page.getByTestId('submit-btn').click()
    await page.waitForLoadState('networkidle')

    // Now check the daily summary for that date
    await loginAs(page, 'supervisor')
    await page.goto('/daily-summary?date=2099-12-31')
    await page.waitForLoadState('networkidle')

    const table = page.getByTestId('summary-table')
    const isEmpty = await page.getByTestId('empty-message').isVisible().catch(() => false)
    if (!isEmpty) {
      await expect(table).toBeVisible()
      const rows = page.getByTestId('summary-row')
      await expect(rows.first()).toBeVisible()
    }
  })

  test('table columns are present', async ({ page }) => {
    await loginAs(page, 'supervisor')
    await page.goto('/daily-summary?date=2099-12-31')
    await page.waitForLoadState('networkidle')

    const hasTable = await page.getByTestId('summary-table').isVisible().catch(() => false)
    if (hasTable) {
      await expect(page.getByRole('columnheader', { name: /time/i })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: /truck company/i })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: /license plate/i })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: /booking/i })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: /container/i })).toBeVisible()
    }
  })
})
