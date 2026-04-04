// src/services/paymentService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from './supabaseClient'
import { verifyPayment, denyPayment } from './paymentService'
import { createQueryBuilder } from '../test/mocks/supabaseMock'

beforeEach(() => vi.clearAllMocks())

describe('verifyPayment', () => {
  it('updates payment status to verified and booking status to paid', async () => {
    const qb = createQueryBuilder({ data: { id: 'p1' }, error: null })
    supabase.from.mockReturnValue(qb)
    await verifyPayment('p1', 'b1', 'admin-id')
    expect(supabase.from).toHaveBeenCalledWith('payments')
  })
})

describe('denyPayment', () => {
  it('updates payment status to denied', async () => {
    const qb = createQueryBuilder({ data: { id: 'p1' }, error: null })
    supabase.from.mockReturnValue(qb)
    await denyPayment('p1', 'b1')
    expect(supabase.from).toHaveBeenCalledWith('payments')
  })
})
