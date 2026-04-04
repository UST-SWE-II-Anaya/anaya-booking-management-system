// src/services/authService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
    },
    from: vi.fn(),
  },
}))

import { supabase } from './supabaseClient'
import {
  signIn,
  getProfile,
} from './authService'
import { createQueryBuilder } from '../test/mocks/supabaseMock'

beforeEach(() => vi.clearAllMocks())

describe('signIn', () => {
  it('returns data on success', async () => {
    const mockData = { user: { id: 'abc' }, session: {} }
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: mockData,
      error: null,
    })
    const result = await signIn('a@b.com', 'pass')
    expect(result).toEqual(mockData)
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'pass',
    })
  })

  it('throws on error', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: null,
      error: new Error('Invalid credentials'),
    })
    await expect(signIn('a@b.com', 'wrong')).rejects.toThrow('Invalid credentials')
  })
})

describe('getProfile', () => {
  it('returns profile data', async () => {
    const profile = { id: 'abc', role: 'admin', first_name: 'Ana' }
    const qb = createQueryBuilder({ data: profile, error: null })
    supabase.from.mockReturnValue(qb)
    const result = await getProfile('abc')
    expect(result).toEqual(profile)
    expect(supabase.from).toHaveBeenCalledWith('profiles')
    expect(qb.eq).toHaveBeenCalledWith('id', 'abc')
  })

  it('throws on error', async () => {
    const qb = createQueryBuilder({ data: null, error: new Error('Not found') })
    supabase.from.mockReturnValue(qb)
    await expect(getProfile('abc')).rejects.toThrow('Not found')
  })
})
