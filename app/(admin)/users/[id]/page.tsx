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
  })

  useEffect(() => {
    if (isNew) return
    fetch(`/api/users/${id}`)
      .then(r => r.json())
      .then(json => {
        if (json.data) {
          setForm({
            email: json.data.email,
            password: '',
            role: json.data.role,
            is_active: json.data.is_active,
          })
        }
      })
      .finally(() => setLoading(false))
  }, [id, isNew])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const body: Record<string, unknown> = { email: form.email, role: form.role }
      if (isNew) body.password = form.password
      else if (form.password) body.password = form.password
      if (!isNew) body.is_active = form.is_active

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
    if (!confirm('Delete this user?')) return
    await fetch(`/api/users/${id}`, { method: 'DELETE' })
    showToast('User deleted', 'success')
    router.push('/users')
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
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            options={ROLE_OPTIONS}
            data-testid="role-select"
          />
          {!isNew && (
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
