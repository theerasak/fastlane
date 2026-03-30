'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { shiftDate } from '@/lib/utils/date'
import { PageSpinner } from '@/components/ui/Spinner'
import type { DailySummaryRow } from '@/app/api/daily-summary/route'

interface Terminal { id: string; name: string }

function todayLocal(): string {
  const now = new Date()
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
}

function formatHour(slot: number): string {
  return `${String(slot).padStart(2, '0')}:00`
}

function DailySummaryContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialDate = searchParams.get('date') ?? todayLocal()
  const initialTerminal = searchParams.get('terminal_id') ?? ''

  const [date, setDate] = useState(initialDate)
  const [terminalId, setTerminalId] = useState(initialTerminal)
  const [terminals, setTerminals] = useState<Terminal[]>([])
  const [rows, setRows] = useState<DailySummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/terminals')
      .then(r => r.json())
      .then(j => setTerminals((j.data ?? []).filter((t: Terminal & { is_active: boolean }) => t.is_active)))
      .catch(() => {})
  }, [])

  const fetchSummary = useCallback(async (d: string, tid: string) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ date: d })
      if (tid) params.set('terminal_id', tid)
      const res = await fetch(`/api/daily-summary?${params}`)
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Failed to load'); return }
      setRows(json.data ?? [])
    } catch {
      setError('Connection error. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSummary(date, terminalId)
  }, [date, terminalId, fetchSummary])

  function navigate(newDate: string, newTerminalId?: string) {
    const tid = newTerminalId !== undefined ? newTerminalId : terminalId
    setDate(newDate)
    const params = new URLSearchParams({ date: newDate })
    if (tid) params.set('terminal_id', tid)
    router.replace(`/daily-summary?${params}`, { scroll: false })
  }

  function handleTerminalChange(newTid: string) {
    setTerminalId(newTid)
    const params = new URLSearchParams({ date })
    if (newTid) params.set('terminal_id', newTid)
    router.replace(`/daily-summary?${params}`, { scroll: false })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold text-gray-900">Daily Summary</h1>
        <span className="text-sm text-gray-500">{rows.length} appointment{rows.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Date navigation */}
      <div className="card flex items-center gap-2 flex-wrap" data-testid="date-nav">
        <button
          onClick={() => navigate(shiftDate(date, -1))}
          className="btn-secondary text-sm px-3 py-1.5"
          data-testid="prev-day-btn"
        >
          ← Yesterday
        </button>

        <input
          type="date"
          value={date}
          onChange={e => e.target.value && navigate(e.target.value)}
          className="input-field text-sm py-1.5 w-auto"
          data-testid="date-input"
        />

        <button
          onClick={() => navigate(shiftDate(date, 1))}
          className="btn-secondary text-sm px-3 py-1.5"
          data-testid="next-day-btn"
        >
          Tomorrow →
        </button>

        <button
          onClick={() => navigate(todayLocal())}
          className="text-sm text-blue-600 hover:underline ml-auto"
          data-testid="today-btn"
        >
          Today
        </button>
      </div>

      {/* Terminal filter */}
      <div className="card flex items-center gap-3 flex-wrap" data-testid="terminal-filter">
        <label htmlFor="terminal-select" className="text-sm font-medium text-gray-700 whitespace-nowrap">
          Terminal
        </label>
        <select
          id="terminal-select"
          value={terminalId}
          onChange={e => handleTerminalChange(e.target.value)}
          className="input-field text-sm py-1.5 w-auto"
          data-testid="terminal-select"
        >
          <option value="">All terminals</option>
          {terminals.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <PageSpinner />
      ) : error ? (
        <div className="card text-red-600 text-sm" data-testid="error-message">{error}</div>
      ) : rows.length === 0 ? (
        <div className="card text-center py-12 text-gray-500" data-testid="empty-message">
          No appointments for {date}.
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm" data-testid="summary-table">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Terminal</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Time</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Container No.</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">License Plate</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Truck Company</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Booking No.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50" data-testid="summary-row">
                  <td className="px-4 py-3 text-gray-900 whitespace-nowrap">{row.terminal_name}</td>
                  <td className="px-4 py-3 font-mono text-gray-900 whitespace-nowrap">{row.booking_date}</td>
                  <td className="px-4 py-3 font-mono text-gray-900 whitespace-nowrap">{formatHour(row.hour_slot)}</td>
                  <td className="px-4 py-3 font-mono text-gray-700 whitespace-nowrap">{row.container_number}</td>
                  <td className="px-4 py-3 font-mono text-gray-900 whitespace-nowrap">{row.license_plate}</td>
                  <td className="px-4 py-3 text-gray-900">{row.truck_company_name}</td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{row.booking_number}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function DailySummaryPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <DailySummaryContent />
    </Suspense>
  )
}
