'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useCapacitySlots } from '@/hooks/useCapacitySlots'
import { CapacityGrid } from '@/components/capacity/CapacityGrid'
import { PageSpinner } from '@/components/ui/Spinner'

export default function CapacityGridPage({
  params,
}: {
  params: { terminalId: string; date: string }
}) {
  const { terminalId, date } = params
  const { slots, loading, error, updateSlotOptimistic } = useCapacitySlots(terminalId, date)
  const [terminalName, setTerminalName] = useState<string>('')

  useEffect(() => {
    fetch(`/api/terminals/${terminalId}`)
      .then(r => r.json())
      .then(json => { if (json.data?.name) setTerminalName(json.data.name) })
      .catch(() => {})
  }, [terminalId])

  if (loading) return <PageSpinner />
  if (error) return <div className="text-red-600 p-4">{error}</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/capacity" className="text-gray-500 hover:text-gray-700">← Back</Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {terminalName ? `${terminalName} — ` : ''}Capacity — {date}
          </h1>
          <p className="text-sm text-gray-500">Click any capacity value to edit it. Changes save on blur or Enter.</p>
        </div>
      </div>

      {slots.length === 0 ? (
        <div className="text-gray-500">No capacity slots found.</div>
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
