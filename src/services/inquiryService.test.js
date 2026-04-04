// src/services/inquiryService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from './supabaseClient'
import { getInquiries, markRead, archiveInquiry } from './inquiryService'
import { createQueryBuilder } from '../test/mocks/supabaseMock'

beforeEach(() => vi.clearAllMocks())

describe('markRead', () => {
  it('updates inquiry status to read', async () => {
    const qb = createQueryBuilder({ data: { id: 'i1', status: 'read' }, error: null })
    supabase.from.mockReturnValue(qb)
    await markRead('i1')
    expect(qb.update).toHaveBeenCalledWith({ status: 'read' })
    expect(qb.eq).toHaveBeenCalledWith('id', 'i1')
  })
})
