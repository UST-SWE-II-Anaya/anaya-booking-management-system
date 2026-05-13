// src/services/customerService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from './supabaseClient'
import { updateAccountStatus } from './customerService'
import { createQueryBuilder } from '../test/mocks/supabaseMock'

beforeEach(() => vi.clearAllMocks())

describe('updateAccountStatus', () => {
  it('writes deactivation_reason when suspending', async () => {
    const qb = createQueryBuilder({
      data: { id: 'u1', account_status: 'suspended', deactivation_reason: 'No-shows' },
      error: null,
    })
    supabase.from.mockReturnValue(qb)
    const result = await updateAccountStatus('u1', 'suspended', 'No-shows')
    expect(result.account_status).toBe('suspended')
    expect(qb.update).toHaveBeenCalledWith(
      expect.objectContaining({
        account_status: 'suspended',
        deactivation_reason: 'No-shows',
      })
    )
  })

  it('clears deactivation_reason when reactivating', async () => {
    const qb = createQueryBuilder({
      data: { id: 'u1', account_status: 'active', deactivation_reason: null },
      error: null,
    })
    supabase.from.mockReturnValue(qb)
    await updateAccountStatus('u1', 'active')
    expect(qb.update).toHaveBeenCalledWith(
      expect.objectContaining({
        account_status: 'active',
        deactivation_reason: null,
      })
    )
  })
})
