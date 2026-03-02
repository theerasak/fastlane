'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { showToast } from '@/components/ui/Toast'
import type { TerminalResponse, TruckCompanyResponse } from '@/types/api'

export default function NewBookingPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [terminals, setTerminals] = useState<TerminalResponse[]>([])
  const [companies, setCompanies] = useState<TruckCompanyResponse[]>([])
  const [form, setForm] = useState({
    booking_number: '',
    terminal_id: '',
    truck_company_id: '',
    num_trucks: 1,
  })

  useEffect(() => {
    Promise.all([
      fetch('/api/terminals').then(r => r.json()),
      fetch('/api/truck-companies').then(r => r.json()),
    ]).then(([t, c]) => {
      setTerminals(t.data ?? [])
      setCompanies(c.data ?? [])
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, num_trucks: Number(form.num_trucks) }),
      })
      const json = await res.json()
      if (!res.ok) { showToast(json.error || 'Failed to create booking', 'error'); return }
      showToast('Booking created', 'success')
      router.push(`/bookings/${json.data.id}`)
    } catch { showToast('Network error', 'error') }
    finally { setSaving(false) }
  }

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">← Back</button>
        <h1 className="text-xl font-bold text-gray-900">New Booking</h1>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Booking Number"
            value={form.booking_number}
            onChange={e => setForm({ ...form, booking_number: e.target.value })}
            required
            placeholder="BK-001"
            data-testid="booking-number-input"
          />
          <Select
            label="Terminal"
            value={form.terminal_id}
            onChange={e => setForm({ ...form, terminal_id: e.target.value })}
            options={terminals.filter(t => t.is_active).map(t => ({ value: t.id, label: t.name }))}
            placeholder="Select terminal…"
            required
            data-testid="terminal-select"
          />
          <Select
            label="Truck Company"
            value={form.truck_company_id}
            onChange={e => setForm({ ...form, truck_company_id: e.target.value })}
            options={companies.map(c => ({ value: c.id, label: c.name }))}
            placeholder="Select company…"
            required
            data-testid="truck-company-select"
          />
          <Input
            label="Number of Trucks"
            type="number"
            min={1}
            max={999}
            value={form.num_trucks}
            onChange={e => setForm({ ...form, num_trucks: Number(e.target.value) })}
            required
            data-testid="num-trucks-input"
          />
          <Button type="submit" loading={saving} data-testid="create-booking-btn">
            Create Booking
          </Button>
        </form>
      </div>
    </div>
  )
}
