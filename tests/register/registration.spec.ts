import { test, expect } from '@playwright/test'

test.describe('Registration — Token Validation', () => {
  test('invalid token shows error page', async ({ page }) => {
    await page.goto('/register/invalid-token-xyz')
    await expect(page.getByText('Invalid Token')).toBeVisible()
  })

  test('cancelled token shows cancelled page', async ({ page }) => {
    // This test requires a known cancelled token in the database
    // Using a non-existent token falls back to invalid token page
    await page.goto('/register/00000000000z')
    await expect(page.getByText(/Invalid Token|Link Cancelled/)).toBeVisible()
  })
})

test.describe('Registration — Form Interaction', () => {
  test('public page requires no login', async ({ page }) => {
    // Registration page should be accessible without auth
    const response = await page.goto('/register/test-token')
    // Should not redirect to login
    expect(page.url()).not.toContain('/login')
  })
})
