'use client'

import { useState, useEffect } from 'react'
import { PlateInput } from './PlateInput'
import { RegistrationSummary } from './RegistrationSummary'
import { Button } from '@/components/ui/Button'
import { HOUR_LABELS } from '@/lib/constants'
import { showToast } from '@/components/ui/Toast'
import type { BookingPublicInfo, RegistrationResponse, SlotAvailability } from '@/types/api'

interface RegistrationFormProps {
  token: string
  initialData: BookingPublicInfo
  onActiveCountChange?: (count: number) => void
}

export function RegistrationForm({ token, initialData, onActiveCountChange }: RegistrationFormProps) {
  const [registrations, setRegistrations] = useState<RegistrationResponse[]>(initialData.registrations)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPlate, setEditPlate] = useState('')
  const [editContainer, setEditContainer] = useState('')
  const [editHourSlot, setEditHourSlot] = useState<number | ''>('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [bookingDate, setBookingDate] = useState(initialData.booking_date)
  const [slotAvailability, setSlotAvailability] = useState<SlotAvailability[]>(initialData.slot_availability)
  const [dateChanging, setDateChanging] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  const active = registrations.filter(r => !r.is_deleted)

  useEffect(() => {
    onActiveCountChange?.(active.length)
  }, [active.length])
  const isFull = active.length >= initialData.num_trucks

  // Returns true if we are within `bufferHours` of the slot start (i.e. locked)
  function isLocked(appointmentDate: string, hourSlot: number, bufferHours: number): boolean {
    const slotMs = new Date(`${appointmentDate}T${String(hourSlot).padStart(2, '0')}:00:00Z`).getTime()
    return Date.now() >= slotMs - bufferHours * 3600 * 1000
  }

  async function handleDateChange(newDate: string) {
    setBookingDate(newDate)
    setDateChanging(true)
    try {
      await fetch(`/api/register/${token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_date: newDate }),
      })
      const res = await fetch(`/api/register/${token}`)
      const json = await res.json()
      if (res.ok && json.data) {
        setSlotAvailability(json.data.slot_availability)
        setRegistrations(json.data.registrations ?? [])
      }
    } catch {
      showToast('Failed to update date', 'error')
    } finally {
      setDateChanging(false)
    }
  }

  async function handleAdd(licensePlate: string, containerNumber: string, hourSlot: number) {
    const res = await fetch(`/api/register/${token}/plates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ license_plate: licensePlate, container_number: containerNumber, hour_slot: hourSlot }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Failed to add registration')
    setRegistrations(prev => [...prev, json.data])
    setSlotAvailability(prev => prev.map(s =>
      s.hour_slot === hourSlot ? { ...s, remaining_capacity: s.remaining_capacity - 1 } : s
    ))
    showToast('Registration added', 'success')
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this registration?')) return
    const res = await fetch(`/api/register/${token}/plates?id=${id}`, { method: 'DELETE' })
    if (!res.ok) { showToast('Failed to remove', 'error'); return }
    setRegistrations(prev => prev.map(r => r.id === id ? { ...r, is_deleted: true, deleted_at: new Date().toISOString() } : r))
    showToast('Registration removed', 'success')
  }

  async function handleEditSave(id: string) {
    setSavingEdit(true)
    try {
      const body: Record<string, unknown> = {}
      if (editPlate) body.license_plate = editPlate
      if (editContainer) body.container_number = editContainer
      if (editHourSlot !== '') body.hour_slot = editHourSlot
      const res = await fetch(`/api/register/${token}/plates?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) { showToast(json.error || 'Failed to save', 'error'); return }
      setRegistrations(prev => prev.map(r => r.id === id ? json.data : r))
      setEditingId(null)
      showToast('Registration updated', 'success')
    } finally { setSavingEdit(false) }
  }

  return (
    <div className="space-y-4">
      <RegistrationSummary registrations={registrations} numTrucks={initialData.num_trucks} />

      <div className="card">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Appointment Date</p>
            <input
              type="date"
              value={bookingDate}
              min={today}
              onChange={e => handleDateChange(e.target.value)}
              disabled={dateChanging}
              className="input-field text-sm"
            />
          </div>
          {dateChanging && <span className="text-sm text-gray-400 mt-4">Updating…</span>}
        </div>
      </div>

      {!isFull && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3">Add Truck</h3>
          <PlateInput onAdd={handleAdd} disabled={isFull} slotAvailability={slotAvailability} />
        </div>
      )}

      {active.length > 0 && (
        <div className="card space-y-2">
          <h3 className="font-semibold text-gray-900">Registered Trucks</h3>
          <div className="space-y-2">
            {active.map((reg, idx) => {
              const containerLocked = isLocked(reg.appointment_date, reg.hour_slot, 12)
              const plateLocked = isLocked(reg.appointment_date, reg.hour_slot, 1)
              return (
                <div key={reg.id} className="p-3 bg-gray-50 rounded-lg" data-testid={`registration-${idx}`}>
                  {editingId === reg.id ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 tablet:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">License Plate</label>
                          <input
                            type="text"
                            value={editPlate}
                            onChange={e => setEditPlate(e.target.value.toUpperCase())}
                            disabled={plateLocked}
                            placeholder={plateLocked ? 'Locked (< 1h to slot)' : reg.license_plate}
                            className="input-field text-sm w-full"
                            data-testid={`edit-plate-input-${idx}`}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            Container Number
                            {containerLocked && <span className="ml-1 text-amber-600">(locked — &lt;12h to slot)</span>}
                          </label>
                          <input
                            type="text"
                            value={editContainer}
                            onChange={e => setEditContainer(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11))}
                            disabled={containerLocked}
                            placeholder={containerLocked ? 'Locked' : reg.container_number}
                            className="input-field text-sm w-full"
                            data-testid={`edit-container-input-${idx}`}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={editHourSlot}
                          onChange={e => setEditHourSlot(e.target.value === '' ? '' : Number(e.target.value))}
                          className="input-field text-sm w-44"
                          data-testid={`edit-slot-select-${idx}`}
                        >
                          <option value="">Same slot</option>
                          {slotAvailability.filter(s => s.remaining_capacity > 0).map(s => (
                            <option key={s.hour_slot} value={s.hour_slot}>{HOUR_LABELS[s.hour_slot]}</option>
                          ))}
                        </select>
                        <Button size="sm" loading={savingEdit} onClick={() => handleEditSave(reg.id)} data-testid={`save-edit-btn-${idx}`}>
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <span className="text-xs text-gray-400 w-5 pt-0.5">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                          <span className="font-mono font-medium" data-testid={`plate-${idx}`}>{reg.license_plate}</span>
                          <span className="font-mono text-sm text-gray-600" data-testid={`container-${idx}`}>{reg.container_number}</span>
                          <span className="text-xs text-gray-500">{HOUR_LABELS[reg.hour_slot]}</span>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingId(reg.id)
                            setEditPlate(reg.license_plate)
                            setEditContainer(reg.container_number)
                            setEditHourSlot('')
                          }}
                          data-testid={`edit-plate-btn-${idx}`}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleDelete(reg.id)}
                          data-testid={`delete-plate-btn-${idx}`}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
