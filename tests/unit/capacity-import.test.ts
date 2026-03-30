import { describe, it, expect } from 'vitest'

// ── Replicate parseCsv logic from app/api/capacity/import/route.ts ────────────

const DEFAULT_CAP_PRIV = 1
const DEFAULT_CAP_NON_PRIV = 1

interface CsvRow {
  terminal_name: string
  date: string
  hour_slot: number
  capacity_privileged: number
  capacity_non_privileged: number
}
interface RowError { line: number; message: string }

function parseCsv(text: string, today = '2026-03-30'): { rows: CsvRow[]; errors: RowError[] } {
  const rows: CsvRow[] = []
  const errors: RowError[] = []

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return { rows, errors: [{ line: 0, message: 'CSV file is empty' }] }

  const header = lines[0].toLowerCase().split(',').map(h => h.trim())
  const required = ['terminal_name', 'date', 'hour_slot', 'capacity_privileged', 'capacity_non_privileged']
  const missing = required.filter(h => !header.includes(h))
  if (missing.length > 0) return { rows, errors: [{ line: 1, message: `Missing columns: ${missing.join(', ')}` }] }

  const idx = (col: string) => header.indexOf(col)

  for (let i = 1; i < lines.length; i++) {
    const lineNum = i + 1
    const cols = lines[i].split(',').map(c => c.trim())

    const terminalName = cols[idx('terminal_name')] ?? ''
    const date = cols[idx('date')] ?? ''
    const hourSlotRaw = cols[idx('hour_slot')] ?? ''
    const capPrivRaw = cols[idx('capacity_privileged')] ?? ''
    const capNonPrivRaw = cols[idx('capacity_non_privileged')] ?? ''

    if (!terminalName) { errors.push({ line: lineNum, message: 'terminal_name is required' }); continue }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { errors.push({ line: lineNum, message: `Invalid date format: "${date}" (use YYYY-MM-DD)` }); continue }
    if (date < today) { errors.push({ line: lineNum, message: `Date ${date} is in the past` }); continue }

    const hourSlot = parseInt(hourSlotRaw, 10)
    if (isNaN(hourSlot) || hourSlot < 0 || hourSlot > 23) { errors.push({ line: lineNum, message: `Invalid hour_slot: "${hourSlotRaw}" (must be 0–23)` }); continue }

    const capPriv = capPrivRaw === '' ? DEFAULT_CAP_PRIV : parseInt(capPrivRaw, 10)
    const capNonPriv = capNonPrivRaw === '' ? DEFAULT_CAP_NON_PRIV : parseInt(capNonPrivRaw, 10)

    if (isNaN(capPriv) || capPriv < 0 || capPriv > 999) { errors.push({ line: lineNum, message: `Invalid capacity_privileged: "${capPrivRaw}" (must be 0–999)` }); continue }
    if (isNaN(capNonPriv) || capNonPriv < 0 || capNonPriv > 999) { errors.push({ line: lineNum, message: `Invalid capacity_non_privileged: "${capNonPrivRaw}" (must be 0–999)` }); continue }

    rows.push({ terminal_name: terminalName, date, hour_slot: hourSlot, capacity_privileged: capPriv, capacity_non_privileged: capNonPriv })
  }

  return { rows, errors }
}

// ── Valid CSV ─────────────────────────────────────────────────────────────────

describe('parseCsv — valid input', () => {
  const VALID_CSV = [
    'terminal_name,date,hour_slot,capacity_privileged,capacity_non_privileged',
    'Terminal A,2099-12-31,8,3,5',
    'Terminal A,2099-12-31,9,2,4',
  ].join('\n')

  it('parses two valid rows', () => {
    const { rows, errors } = parseCsv(VALID_CSV)
    expect(rows).toHaveLength(2)
    expect(errors).toHaveLength(0)
  })

  it('maps all fields correctly', () => {
    const { rows } = parseCsv(VALID_CSV)
    expect(rows[0]).toMatchObject({
      terminal_name: 'Terminal A',
      date: '2099-12-31',
      hour_slot: 8,
      capacity_privileged: 3,
      capacity_non_privileged: 5,
    })
  })

  it('accepts boundary hour_slots 0 and 23', () => {
    const csv = [
      'terminal_name,date,hour_slot,capacity_privileged,capacity_non_privileged',
      'Terminal A,2099-12-31,0,1,1',
      'Terminal A,2099-12-31,23,1,1',
    ].join('\n')
    const { rows, errors } = parseCsv(csv)
    expect(rows).toHaveLength(2)
    expect(errors).toHaveLength(0)
  })

  it('accepts boundary capacity values 0 and 999', () => {
    const csv = [
      'terminal_name,date,hour_slot,capacity_privileged,capacity_non_privileged',
      'Terminal A,2099-12-31,8,0,999',
    ].join('\n')
    const { rows } = parseCsv(csv)
    expect(rows[0].capacity_privileged).toBe(0)
    expect(rows[0].capacity_non_privileged).toBe(999)
  })

  it('trims whitespace from values', () => {
    const csv = [
      'terminal_name , date , hour_slot , capacity_privileged , capacity_non_privileged',
      ' Terminal A , 2099-12-31 , 9 , 3 , 5 ',
    ].join('\n')
    const { rows, errors } = parseCsv(csv)
    expect(errors).toHaveLength(0)
    expect(rows[0].terminal_name).toBe('Terminal A')
    expect(rows[0].hour_slot).toBe(9)
  })

  it('handles CRLF line endings', () => {
    const csv = 'terminal_name,date,hour_slot,capacity_privileged,capacity_non_privileged\r\nTerminal A,2099-12-31,8,3,5\r\n'
    const { rows, errors } = parseCsv(csv)
    expect(rows).toHaveLength(1)
    expect(errors).toHaveLength(0)
  })

  it('skips blank lines silently', () => {
    const csv = [
      'terminal_name,date,hour_slot,capacity_privileged,capacity_non_privileged',
      '',
      'Terminal A,2099-12-31,8,3,5',
      '',
    ].join('\n')
    const { rows } = parseCsv(csv)
    expect(rows).toHaveLength(1)
  })
})

