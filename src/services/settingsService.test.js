// src/services/settingsService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from './supabaseClient'
import { getSetting, upsertSetting } from './settingsService'
import { createQueryBuilder } from '../test/mocks/supabaseMock'

beforeEach(() => vi.clearAllMocks())

describe('getSetting', () => {
  it('queries site_settings by key', async () => {
    const qb = createQueryBuilder({
      data: { key: 'operating_hours', value: { start: '09:00' } },
      error: null,
    })
    supabase.from.mockReturnValue(qb)
    const result = await getSetting('operating_hours')
    expect(result).toEqual({ start: '09:00' })
    expect(supabase.from).toHaveBeenCalledWith('site_settings')
    expect(qb.eq).toHaveBeenCalledWith('key', 'operating_hours')
  })

  it('returns null when setting not found', async () => {
    const qb = createQueryBuilder({ data: null, error: null })
    supabase.from.mockReturnValue(qb)
    const result = await getSetting('missing_key')
    expect(result).toBeNull()
  })
})
