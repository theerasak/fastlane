'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useBookings } from '@/hooks/useBookings'
import { Table, Td, Tr } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/Badge'
import { PageSpinner } from '@/components/ui/Spinner'

export default function BookingsPage() {
  const [filter, setFilter] = useState('')
  const [appliedFilter, setAppliedFilter] = useState('')
  const { bookings, loading } = useBookings(appliedFilter)

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setAppliedFilter(filter)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Bookings</h1>
        <div className="flex gap-2">
          <Link href="/import">
            <Button variant="secondary" size="sm">Import</Button>
          </Link>
          <Link href="/bookings/new">
            <Button size="sm" data-testid="new-booking-btn">+ New Booking</Button>
          </Link>
        </div>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 max-w-sm">
        <input
          type="text"
          placeholder="Search by booking number…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="input-field flex-1"
          data-testid="booking-filter"
        />
        <Button type="submit" variant="secondary" size="sm">Search</Button>
      </form>

      {loading ? <PageSpinner /> : (
        <Table
          headers={['Booking #', 'Terminal', 'Truck Company', 'Trucks', 'Filled', 'Status', 'Actions']}
          isEmpty={bookings.length === 0}
          emptyMessage="No bookings found."
        >
          {bookings.map((b) => (
            <Tr key={b.id}>
              <Td className="font-mono font-medium">{b.booking_number}</Td>
              <Td>{b.terminal_name || '—'}</Td>
              <Td>{b.truck_company_name || '—'}</Td>
              <Td>{b.num_trucks}</Td>
              <Td>
                <span className={b.active_count === b.num_trucks ? 'text-green-600 font-medium' : ''}>
                  {b.active_count ?? 0} / {b.num_trucks}
                </span>
              </Td>
              <Td><StatusBadge status={b.status} /></Td>
              <Td>
                <Link href={`/bookings/${b.id}`} className="text-blue-600 hover:underline text-sm">
                  View
                </Link>
              </Td>
            </Tr>
          ))}
        </Table>
      )}
    </div>
  )
}
