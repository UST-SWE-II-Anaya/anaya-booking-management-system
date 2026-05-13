// src/services/bookingService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from './supabaseClient'
import {
  getBookings,
  updateBookingStatus,
  exportBookings,
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
    const qb = createQueryBuilder({
      data: { id: '1', booking_status: 'finished' },
      error: null
    })
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

describe('exportBookings', () => {
  it('queries the bookings table and returns data array', async () => {
    const rows = [{ id: '1', reference_id: 'AN-XXXX' }]
    const qb = createQueryBuilder({ data: rows, error: null })
    supabase.from.mockReturnValue(qb)
    const result = await exportBookings({})
    expect(supabase.from).toHaveBeenCalledWith('bookings')
    expect(result).toEqual(rows)
  })

  it('applies status filter when provided', async () => {
    const qb = createQueryBuilder({ data: [], error: null })
    supabase.from.mockReturnValue(qb)
    await exportBookings({ status: 'finished' })
    expect(qb.eq).toHaveBeenCalledWith('booking_status', 'finished')
  })

  it('does not apply status filter when omitted', async () => {
    const qb = createQueryBuilder({ data: [], error: null })
    supabase.from.mockReturnValue(qb)
    await exportBookings({})
    expect(qb.eq).not.toHaveBeenCalledWith('booking_status', expect.anything())
  })

  it('applies search filter when provided', async () => {
    const qb = createQueryBuilder({ data: [], error: null })
    supabase.from.mockReturnValue(qb)
    await exportBookings({ search: 'AN-123' })
    expect(qb.ilike).toHaveBeenCalledWith('reference_id', '%AN-123%')
  })

  it('applies dateFrom filter when provided', async () => {
    const qb = createQueryBuilder({ data: [], error: null })
    supabase.from.mockReturnValue(qb)
    await exportBookings({ dateFrom: '2026-05-01' })
    expect(qb.gte).toHaveBeenCalledWith('appointment_date', '2026-05-01')
  })

  it('applies dateTo filter when provided', async () => {
    const qb = createQueryBuilder({ data: [], error: null })
    supabase.from.mockReturnValue(qb)
    await exportBookings({ dateTo: '2026-05-31' })
    expect(qb.lte).toHaveBeenCalledWith('appointment_date', '2026-05-31')
  })

  it('does not call .range() — fetches all rows', async () => {
    const qb = createQueryBuilder({ data: [], error: null })
    supabase.from.mockReturnValue(qb)
    await exportBookings({})
    expect(qb.range).not.toHaveBeenCalled()
  })

  it('throws on error', async () => {
    const qb = createQueryBuilder({
      data: null,
      error: new Error('RLS denied')
    })
    supabase.from.mockReturnValue(qb)
    await expect(exportBookings({})).rejects.toThrow('RLS denied')
  })
})
