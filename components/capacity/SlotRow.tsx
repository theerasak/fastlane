'use client'

import { useState, useRef } from 'react'
import { HOUR_LABELS } from '@/lib/constants'
import { ConflictWarningModal } from './ConflictWarningModal'
import type { CapacitySlotResponse } from '@/types/api'

interface ConflictState {
  myPriv: number
  myNonPriv: number
  currentPriv: number
  currentNonPriv: number
  currentUpdatedAt: string
}

interface SlotRowProps {
  slot: CapacitySlotResponse
  onSaved: (hourSlot: number, capacityPrivileged: number, capacityNonPrivileged: number, lastUpdatedAt: string) => void
}

export function SlotRow({ slot, onSaved }: SlotRowProps) {
  const [editingPriv, setEditingPriv] = useState(false)
  const [editingNonPriv, setEditingNonPriv] = useState(false)
  const [valuePriv, setValuePriv] = useState(slot.capacity_privileged)
  const [valueNonPriv, setValueNonPriv] = useState(slot.capacity_non_privileged)
  const [saving, setSaving] = useState(false)
  const [conflict, setConflict] = useState<ConflictState | null>(null)
  const pendingRef = useRef<{ priv: number; nonPriv: number }>({
    priv: slot.capacity_privileged,
    nonPriv: slot.capacity_non_privileged,
  })

  async function save(privCap: number, nonPrivCap: number, force = false) {
    setSaving(true)
    try {
      const res = await fetch(`/api/capacity/${slot.terminal_id}/${slot.date}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hour_slot: slot.hour_slot,
          capacity_privileged: privCap,
          capacity_non_privileged: nonPrivCap,
          last_updated_at: slot.last_updated_at,
          force,
        }),
      })

      const json = await res.json()

      if (res.status === 409) {
        pendingRef.current = { priv: privCap, nonPriv: nonPrivCap }
        setConflict({
          myPriv: privCap,
          myNonPriv: nonPrivCap,
          currentPriv: json.current_capacity_privileged,
          currentNonPriv: json.current_capacity_non_privileged,
          currentUpdatedAt: json.current_updated_at,
        })
        return
      }

      if (!res.ok) {
        console.error('Save failed:', json.error)
        return
      }

      onSaved(slot.hour_slot, json.data.capacity_privileged, json.data.capacity_non_privileged, json.data.last_updated_at)
      setEditingPriv(false)
      setEditingNonPriv(false)
    } finally {
      setSaving(false)
    }
  }

  function handleBlurPriv() {
    if (valuePriv !== slot.capacity_privileged) {
      save(valuePriv, slot.capacity_non_privileged)
    } else {
      setEditingPriv(false)
    }
  }

  function handleBlurNonPriv() {
    if (valueNonPriv !== slot.capacity_non_privileged) {
      save(slot.capacity_privileged, valueNonPriv)
    } else {
      setEditingNonPriv(false)
    }
  }

  function handleKeyDownPriv(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleBlurPriv()
    if (e.key === 'Escape') { setValuePriv(slot.capacity_privileged); setEditingPriv(false) }
  }

  function handleKeyDownNonPriv(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleBlurNonPriv()
    if (e.key === 'Escape') { setValueNonPriv(slot.capacity_non_privileged); setEditingNonPriv(false) }
  }

  const usedPriv = slot.used_count_privileged ?? 0
  const usedNonPriv = slot.used_count_non_privileged ?? 0
  const remainPriv = slot.remaining_capacity_privileged ?? slot.capacity_privileged
  const remainNonPriv = slot.remaining_capacity_non_privileged ?? slot.capacity_non_privileged

  return (
    <>
      <tr className="border-b border-gray-100 hover:bg-gray-50">
        <td className="py-2 px-3 text-xs text-gray-500 font-medium whitespace-nowrap">
          {HOUR_LABELS[slot.hour_slot]}
        </td>

        {/* Privileged capacity */}
        <td className="py-2 px-3 text-center">
          {editingPriv ? (
            <input
              type="number"
              min={0}
              max={999}
              value={valuePriv}
              onChange={e => setValuePriv(Number(e.target.value))}
              onBlur={handleBlurPriv}
              onKeyDown={handleKeyDownPriv}
              className="w-16 text-center border-b-2 border-blue-500 bg-transparent focus:outline-none font-bold"
              autoFocus
              disabled={saving}
              data-testid={`slot-priv-input-${slot.hour_slot}`}
            />
          ) : (
            <button
              className={`font-bold hover:text-blue-600 transition-colors ${remainPriv === 0 ? 'text-red-600' : 'text-gray-800'}`}
              onClick={() => { setValuePriv(slot.capacity_privileged); setEditingPriv(true) }}
              data-testid={`slot-priv-cell-${slot.hour_slot}`}
            >
              {slot.capacity_privileged}
            </button>
          )}
        </td>

        <td className={`py-2 px-3 text-center text-xs ${remainPriv === 0 ? 'text-red-500' : 'text-gray-400'}`}>
          {usedPriv}/{slot.capacity_privileged}
        </td>

        {/* Non-privileged capacity */}
        <td className="py-2 px-3 text-center">
          {editingNonPriv ? (
            <input
              type="number"
              min={0}
              max={999}
              value={valueNonPriv}
              onChange={e => setValueNonPriv(Number(e.target.value))}
              onBlur={handleBlurNonPriv}
              onKeyDown={handleKeyDownNonPriv}
              className="w-16 text-center border-b-2 border-green-500 bg-transparent focus:outline-none font-bold"
              autoFocus
              disabled={saving}
              data-testid={`slot-nonpriv-input-${slot.hour_slot}`}
            />
          ) : (
            <button
              className={`font-bold hover:text-green-600 transition-colors ${remainNonPriv === 0 ? 'text-red-600' : 'text-gray-800'}`}
              onClick={() => { setValueNonPriv(slot.capacity_non_privileged); setEditingNonPriv(true) }}
              data-testid={`slot-nonpriv-cell-${slot.hour_slot}`}
            >
              {slot.capacity_non_privileged}
            </button>
          )}
        </td>

        <td className={`py-2 px-3 text-center text-xs ${remainNonPriv === 0 ? 'text-red-500' : 'text-gray-400'}`}>
          {usedNonPriv}/{slot.capacity_non_privileged}
        </td>
      </tr>

      {conflict && (
        <ConflictWarningModal
          open={true}
          hourSlot={slot.hour_slot}
          myPrivileged={conflict.myPriv}
          myNonPrivileged={conflict.myNonPriv}
          currentPrivileged={conflict.currentPriv}
          currentNonPrivileged={conflict.currentNonPriv}
          currentUpdatedAt={conflict.currentUpdatedAt}
          onOverwrite={() => {
            setConflict(null)
            save(pendingRef.current.priv, pendingRef.current.nonPriv, true)
          }}
          onDiscard={() => {
            setConflict(null)
            setValuePriv(conflict.currentPriv)
            setValueNonPriv(conflict.currentNonPriv)
            setEditingPriv(false)
            setEditingNonPriv(false)
            onSaved(slot.hour_slot, conflict.currentPriv, conflict.currentNonPriv, conflict.currentUpdatedAt)
          }}
        />
      )}
    </>
  )
}
