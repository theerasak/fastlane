'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Table, Td, Tr } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { RoleBadge } from '@/components/ui/Badge'
import { PageSpinner } from '@/components/ui/Spinner'
import { showToast } from '@/components/ui/Toast'
import type { UserResponse } from '@/types/api'

export default function UsersPage() {
  const [users, setUsers] = useState<UserResponse[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchUsers() {
    setLoading(true)
    try {
      const res = await fetch('/api/users')
      const json = await res.json()
      setUsers(json.data ?? [])
    } catch {
      showToast('Failed to load users', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  if (loading) return <PageSpinner />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Users</h1>
        <Link href="/users/new">
          <Button size="sm" data-testid="new-user-btn">+ New User</Button>
        </Link>
      </div>

      <Table
        headers={['Email', 'Role', 'Status', 'Created', 'Actions']}
        isEmpty={users.length === 0}
        emptyMessage="No users found."
      >
        {users.map((user) => (
          <Tr key={user.id}>
            <Td>
              <div>{user.email}</div>
              {user.contact_person && (
                <div className="text-xs text-gray-500">{user.contact_person}</div>
              )}
            </Td>
            <Td>
              <div className="flex flex-wrap gap-1">
                <RoleBadge role={user.role} />
                {user.role === 'agent' && user.is_privileged && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                    Privileged
                  </span>
                )}
              </div>
            </Td>
            <Td>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {user.is_active ? 'Active' : 'Inactive'}
              </span>
            </Td>
            <Td className="text-gray-500">{new Date(user.created_at).toLocaleDateString()}</Td>
            <Td>
              <Link href={`/users/${user.id}`} className="text-blue-600 hover:underline text-sm">
                Edit
              </Link>
            </Td>
          </Tr>
        ))}
      </Table>
    </div>
  )
}
