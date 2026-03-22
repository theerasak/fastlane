import { test as base, Page } from '@playwright/test'
import { TC_TEST_EMAIL, TC_TEST_PASSWORD, TC_TEST_TOKEN } from './db.fixture'

export type Role = 'admin' | 'agent' | 'supervisor'

const ROLE_CREDENTIALS: Record<Role, { email: string; password: string }> = {
  admin: {
    email: process.env.TEST_ADMIN_EMAIL || 'admin@test.com',
    password: process.env.TEST_ADMIN_PASSWORD || 'testpass123',
  },
  agent: {
    email: process.env.TEST_AGENT_EMAIL || 'agent@test.com',
    password: process.env.TEST_AGENT_PASSWORD || 'testpass123',
  },
  supervisor: {
    email: process.env.TEST_SUPERVISOR_EMAIL || 'supervisor@test.com',
    password: process.env.TEST_SUPERVISOR_PASSWORD || 'testpass123',
  },
}

export async function loginAs(page: Page, role: Role) {
  const creds = ROLE_CREDENTIALS[role]
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.getByTestId('email-input').fill(creds.email)
  await page.getByTestId('password-input').fill(creds.password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL(/\/(users|bookings|capacity)/, { timeout: 15000 })
}

export async function logout(page: Page) {
  await page.getByTestId('logout-button').click()
  await page.waitForURL('/login')
}

/**
 * Logs in as a truck company by calling the API directly (reliable cookie setup).
 * After this, the page will be at /register/TC_TEST_TOKEN with a valid TC session.
 */
export async function loginAsTc(
  page: Page,
  email = TC_TEST_EMAIL,
  password = TC_TEST_PASSWORD
) {
  // POST to the login API — Playwright stores the Set-Cookie in the browser context
  const res = await page.request.post('/api/register/auth/login', {
    data: { contact_email: email, password },
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok()) {
    const body = await res.json()
    throw new Error(`TC login failed (${res.status()}): ${body.error}`)
  }
  // Now navigate to the token page with the session cookie set
  await page.goto(`/register/${TC_TEST_TOKEN}`)
  await page.waitForLoadState('networkidle')
}

type Fixtures = {
  loginAs: (role: Role) => Promise<void>
}

export const test = base.extend<Fixtures>({
  loginAs: async ({ page }, use) => {
    await use((role: Role) => loginAs(page, role))
  },
})

export { expect } from '@playwright/test'
