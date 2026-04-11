// src/services/staffService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabaseClient', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}))

import { supabase } from './supabaseClient'
import { getStaff, deactivateStaff, getStaffList } from './staffService'
import { createQueryBuilder } from '../test/mocks/supabaseMock'

beforeEach(() => vi.clearAllMocks())

describe('getStaff', () => {
  it('queries profiles with role=staff', async () => {
    const qb = createQueryBuilder({ data: [], error: null })
    supabase.from.mockReturnValue(qb)
    await getStaff()
    expect(supabase.from).toHaveBeenCalledWith('profiles')
    expect(qb.eq).toHaveBeenCalledWith('role', 'staff')
  })
})

describe('deactivateStaff', () => {
  it('sets is_active to false in staff_details', async () => {
    const qb = createQueryBuilder({ data: { id: 's1', is_active: false }, error: null })
    supabase.from.mockReturnValue(qb)
    const result = await deactivateStaff('s1')
    expect(result.is_active).toBe(false)
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
