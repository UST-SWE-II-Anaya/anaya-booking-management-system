// src/services/servicesCmsService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from './supabaseClient'
import { getCategories, deleteCategory, getAllActiveServices } from './servicesCmsService'
import { createQueryBuilder } from '../test/mocks/supabaseMock'

beforeEach(() => vi.clearAllMocks())

describe('getCategories', () => {
  it('queries service_categories table ordered by display_order', async () => {
    const qb = createQueryBuilder({ data: [], error: null })
    supabase.from.mockReturnValue(qb)
    await getCategories()
    expect(supabase.from).toHaveBeenCalledWith('service_categories')
    expect(qb.order).toHaveBeenCalledWith('display_order')
  })
})

describe('deleteCategory', () => {
  it('calls delete on service_categories', async () => {
    const qb = createQueryBuilder({ error: null })
    supabase.from.mockReturnValue(qb)
    await deleteCategory('cat-id')
    expect(supabase.from).toHaveBeenCalledWith('service_categories')
    expect(qb.delete).toHaveBeenCalled()
    expect(qb.eq).toHaveBeenCalledWith('id', 'cat-id')
  })
})

describe('getAllActiveServices', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns services mapped with category_name', async () => {
    const raw = [
      {
        id: '1',
        name: 'Manicure',
        duration_minutes: 60,
        price: 350,
        service_categories: { name: 'Nails' },
      },
    ]
    supabase.from.mockReturnValue(createQueryBuilder({ data: raw, error: null }))
    const result = await getAllActiveServices()
    expect(result).toEqual([
      { id: '1', name: 'Manicure', category_name: 'Nails', duration_minutes: 60, price: 350 },
    ])
  })

  it('throws on Supabase error', async () => {
    supabase.from.mockReturnValue(
      createQueryBuilder({ data: null, error: new Error('DB error') })
    )
    await expect(getAllActiveServices()).rejects.toThrow('DB error')
  })
})
