// src/test/services/staffService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createQueryBuilder } from '../mocks/supabaseMock'

vi.mock('../../services/supabaseClient', () => ({
  supabase: { from: vi.fn() },
}))

vi.mock('../../services/auditService', () => ({ logAction: vi.fn() }))
vi.mock('../../store/authStore', () => ({ default: { getState: vi.fn(() => ({ profile: null })) } }))

import { supabase } from '../../services/supabaseClient'
import { getAssignableStaff } from '../../services/staffService'

const activeStaff = [
  { id: '1', first_name: 'Ana', last_name: 'Cruz', gender: 'female', staff_details: { is_active: true, job_title: 'Therapist' } },
  { id: '2', first_name: 'Ben', last_name: 'Lee', gender: 'male', staff_details: { is_active: true, job_title: 'Stylist' } },
]

describe('getAssignableStaff', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns all active staff when preference is "any"', async () => {
    supabase.from.mockReturnValue(createQueryBuilder({ data: activeStaff, error: null }))
    const result = await getAssignableStaff('any')
    expect(result).toHaveLength(2)
  })

  it('does not apply a gender filter when preference is "any"', async () => {
    supabase.from.mockReturnValue(createQueryBuilder({ data: activeStaff, error: null }))
    await getAssignableStaff('any')
    const builder = supabase.from.mock.results[0].value
    expect(builder.eq).not.toHaveBeenCalledWith('gender', expect.anything())
  })

  it('filters by gender female when preference is "any_female"', async () => {
    supabase.from.mockReturnValue(createQueryBuilder({ data: [activeStaff[0]], error: null }))
    await getAssignableStaff('any_female')
    const builder = supabase.from.mock.results[0].value
    expect(builder.eq).toHaveBeenCalledWith('gender', 'female')
  })

  it('filters by gender male when preference is "any_male"', async () => {
    supabase.from.mockReturnValue(createQueryBuilder({ data: [activeStaff[1]], error: null }))
    await getAssignableStaff('any_male')
    const builder = supabase.from.mock.results[0].value
    expect(builder.eq).toHaveBeenCalledWith('gender', 'male')
  })

  it('excludes staff where staff_details.is_active is false', async () => {
    const mixedStaff = [
      { ...activeStaff[0] },
      { id: '3', first_name: 'Cam', last_name: 'Park', gender: 'female', staff_details: { is_active: false, job_title: 'Stylist' } },
    ]
    supabase.from.mockReturnValue(createQueryBuilder({ data: mixedStaff, error: null }))
    const result = await getAssignableStaff('any')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  it('throws when supabase returns an error', async () => {
    supabase.from.mockReturnValue(createQueryBuilder({ data: null, error: new Error('Network error') }))
    await expect(getAssignableStaff('any')).rejects.toThrow('Network error')
  })
})
