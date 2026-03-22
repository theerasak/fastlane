'use client'

import { useState } from 'react'
import { PlateInput } from './PlateInput'
import { RegistrationSummary } from './RegistrationSummary'
import { Button } from '@/components/ui/Button'
import { HOUR_LABELS } from '@/lib/constants'
import { showToast } from '@/components/ui/Toast'
import type { BookingPublicInfo, RegistrationResponse, SlotAvailability } from '@/types/api'

interface RegistrationFormProps {
  token: string
  initialData: BookingPublicInfo
}

export function RegistrationForm({ token, initialData }: RegistrationFormProps) {
  const [registrations, setRegistrations] = useState<RegistrationResponse[]>(initialData.registrations)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPlate, setEditPlate] = useState('')
  const [editHourSlot, setEditHourSlot] = useState<number | ''>('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [bookingDate, setBookingDate] = useState(initialData.booking_date)
  const [slotAvailability, setSlotAvailability] = useState<SlotAvailability[]>(initialData.slot_availability)
  const [dateChanging, setDateChanging] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  const active = registrations.filter(r => !r.is_deleted)
  const isFull = active.length >= initialData.num_trucks

  async function handleDateChange(newDate: string) {
    setBookingDate(newDate)
    setDateChanging(true)
    try {
      // Update booking_date
      await fetch(`/api/register/${token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_date: newDate }),
      })
      // Re-fetch to get updated slot availability
      const res = await fetch(`/api/register/${token}`)
      const json = await res.json()
      if (res.ok && json.data) {
        setSlotAvailability(json.data.slot_availability)
      }
    } catch {
      showToast('Failed to update date', 'error')
    } finally {
      setDateChanging(false)
    }
  }

  async function handleAdd(licensePlate: string, hourSlot: number) {
    const res = await fetch(`/api/register/${token}/plates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ license_plate: licensePlate, hour_slot: hourSlot }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Failed to add plate')
    setRegistrations(prev => [...prev, json.data])
    showToast('Plate added', 'success')
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
      const body: Record<string, unknown> = { license_plate: editPlate }
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
      showToast('Plate updated', 'success')
    } finally { setSavingEdit(false) }
  }

  return (
    <div className="space-y-4">
      <RegistrationSummary registrations={registrations} numTrucks={initialData.num_trucks} />

      <div className="card">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Booking Date</p>
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
            {active.map((reg, idx) => (
              <div key={reg.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg" data-testid={`registration-${idx}`}>
                <span className="text-xs text-gray-400 w-5">{idx + 1}</span>

                {editingId === reg.id ? (
                  <>
                    <input
                      type="text"
                      value={editPlate}
                      onChange={e => setEditPlate(e.target.value.toUpperCase())}
                      className="input-field flex-1 text-sm"
                      data-testid={`edit-plate-input-${idx}`}
                    />
                    <select
                      value={editHourSlot}
                      onChange={e => setEditHourSlot(e.target.value === '' ? '' : Number(e.target.value))}
                      className="input-field text-sm w-40"
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
                  </>
                ) : (
                  <>
                    <span className="flex-1 font-mono font-medium" data-testid={`plate-${idx}`}>{reg.license_plate}</span>
                    <span className="text-xs text-gray-500">{HOUR_LABELS[reg.hour_slot]}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { setEditingId(reg.id); setEditPlate(reg.license_plate); setEditHourSlot('') }}
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
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
