'use client'

import { useState, useRef } from 'react'
import { HOUR_LABELS } from '@/lib/constants'
import { ConflictWarningModal } from './ConflictWarningModal'
import type { CapacitySlotResponse } from '@/types/api'

interface ConflictState {
  currentValue: number
  currentUpdatedAt: string
}

interface SlotCellProps {
  slot: CapacitySlotResponse
  onSaved: (hourSlot: number, capacity: number, lastUpdatedAt: string) => void
}

export function SlotCell({ slot, onSaved }: SlotCellProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(slot.capacity)
  const [saving, setSaving] = useState(false)
  const [conflict, setConflict] = useState<ConflictState | null>(null)
  const pendingValueRef = useRef<number>(slot.capacity)

  async function saveCapacity(capacity: number, force = false) {
    setSaving(true)
    try {
      const res = await fetch(`/api/capacity/${slot.terminal_id}/${slot.date}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hour_slot: slot.hour_slot,
          capacity,
          last_updated_at: slot.last_updated_at,
          force,
        }),
      })

      const json = await res.json()

      if (res.status === 409) {
        // Conflict
        pendingValueRef.current = capacity
        setConflict({
          currentValue: json.current_value,
          currentUpdatedAt: json.current_updated_at,
        })
        return
      }

      if (!res.ok) {
        console.error('Save failed:', json.error)
        return
      }

      onSaved(slot.hour_slot, json.data.capacity, json.data.last_updated_at)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  function handleBlur() {
    if (value !== slot.capacity) {
      saveCapacity(value)
    } else {
      setEditing(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleBlur()
    if (e.key === 'Escape') { setValue(slot.capacity); setEditing(false) }
  }

  const remaining = slot.remaining_capacity ?? slot.capacity
  const used = slot.used_count ?? 0

  return (
    <>
      <div
        className={[
          'rounded-lg p-2 tablet:p-3 border transition-colors',
          remaining === 0
            ? 'bg-red-50 border-red-200'
            : remaining <= 1
              ? 'bg-yellow-50 border-yellow-200'
              : 'bg-white border-gray-200',
        ].join(' ')}
      >
        <p className="text-xs text-gray-500 font-medium truncate">{HOUR_LABELS[slot.hour_slot]}</p>

        {editing ? (
          <input
            type="number"
            min={0}
            max={99}
            value={value}
            onChange={e => setValue(Number(e.target.value))}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="mt-1 w-full text-lg font-bold border-b-2 border-blue-500 bg-transparent focus:outline-none text-center"
            autoFocus
            disabled={saving}
            data-testid={`slot-input-${slot.hour_slot}`}
          />
        ) : (
          <button
            className="mt-1 w-full text-lg font-bold text-center hover:text-blue-600 transition-colors"
            onClick={() => { setValue(slot.capacity); setEditing(true) }}
            data-testid={`slot-cell-${slot.hour_slot}`}
          >
            {slot.capacity}
          </button>
        )}

        <p className="text-xs text-center mt-1">
          <span className={remaining === 0 ? 'text-red-600' : 'text-gray-400'}>
            {used}/{slot.capacity} used
          </span>
        </p>
      </div>

      {conflict && (
        <ConflictWarningModal
          open={true}
          hourSlot={slot.hour_slot}
          myValue={pendingValueRef.current}
          currentValue={conflict.currentValue}
          currentUpdatedAt={conflict.currentUpdatedAt}
          onOverwrite={() => {
            setConflict(null)
            saveCapacity(pendingValueRef.current, true)
          }}
          onDiscard={() => {
            setConflict(null)
            setValue(conflict.currentValue)
            setEditing(false)
            // Update parent with current DB value
            onSaved(slot.hour_slot, conflict.currentValue, conflict.currentUpdatedAt)
          }}
        />
      )}
    </>
  )
}
