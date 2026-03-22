'use client'

import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { HOUR_LABELS } from '@/lib/constants'

interface ConflictWarningModalProps {
  open: boolean
  hourSlot: number
  myPrivileged: number
  myNonPrivileged: number
  currentPrivileged: number
  currentNonPrivileged: number
  currentUpdatedAt: string
  onOverwrite: () => void
  onDiscard: () => void
}

export function ConflictWarningModal({
  open,
  hourSlot,
  myPrivileged,
  myNonPrivileged,
  currentPrivileged,
  currentNonPrivileged,
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
            <p className="text-xs text-blue-600 font-medium uppercase tracking-wide mb-2">Your values</p>
            <p className="text-sm font-bold text-blue-700">Privileged: {myPrivileged}</p>
            <p className="text-sm font-bold text-blue-700">Non-Privileged: {myNonPrivileged}</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-3">
            <p className="text-xs text-orange-600 font-medium uppercase tracking-wide mb-2">Current values</p>
            <p className="text-sm font-bold text-orange-700">Privileged: {currentPrivileged}</p>
            <p className="text-sm font-bold text-orange-700">Non-Privileged: {currentNonPrivileged}</p>
            <p className="text-xs text-orange-500 mt-1">
              {new Date(currentUpdatedAt).toLocaleTimeString()}
            </p>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={onOverwrite} variant="primary" data-testid="conflict-overwrite-btn">
            Overwrite with my values
          </Button>
          <Button onClick={onDiscard} variant="secondary" data-testid="conflict-discard-btn">
            Keep current values
          </Button>
        </div>
      </div>
    </Modal>
  )
}
