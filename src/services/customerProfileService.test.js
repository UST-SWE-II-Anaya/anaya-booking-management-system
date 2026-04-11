import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createQueryBuilder } from '../test/mocks/supabaseMock'

vi.mock('./supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    storage: { from: vi.fn() },
  },
}))

import { supabase } from './supabaseClient'
import { getMyProfile, updateMyProfile, uploadAvatar } from './customerProfileService'

describe('getMyProfile', () => {
  it('fetches profile by userId', async () => {
    const data = { id: 'u1', first_name: 'Ana', last_name: 'Santos' }
    supabase.from.mockReturnValue(createQueryBuilder({ data, error: null }))
    const res = await getMyProfile('u1')
    expect(res).toEqual(data)
  })

  it('throws on error', async () => {
    supabase.from.mockReturnValue(
      createQueryBuilder({ data: null, error: new Error('DB error') })
    )
    await expect(getMyProfile('u1')).rejects.toThrow('DB error')
  })
})

describe('updateMyProfile', () => {
  it('calls update on profiles table', async () => {
    supabase.from.mockReturnValue(createQueryBuilder({ data: null, error: null }))
    await updateMyProfile('u1', { first_name: 'Ana' })
    expect(supabase.from).toHaveBeenCalledWith('profiles')
  })
})

describe('uploadAvatar', () => {
  it('uploads file and returns public URL', async () => {
    const mockFile = new File(['img'], 'photo.jpg', { type: 'image/jpeg' })
    const storageMock = {
      upload: vi.fn().mockResolvedValue({ error: null }),
      getPublicUrl: vi.fn().mockReturnValue({
        data: { publicUrl: 'https://cdn.example.com/avatars/u1/photo.jpg' },
      }),
    }
    supabase.storage.from.mockReturnValue(storageMock)
    const url = await uploadAvatar(mockFile, 'u1')
    expect(storageMock.upload).toHaveBeenCalled()
    expect(url).toBe('https://cdn.example.com/avatars/u1/photo.jpg')
  })
})
