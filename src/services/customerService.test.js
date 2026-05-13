// src/services/customerService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabaseClient', () => ({
  supabase: { from: vi.fn(), functions: { invoke: vi.fn() } },
}))

import { supabase } from './supabaseClient'
import { updateAccountStatus, banCustomer } from './customerService'
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

describe('banCustomer', () => {
  it('invokes ban-user edge function with customer role', async () => {
    const mockInvoke = vi.fn().mockResolvedValue({ data: { success: true }, error: null })
    vi.mocked(supabase.functions).invoke = mockInvoke
    await banCustomer('user-123', 'Spam')
    expect(mockInvoke).toHaveBeenCalledWith('ban-user', {
      body: { userId: 'user-123', reason: 'Spam', role: 'customer' },
    })
  })

  it('throws when edge function returns error', async () => {
    const mockResponse = new Response(
      JSON.stringify({ error: 'Forbidden' }),
      { status: 403 }
    )
    const mockInvoke = vi.fn().mockResolvedValue({
      data: null,
      error: Object.assign(
        new Error('Edge Function returned a non-2xx status code'),
        { context: mockResponse }
      ),
    })
    vi.mocked(supabase.functions).invoke = mockInvoke
    await expect(banCustomer('user-123', 'Spam')).rejects.toThrow()
  })
})
