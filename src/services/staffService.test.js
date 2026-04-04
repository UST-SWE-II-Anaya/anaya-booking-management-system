// src/services/staffService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from './supabaseClient'
import { getStaff, deactivateStaff } from './staffService'
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
