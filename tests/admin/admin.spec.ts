import { test, expect } from '@playwright/test'
import { loginAs } from '../fixtures/auth.fixture'

test.describe('Admin — User Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/users')
  })

  test('users list page renders', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible()
    await expect(page.getByTestId('new-user-btn')).toBeVisible()
  })

  test('can navigate to new user form', async ({ page }) => {
    await page.getByTestId('new-user-btn').click()
    await expect(page).toHaveURL(/\/users\/new/)
    await expect(page.getByTestId('email-input')).toBeVisible()
    await expect(page.getByTestId('password-input')).toBeVisible()
    await expect(page.getByTestId('role-select')).toBeVisible()
  })
})

test.describe('Admin — Terminal Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/terminals')
  })

  test('terminals list page renders', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Port Terminals' })).toBeVisible()
  })

  test('can navigate to new terminal form', async ({ page }) => {
    await page.getByRole('link', { name: '+ New Terminal' }).click()
    await expect(page).toHaveURL(/\/terminals\/new/)
    await expect(page.getByTestId('terminal-name-input')).toBeVisible()
  })
})

test.describe('Admin — Truck Company Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/truck-companies')
  })

  test('truck companies page renders', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Truck Companies' })).toBeVisible()
  })

  test('can navigate to new company form', async ({ page }) => {
    await page.getByRole('link', { name: '+ New Company' }).click()
    await expect(page).toHaveURL(/\/truck-companies\/new/)
    await expect(page.getByTestId('company-name-input')).toBeVisible()
  })
})
