'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCapacitySlots } from '@/hooks/useCapacitySlots'
import { CapacityGrid } from '@/components/capacity/CapacityGrid'
import { PageSpinner } from '@/components/ui/Spinner'
import { shiftDate } from '@/lib/utils/date'
import type { TerminalResponse } from '@/types/api'

export default function CapacityGridPage({
  params,
}: {
  params: { terminalId: string; date: string }
}) {
  const router = useRouter()
  const { terminalId, date } = params
  const { slots, loading, error, updateSlotOptimistic } = useCapacitySlots(terminalId, date)
  const [terminals, setTerminals] = useState<TerminalResponse[]>([])

  useEffect(() => {
    fetch('/api/terminals')
      .then(r => r.json())
      .then(json => {
        const active = (json.data ?? []).filter((t: TerminalResponse) => t.is_active)
        setTerminals(active)
      })
      .catch(() => {})
  }, [])

  function navigate(newTerminalId: string, newDate: string) {
    router.push(`/capacity/${newTerminalId}/${newDate}`)
  }

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Link href="/capacity" className="text-gray-500 hover:text-gray-700 shrink-0">
          &larr; Back
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Capacity Management</h1>
          <p className="text-sm text-gray-500">Click any value to edit. Changes save on blur or Enter.</p>
        </div>
      </div>

      {/* Navigation controls */}
      <div className="card flex flex-wrap items-center gap-3">
        {/* Terminal selector */}
        {terminals.length > 1 ? (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600 shrink-0">Terminal</label>
            <select
              value={terminalId}
              onChange={e => navigate(e.target.value, date)}
              className="input-field py-1.5 text-sm w-auto"
              data-testid="capacity-terminal-select"
            >
              {terminals.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        ) : terminals.length === 1 ? (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">Terminal</span>
            <span className="text-sm font-semibold text-gray-900">
              {terminals[0].name}
            </span>
          </div>
        ) : null}

        <div className="w-px h-6 bg-gray-200 hidden tablet:block" />

        {/* Date navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(terminalId, shiftDate(date, -1))}
            className="btn-secondary px-3 py-1.5 text-sm"
            data-testid="capacity-prev-day"
          >
            &larr; Prev
          </button>

          <input
            type="date"
            value={date}
            onChange={e => { if (e.target.value) navigate(terminalId, e.target.value) }}
            className="input-field py-1.5 text-sm w-auto"
            data-testid="capacity-date-input"
          />

          <button
            onClick={() => navigate(terminalId, shiftDate(date, 1))}
            className="btn-secondary px-3 py-1.5 text-sm"
            data-testid="capacity-next-day"
          >
            Next &rarr;
          </button>
        </div>
      </div>

      {/* Grid area */}
      {loading ? (
        <PageSpinner />
      ) : error ? (
        <div className="text-red-600 p-4">{error}</div>
      ) : slots.length === 0 ? (
        <div className="text-gray-500">No capacity slots found for this date.</div>
      ) : (
        <CapacityGrid
          slots={slots}
          onSlotSaved={(hourSlot, capacityPrivileged, capacityNonPrivileged, lastUpdatedAt) => {
            updateSlotOptimistic(hourSlot, capacityPrivileged, capacityNonPrivileged, lastUpdatedAt)
          }}
        />
      )}
    </div>
  )
}
