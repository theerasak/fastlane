import { test, expect } from '@playwright/test'
import { loginAs } from '../fixtures/auth.fixture'

const MOCK_AGENT_ID = 'aaaaaaaa-0000-0000-0000-000000000001'
const MOCK_COMPANY_ID = 'bbbbbbbb-0000-0000-0000-000000000001'

const agentUserData = {
  id: MOCK_AGENT_ID,
  email: 'agent@test.com',
  role: 'agent',
  is_active: true,
  is_privileged: false,
  contact_person: 'John Doe',
  phone: '+66-81-234-5678',
  created_at: '2024-01-01T00:00:00Z',
}

const companyData = {
  id: MOCK_COMPANY_ID,
  name: 'Test Trucking Co',
  contact_email: 'test@trucking.com',
  contact_person: 'Alice Manager',
  phone: '+66-2-345-6789',
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
}

// ── User form — new fields (no existing data needed) ──────────────────────────

test.describe('User Form — Contact Person & Phone', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/users/new')
  })

  test('new user form has Contact Person field', async ({ page }) => {
    await expect(page.getByLabel('Contact Person')).toBeVisible()
  })

  test('new user form has Phone field', async ({ page }) => {
    await expect(page.getByLabel('Phone')).toBeVisible()
  })
})

// ── User form — Privileged Agent toggle ───────────────────────────────────────

test.describe('User Form — Privileged Agent toggle', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin')
  })

  test('Privileged Agent checkbox is hidden on new user form', async ({ page }) => {
    await page.goto('/users/new')
    await expect(page.getByLabel('Privileged Agent')).not.toBeVisible()
  })

  test('edit page for an agent shows Privileged Agent checkbox', async ({ page }) => {
    await page.route(`/api/users/${MOCK_AGENT_ID}`, route =>
      route.fulfill({ json: { data: agentUserData } })
    )
    await page.goto(`/users/${MOCK_AGENT_ID}`)
    await expect(page.getByLabel('Privileged Agent')).toBeVisible()
  })

  test('Privileged Agent checkbox disappears when role changes from agent to admin', async ({
    page,
  }) => {
    await page.route(`/api/users/${MOCK_AGENT_ID}`, route =>
      route.fulfill({ json: { data: agentUserData } })
    )
    await page.goto(`/users/${MOCK_AGENT_ID}`)
    await expect(page.getByLabel('Privileged Agent')).toBeVisible()

    await page.getByTestId('role-select').selectOption('admin')
    await expect(page.getByLabel('Privileged Agent')).not.toBeVisible()
  })

  test('Privileged Agent checkbox reappears when role is switched back to agent', async ({
    page,
  }) => {
    await page.route(`/api/users/${MOCK_AGENT_ID}`, route =>
      route.fulfill({ json: { data: agentUserData } })
    )
    await page.goto(`/users/${MOCK_AGENT_ID}`)
    await page.getByTestId('role-select').selectOption('admin')
    await page.getByTestId('role-select').selectOption('agent')
    await expect(page.getByLabel('Privileged Agent')).toBeVisible()
  })
})

// ── Users list — display ──────────────────────────────────────────────────────

test.describe('Users List — display', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/users')
  })

  test('users list page renders with Status column', async ({ page }) => {
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible()
  })

  test('users list page renders with Role column', async ({ page }) => {
    await expect(page.getByRole('columnheader', { name: 'Role' })).toBeVisible()
  })
})

// ── Truck company form — new fields ───────────────────────────────────────────

test.describe('Truck Company Form — new record', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/truck-companies/new')
  })

  test('new company form has Contact Person field', async ({ page }) => {
    await expect(page.getByLabel('Contact Person')).toBeVisible()
  })

  test('new company form has Phone field', async ({ page }) => {
    await expect(page.getByLabel('Phone')).toBeVisible()
  })

  test('Active checkbox is not shown on new company form', async ({ page }) => {
    await expect(page.getByLabel('Active')).not.toBeVisible()
  })
})

// ── Truck company form — edit mode ────────────────────────────────────────────

