'use client'

import { SlotRow } from './SlotRow'
import type { CapacitySlotResponse } from '@/types/api'

interface CapacityGridProps {
  slots: CapacitySlotResponse[]
  onSlotSaved: (hourSlot: number, capacityPrivileged: number, capacityNonPrivileged: number, lastUpdatedAt: string) => void
}

export function CapacityGrid({ slots, onSlotSaved }: CapacityGridProps) {
  return (
    <div className="overflow-x-auto" data-testid="capacity-grid">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b-2 border-gray-200">
            <th className="text-left py-2 px-3 font-medium text-gray-700">Hour</th>
            <th className="text-center py-2 px-3 font-semibold text-blue-700">Capacity for Privileged</th>
            <th className="text-center py-2 px-3 font-normal text-blue-500 text-xs">Used</th>
            <th className="text-center py-2 px-3 font-semibold text-green-700">Capacity for Non-Privileged</th>
            <th className="text-center py-2 px-3 font-normal text-green-500 text-xs">Used</th>
          </tr>
        </thead>
        <tbody>
          {slots.map((slot) => (
            <SlotRow key={slot.hour_slot} slot={slot} onSaved={onSlotSaved} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
