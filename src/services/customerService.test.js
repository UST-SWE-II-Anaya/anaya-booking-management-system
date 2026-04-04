// src/services/customerService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from './supabaseClient'
import {
  getCustomers,
  getCustomerById,
  updateAccountStatus,
} from './customerService'
import { createQueryBuilder } from '../test/mocks/supabaseMock'

beforeEach(() => vi.clearAllMocks())

describe('updateAccountStatus', () => {
  it('updates account_status', async () => {
    const qb = createQueryBuilder({
      data: { id: 'u1', account_status: 'suspended' },
      error: null,
    })
    supabase.from.mockReturnValue(qb)
    const result = await updateAccountStatus('u1', 'suspended')
    expect(result.account_status).toBe('suspended')
    expect(qb.update).toHaveBeenCalledWith(
      expect.objectContaining({ account_status: 'suspended' })
    )
  })
})
