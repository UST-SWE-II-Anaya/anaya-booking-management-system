// src/services/staffService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    functions: { invoke: vi.fn() },
  },
}))

import { supabase } from './supabaseClient'
import { getStaff, deactivateStaff, activateStaff, getStaffList, inviteUser, banStaff } from './staffService'
import { createQueryBuilder } from '../test/mocks/supabaseMock'

beforeEach(() => vi.clearAllMocks())

describe('getStaff', () => {
  it('queries profiles with role in [staff, admin]', async () => {
    const qb = createQueryBuilder({ data: [], error: null })
    supabase.from.mockReturnValue(qb)
    await getStaff()
    expect(supabase.from).toHaveBeenCalledWith('profiles')
    expect(qb.in).toHaveBeenCalledWith('role', ['staff', 'admin'])
  })
})

describe('deactivateStaff', () => {
  it('sets account_status to suspended and stores reason', async () => {
    const qb = createQueryBuilder({
      data: { id: 's1', account_status: 'suspended', deactivation_reason: 'Contract ended' },
      error: null,
    })
    supabase.from.mockReturnValue(qb)
    const result = await deactivateStaff('s1', 'Contract ended')
    expect(result.account_status).toBe('suspended')
    expect(qb.update).toHaveBeenCalledWith(
      expect.objectContaining({
        account_status: 'suspended',
        deactivation_reason: 'Contract ended',
      })
    )
  })
})

describe('activateStaff', () => {
  it('sets account_status to active and clears deactivation_reason', async () => {
    const qb = createQueryBuilder({
      data: { id: 's1', account_status: 'active', deactivation_reason: null },
      error: null,
    })
    supabase.from.mockReturnValue(qb)
    await activateStaff('s1')
    expect(qb.update).toHaveBeenCalledWith(
      expect.objectContaining({
        account_status: 'active',
        deactivation_reason: null,
      })
    )
  })
})

describe('getStaffList', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls get_staff_list RPC and returns data', async () => {
    const data = [{ id: 's1', first_name: 'Maria', last_name: 'Cruz', avatar_url: null }]
    supabase.rpc.mockResolvedValue({ data, error: null })
    const result = await getStaffList()
    expect(supabase.rpc).toHaveBeenCalledWith('get_staff_list')
    expect(result).toEqual(data)
  })

  it('throws on RPC error', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: new Error('RPC error') })
    await expect(getStaffList()).rejects.toThrow('RPC error')
  })
})

describe('inviteUser', () => {
  it('invokes the invite-user edge function with mapped payload', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: { success: true }, error: null })
    const result = await inviteUser({
      firstName: 'Maria',
      lastName: 'Cruz',
      email: 'maria@example.com',
      phone: '09171234567',
      role: 'staff',
    })
    expect(supabase.functions.invoke).toHaveBeenCalledWith('invite-user', {
      body: {
        first_name: 'Maria',
        last_name: 'Cruz',
        email: 'maria@example.com',
        phone_number: '09171234567',
        role: 'staff',
      },
    })
    expect(result).toEqual({ success: true })
  })

  it('extracts the error message from a FunctionsHttpError context response', async () => {
    const mockResponse = new Response(
      JSON.stringify({ error: 'An account with this email already exists' }),
      { status: 400 }
    )
    supabase.functions.invoke.mockResolvedValue({
      data: null,
      error: Object.assign(
        new Error('Edge Function returned a non-2xx status code'),
        { context: mockResponse }
      ),
    })
    await expect(
      inviteUser({ firstName: 'A', lastName: 'B', email: 'a@b.com', phone: '', role: 'staff' })
    ).rejects.toThrow('An account with this email already exists')
  })
})

describe('banStaff', () => {
  it('invokes ban-user edge function with staff role', async () => {
    const mockInvoke = vi.fn().mockResolvedValue({ data: { success: true }, error: null })
    vi.mocked(supabase.functions).invoke = mockInvoke
    await banStaff('staff-456', 'Policy violation')
    expect(mockInvoke).toHaveBeenCalledWith('ban-user', {
      body: { userId: 'staff-456', reason: 'Policy violation', role: 'staff' },
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
    await expect(banStaff('staff-456', 'Policy violation')).rejects.toThrow()
  })
})
