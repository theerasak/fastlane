import { test, expect } from '@playwright/test'
import { seedTcTestData, cleanupTcTestData, TC_TEST_TOKEN } from '../fixtures/db.fixture'
import { loginAsTc } from '../fixtures/auth.fixture'

const MOCK_REG = {
  id: 'mock-reg-id-e2e-001',
  booking_id: 'mock-booking-id',
  hour_slot: 9,
  terminal_id: 'mock-terminal-id',
  license_plate: 'ABC-0010',
  container_number: 'ABCD1234567',
  is_deleted: false,
  registered_at: new Date().toISOString(),
  deleted_at: null,
}

const PLATES_URL = `/api/register/${TC_TEST_TOKEN}/plates`

test.beforeAll(async () => {
  await seedTcTestData()
})

test.afterAll(async () => {
  await cleanupTcTestData()
})

// Mock POST and PATCH so no real registrations are created, keeping the booking
// perpetually unfull and giving deterministic UI state across all tests.
test.beforeEach(async ({ page }) => {
  await page.route(`**${PLATES_URL}*`, async route => {
    const method = route.request().method()
    let body: Record<string, unknown> = {}
    try {
      const raw = route.request().postData()
      if (raw) body = JSON.parse(raw)
    } catch { /* no-op */ }

    if (method === 'POST') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            ...MOCK_REG,
            license_plate: String(body.license_plate ?? MOCK_REG.license_plate).toUpperCase(),
            container_number: String(body.container_number ?? MOCK_REG.container_number).toUpperCase(),
            hour_slot: body.hour_slot ?? MOCK_REG.hour_slot,
          },
        }),
      })
    }
    if (method === 'PATCH') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            ...MOCK_REG,
            license_plate: String(body.license_plate ?? MOCK_REG.license_plate),
            container_number: String(body.container_number ?? MOCK_REG.container_number),
          },
        }),
      })
    }
    if (method === 'DELETE') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
    }
    return route.continue()
  })

  await loginAsTc(page)
})

// ── Container number field visibility ─────────────────────────────────────

test.describe('Container Number — field visibility', () => {
  test('shows container number input on the Add Truck form', async ({ page }) => {
    await expect(page.getByTestId('container-input')).toBeVisible()
  })

  test('shows license plate input alongside container number input', async ({ page }) => {
    await expect(page.getByTestId('plate-input')).toBeVisible()
    await expect(page.getByTestId('container-input')).toBeVisible()
  })

  test('shows Container Number label on the form', async ({ page }) => {
    await expect(page.getByText('Container Number')).toBeVisible()
  })
})

// ── Container number input formatting ─────────────────────────────────────

test.describe('Container Number — input formatting', () => {
  test('auto-uppercases lowercase letters', async ({ page }) => {
    const input = page.getByTestId('container-input')
    await input.fill('ABCD1234567')
    // Fill lowercased manually via pressSequentially to exercise formatter
    await input.clear()
    await input.pressSequentially('abcd1234567')
    await expect(input).toHaveValue('ABCD1234567')
  })

  test('strips non-alphanumeric characters typed via keyboard', async ({ page }) => {
    const input = page.getByTestId('container-input')
    await input.pressSequentially('ABCD-12345')
    // Dash should be stripped; formatter produces ABCD12345 (9 chars — 4 letters + 5 digits)
    const value = await input.inputValue()
    expect(value).not.toContain('-')
  })

  test('limits to 11 alphanumeric characters', async ({ page }) => {
    const input = page.getByTestId('container-input')
    await input.pressSequentially('ABCD12345678') // 12 chars
    const value = await input.inputValue()
    expect(value.length).toBeLessThanOrEqual(11)
  })
})

// ── Validation on submit ───────────────────────────────────────────────────

test.describe('Container Number — validation on submit', () => {
  test('shows error when container number is empty on submit', async ({ page }) => {
    await page.getByTestId('hour-slot-select').selectOption({ index: 1 })
    await page.getByTestId('plate-input').fill('abc0001')
    // leave container-input empty
    await page.getByTestId('add-plate-btn').click()
    await expect(page.getByText('Please enter a container number')).toBeVisible()
  })

  test('shows error when container number format is invalid on submit', async ({ page }) => {
    await page.getByTestId('hour-slot-select').selectOption({ index: 1 })
    await page.getByTestId('plate-input').fill('abc0001')
    await page.getByTestId('container-input').pressSequentially('ABCD123') // only 4+3=7 chars — invalid
    await page.getByTestId('add-plate-btn').click()
    await expect(page.getByText(/4 letters.*7 digits|container number must be/i)).toBeVisible()
  })

  test('shows error when license plate is empty on submit', async ({ page }) => {
    await page.getByTestId('hour-slot-select').selectOption({ index: 1 })
    await page.getByTestId('container-input').pressSequentially('ABCD1234567')
    // leave plate-input empty
    await page.getByTestId('add-plate-btn').click()
    await expect(page.getByText('Please enter a license plate')).toBeVisible()
  })
})

