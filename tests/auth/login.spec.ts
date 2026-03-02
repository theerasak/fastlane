import { test, expect } from '@playwright/test'
import { loginAs } from '../fixtures/auth.fixture'

test.describe('Authentication', () => {
  test('login page renders', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByTestId('email-input')).toBeVisible()
    await expect(page.getByTestId('password-input')).toBeVisible()
    await expect(page.getByTestId('login-submit')).toBeVisible()
  })

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await page.getByTestId('email-input').fill('wrong@example.com')
    await page.getByTestId('password-input').fill('wrongpassword')
    await page.getByTestId('login-submit').click()
    await expect(page.getByTestId('login-error')).toBeVisible({ timeout: 10000 })
  })

  test('admin lands on /users after login', async ({ page }) => {
    await loginAs(page, 'admin')
    await expect(page).toHaveURL(/\/users/)
  })

  test('agent lands on /bookings after login', async ({ page }) => {
    await loginAs(page, 'agent')
    await expect(page).toHaveURL(/\/bookings/)
  })

  test('supervisor lands on /capacity after login', async ({ page }) => {
    await loginAs(page, 'supervisor')
    await expect(page).toHaveURL(/\/capacity/)
  })

  test('unauthenticated redirect to login', async ({ page }) => {
    await page.goto('/users')
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('Role-based route guards', () => {
  test('agent cannot access /users', async ({ page }) => {
    await loginAs(page, 'agent')
    await page.goto('/users')
    // Should redirect away from /users
    await expect(page).not.toHaveURL(/\/users/)
  })

  test('supervisor cannot access /bookings', async ({ page }) => {
    await loginAs(page, 'supervisor')
    await page.goto('/bookings')
    await expect(page).not.toHaveURL(/\/bookings/)
  })

  test('agent cannot access /capacity', async ({ page }) => {
    await loginAs(page, 'agent')
    await page.goto('/capacity')
    await expect(page).not.toHaveURL(/\/capacity/)
  })
})
