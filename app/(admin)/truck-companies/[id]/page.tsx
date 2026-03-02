'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { showToast } from '@/components/ui/Toast'
import { PageSpinner } from '@/components/ui/Spinner'

export default function TruckCompanyDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const isNew = id === 'new'
  const router = useRouter()

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', contact_email: '' })

  useEffect(() => {
    if (isNew) return
    fetch(`/api/truck-companies/${id}`)
      .then(r => r.json())
      .then(json => {
        if (json.data) setForm({ name: json.data.name, contact_email: json.data.contact_email ?? '' })
      })
      .finally(() => setLoading(false))
  }, [id, isNew])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(isNew ? '/api/truck-companies' : `/api/truck-companies/${id}`, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) { showToast(json.error || 'Save failed', 'error'); return }
      showToast(isNew ? 'Company created' : 'Company updated', 'success')
      router.push('/truck-companies')
    } catch { showToast('Network error', 'error') }
    finally { setSaving(false) }
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
          <Input label="Company Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required data-testid="company-name-input" />
          <Input label="Contact Email" type="email" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} data-testid="contact-email-input" />
          <Button type="submit" loading={saving}>{isNew ? 'Create Company' : 'Save Changes'}</Button>
        </form>
      </div>
    </div>
  )
}
