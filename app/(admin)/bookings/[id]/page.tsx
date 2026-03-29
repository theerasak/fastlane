'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { StatusBadge } from '@/components/ui/Badge'
import { PageSpinner } from '@/components/ui/Spinner'
import { showToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { FastlaneUrlCard } from '@/components/bookings/FastlaneUrlCard'
import { HOUR_LABELS } from '@/lib/constants'
import type { BookingResponse, RegistrationResponse, UserResponse, TruckCompanyResponse } from '@/types/api'

function formatPlate(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (clean.length <= 2) return clean
  const prefixLen = clean.length >= 6 ? Math.min(clean.length - 4, 3) : Math.min(clean.length, 3)
  const prefix = clean.slice(0, prefixLen)
  const digits = clean.slice(prefixLen)
  if (digits.length === 0) return prefix
  return `${prefix}-${digits.slice(0, 4)}`
}

const STATUS_OPTIONS = [
  { value: 'FILLING-IN', label: 'Filling In' },
  { value: 'BOOKED', label: 'Booked' },
  { value: 'CLOSED', label: 'Closed' },
]

export default function BookingDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const router = useRouter()

  const [booking, setBooking] = useState<BookingResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    truck_company_id: '',
    created_by: '',
    num_trucks: 1,
    is_privileged_booking: false,
    status: 'FILLING-IN' as string,
  })

  const [agents, setAgents] = useState<UserResponse[]>([])
  const [truckCompanies, setTruckCompanies] = useState<TruckCompanyResponse[]>([])
  const [registrations, setRegistrations] = useState<RegistrationResponse[]>([])

  const [addingReg, setAddingReg] = useState(false)
  const [newPlate, setNewPlate] = useState('')
  const [newSlot, setNewSlot] = useState('')
  const [addingRegLoading, setAddingRegLoading] = useState(false)
  const [addRegError, setAddRegError] = useState('')

  const [editingRegId, setEditingRegId] = useState<string | null>(null)
  const [editRegPlate, setEditRegPlate] = useState('')
  const [editRegSlot, setEditRegSlot] = useState('')
  const [savingReg, setSavingReg] = useState(false)

  async function fetchBooking() {
    const res = await fetch(`/api/bookings/${id}`)
    const json = await res.json()
    if (!res.ok) { showToast(json.error || 'Failed to load', 'error'); return null }
    return json.data as BookingResponse
  }

  async function fetchAll() {
    try {
      const [meRes, bookingRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch(`/api/bookings/${id}`),
      ])
      const [meJson, bJson] = await Promise.all([meRes.json(), bookingRes.json()])

      const admin = meJson.data?.role === 'admin'
      setIsAdmin(admin)

      if (bJson.data) {
        const b = bJson.data as BookingResponse
        setBooking(b)
        setForm({
          truck_company_id: b.truck_company_id,
          created_by: b.created_by ?? '',
          num_trucks: b.num_trucks,
          is_privileged_booking: b.is_privileged_booking ?? false,
          status: b.status,
        })
      }

      if (admin) {
        const [agentsRes, companiesRes, regsRes] = await Promise.all([
          fetch('/api/users'),
          fetch('/api/truck-companies'),
          fetch(`/api/bookings/${id}/registrations`),
        ])
        const [aJson, cJson, rJson] = await Promise.all([
          agentsRes.json(), companiesRes.json(), regsRes.json(),
        ])
        setAgents((aJson.data ?? []).filter((u: UserResponse) => u.role === 'agent'))
        setTruckCompanies(cJson.data ?? [])
        setRegistrations(rJson.data ?? [])
      }
    } catch {
      showToast('Network error', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [id])

  async function handleSave() {
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        num_trucks: form.num_trucks,
        is_privileged_booking: form.is_privileged_booking,
        status: form.status,
        truck_company_id: form.truck_company_id,
        created_by: form.created_by || null,
      }
      const res = await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) { showToast(json.error || 'Save failed', 'error'); return }
      const refreshed = await fetchBooking()
      if (refreshed) setBooking(refreshed)
      setEditMode(false)
      showToast('Booking updated', 'success')
    } catch { showToast('Network error', 'error') }
    finally { setSaving(false) }
  }

  async function handleAddReg() {
    setAddRegError('')
    if (!newPlate.trim()) { setAddRegError('Enter a license plate'); return }
    if (!newSlot) { setAddRegError('Select a time slot'); return }
    setAddingRegLoading(true)
    try {
      const res = await fetch(`/api/bookings/${id}/registrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ license_plate: newPlate.trim(), hour_slot: Number(newSlot) }),
      })
      const json = await res.json()
      if (!res.ok) { setAddRegError(json.error || 'Failed to add'); return }
      setRegistrations(prev => [...prev, json.data])
      setNewPlate(''); setNewSlot(''); setAddingReg(false)
      const refreshed = await fetchBooking()
      if (refreshed) setBooking(refreshed)
      showToast('Truck added', 'success')
    } catch { setAddRegError('Network error') }
    finally { setAddingRegLoading(false) }
  }

  async function handleSaveReg(regId: string) {
    setSavingReg(true)
    try {
      const body: Record<string, unknown> = { license_plate: editRegPlate }
      if (editRegSlot !== '') body.hour_slot = Number(editRegSlot)
      const res = await fetch(`/api/bookings/${id}/registrations?id=${regId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) { showToast(json.error || 'Failed to save', 'error'); return }
      setRegistrations(prev => prev.map(r => r.id === regId ? json.data : r))
      setEditingRegId(null)
      showToast('Updated', 'success')
    } catch { showToast('Network error', 'error') }
    finally { setSavingReg(false) }
  }

  async function handleDeleteReg(regId: string) {
    if (!confirm('Remove this truck registration?')) return
    const res = await fetch(`/api/bookings/${id}/registrations?id=${regId}`, { method: 'DELETE' })
    if (!res.ok) { showToast('Failed to remove', 'error'); return }
    setRegistrations(prev => prev.filter(r => r.id !== regId))
    const refreshed = await fetchBooking()
    if (refreshed) setBooking(refreshed)
    showToast('Registration removed', 'success')
  }

  if (loading) return <PageSpinner />
  if (!booking) return <div className="text-gray-500">Booking not found.</div>

  const agentOptions = [
    { value: '', label: '— Unassigned —' },
    ...agents.map(a => ({ value: a.id, label: a.company_name || a.email })),
  ]
  const companyOptions = truckCompanies.map(c => ({ value: c.id, label: c.name }))

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">← Back</button>
        <h1 className="text-xl font-bold text-gray-900">Booking {booking.booking_number}</h1>
        <StatusBadge status={booking.status} />
      </div>

      {/* Booking Info */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Booking Details</h2>
          {isAdmin && !editMode && (
            <Button size="sm" variant="secondary" onClick={() => setEditMode(true)}>Edit</Button>
          )}
          {isAdmin && editMode && (
            <div className="flex gap-2">
              <Button size="sm" loading={saving} onClick={handleSave}>Save Changes</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditMode(false)}>Cancel</Button>
            </div>
          )}
        </div>

        {editMode ? (
          <div className="space-y-3">
            <Select label="Agent" value={form.created_by} onChange={e => setForm({ ...form, created_by: e.target.value })} options={agentOptions} />
            <Select label="Truck Company" value={form.truck_company_id} onChange={e => setForm({ ...form, truck_company_id: e.target.value })} options={companyOptions} />
            <Input label="Trucks Allocated" type="number" min={1} max={999} value={String(form.num_trucks)} onChange={e => setForm({ ...form, num_trucks: Number(e.target.value) })} />
            <Select label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} options={STATUS_OPTIONS} />
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="is_privileged_booking"
                checked={form.is_privileged_booking}
                onChange={e => setForm({ ...form, is_privileged_booking: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="is_privileged_booking" className="text-sm text-gray-700">Paid by Agent (Privileged Booking)</label>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Terminal</p>
              <p className="font-medium">{booking.terminal_name || booking.terminal_id}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Agent</p>
              <p className="font-medium">{booking.agent_company_name || booking.agent_email || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Truck Company</p>
              <p className="font-medium">{booking.truck_company_name || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Trucks Allocated</p>
              <p className="font-medium">{booking.num_trucks}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Registered</p>
              <p className="font-medium">{booking.active_count ?? 0} / {booking.num_trucks}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Payment</p>
              <p className="font-medium">
                {booking.is_privileged_booking
                  ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">Paid by Agent</span>
                  : 'Standard'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Created</p>
              <p className="font-medium">{new Date(booking.created_at).toLocaleString()}</p>
            </div>
            {booking.fastlane_token && !booking.token_cancelled && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Link Expires</p>
                <p className="font-medium" data-testid="booking-link-expiry">
                  {booking.token_expires_at ? new Date(booking.token_expires_at).toLocaleDateString() : '—'}
                </p>
              </div>
            )}
            {booking.booked_at && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Booked At</p>
                <p className="font-medium">{new Date(booking.booked_at).toLocaleString()}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <FastlaneUrlCard
        token={booking.fastlane_token}
        tokenCancelled={booking.token_cancelled}
        tokenExpiresAt={booking.token_expires_at ?? null}
        bookingId={booking.id}
        hasRegistrations={(booking.active_count ?? 0) > 0}
        onTokenGenerated={(token, expiresAt) => setBooking(prev => prev ? { ...prev, fastlane_token: token, token_cancelled: false, token_expires_at: expiresAt } : prev)}
        onCancelled={() => setBooking(prev => prev ? { ...prev, token_cancelled: true } : prev)}
      />

      {/* Registered Trucks (admin only) */}
      {isAdmin && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">
              Registered Trucks ({registrations.length} / {booking.num_trucks})
            </h2>
            {!addingReg && (
              <Button size="sm" variant="secondary" onClick={() => { setAddingReg(true); setAddRegError('') }}>
                + Add Truck
              </Button>
            )}
          </div>

          {addingReg && (
            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              <div className="flex gap-2 flex-wrap">
                <div className="flex-1 min-w-[120px]">
                  <input
                    type="text"
                    placeholder="AB-1234"
                    value={newPlate}
                    onChange={e => setNewPlate(formatPlate(e.target.value))}
                    className="input-field w-full text-sm"
                  />
                </div>
                <select
                  value={newSlot}
                  onChange={e => setNewSlot(e.target.value)}
                  className="input-field text-sm w-44"
                >
                  <option value="">Select time slot…</option>
                  {HOUR_LABELS.map((label, i) => (
                    <option key={i} value={String(i)}>{label}</option>
                  ))}
                </select>
                <Button size="sm" loading={addingRegLoading} onClick={handleAddReg}>Add</Button>
                <Button size="sm" variant="ghost" onClick={() => { setAddingReg(false); setNewPlate(''); setNewSlot(''); setAddRegError('') }}>Cancel</Button>
              </div>
              {addRegError && <p className="text-sm text-red-600">{addRegError}</p>}
            </div>
          )}

          {registrations.length === 0 ? (
            <p className="text-sm text-gray-400">No trucks registered yet.</p>
          ) : (
            <div className="space-y-2">
              {registrations.map((reg, idx) => (
                <div key={reg.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <span className="text-xs text-gray-400 w-5">{idx + 1}</span>
                  {editingRegId === reg.id ? (
                    <>
                      <input
                        type="text"
                        value={editRegPlate}
                        onChange={e => setEditRegPlate(formatPlate(e.target.value))}
                        className="input-field flex-1 text-sm"
                      />
                      <select
                        value={editRegSlot}
                        onChange={e => setEditRegSlot(e.target.value)}
                        className="input-field text-sm w-40"
                      >
                        <option value="">Same slot</option>
                        {HOUR_LABELS.map((label, i) => (
                          <option key={i} value={String(i)}>{label}</option>
                        ))}
                      </select>
                      <Button size="sm" loading={savingReg} onClick={() => handleSaveReg(reg.id)}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingRegId(null)}>Cancel</Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 font-mono font-medium text-sm">{reg.license_plate}</span>
                      <span className="text-xs text-gray-500 w-24">{HOUR_LABELS[reg.hour_slot]}</span>
                      <Button size="sm" variant="ghost" onClick={() => { setEditingRegId(reg.id); setEditRegPlate(reg.license_plate); setEditRegSlot('') }}>Edit</Button>
                      <Button size="sm" variant="danger" onClick={() => handleDeleteReg(reg.id)}>Remove</Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
