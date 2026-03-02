'use client'

import { SlotCell } from './SlotCell'
import type { CapacitySlotResponse } from '@/types/api'

interface CapacityGridProps {
  slots: CapacitySlotResponse[]
  onSlotSaved: (hourSlot: number, capacity: number, lastUpdatedAt: string) => void
}

export function CapacityGrid({ slots, onSlotSaved }: CapacityGridProps) {
  return (
    <div className="grid grid-cols-3 tablet:grid-cols-6 gap-2" data-testid="capacity-grid">
      {slots.map((slot) => (
        <SlotCell key={slot.hour_slot} slot={slot} onSaved={onSlotSaved} />
      ))}
    </div>
  )
}
