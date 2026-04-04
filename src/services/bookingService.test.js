// src/services/bookingService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from './supabaseClient'
import {
  getBookings,
  updateBookingStatus,
} from './bookingService'
import { createQueryBuilder } from '../test/mocks/supabaseMock'

beforeEach(() => vi.clearAllMocks())

describe('getBookings', () => {
  it('queries the bookings table', async () => {
    const qb = createQueryBuilder({ data: [], error: null })
    supabase.from.mockReturnValue(qb)
    await getBookings({})
    expect(supabase.from).toHaveBeenCalledWith('bookings')
  })
})

describe('updateBookingStatus', () => {
  it('updates booking_status', async () => {
    const qb = createQueryBuilder({ data: { id: '1', booking_status: 'finished' }, error: null })
    supabase.from.mockReturnValue(qb)
    const result = await updateBookingStatus('1', 'finished')
    expect(result.booking_status).toBe('finished')
    expect(qb.update).toHaveBeenCalledWith(
      expect.objectContaining({ booking_status: 'finished' })
    )
  })

  it('throws on error', async () => {
    const qb = createQueryBuilder({ data: null, error: new Error('RLS error') })
    supabase.from.mockReturnValue(qb)
    await expect(updateBookingStatus('1', 'finished')).rejects.toThrow('RLS error')
  })
})
