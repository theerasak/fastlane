'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { PageSpinner } from '@/components/ui/Spinner'
import type { TerminalResponse } from '@/types/api'

export default function CapacityIndexPage() {
  const router = useRouter()
  const [terminals, setTerminals] = useState<TerminalResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [terminalId, setTerminalId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])

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

  if (loading) return <PageSpinner />

  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Capacity Management</h1>

      <div className="card">
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
              onChange={e => setDate(e.target.value)}
              className="input-field"
              required
              data-testid="date-input"
            />
          </div>
          <Button type="submit" data-testid="view-capacity-btn">View Capacity</Button>
        </form>
      </div>
    </div>
  )
}
