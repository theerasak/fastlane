import { test as base, Page } from '@playwright/test'

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

type Fixtures = {
  loginAs: (role: Role) => Promise<void>
}

export const test = base.extend<Fixtures>({
  loginAs: async ({ page }, use) => {
    await use((role: Role) => loginAs(page, role))
  },
})

export { expect } from '@playwright/test'
