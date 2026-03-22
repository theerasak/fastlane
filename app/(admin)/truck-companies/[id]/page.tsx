'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { showToast } from '@/components/ui/Toast'
import { PageSpinner } from '@/components/ui/Spinner'
import type { TruckCompanyResponse } from '@/types/api'

export default function TruckCompanyDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const isNew = id === 'new'
  const router = useRouter()

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    contact_email: '',
    contact_person: '',
    phone: '',
    is_active: true,
  })
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (isNew) return
    fetch(`/api/truck-companies/${id}`)
      .then(r => r.json())
      .then(json => {
        if (json.data) {
          const d: TruckCompanyResponse = json.data
          setForm({
            name: d.name,
            contact_email: d.contact_email ?? '',
            contact_person: d.contact_person ?? '',
            phone: d.phone ?? '',
            is_active: d.is_active,
          })
        }
      })
      .finally(() => setLoading(false))
  }, [id, isNew])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        contact_email: form.contact_email || null,
        contact_person: form.contact_person || null,
        phone: form.phone || null,
      }
      if (!isNew) body.is_active = form.is_active
      if (password) body.password = password

      const res = await fetch(isNew ? '/api/truck-companies' : `/api/truck-companies/${id}`, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) { showToast(json.error || 'Save failed', 'error'); return }
      showToast(isNew ? 'Company created' : 'Company updated', 'success')
      router.push('/truck-companies')
    } catch { showToast('Network error', 'error') }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!confirm('Delete this truck company? This action cannot be undone.')) return
    const res = await fetch(`/api/truck-companies/${id}`, { method: 'DELETE' })
    if (res.ok) {
      showToast('Company deleted', 'success')
      router.push('/truck-companies')
    } else {
      const json = await res.json()
      showToast(json.error || 'Delete failed', 'error')
    }
  }

  if (loading) return <PageSpinner />

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">← Back</button>
        <h1 className="text-xl font-bold text-gray-900">{isNew ? 'New Truck Company' : 'Edit Truck Company'}</h1>
      </div>
      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Company Name"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            required
            data-testid="company-name-input"
          />
          <Input
            label="Contact Email"
            type="email"
            value={form.contact_email}
            onChange={e => setForm({ ...form, contact_email: e.target.value })}
            data-testid="contact-email-input"
          />
          <Input
            label="Contact Person"
            value={form.contact_person}
            onChange={e => setForm({ ...form, contact_person: e.target.value })}
          />
          <Input
            label="Phone"
            type="tel"
            value={form.phone}
            onChange={e => setForm({ ...form, phone: e.target.value })}
          />
          <Input
            label={isNew ? 'Login Password' : 'Set New Password'}
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={isNew ? 'Required for truck company login' : 'Leave blank to keep current password'}
            minLength={6}
            required={isNew}
          />
          {!isNew && (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="is_active"
                checked={form.is_active}
                onChange={e => setForm({ ...form, is_active: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="is_active" className="text-sm text-gray-700">Active</label>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={saving}>{isNew ? 'Create Company' : 'Save Changes'}</Button>
            {!isNew && (
              <Button type="button" variant="danger" onClick={handleDelete}>
                Delete
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
