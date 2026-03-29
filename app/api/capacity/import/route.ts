import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { handleApiError, ApiError } from '@/lib/api/errors'
import { DEFAULT_SLOT_CAPACITY_PRIVILEGED, DEFAULT_SLOT_CAPACITY_NON_PRIVILEGED } from '@/lib/constants'

interface CsvRow {
  terminal_name: string
  date: string
  hour_slot: number
  capacity_privileged: number
  capacity_non_privileged: number
}

interface RowError {
  line: number
  message: string
}

function parseCsv(text: string): { rows: CsvRow[]; errors: RowError[] } {
  const rows: CsvRow[] = []
  const errors: RowError[] = []
  const today = new Date().toISOString().split('T')[0]

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return { rows, errors: [{ line: 0, message: 'CSV file is empty' }] }

  // Validate header
  const header = lines[0].toLowerCase().split(',').map(h => h.trim())
  const required = ['terminal_name', 'date', 'hour_slot', 'capacity_privileged', 'capacity_non_privileged']
  const missing = required.filter(h => !header.includes(h))
  if (missing.length > 0) {
    return { rows, errors: [{ line: 1, message: `Missing columns: ${missing.join(', ')}` }] }
  }

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
    if (isNaN(hourSlot) || hourSlot < 0 || hourSlot > 23) {
      errors.push({ line: lineNum, message: `Invalid hour_slot: "${hourSlotRaw}" (must be 0–23)` }); continue
    }

    const capPriv = capPrivRaw === '' ? DEFAULT_SLOT_CAPACITY_PRIVILEGED : parseInt(capPrivRaw, 10)
    const capNonPriv = capNonPrivRaw === '' ? DEFAULT_SLOT_CAPACITY_NON_PRIVILEGED : parseInt(capNonPrivRaw, 10)

    if (isNaN(capPriv) || capPriv < 0 || capPriv > 999) {
      errors.push({ line: lineNum, message: `Invalid capacity_privileged: "${capPrivRaw}" (must be 0–999)` }); continue
    }
    if (isNaN(capNonPriv) || capNonPriv < 0 || capNonPriv > 999) {
      errors.push({ line: lineNum, message: `Invalid capacity_non_privileged: "${capNonPrivRaw}" (must be 0–999)` }); continue
    }

    rows.push({ terminal_name: terminalName, date, hour_slot: hourSlot, capacity_privileged: capPriv, capacity_non_privileged: capNonPriv })
  }

  return { rows, errors }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req)
    if (!session || session.role !== 'supervisor') throw ApiError.forbidden()

    const formData = await req.formData()
    const file = formData.get('file')
    if (!file || typeof file === 'string') throw ApiError.badRequest('CSV file is required')

    const text = await (file as File).text()
    const { rows, errors: parseErrors } = parseCsv(text)

    if (parseErrors.length > 0 && rows.length === 0) {
      return NextResponse.json({ ok: false, errors: parseErrors }, { status: 422 })
    }

    const supabase = getServerClient()

    // Resolve terminal names → IDs (deduplicated)
    const terminalNames = [...new Set(rows.map(r => r.terminal_name))]
    const { data: terminals } = await supabase
      .from('port_terminals')
      .select('id, name')
      .in('name', terminalNames)
      .eq('is_active', true)

    const terminalMap = new Map((terminals ?? []).map(t => [t.name, t.id]))

    const upsertRows: { terminal_id: string; date: string; hour_slot: number; capacity_privileged: number; capacity_non_privileged: number }[] = []
    const rowErrors: RowError[] = [...parseErrors]

    for (const row of rows) {
      const terminalId = terminalMap.get(row.terminal_name)
      if (!terminalId) {
        rowErrors.push({ line: 0, message: `Terminal not found: "${row.terminal_name}"` })
        continue
      }
      upsertRows.push({
        terminal_id: terminalId,
        date: row.date,
        hour_slot: row.hour_slot,
        capacity_privileged: row.capacity_privileged,
        capacity_non_privileged: row.capacity_non_privileged,
      })
    }

    if (upsertRows.length === 0) {
      return NextResponse.json({ ok: false, errors: rowErrors }, { status: 422 })
    }

    // Upsert: insert new rows, update capacity on conflict
    const { error: upsertError } = await supabase
      .from('terminal_capacity')
      .upsert(upsertRows, { onConflict: 'terminal_id,date,hour_slot' })

    if (upsertError) throw ApiError.internal(upsertError.message)

    return NextResponse.json({
      ok: true,
      imported: upsertRows.length,
      errors: rowErrors,
    })
  } catch (err) {
    const { error, code, status } = handleApiError(err)
    return NextResponse.json({ error, code }, { status })
  }
}
