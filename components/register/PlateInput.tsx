'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { HOUR_LABELS } from '@/lib/constants'
import type { SlotAvailability } from '@/types/api'

interface PlateInputProps {
  onAdd: (licensePlate: string, containerNumber: string, hourSlot: number) => Promise<void>
  disabled?: boolean
  slotAvailability: SlotAvailability[]
}

function formatPlateInput(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (clean.length <= 2) return clean
  // Use minimum prefix length to leave exactly 4 suffix chars when possible
  // e.g. 100011 → prefixLen=2 → 10-0011 (not 100-011)
  const prefixLen = clean.length >= 6 ? Math.min(clean.length - 4, 3) : Math.min(clean.length, 3)
  const prefix = clean.slice(0, prefixLen)
  const digits = clean.slice(prefixLen)
  if (digits.length === 0) return prefix
  return `${prefix}-${digits.slice(0, 4)}`
}

function formatContainerInput(raw: string): string {
  // 4 uppercase letters + up to 7 digits, no separator
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const letters = clean.slice(0, 4).replace(/[^A-Z]/g, '')
  const rest = clean.slice(letters.length)
  const digits = rest.replace(/[^0-9]/g, '').slice(0, 7)
  return letters + digits
}

export function PlateInput({ onAdd, disabled, slotAvailability }: PlateInputProps) {
  const [plate, setPlate] = useState('')
  const [container, setContainer] = useState('')
  const [hourSlot, setHourSlot] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  const availableSlots = slotAvailability.filter(s => s.remaining_capacity > 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!plate.trim()) { setError('Please enter a license plate'); return }
    if (!container.trim()) { setError('Please enter a container number'); return }
    if (!/^[A-Z]{4}\d{7}$/.test(container)) { setError('Container number must be 4 letters + 7 digits (e.g. ABCD1234567)'); return }
    if (!hourSlot) { setError('Please select a time slot'); return }
    setError('')
    setAdding(true)
    try {
      await onAdd(plate.trim().toUpperCase(), container.trim().toUpperCase(), Number(hourSlot))
      setPlate('')
      setContainer('')
      setHourSlot('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add registration')
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

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 tablet:grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-500 mb-1">License Plate</label>
          <Input
            placeholder="AB-1234"
            value={plate}
            onChange={e => setPlate(formatPlateInput(e.target.value))}
            disabled={disabled || adding}
            data-testid="plate-input"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Container Number</label>
          <Input
            placeholder="ABCD1234567"
            value={container}
            onChange={e => setContainer(formatContainerInput(e.target.value))}
            disabled={disabled || adding}
            maxLength={11}
            data-testid="container-input"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <select
            value={hourSlot}
            onChange={e => setHourSlot(e.target.value)}
            disabled={disabled || adding}
            className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            data-testid="hour-slot-select"
          >
            <option value="">Select time slot…</option>
            {slotAvailability.map(s => (
              <option key={s.hour_slot} value={String(s.hour_slot)} disabled={s.remaining_capacity <= 0}>
                {HOUR_LABELS[s.hour_slot]}{s.remaining_capacity <= 0 ? ' (full)' : ` (${s.remaining_capacity} remaining)`}
              </option>
            ))}
          </select>
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
      {availableSlots.length === 0 && slotAvailability.length > 0 && (
        <p className="text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
          All time slots are full for this date.
        </p>
      )}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}
    </form>
  )
}
