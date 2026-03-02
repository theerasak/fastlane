'use client'

import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { HOUR_LABELS } from '@/lib/constants'

interface ConflictWarningModalProps {
  open: boolean
  hourSlot: number
  myValue: number
  currentValue: number
  currentUpdatedAt: string
  onOverwrite: () => void
  onDiscard: () => void
}

export function ConflictWarningModal({
  open,
  hourSlot,
  myValue,
  currentValue,
  currentUpdatedAt,
  onOverwrite,
  onDiscard,
}: ConflictWarningModalProps) {
  return (
    <Modal open={open} onClose={onDiscard} title="Capacity Conflict Detected">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          The capacity for <strong>{HOUR_LABELS[hourSlot]}</strong> was updated by someone else while you were editing.
        </p>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-xs text-blue-600 font-medium uppercase tracking-wide mb-1">Your value</p>
            <p className="text-2xl font-bold text-blue-700">{myValue}</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-3">
            <p className="text-xs text-orange-600 font-medium uppercase tracking-wide mb-1">Current value</p>
            <p className="text-2xl font-bold text-orange-700">{currentValue}</p>
            <p className="text-xs text-orange-500 mt-1">
              {new Date(currentUpdatedAt).toLocaleTimeString()}
            </p>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={onOverwrite} variant="primary" data-testid="conflict-overwrite-btn">
            Overwrite with {myValue}
          </Button>
          <Button onClick={onDiscard} variant="secondary" data-testid="conflict-discard-btn">
            Keep {currentValue}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
