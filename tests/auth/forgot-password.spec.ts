import { test, expect } from '@playwright/test'
import {
  seedPasswordResetData,
  cleanupPasswordResetData,
  RESET_E2E_EMAIL,
  RESET_E2E_PASSWORD,
  RESET_E2E_TOKEN,
  RESET_FLOW_TOKEN,
} from '../fixtures/db.fixture'

test.beforeAll(async () => {
  await seedPasswordResetData()
})

test.afterAll(async () => {
  await cleanupPasswordResetData()
})

// ── Login page integration ─────────────────────────────────────────────────

test.describe('Login page — forgot password link', () => {
  test('shows a "Forgot password?" link', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await expect(page.getByTestId('forgot-password-link')).toBeVisible()
  })

  test('clicking "Forgot password?" navigates to /forgot-password', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await page.getByTestId('forgot-password-link').click()
    await expect(page).toHaveURL(/\/forgot-password/)
  })
})

// ── Forgot password page ───────────────────────────────────────────────────

test.describe('Forgot password page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/forgot-password')
    await page.waitForLoadState('networkidle')
  })

  test('renders email input and submit button', async ({ page }) => {
    await expect(page.getByTestId('email-input')).toBeVisible()
    await expect(page.getByTestId('submit-btn')).toBeVisible()
  })

  test('has a "Back to sign in" link pointing to /login', async ({ page }) => {
    const backLink = page.getByRole('link', { name: /back to sign in/i })
    await expect(backLink).toBeVisible()
    await expect(backLink).toHaveAttribute('href', '/login')
  })

  test('shows success message after submitting any email', async ({ page }) => {
    await page.getByTestId('email-input').fill('anyone@example.com')
    await page.getByTestId('submit-btn').click()
    // Success message replaces the form
    await expect(page.getByText(/if that email/i)).toBeVisible({ timeout: 10000 })
  })

  test('success message includes a link back to sign in', async ({ page }) => {
    await page.getByTestId('email-input').fill('anyone@example.com')
    await page.getByTestId('submit-btn').click()
    await expect(page.getByRole('link', { name: /back to sign in/i })).toBeVisible({ timeout: 10000 })
  })

  test('back to sign in link navigates to /login', async ({ page }) => {
    await page.getByRole('link', { name: /back to sign in/i }).click()
    await expect(page).toHaveURL(/\/login/)
  })
})

// ── Reset password page ────────────────────────────────────────────────────

test.describe('Reset password page — form validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/reset-password/${RESET_E2E_TOKEN}`)
    await page.waitForLoadState('networkidle')
  })

  test('renders password and confirm fields', async ({ page }) => {
    await expect(page.getByTestId('password-input')).toBeVisible()
    await expect(page.getByTestId('confirm-input')).toBeVisible()
    await expect(page.getByTestId('submit-btn')).toBeVisible()
  })

  test('shows error when password is fewer than 10 characters', async ({ page }) => {
    await page.getByTestId('password-input').fill('short')
    await page.getByTestId('confirm-input').fill('short')
    await page.getByTestId('submit-btn').click()
    await expect(page.getByTestId('form-error')).toBeVisible()
    await expect(page.getByTestId('form-error')).toContainText('10 characters')
  })

  test('shows error when passwords do not match', async ({ page }) => {
    await page.getByTestId('password-input').fill('validpassword1')
    await page.getByTestId('confirm-input').fill('differentpass1')
    await page.getByTestId('submit-btn').click()
    await expect(page.getByTestId('form-error')).toBeVisible()
    await expect(page.getByTestId('form-error')).toContainText(/match/i)
  })

  test('shows error for exactly 9-character password', async ({ page }) => {
    await page.getByTestId('password-input').fill('123456789')
    await page.getByTestId('confirm-input').fill('123456789')
    await page.getByTestId('submit-btn').click()
    await expect(page.getByTestId('form-error')).toBeVisible()
  })
})

test.describe('Reset password page — invalid token', () => {
  test('shows error message for a non-existent token', async ({ page }) => {
    await page.goto('/reset-password/invalid-token-that-does-not-exist-000000000000000000000')
    await page.waitForLoadState('networkidle')
    await page.getByTestId('password-input').fill('newpassword123')
    await page.getByTestId('confirm-input').fill('newpassword123')
    await page.getByTestId('submit-btn').click()
    await expect(page.getByTestId('form-error')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('form-error')).toContainText(/invalid|expired/i)
  })
})

// ── Full reset flow ────────────────────────────────────────────────────────

test.describe('Full reset flow', () => {
  const newPassword = 'brandnewpass1'

  test('reset password with valid token then login with new password', async ({ page }) => {
    // 1. Navigate to the reset page with the flow token
    await page.goto(`/reset-password/${RESET_FLOW_TOKEN}`)
    await page.waitForLoadState('networkidle')

    // 2. Fill in a new valid password
    await page.getByTestId('password-input').fill(newPassword)
    await page.getByTestId('confirm-input').fill(newPassword)
    await page.getByTestId('submit-btn').click()

    // 3. Success message is shown
    await expect(page.getByText(/password has been updated/i)).toBeVisible({ timeout: 10000 })

    // 4. Navigate to login via the success page link
    await page.getByRole('link', { name: /go to sign in/i }).click()
    await expect(page).toHaveURL(/\/login/)

    // 5. Login with the new password
    await page.getByTestId('email-input').fill(RESET_E2E_EMAIL)
    await page.getByTestId('password-input').fill(newPassword)
    await page.getByTestId('login-submit').click()
    await page.waitForURL(/\/(bookings|users|capacity)/, { timeout: 15000 })
  })

  test('reset link cannot be used a second time', async ({ page }) => {
    // RESET_FLOW_TOKEN was consumed by the previous test; using it again should fail
    await page.goto(`/reset-password/${RESET_FLOW_TOKEN}`)
    await page.waitForLoadState('networkidle')
    await page.getByTestId('password-input').fill('anotherpassword1')
    await page.getByTestId('confirm-input').fill('anotherpassword1')
    await page.getByTestId('submit-btn').click()
    await expect(page.getByTestId('form-error')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('form-error')).toContainText(/already been used|invalid|expired/i)
  })
})
