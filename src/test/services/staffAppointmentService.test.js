// src/test/services/staffAppointmentService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createQueryBuilder } from '../mocks/supabaseMock'

vi.mock('../../services/supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from '../../services/supabaseClient'
import { getMyAppointments } from '../../services/staffAppointmentService'

describe('getMyAppointments', () => {
  beforeEach(() => vi.clearAllMocks())

  it('filters by staff_id using eq, not or', async () => {
    supabase.from.mockReturnValue(
      createQueryBuilder({ data: [], error: null, count: 0 })
    )
    await getMyAppointments('staff-1')
    const builder = supabase.from.mock.results[0].value
    expect(builder.eq).toHaveBeenCalledWith('staff_id', 'staff-1')
    expect(builder.or).not.toHaveBeenCalled()
  })

  it('returns data and count from the query', async () => {
    const mockBookings = [{ id: 'b1', booking_status: 'upcoming' }]
    supabase.from.mockReturnValue(
      createQueryBuilder({ data: mockBookings, error: null, count: 1 })
    )
    const { data, count } = await getMyAppointments('staff-1')
    expect(data).toHaveLength(1)
    expect(count).toBe(1)
  })
})
