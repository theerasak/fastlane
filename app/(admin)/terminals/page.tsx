'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Table, Td, Tr } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { PageSpinner } from '@/components/ui/Spinner'
import { showToast } from '@/components/ui/Toast'
import type { TerminalResponse } from '@/types/api'

export default function TerminalsPage() {
  const [terminals, setTerminals] = useState<TerminalResponse[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/terminals')
      .then(r => r.json())
      .then(json => setTerminals(json.data ?? []))
      .catch(() => showToast('Failed to load terminals', 'error'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <PageSpinner />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Port Terminals</h1>
        <Link href="/terminals/new">
          <Button size="sm">+ New Terminal</Button>
        </Link>
      </div>

      <Table headers={['Name', 'Status', 'Created', 'Actions']} isEmpty={terminals.length === 0}>
        {terminals.map((t) => (
          <Tr key={t.id}>
            <Td className="font-medium">{t.name}</Td>
            <Td>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${t.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {t.is_active ? 'Active' : 'Inactive'}
              </span>
            </Td>
            <Td className="text-gray-500">{new Date(t.created_at).toLocaleDateString()}</Td>
            <Td>
              <Link href={`/terminals/${t.id}`} className="text-blue-600 hover:underline text-sm">Edit</Link>
            </Td>
          </Tr>
        ))}
      </Table>
    </div>
  )
}
