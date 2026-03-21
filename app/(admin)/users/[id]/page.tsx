'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { showToast } from '@/components/ui/Toast'
import { PageSpinner } from '@/components/ui/Spinner'
import type { UserResponse } from '@/types/api'

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'agent', label: 'Agent' },
  { value: 'supervisor', label: 'Supervisor' },
]

export default function UserDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const isNew = id === 'new'
  const router = useRouter()

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    email: '',
    password: '',
    role: 'agent' as string,
    is_active: true,
    is_privileged: false,
    contact_person: '',
    phone: '',
  })

  useEffect(() => {
    if (isNew) return
    fetch(`/api/users/${id}`)
      .then(r => r.json())
      .then(json => {
        if (json.data) {
          const d: UserResponse = json.data
          setForm({
            email: d.email,
            password: '',
            role: d.role,
            is_active: d.is_active,
            is_privileged: d.is_privileged,
            contact_person: d.contact_person ?? '',
            phone: d.phone ?? '',
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
        email: form.email,
        role: form.role,
        contact_person: form.contact_person || null,
        phone: form.phone || null,
      }
      if (isNew) {
        body.password = form.password
      } else {
        if (form.password) body.password = form.password
        body.is_active = form.is_active
        if (form.role === 'agent') body.is_privileged = form.is_privileged
      }

      const res = await fetch(isNew ? '/api/users' : `/api/users/${id}`, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()

      if (!res.ok) {
        showToast(json.error || 'Save failed', 'error')
        return
      }

      showToast(isNew ? 'User created' : 'User updated', 'success')
      router.push('/users')
    } catch {
      showToast('Network error', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this user? This action cannot be undone.')) return
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' })
    if (res.ok) {
      showToast('User deleted', 'success')
      router.push('/users')
    } else {
      const json = await res.json()
      showToast(json.error || 'Delete failed', 'error')
    }
  }

  if (loading) return <PageSpinner />

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">
          ← Back
        </button>
        <h1 className="text-xl font-bold text-gray-900">{isNew ? 'New User' : 'Edit User'}</h1>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            data-testid="email-input"
          />
          <Input
            label={isNew ? 'Password' : 'New Password (leave blank to keep)'}
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required={isNew}
            data-testid="password-input"
          />
          <Select
            label="Role"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value, is_privileged: false })}
            options={ROLE_OPTIONS}
            data-testid="role-select"
          />
          <Input
            label="Contact Person"
            value={form.contact_person}
            onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
          />
          <Input
            label="Phone"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />

          {!isNew && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">Active</label>
              </div>
              {form.role === 'agent' && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_privileged"
                    checked={form.is_privileged}
                    onChange={(e) => setForm({ ...form, is_privileged: e.target.checked })}
                    className="rounded"
                  />
                  <label htmlFor="is_privileged" className="text-sm text-gray-700">Privileged Agent</label>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={saving} data-testid="save-user-btn">
              {isNew ? 'Create User' : 'Save Changes'}
            </Button>
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