test.describe('Truck Company Form — edit record', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin')
  })

  test('edit page shows Active checkbox', async ({ page }) => {
    await page.route(`/api/truck-companies/${MOCK_COMPANY_ID}`, route =>
      route.fulfill({ json: { data: companyData } })
    )
    await page.goto(`/truck-companies/${MOCK_COMPANY_ID}`)
    await expect(page.getByLabel('Active')).toBeVisible()
  })

  test('edit page shows Contact Person field', async ({ page }) => {
    await page.route(`/api/truck-companies/${MOCK_COMPANY_ID}`, route =>
      route.fulfill({ json: { data: companyData } })
    )
    await page.goto(`/truck-companies/${MOCK_COMPANY_ID}`)
    await expect(page.getByLabel('Contact Person')).toBeVisible()
  })

  test('edit page shows Phone field', async ({ page }) => {
    await page.route(`/api/truck-companies/${MOCK_COMPANY_ID}`, route =>
      route.fulfill({ json: { data: companyData } })
    )
    await page.goto(`/truck-companies/${MOCK_COMPANY_ID}`)
    await expect(page.getByLabel('Phone')).toBeVisible()
  })

  test('edit page shows Delete button', async ({ page }) => {
    await page.route(`/api/truck-companies/${MOCK_COMPANY_ID}`, route =>
      route.fulfill({ json: { data: companyData } })
    )
    await page.goto(`/truck-companies/${MOCK_COMPANY_ID}`)
    await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible()
  })

  test('Active checkbox reflects is_active=true from API', async ({ page }) => {
    await page.route(`/api/truck-companies/${MOCK_COMPANY_ID}`, route =>
      route.fulfill({ json: { data: { ...companyData, is_active: true } } })
    )
    await page.goto(`/truck-companies/${MOCK_COMPANY_ID}`)
    await expect(page.getByLabel('Active')).toBeChecked()
  })

  test('Active checkbox reflects is_active=false from API', async ({ page }) => {
    await page.route(`/api/truck-companies/${MOCK_COMPANY_ID}`, route =>
      route.fulfill({ json: { data: { ...companyData, is_active: false } } })
    )
    await page.goto(`/truck-companies/${MOCK_COMPANY_ID}`)
    await expect(page.getByLabel('Active')).not.toBeChecked()
  })
})

// ── Truck company disable & delete — bug regression ──────────────────────────

test.describe('Truck Company — disable and delete', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin')
  })

  test('disabling a company (null contact_email) succeeds and navigates back to list', async ({
    page,
  }) => {
    // Single handler for all methods — GET loads data, PATCH returns success
    await page.route(`/api/truck-companies/${MOCK_COMPANY_ID}`, route => {
      if (route.request().method() === 'PATCH')
        return route.fulfill({ json: { data: { ...companyData, contact_email: null, is_active: false } } })
      return route.fulfill({ json: { data: { ...companyData, contact_email: null } } })
    })

    await page.goto(`/truck-companies/${MOCK_COMPANY_ID}`)
    await expect(page.getByLabel('Active')).toBeVisible()

    await page.getByLabel('Active').uncheck()
    await page.getByRole('button', { name: 'Save Changes' }).click()

    await expect(page).toHaveURL(/\/truck-companies$/)
  })

  test('deleting a company with bookings shows a friendly error', async ({ page }) => {
    await page.route(`/api/truck-companies/${MOCK_COMPANY_ID}`, route => {
      if (route.request().method() === 'DELETE')
        return route.fulfill({
          status: 400,
          json: { error: 'Cannot delete: this company has existing bookings. Disable it instead.' },
        })
      return route.fulfill({ json: { data: companyData } })
    })

    await page.goto(`/truck-companies/${MOCK_COMPANY_ID}`)

    page.on('dialog', dialog => dialog.accept())
    await page.getByRole('button', { name: 'Delete' }).click()

    // Stays on edit page, does not navigate away
    await expect(page).toHaveURL(new RegExp(MOCK_COMPANY_ID))
  })

  test('deleting a company without bookings succeeds and navigates to list', async ({ page }) => {
    await page.route(`/api/truck-companies/${MOCK_COMPANY_ID}`, route => {
      if (route.request().method() === 'DELETE')
        return route.fulfill({ json: { ok: true } })
      return route.fulfill({ json: { data: companyData } })
    })

    await page.goto(`/truck-companies/${MOCK_COMPANY_ID}`)

    page.on('dialog', dialog => dialog.accept())
    await page.getByRole('button', { name: 'Delete' }).click()

    await expect(page).toHaveURL(/\/truck-companies$/)
  })
})

// ── Truck companies list — columns ────────────────────────────────────────────

test.describe('Truck Companies List — display', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/truck-companies')
  })

  test('truck companies list has Status column', async ({ page }) => {
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible()
  })

  test('truck companies list has Contact column', async ({ page }) => {
    await expect(page.getByRole('columnheader', { name: 'Contact' })).toBeVisible()
  })

  test('truck companies list has Phone column', async ({ page }) => {
    await expect(page.getByRole('columnheader', { name: 'Phone' })).toBeVisible()
  })
})
