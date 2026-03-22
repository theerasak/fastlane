import { test, expect, Page } from '@playwright/test'
import {
  seedTcTestData,
  cleanupTcTestData,
  TC_TEST_EMAIL,
  TC_TEST_PASSWORD,
  TC_TEST_TOKEN,
  TC_DISABLED_EMAIL,
} from '../fixtures/db.fixture'
import { loginAsTc } from '../fixtures/auth.fixture'

/** UI-based login helper (for testing the login form itself). */
async function loginViaTcUi(page: Page, email: string, password: string) {
  await page.goto('/register/login')
  await page.waitForLoadState('networkidle')
  await page.getByTestId('tc-email-input').fill(email)
  await page.getByTestId('tc-password-input').fill(password)
  await page.getByTestId('tc-login-submit').click()
}

test.beforeAll(async () => {
  await seedTcTestData()
})

test.afterAll(async () => {
  await cleanupTcTestData()
})

// ── TC Login Page ──────────────────────────────────────────────────────────

test.describe('TC Login — /register/login', () => {
  test('login page renders email/password form', async ({ page }) => {
    await page.goto('/register/login')
    await expect(page.getByTestId('tc-email-input')).toBeVisible()
    await expect(page.getByTestId('tc-password-input')).toBeVisible()
    await expect(page.getByTestId('tc-login-submit')).toBeVisible()
  })

  test('shows error for invalid credentials', async ({ page }) => {
    await loginViaTcUi(page, 'wrong@example.com', 'wrongpass')
    await expect(page.getByTestId('tc-login-error')).toBeVisible({ timeout: 10000 })
    const errorText = await page.getByTestId('tc-login-error').textContent()
    expect(errorText).toMatch(/invalid/i)
  })

  test('shows disabled message for disabled company', async ({ page }) => {
    await loginViaTcUi(page, TC_DISABLED_EMAIL, TC_TEST_PASSWORD)
    await expect(page.getByTestId('tc-login-error')).toBeVisible({ timeout: 10000 })
    const errorText = await page.getByTestId('tc-login-error').textContent()
    expect(errorText).toMatch(/disabled/i)
  })

  test('valid credentials redirect to the registration page', async ({ page }) => {
    await loginAsTc(page)
    await expect(page).toHaveURL(new RegExp(`/register/${TC_TEST_TOKEN}`))
  })
})

// ── Route Guard ────────────────────────────────────────────────────────────

test.describe('TC Route Guard', () => {
  test('accessing /register/[token] without login redirects to /register/login', async ({ page }) => {
    // Use a fresh browser context (no cookies) to simulate unauthenticated access
    await page.context().clearCookies()
    await page.goto(`/register/${TC_TEST_TOKEN}`)
    await expect(page).toHaveURL(/\/register\/login/, { timeout: 10000 })
  })

  test('login page itself is accessible without auth', async ({ page }) => {
    await page.goto('/register/login')
    await expect(page).toHaveURL(/\/register\/login/)
    await expect(page.getByTestId('tc-login-submit')).toBeVisible()
  })
})

// ── Registration Page ──────────────────────────────────────────────────────

test.describe('Registration Page — /register/[token]', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTc(page) // navigates to TC_TEST_TOKEN and waits for networkidle
  })

  test('shows booking details: number, terminal, date, truck count', async ({ page }) => {
    await expect(page.getByText('TEST-TC-E2E-001')).toBeVisible()
    await expect(page.getByText('TEST-TERMINAL-A0')).toBeVisible()
    // "Trucks Allocated" label with "2" value — check the label exists
    await expect(page.getByText('Trucks Allocated')).toBeVisible()
  })

  test('shows booking date with a date picker', async ({ page }) => {
    const datePicker = page.locator('input[type="date"]')
    await expect(datePicker).toBeVisible()
    const value = await datePicker.inputValue()
    expect(value).toBe('2099-12-31')
  })

  test('shows Add Truck section when booking is not full', async ({ page }) => {
    await expect(page.getByTestId('plate-input')).toBeVisible()
    await expect(page.getByTestId('hour-slot-select')).toBeVisible()
    await expect(page.getByTestId('add-plate-btn')).toBeVisible()
  })

  test('shows Fastlane Registration heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Fastlane Registration' })).toBeVisible()
  })

  test('plate input auto-formats to XX-0000 format', async ({ page }) => {
    const plateInput = page.getByTestId('plate-input')
    // 3-letter + 4-digit input → formatter produces ABC-1234
    await plateInput.fill('abc1234')
    await expect(plateInput).toHaveValue('ABC-1234')
  })

  test('can add a plate and see it in the registered list', async ({ page }) => {
    const plateInput = page.getByTestId('plate-input')
    const slotSelect = page.getByTestId('hour-slot-select')
    const addBtn = page.getByTestId('add-plate-btn')

    // Pick any available slot
    await slotSelect.selectOption({ index: 1 })
    // Use a valid plate format: 3 alphanumeric + dash + 4 digits
    await plateInput.fill('abc0001')  // formatter will produce ABC-0001
    await addBtn.click()

    // Registration should appear
    await expect(page.getByTestId('plate-0')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('plate-0')).toHaveText('ABC-0001')
  })
})

// ── Privileged Booking Badge ───────────────────────────────────────────────

test.describe('Registration Page — Privileged Booking', () => {
  test('shows "Paid by Agent" badge for a privileged booking', async ({ page }) => {
    await loginAsTc(page)
    await page.goto('/register/TC-E2E-TOKEN-PRIV')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Paid by Agent')).toBeVisible()
  })

  test('does not show "Paid by Agent" badge for a non-privileged booking', async ({ page }) => {
    await loginAsTc(page)
    await page.goto(`/register/${TC_TEST_TOKEN}`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Paid by Agent')).not.toBeVisible()
  })
})
