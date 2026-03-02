'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { HOUR_LABELS } from '@/lib/constants'

interface PlateInputProps {
  onAdd: (licensePlate: string, hourSlot: number) => Promise<void>
  disabled?: boolean
}

export function PlateInput({ onAdd, disabled }: PlateInputProps) {
  const [plate, setPlate] = useState('')
  const [hourSlot, setHourSlot] = useState('0')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  const slotOptions = HOUR_LABELS.map((label, i) => ({ value: String(i), label }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!plate.trim()) return
    setError('')
    setAdding(true)
    try {
      await onAdd(plate.trim().toUpperCase(), Number(hourSlot))
      setPlate('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add plate')
    } finally {
      setAdding(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            placeholder="ABC-1234"
            value={plate}
            onChange={e => setPlate(e.target.value.toUpperCase())}
            disabled={disabled || adding}
            error={error}
            data-testid="plate-input"
          />
        </div>
        <div className="w-32 tablet:w-40">
          <Select
            value={hourSlot}
            onChange={e => setHourSlot(e.target.value)}
            options={slotOptions}
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
    </form>
  )
}
