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
              className="w-20 text-center rounded border-2 border-blue-500 bg-blue-50 px-2 py-1 font-bold focus:outline-none"
              autoFocus
              disabled={saving}
              data-testid={`slot-priv-input-${slot.hour_slot}`}
            />
          ) : (
            <button
              className={[
                'inline-flex items-center gap-1 w-20 justify-center rounded border px-2 py-1 font-bold cursor-text transition-colors',
                remainPriv === 0
                  ? 'border-red-300 bg-red-50 text-red-600 hover:border-red-400 hover:bg-red-100'
                  : 'border-blue-200 bg-blue-50 text-blue-800 hover:border-blue-400 hover:bg-blue-100',
              ].join(' ')}
              onClick={() => { setValuePriv(slot.capacity_privileged); setEditingPriv(true) }}
              title="Click to edit"
              data-testid={`slot-priv-cell-${slot.hour_slot}`}
            >
              {slot.capacity_privileged}
              <svg className="w-3 h-3 opacity-40 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a4 4 0 01-1.414.586l-3 .586.586-3a4 4 0 01.586-1.414z" />
              </svg>
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
              className="w-20 text-center rounded border-2 border-green-500 bg-green-50 px-2 py-1 font-bold focus:outline-none"
              autoFocus
              disabled={saving}
              data-testid={`slot-nonpriv-input-${slot.hour_slot}`}
            />
          ) : (
            <button
              className={[
                'inline-flex items-center gap-1 w-20 justify-center rounded border px-2 py-1 font-bold cursor-text transition-colors',
                remainNonPriv === 0
                  ? 'border-red-300 bg-red-50 text-red-600 hover:border-red-400 hover:bg-red-100'
                  : 'border-green-200 bg-green-50 text-green-800 hover:border-green-400 hover:bg-green-100',
              ].join(' ')}
              onClick={() => { setValueNonPriv(slot.capacity_non_privileged); setEditingNonPriv(true) }}
              title="Click to edit"
              data-testid={`slot-nonpriv-cell-${slot.hour_slot}`}
            >
              {slot.capacity_non_privileged}
              <svg className="w-3 h-3 opacity-40 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a4 4 0 01-1.414.586l-3 .586.586-3a4 4 0 01.586-1.414z" />
              </svg>
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
