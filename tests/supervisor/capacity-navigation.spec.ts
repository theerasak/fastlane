import { test, expect } from '@playwright/test'
import { loginAs } from '../fixtures/auth.fixture'
import {
  seedCapacityNavData,
  cleanupCapacityNavData,
} from '../fixtures/db.fixture'

// Shared state set by beforeAll
let terminalAId = ''
let terminalBId = ''
const NAV_DATE = '2099-06-15'
const PREV_DATE = '2099-06-14'
const NEXT_DATE = '2099-06-16'

test.describe('Supervisor — Capacity Grid Navigation', () => {
  test.beforeAll(async () => {
    const result = await seedCapacityNavData()
    if (!result) throw new Error('Failed to seed capacity nav test data')
    terminalAId = result.terminalA.id
    terminalBId = result.terminalB.id
  })

  test.afterAll(async () => {
    await cleanupCapacityNavData()
  })

  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'supervisor')
    await page.goto(`/capacity/${terminalAId}/${NAV_DATE}`)
    await page.waitForLoadState('networkidle')
  })

  // ── Controls visibility ───────────────────────────────────────────────────

  test('date picker shows the current date', async ({ page }) => {
    await expect(page.getByTestId('capacity-date-input')).toHaveValue(NAV_DATE)
  })

  test('prev day and next day buttons are visible', async ({ page }) => {
    await expect(page.getByTestId('capacity-prev-day')).toBeVisible()
    await expect(page.getByTestId('capacity-next-day')).toBeVisible()
  })

  test('terminal selector is visible and shows terminal A as selected', async ({ page }) => {
    const select = page.getByTestId('capacity-terminal-select')
    await expect(select).toBeVisible()
    await expect(select).toHaveValue(terminalAId)
  })

  test('capacity grid is visible with 24 slots', async ({ page }) => {
    await expect(page.getByTestId('capacity-grid')).toBeVisible()
    await expect(page.getByTestId(/slot-priv-cell-\d+/)).toHaveCount(24)
  })

  // ── Date navigation — next day ────────────────────────────────────────────

  test('next day button navigates to the next date', async ({ page }) => {
    await page.getByTestId('capacity-next-day').click()
    await page.waitForURL(`/capacity/${terminalAId}/${NEXT_DATE}`)
    await expect(page.getByTestId('capacity-date-input')).toHaveValue(NEXT_DATE)
  })

  test('next day button updates the URL while keeping the same terminal', async ({ page }) => {
    await page.getByTestId('capacity-next-day').click()
    await page.waitForURL(new RegExp(`/capacity/${terminalAId}/`))
    await expect(page).toHaveURL(new RegExp(`/capacity/${terminalAId}/${NEXT_DATE}`))
  })

  // ── Date navigation — previous day ───────────────────────────────────────

  test('prev day button navigates to the previous date', async ({ page }) => {
    await page.getByTestId('capacity-prev-day').click()
    await page.waitForURL(`/capacity/${terminalAId}/${PREV_DATE}`)
    await expect(page.getByTestId('capacity-date-input')).toHaveValue(PREV_DATE)
  })

  test('prev day then next day returns to the original date', async ({ page }) => {
    await page.getByTestId('capacity-prev-day').click()
    await page.waitForURL(`/capacity/${terminalAId}/${PREV_DATE}`)
    await page.getByTestId('capacity-next-day').click()
    await page.waitForURL(`/capacity/${terminalAId}/${NAV_DATE}`)
    await expect(page.getByTestId('capacity-date-input')).toHaveValue(NAV_DATE)
  })

  // ── Date navigation — date picker ─────────────────────────────────────────

  test('changing date picker navigates to the selected date', async ({ page }) => {
    const targetDate = '2099-07-20'
    await page.getByTestId('capacity-date-input').fill(targetDate)
    await page.waitForURL(`/capacity/${terminalAId}/${targetDate}`)
    await expect(page.getByTestId('capacity-date-input')).toHaveValue(targetDate)
  })

  test('date picker keeps the same terminal when date changes', async ({ page }) => {
    const targetDate = '2099-08-01'
    await page.getByTestId('capacity-date-input').fill(targetDate)
    await page.waitForURL(new RegExp(`/capacity/${terminalAId}/${targetDate}`))
    await expect(page).toHaveURL(new RegExp(`/capacity/${terminalAId}/`))
  })

  // ── Terminal switching ────────────────────────────────────────────────────

  test('terminal selector switches to the chosen terminal and keeps the date', async ({ page }) => {
    const select = page.getByTestId('capacity-terminal-select')
    await select.selectOption(terminalBId)
    await page.waitForURL(`/capacity/${terminalBId}/${NAV_DATE}`)
    await expect(page).toHaveURL(`/capacity/${terminalBId}/${NAV_DATE}`)
    await expect(page.getByTestId('capacity-date-input')).toHaveValue(NAV_DATE)
  })

  test('after terminal switch the selector shows the new terminal as selected', async ({ page }) => {
    const select = page.getByTestId('capacity-terminal-select')
    await select.selectOption(terminalBId)
    await page.waitForURL(`/capacity/${terminalBId}/${NAV_DATE}`)
    await expect(page.getByTestId('capacity-terminal-select')).toHaveValue(terminalBId)
  })

  test('can switch back to original terminal after switching', async ({ page }) => {
    const select = page.getByTestId('capacity-terminal-select')
    await select.selectOption(terminalBId)
    await page.waitForURL(`/capacity/${terminalBId}/${NAV_DATE}`)
    await page.getByTestId('capacity-terminal-select').selectOption(terminalAId)
    await page.waitForURL(`/capacity/${terminalAId}/${NAV_DATE}`)
    await expect(page).toHaveURL(`/capacity/${terminalAId}/${NAV_DATE}`)
  })

  // ── Back link ─────────────────────────────────────────────────────────────

  test('back link navigates to /capacity index', async ({ page }) => {
    await page.getByRole('link', { name: '← Back' }).click()
    await expect(page).toHaveURL('/capacity')
  })

  test('after back navigation the capacity index page renders correctly', async ({ page }) => {
    await page.getByRole('link', { name: '← Back' }).click()
    await expect(page).toHaveURL('/capacity')
    await expect(page.getByTestId('view-capacity-btn')).toBeVisible()
    await expect(page.getByTestId('date-input')).toBeVisible()
  })

  // ── Combined navigation ───────────────────────────────────────────────────

  test('can switch terminal and date in sequence', async ({ page }) => {
    // Switch terminal
    await page.getByTestId('capacity-terminal-select').selectOption(terminalBId)
    await page.waitForURL(`/capacity/${terminalBId}/${NAV_DATE}`)

    // Then advance date
    await page.getByTestId('capacity-next-day').click()
    await page.waitForURL(`/capacity/${terminalBId}/${NEXT_DATE}`)

    await expect(page.getByTestId('capacity-date-input')).toHaveValue(NEXT_DATE)
    await expect(page.getByTestId('capacity-terminal-select')).toHaveValue(terminalBId)
  })
})
