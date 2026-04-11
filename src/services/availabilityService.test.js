import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabaseClient', () => ({
  supabase: { rpc: vi.fn() },
}))

import { supabase } from './supabaseClient'
import { getAvailableSlots } from './availabilityService'

describe('getAvailableSlots', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls get_available_slots with correct params', async () => {
    const blocked = [{ start_time: '10:00', duration_minutes: 60 }]
    supabase.rpc.mockResolvedValue({ data: blocked, error: null })
    const result = await getAvailableSlots(null, '2026-04-20', 'any')
    expect(supabase.rpc).toHaveBeenCalledWith('get_available_slots', {
      p_staff_id: null,
      p_date: '2026-04-20',
      p_preference: 'any',
    })
    expect(result).toEqual(blocked)
  })

  it('passes specific staff id for specific preference', async () => {
    supabase.rpc.mockResolvedValue({ data: [], error: null })
    await getAvailableSlots('staff-uuid', '2026-04-20', 'specific')
    expect(supabase.rpc).toHaveBeenCalledWith('get_available_slots', {
      p_staff_id: 'staff-uuid',
      p_date: '2026-04-20',
      p_preference: 'specific',
    })
  })

  it('throws on RPC error', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: new Error('RPC error') })
    await expect(getAvailableSlots(null, '2026-04-20', 'any')).rejects.toThrow('RPC error')
  })
})
