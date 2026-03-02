'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { showToast } from '@/components/ui/Toast'

interface ImportRow {
  booking_number: string
  terminal_id: string
  truck_company_id: string
  num_trucks: number
}

export default function ImportPage() {
  const router = useRouter()
  const [jsonText, setJsonText] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number } | null>(null)

  async function handleImport(e: React.FormEvent) {
    e.preventDefault()
    setImporting(true)
    setResult(null)

    try {
      let parsed: unknown
      try {
        parsed = JSON.parse(jsonText)
      } catch {
        showToast('Invalid JSON', 'error')
        return
      }

      const bookings: ImportRow[] = Array.isArray(parsed) ? parsed : (parsed as { bookings: ImportRow[] }).bookings

      const res = await fetch('/api/bookings/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookings }),
      })
      const json = await res.json()
      if (!res.ok) { showToast(json.error || 'Import failed', 'error'); return }

      setResult({ imported: json.data.imported })
      showToast(`Imported ${json.data.imported} bookings`, 'success')
    } catch { showToast('Network error', 'error') }
    finally { setImporting(false) }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">← Back</button>
        <h1 className="text-xl font-bold text-gray-900">Import Bookings</h1>
      </div>

      <div className="card space-y-4">
        <p className="text-sm text-gray-600">
          Paste a JSON array of bookings or a <code className="bg-gray-100 px-1 rounded">{'{"bookings": [...]}'}</code> object.
        </p>
        <p className="text-xs text-gray-500">
          Each booking requires: <code className="bg-gray-100 px-1 rounded">booking_number, terminal_id, truck_company_id, num_trucks</code>
        </p>

        <form onSubmit={handleImport} className="space-y-3">
          <textarea
            value={jsonText}
            onChange={e => setJsonText(e.target.value)}
            className="input-field min-h-[200px] font-mono text-xs"
            placeholder={'[\n  {\n    "booking_number": "BK-001",\n    "terminal_id": "...",\n    "truck_company_id": "...",\n    "num_trucks": 3\n  }\n]'}
            required
            data-testid="import-json-input"
          />
          <Button type="submit" loading={importing} data-testid="import-submit-btn">
            Import
          </Button>
        </form>

        {result && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
            Successfully imported {result.imported} booking(s).{' '}
            <button onClick={() => router.push('/bookings')} className="underline">
              View bookings →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
