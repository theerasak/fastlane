import { test, expect } from '@playwright/test'
import { loginAs } from '../fixtures/auth.fixture'
import { createTestSupabaseClient } from '../fixtures/db.fixture'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getFirstActiveTerminalName(): Promise<string | null> {
  const supabase = await createTestSupabaseClient()
  const { data } = await supabase
    .from('port_terminals')
    .select('name')
    .eq('is_active', true)
    .limit(1)
    .single()
  return data?.name ?? null
}

function makeCsv(terminalName: string, rows: { date: string; slot: number; priv: number; nonPriv: number }[]) {
  const header = 'terminal_name,date,hour_slot,capacity_privileged,capacity_non_privileged'
  const lines = rows.map(r => `${terminalName},${r.date},${r.slot},${r.priv},${r.nonPriv}`)
  return [header, ...lines].join('\n')
}

function futureDate(daysAhead = 30) {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  return d.toISOString().split('T')[0]
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Supervisor — CSV Capacity Import', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'supervisor')
    await page.goto('/capacity')
    await page.waitForLoadState('networkidle')
  })

  test('import section is visible on capacity page', async ({ page }) => {
    await expect(page.getByTestId('import-csv-input')).toBeVisible()
    await expect(page.getByTestId('download-example-csv-btn')).toBeVisible()
  })

  test('imports valid CSV and shows success message', async ({ page }) => {
    const terminalName = await getFirstActiveTerminalName()
    test.skip(!terminalName, 'No active terminal available')

    const csv = makeCsv(terminalName!, [
      { date: futureDate(30), slot: 8, priv: 3, nonPriv: 5 },
      { date: futureDate(30), slot: 9, priv: 2, nonPriv: 4 },
    ])

    await page.getByTestId('import-csv-input').setInputFiles({
      name: 'capacity.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    })

    await expect(page.getByTestId('import-result')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('import-success-msg')).toBeVisible()
    await expect(page.getByTestId('import-success-msg')).toContainText('2 slot(s)')
  })

  test('shows warning for past-date rows but still imports valid rows', async ({ page }) => {
    const terminalName = await getFirstActiveTerminalName()
    test.skip(!terminalName, 'No active terminal available')

    const csv = makeCsv(terminalName!, [
      { date: futureDate(31), slot: 10, priv: 3, nonPriv: 5 },  // valid
      { date: '2020-01-01',   slot: 11, priv: 1, nonPriv: 2 },  // past — error
    ])

    await page.getByTestId('import-csv-input').setInputFiles({
      name: 'capacity.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    })

    await expect(page.getByTestId('import-result')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('import-success-msg')).toBeVisible()
    await expect(page.getByTestId('import-success-msg')).toContainText('1 slot(s)')
    await expect(page.getByTestId('import-errors')).toBeVisible()
    await expect(page.getByTestId('import-errors')).toContainText('past')
  })

  test('shows errors when CSV has wrong columns', async ({ page }) => {
    const csv = 'terminal_name,date\nTerminal A,2099-12-31'

    await page.getByTestId('import-csv-input').setInputFiles({
      name: 'bad.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    })

    await expect(page.getByTestId('import-result')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('import-errors')).toBeVisible()
    await expect(page.getByTestId('import-errors')).toContainText('Missing columns')
  })

  test('shows error for unknown terminal name', async ({ page }) => {
    const csv = makeCsv('NONEXISTENT-TERMINAL-XYZ', [
      { date: futureDate(32), slot: 8, priv: 1, nonPriv: 2 },
    ])

    await page.getByTestId('import-csv-input').setInputFiles({
      name: 'bad.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    })

    await expect(page.getByTestId('import-result')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('import-errors')).toBeVisible()
    await expect(page.getByTestId('import-errors')).toContainText('Terminal not found')
  })

  test('download example CSV button is present and clickable', async ({ page }) => {
    // Start waiting for download before clicking
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 5000 }),
      page.getByTestId('download-example-csv-btn').click(),
    ])
    expect(download.suggestedFilename()).toBe('capacity-import-example.csv')
  })

  test('result clears when a new file is selected', async ({ page }) => {
    const terminalName = await getFirstActiveTerminalName()
    test.skip(!terminalName, 'No active terminal available')

    // First import
    const csv1 = makeCsv(terminalName!, [{ date: futureDate(33), slot: 8, priv: 1, nonPriv: 2 }])
    await page.getByTestId('import-csv-input').setInputFiles({
      name: 'first.csv', mimeType: 'text/csv', buffer: Buffer.from(csv1),
    })
    await expect(page.getByTestId('import-result')).toBeVisible({ timeout: 10000 })

    // Second import — result should refresh
    const csv2 = makeCsv(terminalName!, [
      { date: futureDate(34), slot: 9, priv: 2, nonPriv: 3 },
      { date: futureDate(34), slot: 10, priv: 2, nonPriv: 3 },
    ])
    await page.getByTestId('import-csv-input').setInputFiles({
      name: 'second.csv', mimeType: 'text/csv', buffer: Buffer.from(csv2),
    })
    await expect(page.getByTestId('import-success-msg')).toContainText('2 slot(s)', { timeout: 10000 })
  })
})

// ── Role guard ────────────────────────────────────────────────────────────────

test.describe('Capacity import — role guard', () => {
  test('admin cannot call import API', async ({ page }) => {
    await loginAs(page, 'admin')
    const res = await page.request.post('/api/capacity/import', {
      multipart: { file: { name: 'test.csv', mimeType: 'text/csv', buffer: Buffer.from('') } },
    })
    expect(res.status()).toBe(403)
  })

  test('agent cannot call import API', async ({ page }) => {
    await loginAs(page, 'agent')
    const res = await page.request.post('/api/capacity/import', {
      multipart: { file: { name: 'test.csv', mimeType: 'text/csv', buffer: Buffer.from('') } },
    })
    expect(res.status()).toBe(403)
  })
})
