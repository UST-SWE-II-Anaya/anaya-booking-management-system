import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from './supabaseClient'
import { createLeaveRequest, getMyLeaveRequests } from './staffLeaveService'
import { createQueryBuilder } from '../test/mocks/supabaseMock'

beforeEach(() => vi.clearAllMocks())

describe('createLeaveRequest', () => {
  it('inserts into leave_requests with staff_id', async () => {
    const payload = {
      leave_type: 'vacation',
      start_date: '2026-04-10',
      end_date: '2026-04-12',
      reason: 'Holiday',
    }
    const qb = createQueryBuilder({ data: { id: 'lr1', ...payload }, error: null })
    supabase.from.mockReturnValue(qb)
    const result = await createLeaveRequest('staff-1', payload)
    expect(result.id).toBe('lr1')
    expect(supabase.from).toHaveBeenCalledWith('leave_requests')
    expect(qb.insert).toHaveBeenCalledWith(
      expect.objectContaining({ staff_id: 'staff-1', leave_type: 'vacation' })
    )
  })

  it('throws when end_date is before start_date', async () => {
    await expect(
      createLeaveRequest('staff-1', {
        leave_type: 'sick',
        start_date: '2026-04-15',
        end_date: '2026-04-10',
        reason: '',
      })
    ).rejects.toThrow('End date must be on or after start date')
  })
})

describe('getMyLeaveRequests', () => {
  it('filters by staff_id', async () => {
    const qb = createQueryBuilder({ data: [], error: null })
    supabase.from.mockReturnValue(qb)
    await getMyLeaveRequests('staff-1')
    expect(qb.eq).toHaveBeenCalledWith('staff_id', 'staff-1')
  })
})