// ── Header validation ────────────────────────────────────────────────────────

describe('parseCsv — header validation', () => {
  it('returns error for empty file', () => {
    const { errors } = parseCsv('')
    expect(errors[0].message).toMatch(/empty/i)
  })

  it('returns error for missing required columns', () => {
    const csv = 'terminal_name,date,hour_slot\nTerminal A,2099-12-31,8'
    const { rows, errors } = parseCsv(csv)
    expect(rows).toHaveLength(0)
    expect(errors[0].message).toMatch(/missing columns/i)
    expect(errors[0].message).toContain('capacity_privileged')
    expect(errors[0].message).toContain('capacity_non_privileged')
  })

  it('is case-insensitive for column names', () => {
    const csv = [
      'TERMINAL_NAME,DATE,HOUR_SLOT,CAPACITY_PRIVILEGED,CAPACITY_NON_PRIVILEGED',
      'Terminal A,2099-12-31,8,3,5',
    ].join('\n')
    const { rows, errors } = parseCsv(csv)
    expect(errors).toHaveLength(0)
    expect(rows).toHaveLength(1)
  })
})

// ── Row-level validation ──────────────────────────────────────────────────────

describe('parseCsv — row validation', () => {
  const hdr = 'terminal_name,date,hour_slot,capacity_privileged,capacity_non_privileged'

  it('reports error for missing terminal_name', () => {
    const { errors } = parseCsv(`${hdr}\n,2099-12-31,8,3,5`)
    expect(errors[0].line).toBe(2)
    expect(errors[0].message).toMatch(/terminal_name/i)
  })

  it('reports error for invalid date format', () => {
    const { errors } = parseCsv(`${hdr}\nTerminal A,31/12/2099,8,3,5`)
    expect(errors[0].line).toBe(2)
    expect(errors[0].message).toMatch(/invalid date/i)
  })

  it('reports error for past date', () => {
    const { errors } = parseCsv(`${hdr}\nTerminal A,2020-01-01,8,3,5`)
    expect(errors[0].line).toBe(2)
    expect(errors[0].message).toMatch(/past/i)
  })

  it('accepts today as a valid date', () => {
    const today = '2026-03-30'
    const { rows, errors } = parseCsv(`${hdr}\nTerminal A,${today},8,3,5`, today)
    expect(errors).toHaveLength(0)
    expect(rows).toHaveLength(1)
  })

  it('reports error for hour_slot > 23', () => {
    const { errors } = parseCsv(`${hdr}\nTerminal A,2099-12-31,24,3,5`)
    expect(errors[0].message).toMatch(/hour_slot/i)
  })

  it('reports error for negative hour_slot', () => {
    const { errors } = parseCsv(`${hdr}\nTerminal A,2099-12-31,-1,3,5`)
    expect(errors[0].message).toMatch(/hour_slot/i)
  })

  it('reports error for non-numeric hour_slot', () => {
    const { errors } = parseCsv(`${hdr}\nTerminal A,2099-12-31,morning,3,5`)
    expect(errors[0].message).toMatch(/hour_slot/i)
  })

  it('reports error for capacity_privileged > 999', () => {
    const { errors } = parseCsv(`${hdr}\nTerminal A,2099-12-31,8,1000,5`)
    expect(errors[0].message).toMatch(/capacity_privileged/i)
  })

  it('reports error for negative capacity_non_privileged', () => {
    const { errors } = parseCsv(`${hdr}\nTerminal A,2099-12-31,8,3,-1`)
    expect(errors[0].message).toMatch(/capacity_non_privileged/i)
  })

  it('valid rows still imported when some rows have errors', () => {
    const csv = [
      hdr,
      'Terminal A,2099-12-31,8,3,5',   // valid
      'Terminal A,2020-01-01,9,3,5',   // past date — error
      'Terminal A,2099-12-31,10,2,4',  // valid
    ].join('\n')
    const { rows, errors } = parseCsv(csv)
    expect(rows).toHaveLength(2)
    expect(errors).toHaveLength(1)
    expect(rows.map(r => r.hour_slot)).toEqual([8, 10])
  })
})
