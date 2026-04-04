// src/services/dashboardService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from './supabaseClient'
import { getDashboardStats } from './dashboardService'
import { createQueryBuilder } from '../test/mocks/supabaseMock'

beforeEach(() => vi.clearAllMocks())

describe('getDashboardStats', () => {
  it('returns stats object with expected keys', async () => {
    const qb = createQueryBuilder({ data: [], error: null, count: 0 })
    supabase.from.mockReturnValue(qb)
    const stats = await getDashboardStats()
    expect(stats).toHaveProperty('totalBookings')
    expect(stats).toHaveProperty('upcomingBookings')
    expect(stats).toHaveProperty('pendingPayments')
    expect(stats).toHaveProperty('pendingLeaveRequests')
    expect(stats).toHaveProperty('unreadInquiries')
    expect(stats).toHaveProperty('todaysAppointments')
  })
})
