'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Table, Td, Tr } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { PageSpinner } from '@/components/ui/Spinner'
import { showToast } from '@/components/ui/Toast'
import type { TruckCompanyResponse } from '@/types/api'

export default function TruckCompaniesPage() {
  const [companies, setCompanies] = useState<TruckCompanyResponse[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/truck-companies')
      .then(r => r.json())
      .then(json => setCompanies(json.data ?? []))
      .catch(() => showToast('Failed to load companies', 'error'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <PageSpinner />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Truck Companies</h1>
        <Link href="/truck-companies/new">
          <Button size="sm">+ New Company</Button>
        </Link>
      </div>

      <Table headers={['Name', 'Contact Email', 'Created', 'Actions']} isEmpty={companies.length === 0}>
        {companies.map((c) => (
          <Tr key={c.id}>
            <Td className="font-medium">{c.name}</Td>
            <Td className="text-gray-500">{c.contact_email || '—'}</Td>
            <Td className="text-gray-500">{new Date(c.created_at).toLocaleDateString()}</Td>
            <Td>
              <Link href={`/truck-companies/${c.id}`} className="text-blue-600 hover:underline text-sm">Edit</Link>
            </Td>
          </Tr>
        ))}
      </Table>
    </div>
  )
}
