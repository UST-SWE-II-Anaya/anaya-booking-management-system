import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from './supabaseClient'
import {
  getMyAppointments,
  getMyDashboardStats,
  claimAppointment,
} from './staffAppointmentService'
import { createQueryBuilder } from '../test/mocks/supabaseMock'

beforeEach(() => vi.clearAllMocks())

describe('getMyAppointments', () => {
  it('filters bookings by staff_id or null (includes unassigned)', async () => {
    const qb = createQueryBuilder({ data: [], error: null, count: 0 })
    supabase.from.mockReturnValue(qb)
    await getMyAppointments('staff-123', {})
    expect(supabase.from).toHaveBeenCalledWith('bookings')
    expect(qb.or).toHaveBeenCalledWith('staff_id.eq.staff-123,staff_id.is.null')
  })

  it('throws on error', async () => {
    const qb = createQueryBuilder({ data: null, error: new Error('RLS'), count: 0 })
    supabase.from.mockReturnValue(qb)
    await expect(getMyAppointments('staff-123', {})).rejects.toThrow('RLS')
  })
})

describe('getMyDashboardStats', () => {
  it('returns stats with expected keys', async () => {
    const qb = createQueryBuilder({ data: [], error: null, count: 0 })
    supabase.from.mockReturnValue(qb)
    const stats = await getMyDashboardStats('staff-123')
    expect(stats).toHaveProperty('upcomingCount')
    expect(stats).toHaveProperty('todayCount')
    expect(stats).toHaveProperty('todayDurationMinutes')
    expect(stats).toHaveProperty('todaysAppointments')
  })
})

describe('claimAppointment', () => {
  it('updates staff_id on an unassigned booking', async () => {
    const mockUpdate = vi.fn().mockReturnThis()
    const mockEq = vi.fn().mockReturnThis()
    const mockIs = vi.fn().mockReturnThis()
    const mockSelect = vi.fn().mockReturnThis()
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: 'booking-1', staff_id: 'staff-1' },
      error: null,
    })
    supabase.from.mockReturnValue({
      update: mockUpdate,
      eq: mockEq,
      is: mockIs,
      select: mockSelect,
      single: mockSingle,
    })
    mockUpdate.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ is: mockIs })
    mockIs.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ single: mockSingle })

    const result = await claimAppointment('booking-1', 'staff-1')
    expect(mockUpdate).toHaveBeenCalledWith({ staff_id: 'staff-1' })
    expect(result).toEqual({ id: 'booking-1', staff_id: 'staff-1' })
  })
})
