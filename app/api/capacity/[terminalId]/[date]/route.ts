import { NextRequest, NextResponse } from 'next/server'
import { getServerClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { handleApiError, ApiError } from '@/lib/api/errors'
import { getDefaultSlotCapacity, HOUR_SLOTS } from '@/lib/constants'
import { z } from 'zod'

const UpdateCapacitySchema = z.object({
  hour_slot: z.number().int().min(0).max(23),
  capacity_privileged: z.number().int().min(0).max(999),
  capacity_non_privileged: z.number().int().min(0).max(999),
  last_updated_at: z.string(),
  force: z.boolean().optional(),
})

type Params = { terminalId: string; date: string }

export async function GET(req: NextRequest, { params }: { params: Promise<Params> }) {
  try {
    const session = await getSession(req)
    if (!session) throw ApiError.unauthorized()

    const { terminalId, date } = await params
    const supabase = getServerClient()

    // Verify terminal exists
    const { data: terminal } = await supabase
      .from('port_terminals')
      .select('id')
      .eq('id', terminalId)
      .single()

    if (!terminal) throw ApiError.notFound('Terminal not found')

    // Upsert all 24 slots (creates missing ones with default capacity)
    const defaultSlots = HOUR_SLOTS.map((hour_slot) => ({
      terminal_id: terminalId,
      date,
      hour_slot,
      ...getDefaultSlotCapacity(hour_slot),
    }))

    await supabase
      .from('terminal_capacity')
      .upsert(defaultSlots, { onConflict: 'terminal_id,date,hour_slot', ignoreDuplicates: true })

    // Fetch from view with remaining capacity
    const { data, error } = await supabase
      .from('slot_remaining_capacity')
      .select('terminal_id, date, hour_slot, capacity_privileged, capacity_non_privileged, last_updated_at, used_count_privileged, used_count_non_privileged, remaining_capacity_privileged, remaining_capacity_non_privileged')
      .eq('terminal_id', terminalId)
      .eq('date', date)
      .order('hour_slot')

    if (error) throw ApiError.internal(error.message)

    return NextResponse.json({ data })
  } catch (err) {
    const { error, code, status } = handleApiError(err)
    return NextResponse.json({ error, code }, { status })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<Params> }) {
  try {
    const session = await getSession(req)
    if (!session || session.role !== 'supervisor') throw ApiError.forbidden()

    const { terminalId, date } = await params
    const body = await req.json()
    const parsed = UpdateCapacitySchema.safeParse(body)
    if (!parsed.success) throw ApiError.badRequest(parsed.error.issues[0]?.message)

    const { hour_slot, capacity_privileged, capacity_non_privileged, last_updated_at, force } = parsed.data
    const supabase = getServerClient()

    // Feature 1: reject past dates
    const today = new Date().toISOString().split('T')[0]
    if (date < today) throw ApiError.badRequest('Cannot modify capacity for a past date')

    // Fetch current slot
    const { data: current, error: fetchError } = await supabase
      .from('terminal_capacity')
      .select('id, capacity_privileged, capacity_non_privileged, last_updated_at')
      .eq('terminal_id', terminalId)
      .eq('date', date)
      .eq('hour_slot', hour_slot)
      .single()

    if (fetchError || !current) throw ApiError.notFound('Capacity slot not found')

    // Optimistic lock check (unless force)
    if (!force && current.last_updated_at !== last_updated_at) {
      return NextResponse.json(
        {
          code: 'CONFLICT',
          current_capacity_privileged: current.capacity_privileged,
          current_capacity_non_privileged: current.capacity_non_privileged,
          current_updated_at: current.last_updated_at,
        },
        { status: 409 }
      )
    }

    // Feature 2: validate capacity >= current used count
    const { data: slotView } = await supabase
      .from('slot_remaining_capacity')
      .select('used_count_privileged, used_count_non_privileged')
      .eq('terminal_id', terminalId)
      .eq('date', date)
      .eq('hour_slot', hour_slot)
      .single()

    const usedPriv = slotView?.used_count_privileged ?? 0
    const usedNonPriv = slotView?.used_count_non_privileged ?? 0

    if (capacity_privileged < usedPriv)
      throw ApiError.badRequest(`Privileged capacity cannot be less than current usage (${usedPriv})`)
    if (capacity_non_privileged < usedNonPriv)
      throw ApiError.badRequest(`Non-privileged capacity cannot be less than current usage (${usedNonPriv})`)

    // Update
    const { data, error } = await supabase
      .from('terminal_capacity')
      .update({ capacity_privileged, capacity_non_privileged, updated_by_api: false })
      .eq('id', current.id)
      .select('id, terminal_id, date, hour_slot, capacity_privileged, capacity_non_privileged, last_updated_at')
      .single()

    if (error || !data) throw ApiError.internal('Failed to update capacity')

    return NextResponse.json({ data })
  } catch (err) {
    const { error, code, status } = handleApiError(err)
    return NextResponse.json({ error, code }, { status })
  }
}
