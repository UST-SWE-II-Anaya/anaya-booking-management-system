import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    auth: { updateUser: vi.fn() },
  },
}))

import { supabase } from './supabaseClient'
import {
  updateMyProfile,
  updateMyStaffDetails,
  updateMyPassword,
  getMyFullProfile,
} from './staffProfileService'
import { createQueryBuilder } from '../test/mocks/supabaseMock'

beforeEach(() => vi.clearAllMocks())

describe('updateMyProfile', () => {
  it('updates the profiles table', async () => {
    const qb = createQueryBuilder({
      data: { id: 'u1', first_name: 'Ana' },
      error: null,
    })
    supabase.from.mockReturnValue(qb)
    const result = await updateMyProfile('u1', { first_name: 'Ana' })
    expect(result.first_name).toBe('Ana')
    expect(supabase.from).toHaveBeenCalledWith('profiles')
    expect(qb.update).toHaveBeenCalledWith(
      expect.objectContaining({ first_name: 'Ana' })
    )
  })
})

describe('updateMyPassword', () => {
  it('calls supabase.auth.updateUser with new password', async () => {
    supabase.auth.updateUser.mockResolvedValue({ data: {}, error: null })
    await updateMyPassword('newpass123')
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'newpass123' })
  })

  it('throws when password is too short', async () => {
    await expect(updateMyPassword('abc')).rejects.toThrow(
      'Password must be at least 8 characters'
    )
  })

  it('throws on supabase error', async () => {
    supabase.auth.updateUser.mockResolvedValue({
      data: null,
      error: new Error('Auth error'),
    })
    await expect(updateMyPassword('validpass123')).rejects.toThrow('Auth error')
  })
})
