// src/test/services/paymentService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createQueryBuilder } from '../mocks/supabaseMock'

vi.mock('../../services/supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

vi.mock('../../services/auditService', () => ({
  logAction: vi.fn(),
}))

import { supabase } from '../../services/supabaseClient'
import { logAction } from '../../services/auditService'
import { verifyAndAssignPayment } from '../../services/paymentService'

describe('verifyAndAssignPayment', () => {
  const prevPayment = { status: 'paid', reference_number: 'GC-001' }
  const updatedBooking = { id: 'booking-1', downpayment_status: 'verified', staff_id: 'staff-1' }

  const setupMocks = (bookingResult = { data: updatedBooking, error: null }) => {
    supabase.from
      .mockReturnValueOnce(createQueryBuilder({ data: prevPayment, error: null }))
      .mockReturnValueOnce(createQueryBuilder({ data: null, error: null }))
      .mockReturnValueOnce(createQueryBuilder(bookingResult))
  }

  beforeEach(() => vi.clearAllMocks())

  it('updates the booking with verified status and the assigned staff_id', async () => {
    setupMocks()
    const result = await verifyAndAssignPayment('pay-1', 'booking-1', 'staff-1', 'admin-1')
    expect(result).toEqual(updatedBooking)
    const bookingUpdateBuilder = supabase.from.mock.results[2].value
    expect(bookingUpdateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ downpayment_status: 'verified', staff_id: 'staff-1' })
    )
  })

  it('sets verified_by and verified_at on the payment record', async () => {
    setupMocks()
    await verifyAndAssignPayment('pay-1', 'booking-1', 'staff-1', 'admin-1')
    const paymentUpdateBuilder = supabase.from.mock.results[1].value
    expect(paymentUpdateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'verified', verified_by: 'admin-1' })
    )
  })

  it('logs the action with type payment.verified_and_assigned', async () => {
    setupMocks()
    await verifyAndAssignPayment('pay-1', 'booking-1', 'staff-1', 'admin-1')
    expect(logAction).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: 'payment.verified_and_assigned' })
    )
  })

  it('throws when the payment update fails and does not update the booking', async () => {
    supabase.from
      .mockReturnValueOnce(createQueryBuilder({ data: prevPayment, error: null }))
      .mockReturnValueOnce(createQueryBuilder({ data: null, error: new Error('DB write error') }))

    await expect(
      verifyAndAssignPayment('pay-err', 'booking-err', 'staff-1', 'admin-1')
    ).rejects.toThrow('DB write error')

    expect(supabase.from).toHaveBeenCalledTimes(2)
  })
})
