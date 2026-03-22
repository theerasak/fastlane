'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { HOUR_LABELS } from '@/lib/constants'
import type { SlotAvailability } from '@/types/api'

interface PlateInputProps {
  onAdd: (licensePlate: string, hourSlot: number) => Promise<void>
  disabled?: boolean
  slotAvailability: SlotAvailability[]
}

function formatPlateInput(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (clean.length <= 2) return clean
  // Insert dash after 2nd or 3rd alphanumeric char
  const prefix = clean.slice(0, Math.min(clean.length, 3))
  const digits = clean.slice(prefix.length)
  if (digits.length === 0) return prefix
  return `${prefix}-${digits.slice(0, 4)}`
}

export function PlateInput({ onAdd, disabled, slotAvailability }: PlateInputProps) {
  const [plate, setPlate] = useState('')
  const [hourSlot, setHourSlot] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  // Build slot dropdown: only slots that have remaining capacity > 0
  const availableSlots = slotAvailability.filter(s => s.remaining_capacity > 0)

  const slotOptions = availableSlots.map(s => ({
    value: String(s.hour_slot),
    label: `${HOUR_LABELS[s.hour_slot]} (${s.remaining_capacity} remaining)`,
  }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!plate.trim()) { setError('Please enter a license plate'); return }
    if (!hourSlot) { setError('Please select a time slot'); return }
    setError('')
    setAdding(true)
    try {
      await onAdd(plate.trim().toUpperCase(), Number(hourSlot))
      setPlate('')
      setHourSlot('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add plate')
    } finally {
      setAdding(false)
    }
  }

  if (slotAvailability.length === 0) {
    return (
      <p className="text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
        No capacity slots have been configured for this date. Please contact the booking agent.
      </p>
    )
  }

  if (availableSlots.length === 0) {
    return (
      <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
        All time slots are full for this date. No more trucks can be registered.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            placeholder="AB-1234"
            value={plate}
            onChange={e => setPlate(formatPlateInput(e.target.value))}
            disabled={disabled || adding}
            data-testid="plate-input"
          />
        </div>
        <div className="w-48 tablet:w-56">
          <Select
            value={hourSlot}
            onChange={e => setHourSlot(e.target.value)}
            options={slotOptions}
            placeholder="Select time slot…"
            disabled={disabled || adding}
            data-testid="hour-slot-select"
          />
        </div>
        <Button
          type="submit"
          loading={adding}
          disabled={disabled}
          data-testid="add-plate-btn"
        >
          Add
        </Button>
      </div>
      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}
    </form>
  )
}
