import { test, expect, Page } from '@playwright/test'
import {
  seedTcTestData,
  cleanupTcTestData,
  TC_TEST_EMAIL,
  TC_TEST_PASSWORD,
  TC_TEST_TOKEN,
} from '../fixtures/db.fixture'
import { loginAsTcDashboard } from '../fixtures/auth.fixture'

/** UI-based TC login helper — fills the login form and submits. */
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

// ── Route guard ────────────────────────────────────────────────────────────

test.describe('TC dashboard — route guard', () => {
  test('unauthenticated /register redirects to /register/login', async ({ page }) => {
    await page.goto('/register')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/register\/login/)
  })
})

// ── Login redirect ─────────────────────────────────────────────────────────

test.describe('TC dashboard — login redirect', () => {
  test('login form redirects to /register on success', async ({ page }) => {
    await loginViaTcUi(page, TC_TEST_EMAIL, TC_TEST_PASSWORD)
    await page.waitForURL(/\/register$/, { timeout: 10000 })
    await expect(page).toHaveURL(/\/register$/)
  })
})

// ── Dashboard content ──────────────────────────────────────────────────────

test.describe('TC dashboard — content', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTcDashboard(page)
  })

  test('shows the company name', async ({ page }) => {
    await expect(page.getByText('TC E2E Test Co')).toBeVisible()
  })

  test('shows at least one booking card', async ({ page }) => {
    // seedTcTestData creates a booking with token TC-E2E-TOKEN-001
    await expect(page.getByText('TEST-TC-E2E-001')).toBeVisible()
  })

  test('booking card links to the registration page', async ({ page }) => {
    const bookingLink = page.getByRole('link', { name: /TEST-TC-E2E-001/i })
    await expect(bookingLink).toBeVisible()
    await expect(bookingLink).toHaveAttribute('href', `/register/${TC_TEST_TOKEN}`)
  })

  test('clicking a booking link navigates to the registration page', async ({ page }) => {
    await page.getByRole('link', { name: /TEST-TC-E2E-001/i }).click()
    await page.waitForURL(new RegExp(`/register/${TC_TEST_TOKEN}`), { timeout: 10000 })
    await expect(page).toHaveURL(new RegExp(`/register/${TC_TEST_TOKEN}`))
  })

  test('shows the booking date and terminal name', async ({ page }) => {
    await expect(page.getByText('TEST-TERMINAL-A0')).toBeVisible()
    await expect(page.getByText('2099-12-31')).toBeVisible()
  })

  test('shows booking status', async ({ page }) => {
    await expect(page.getByText('FILLING-IN')).toBeVisible()
  })
})

// ── Sign out ───────────────────────────────────────────────────────────────

test.describe('TC dashboard — sign out', () => {
  test('sign out redirects to /register/login', async ({ page }) => {
    await loginAsTcDashboard(page)
    await page.getByRole('button', { name: /sign out/i }).click()
    await page.waitForURL(/\/register\/login/, { timeout: 10000 })
    await expect(page).toHaveURL(/\/register\/login/)
  })

  test('after sign out, /register redirects back to login', async ({ page }) => {
    await loginAsTcDashboard(page)
    await page.getByRole('button', { name: /sign out/i }).click()
    await page.waitForURL(/\/register\/login/, { timeout: 10000 })

    await page.goto('/register')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/register\/login/)
  })
})
