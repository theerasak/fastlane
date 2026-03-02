'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { showToast } from '@/components/ui/Toast'
import { PageSpinner } from '@/components/ui/Spinner'

export default function TerminalDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const isNew = id === 'new'
  const router = useRouter()

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    if (isNew) return
    fetch(`/api/terminals/${id}`)
      .then(r => r.json())
      .then(json => {
        if (json.data) { setName(json.data.name); setIsActive(json.data.is_active) }
      })
      .finally(() => setLoading(false))
  }, [id, isNew])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(isNew ? '/api/terminals' : `/api/terminals/${id}`, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isNew ? { name } : { name, is_active: isActive }),
      })
      const json = await res.json()
      if (!res.ok) { showToast(json.error || 'Save failed', 'error'); return }
      showToast(isNew ? 'Terminal created' : 'Terminal updated', 'success')
      router.push('/terminals')
    } catch { showToast('Network error', 'error') }
    finally { setSaving(false) }
  }

  if (loading) return <PageSpinner />

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">← Back</button>
        <h1 className="text-xl font-bold text-gray-900">{isNew ? 'New Terminal' : 'Edit Terminal'}</h1>
      </div>
      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Terminal Name" value={name} onChange={e => setName(e.target.value)} required data-testid="terminal-name-input" />
          {!isNew && (
            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_active" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="rounded" />
              <label htmlFor="is_active" className="text-sm text-gray-700">Active</label>
            </div>
          )}
          <Button type="submit" loading={saving}>{isNew ? 'Create Terminal' : 'Save Changes'}</Button>
        </form>
      </div>
    </div>
  )
}
