'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { PageSpinner } from '@/components/ui/Spinner'
import { showToast } from '@/components/ui/Toast'
import type { TerminalResponse } from '@/types/api'

export default function CapacityIndexPage() {
  const router = useRouter()
  const [terminals, setTerminals] = useState<TerminalResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [terminalId, setTerminalId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; errors: { line: number; message: string }[] } | null>(null)

  useEffect(() => {
    fetch('/api/terminals')
      .then(r => r.json())
      .then(json => {
        const active = (json.data ?? []).filter((t: TerminalResponse) => t.is_active)
        setTerminals(active)
        if (active.length > 0) setTerminalId(active[0].id)
      })
      .finally(() => setLoading(false))
  }, [])

  function handleView(e: React.FormEvent) {
    e.preventDefault()
    if (!terminalId || !date) return
    router.push(`/capacity/${terminalId}/${date}`)
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportResult(null)
    setImporting(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/capacity/import', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) {
        showToast(json.error || 'Import failed', 'error')
        if (json.errors) setImportResult({ imported: 0, errors: json.errors })
        return
      }
      setImportResult({ imported: json.imported, errors: json.errors ?? [] })
      if (json.imported > 0) showToast(`Imported ${json.imported} slot(s)`, 'success')
    } catch {
      showToast('Network error', 'error')
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function downloadExample() {
    const today = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    const d1 = fmt(new Date(today.getTime() + 86400000))
    const d2 = fmt(new Date(today.getTime() + 2 * 86400000))
    const terminalName = terminals[0]?.name ?? 'Terminal A'
    const rows = [
      'terminal_name,date,hour_slot,capacity_privileged,capacity_non_privileged',
      `${terminalName},${d1},8,3,5`,
      `${terminalName},${d1},9,3,5`,
      `${terminalName},${d1},10,3,5`,
      `${terminalName},${d1},11,3,5`,
      `${terminalName},${d1},13,2,4`,
      `${terminalName},${d1},14,2,4`,
      `${terminalName},${d2},8,3,5`,
      `${terminalName},${d2},9,3,5`,
    ]
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'capacity-import-example.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <PageSpinner />

  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Capacity Management</h1>

      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-3">View / Edit by Date</h2>
        <form onSubmit={handleView} className="space-y-4">
          <Select
            label="Terminal"
            value={terminalId}
            onChange={e => setTerminalId(e.target.value)}
            options={terminals.map(t => ({ value: t.id, label: t.name }))}
            placeholder="Select terminal…"
            required
            data-testid="terminal-select"
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Date</label>
            <input
              type="date"
              value={date}
              min={new Date().toISOString().split('T')[0]}
              onChange={e => setDate(e.target.value)}
              className="input-field"
              required
              data-testid="date-input"
            />
          </div>
          <Button type="submit" data-testid="view-capacity-btn">View Capacity</Button>
        </form>
      </div>

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Import from CSV</h2>
          <button
            onClick={downloadExample}
            className="text-xs text-blue-600 hover:underline"
            data-testid="download-example-csv-btn"
          >
            Download example CSV
          </button>
        </div>

        <p className="text-sm text-gray-500">
          Upload a CSV with columns:{' '}
          <span className="font-mono text-xs bg-gray-100 px-1 rounded">
            terminal_name, date, hour_slot, capacity_privileged, capacity_non_privileged
          </span>
          . Existing slots are updated; hours not listed keep their current or default values.
        </p>

        <div className="flex items-center gap-3">
          <label className="flex-1">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleImport}
              disabled={importing}
              className="block w-full text-sm text-gray-600
                file:mr-3 file:py-1.5 file:px-3
                file:rounded file:border file:border-gray-300
                file:text-sm file:font-medium file:bg-white
                file:text-gray-700 file:cursor-pointer
                hover:file:bg-gray-50 disabled:opacity-50"
              data-testid="import-csv-input"
            />
          </label>
          {importing && <span className="text-sm text-gray-400">Importing…</span>}
        </div>

        {importResult && (
          <div className="space-y-1" data-testid="import-result">
            {importResult.imported > 0 && (
              <p className="text-sm text-green-700 font-medium" data-testid="import-success-msg">
                ✓ {importResult.imported} slot(s) imported successfully.
              </p>
            )}
            {importResult.errors.length > 0 && (
              <div className="rounded-md bg-amber-50 border border-amber-200 p-3 space-y-1" data-testid="import-errors">
                <p className="text-xs font-semibold text-amber-700">Warnings / skipped rows:</p>
                {importResult.errors.map((e, i) => (
                  <p key={i} className="text-xs text-amber-700">
                    {e.line > 0 ? `Line ${e.line}: ` : ''}{e.message}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
