import { test, expect } from '@playwright/test'
import { loginAs } from '../fixtures/auth.fixture'

test.describe('Supervisor — Capacity Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'supervisor')
    await page.goto('/capacity')
  })

  test('capacity index page renders', async ({ page }) => {
    await expect(page.getByTestId('view-capacity-btn')).toBeVisible()
    await expect(page.getByTestId('date-input')).toBeVisible()
  })

  test('shows terminal selector', async ({ page }) => {
    await expect(page.getByTestId('terminal-select')).toBeVisible()
  })
})

test.describe('Supervisor — Capacity Grid', () => {
  test('can navigate to capacity grid', async ({ page }) => {
    await loginAs(page, 'supervisor')
    await page.goto('/capacity')

    // Only proceed if a terminal is available
    const terminalSelect = page.getByTestId('terminal-select')
    const options = await terminalSelect.locator('option').count()

    if (options > 1) {
      // Select today's date
      const today = new Date().toISOString().split('T')[0]
      await page.getByTestId('date-input').fill(today)
      await page.getByTestId('view-capacity-btn').click()

      await expect(page.getByTestId('capacity-grid')).toBeVisible()
      // Should show 24 slots
      const cells = page.getByTestId(/slot-priv-cell-\d+/)
      await expect(cells).toHaveCount(24)
    }
  })
})