// ── Successful registration with container number ──────────────────────────

test.describe('Container Number — successful registration', () => {
  test('can add a truck with both plate and container number', async ({ page }) => {
    await page.getByTestId('plate-input').fill('abc0010')
    await page.getByTestId('container-input').pressSequentially('ABCD1234567')
    await page.getByTestId('hour-slot-select').selectOption({ index: 1 })
    await page.getByTestId('add-plate-btn').click()

    await expect(page.getByTestId('registration-0')).toBeVisible({ timeout: 10000 })
  })

  test('registered truck row shows the license plate', async ({ page }) => {
    await page.getByTestId('plate-input').fill('abc0010')
    await page.getByTestId('container-input').pressSequentially('ABCD1234567')
    await page.getByTestId('hour-slot-select').selectOption({ index: 1 })
    await page.getByTestId('add-plate-btn').click()

    await expect(page.getByTestId('plate-0')).toHaveText('ABC-0010', { timeout: 10000 })
  })

  test('registered truck row shows the container number', async ({ page }) => {
    await page.getByTestId('plate-input').fill('abc0010')
    await page.getByTestId('container-input').pressSequentially('WXYZ7654321')
    await page.getByTestId('hour-slot-select').selectOption({ index: 1 })
    await page.getByTestId('add-plate-btn').click()

    await expect(page.getByTestId('container-0')).toHaveText('WXYZ7654321', { timeout: 10000 })
  })

  test('add form clears after successful submission', async ({ page }) => {
    await page.getByTestId('plate-input').fill('abc0010')
    await page.getByTestId('container-input').pressSequentially('ABCD1234567')
    await page.getByTestId('hour-slot-select').selectOption({ index: 1 })
    await page.getByTestId('add-plate-btn').click()

    await expect(page.getByTestId('registration-0')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('plate-input')).toHaveValue('')
    await expect(page.getByTestId('container-input')).toHaveValue('')
  })
})

// ── Edit mode shows container number ──────────────────────────────────────

test.describe('Container Number — edit mode', () => {
  // Add a mocked registration before each edit test
  test.beforeEach(async ({ page }) => {
    await page.getByTestId('plate-input').fill('abc0020')
    await page.getByTestId('container-input').pressSequentially('ABCD1234567')
    await page.getByTestId('hour-slot-select').selectOption({ index: 1 })
    await page.getByTestId('add-plate-btn').click()
    await expect(page.getByTestId('registration-0')).toBeVisible({ timeout: 10000 })
  })

  test('edit mode shows container number input field', async ({ page }) => {
    await page.getByTestId('edit-plate-btn-0').click()
    await expect(page.getByTestId('edit-container-input-0')).toBeVisible()
  })

  test('edit mode pre-fills container number with current value', async ({ page }) => {
    await page.getByTestId('edit-plate-btn-0').click()
    await expect(page.getByTestId('edit-container-input-0')).toHaveValue('ABCD1234567')
  })

  test('edit mode pre-fills license plate with current value', async ({ page }) => {
    await page.getByTestId('edit-plate-btn-0').click()
    await expect(page.getByTestId('edit-plate-input-0')).toHaveValue('ABC-0020')
  })

  test('can update container number and see it reflected in the list', async ({ page }) => {
    await page.getByTestId('edit-plate-btn-0').click()
    const containerInput = page.getByTestId('edit-container-input-0')
    await containerInput.fill('ZZZZ9999999')
    await page.getByTestId('save-edit-btn-0').click()

    // Global PATCH mock echoes back the container_number from the request body
    await expect(page.getByTestId('container-0')).toHaveText('ZZZZ9999999', { timeout: 10000 })
  })

  test('cancel edit leaves original container number unchanged', async ({ page }) => {
    await page.getByTestId('edit-plate-btn-0').click()
    const containerInput = page.getByTestId('edit-container-input-0')
    await containerInput.clear()
    await containerInput.pressSequentially('ZZZZ9999999')
    await page.getByRole('button', { name: 'Cancel' }).click()

    await expect(page.getByTestId('container-0')).toHaveText('ABCD1234567')
  })
})
