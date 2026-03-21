import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockInsert = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  getServerClient: () => ({
    from: (_table: string) => ({ insert: mockInsert }),
  }),
}))

// Import after mock is registered
const { writeAuditLog } = await import('@/lib/audit')

describe('writeAuditLog', () => {
  beforeEach(() => {
    mockInsert.mockReset()
    mockInsert.mockResolvedValue({ error: null })
  })

  it('resolves without throwing when insert succeeds', async () => {
    await expect(writeAuditLog({
      table_name: 'users',
      record_id: '00000000-0000-0000-0000-000000000001',
      action: 'CREATE',
      performed_by: 'admin-id',
      performed_by_email: 'admin@test.com',
      new_data: { id: '1', email: 'user@test.com' },
    })).resolves.toBeUndefined()
  })

  it('resolves without throwing when insert rejects (error is silently swallowed)', async () => {
    mockInsert.mockRejectedValue(new Error('DB connection failed'))
    await expect(writeAuditLog({
      table_name: 'users',
      record_id: '00000000-0000-0000-0000-000000000001',
      action: 'DELETE',
      performed_by: 'admin-id',
      performed_by_email: 'admin@test.com',
    })).resolves.toBeUndefined()
  })

  it('calls insert with the correct payload for CREATE', async () => {
    await writeAuditLog({
      table_name: 'truck_companies',
      record_id: '00000000-0000-0000-0000-000000000020',
      action: 'CREATE',
      performed_by: 'admin-id',
      performed_by_email: 'admin@example.com',
      new_data: { name: 'Test Co' },
    })

    expect(mockInsert).toHaveBeenCalledWith({
      table_name: 'truck_companies',
      record_id: '00000000-0000-0000-0000-000000000020',
      action: 'CREATE',
      performed_by: 'admin-id',
      performed_by_email: 'admin@example.com',
      old_data: null,
      new_data: { name: 'Test Co' },
    })
  })

  it('calls insert with the correct payload for UPDATE including old_data and new_data', async () => {
    await writeAuditLog({
      table_name: 'users',
      record_id: 'some-user-id',
      action: 'UPDATE',
      performed_by: 'admin-id',
      performed_by_email: 'admin@test.com',
      old_data: { is_active: true },
      new_data: { is_active: false },
    })

    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      action: 'UPDATE',
      old_data: { is_active: true },
      new_data: { is_active: false },
    }))
  })

  it('defaults old_data and new_data to null when omitted', async () => {
    await writeAuditLog({
      table_name: 'users',
      record_id: 'some-id',
      action: 'DELETE',
      performed_by: 'admin-id',
      performed_by_email: 'admin@test.com',
    })

    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      old_data: null,
      new_data: null,
    }))
  })

  it('calls insert exactly once per writeAuditLog call', async () => {
    await writeAuditLog({
      table_name: 'bookings',
      record_id: 'booking-id',
      action: 'CREATE',
      performed_by: 'agent-id',
      performed_by_email: 'agent@test.com',
      new_data: { booking_number: 'BK-001' },
    })

    expect(mockInsert).toHaveBeenCalledTimes(1)
  })
})
