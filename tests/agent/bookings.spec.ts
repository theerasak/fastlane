import { test, expect } from '@playwright/test'
import { loginAs } from '../fixtures/auth.fixture'

test.describe('Agent — Booking Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'agent')
    await page.goto('/bookings')
  })

  test('bookings list page renders', async ({ page }) => {
    await expect(page.getByTestId('new-booking-btn')).toBeVisible()
    await expect(page.getByTestId('booking-filter')).toBeVisible()
  })

  test('can search bookings by number', async ({ page }) => {
    await page.getByTestId('booking-filter').fill('NONEXISTENT-BK-999')
    await page.getByRole('button', { name: 'Search' }).click()
    // Should show empty state
    await expect(page.getByText('No bookings found.')).toBeVisible()
  })

  test('can navigate to new booking form', async ({ page }) => {
    await page.getByTestId('new-booking-btn').click()
    await expect(page).toHaveURL(/\/bookings\/new/)
    await expect(page.getByTestId('booking-number-input')).toBeVisible()
    await expect(page.getByTestId('terminal-select')).toBeVisible()
    await expect(page.getByTestId('truck-company-select')).toBeVisible()
    await expect(page.getByTestId('num-trucks-input')).toBeVisible()
  })
})

test.describe('Agent — Token Generation', () => {
  test('booking detail shows generate token button', async ({ page }) => {
    await loginAs(page, 'agent')
    await page.goto('/bookings')
    // Navigate to first booking if any
    const viewLinks = page.getByRole('link', { name: 'View' })
    const count = await viewLinks.count()
    if (count > 0) {
      await viewLinks.first().click()
      await expect(page.getByTestId('generate-token-btn')).toBeVisible()
    }
  })
})
