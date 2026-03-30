'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Table, Td, Tr } from '@/components/ui/Table'
import { showToast } from '@/components/ui/Toast'
import type { InvoiceRow } from '@/app/api/invoice/route'

interface Terminal { id: string; name: string }

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Asia/Bangkok',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function formatAmount(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function InvoiceClient() {
  const today = new Date().toISOString().split('T')[0]
  const firstOfMonth = `${today.slice(0, 7)}-01`

  const [fromDate, setFromDate] = useState(firstOfMonth)
  const [toDate, setToDate] = useState(today)
  const [terminalId, setTerminalId] = useState('')
  const [terminals, setTerminals] = useState<Terminal[]>([])
  const [rows, setRows] = useState<InvoiceRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [queried, setQueried] = useState<{ from: string; to: string } | null>(null)

  useEffect(() => {
    fetch('/api/terminals')
      .then(r => r.json())
      .then(j => setTerminals((j.data ?? []).filter((t: Terminal & { is_active: boolean }) => t.is_active)))
      .catch(() => {})
  }, [])

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const params = new URLSearchParams({ from_date: fromDate, to_date: toDate })
      if (terminalId) params.set('terminal_id', terminalId)
      const res = await fetch(`/api/invoice?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load invoice')
      setRows(json.data)
      setQueried({ from: fromDate, to: toDate })
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error', 'error')
    } finally {
      setLoading(false)
    }
  }

  const total = rows?.reduce((sum, r) => sum + r.amount, 0) ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Invoice Summary</h1>
        <p className="text-sm text-gray-500 mt-0.5">Bookings created within the selected date range</p>
      </div>

      {/* Date range form */}
      <form onSubmit={handleGenerate} className="card">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Terminal</label>
            <select
              value={terminalId}
              onChange={e => setTerminalId(e.target.value)}
              className="input-field"
              data-testid="terminal-select"
            >
              <option value="">All terminals</option>
              {terminals.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <Button type="submit" loading={loading}>
            View
          </Button>
        </div>
      </form>

      {/* Results */}
      {rows !== null && (
        <div className="space-y-3">
          {queried && (
            <p className="text-sm text-gray-500">
              Showing results for <span className="font-medium text-gray-700">{queried.from}</span> to{' '}
              <span className="font-medium text-gray-700">{queried.to}</span>
              {' '}— <span className="font-medium text-gray-700">{rows.length}</span> booking{rows.length !== 1 ? 's' : ''}
            </p>
          )}

          <Table
            headers={['Date & Time', 'Terminal', 'Booking No', 'Truck Company', 'TGC Code', 'Containers', 'Rate (THB)', 'Amount (THB)']}
            isEmpty={rows.length === 0}
            emptyMessage="No bookings found in the selected date range."
          >
            {rows.map(row => (
              <Tr key={row.id}>
                <Td className="whitespace-nowrap">{formatDateTime(row.created_at)}</Td>
                <Td className="whitespace-nowrap">{row.terminal_name}</Td>
                <Td className="font-mono font-medium whitespace-nowrap">{row.booking_number}</Td>
                <Td>{row.truck_company_name}</Td>
                <Td>
                  {row.fastlane_token ? (
                    <Link
                      href={`/register/${row.fastlane_token}`}
                      className="font-mono text-xs text-blue-600 hover:text-blue-800 hover:underline"
                      target="_blank"
                    >
                      {row.fastlane_token}
                    </Link>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </Td>
                <Td className="text-right">{row.num_trucks}</Td>
                <Td className="text-right font-mono">{formatAmount(row.price_per_container)}</Td>
                <Td className="text-right font-mono">{formatAmount(row.amount)}</Td>
              </Tr>
            ))}
          </Table>

          {rows.length > 0 && (
            <div className="flex justify-end">
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-6 py-4 flex items-center gap-8">
                <span className="text-sm font-semibold text-gray-700">Total Amount (THB)</span>
                <span className="text-xl font-bold text-gray-900 font-mono">{formatAmount(total)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
