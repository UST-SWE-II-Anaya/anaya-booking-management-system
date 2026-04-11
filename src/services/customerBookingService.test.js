import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createQueryBuilder } from '../test/mocks/supabaseMock'

vi.mock('./supabaseClient', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}))

import { supabase } from './supabaseClient'
import {
  createBooking,
  getMyBookings,
  getMyPastBookings,
  getMyBookingById,
  cancelMyBooking,
} from './customerBookingService'

describe('createBooking', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls create_booking RPC and returns data', async () => {
    const payload = { appointment_date: '2026-04-20', start_time: '10:00', services: [] }
    const result = { id: 'b1', reference_id: 'BK000001' }
    supabase.rpc.mockResolvedValue({ data: result, error: null })
    const res = await createBooking(payload)
    expect(supabase.rpc).toHaveBeenCalledWith('create_booking', { payload })
    expect(res).toEqual(result)
  })

  it('throws SLOT_UNAVAILABLE when RPC returns that error', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'SLOT_UNAVAILABLE' } })
    await expect(createBooking({})).rejects.toThrow('SLOT_UNAVAILABLE')
  })
})

describe('getMyBookings', () => {
  it('fetches upcoming bookings for a user', async () => {
    const data = [{ id: 'b1', booking_status: 'upcoming' }]
    supabase.from.mockReturnValue(createQueryBuilder({ data, error: null }))
    const res = await getMyBookings('user-1')
    expect(res).toEqual(data)
  })
})

describe('getMyPastBookings', () => {
  it('fetches past bookings for a user', async () => {
    const data = [{ id: 'b2', booking_status: 'finished' }]
    supabase.from.mockReturnValue(createQueryBuilder({ data, error: null }))
    const res = await getMyPastBookings('user-1')
    expect(res).toEqual(data)
  })
})

describe('getMyBookingById', () => {
  it('fetches a single booking by id', async () => {
    const data = { id: 'b1', reference_id: 'BK000001' }
    supabase.from.mockReturnValue(createQueryBuilder({ data, error: null }))
    const res = await getMyBookingById('b1')
    expect(res).toEqual(data)
  })
})

describe('cancelMyBooking', () => {
  it('updates booking_status to cancelled', async () => {
    supabase.from.mockReturnValue(createQueryBuilder({ data: null, error: null }))
    await cancelMyBooking('b1', 'user-1')
    expect(supabase.from).toHaveBeenCalledWith('bookings')
  })

  it('throws on error', async () => {
    supabase.from.mockReturnValue(
      createQueryBuilder({ data: null, error: new Error('DB error') })
    )
    await expect(cancelMyBooking('b1', 'user-1')).rejects.toThrow('DB error')
  })
})
