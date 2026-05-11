// src/services/qrPaymentService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    storage: { from: vi.fn() },
  },
}))

vi.mock('./settingsService', () => ({
  upsertSetting: vi.fn().mockResolvedValue({}),
  getSetting: vi.fn(),
}))

import { supabase } from './supabaseClient'
import { upsertSetting, getSetting } from './settingsService'
import { uploadQRCode, removeQRCode, getQRCodeUrls } from './qrPaymentService'

beforeEach(() => vi.clearAllMocks())

describe('uploadQRCode', () => {
  it('uploads file to storage and saves URL to settings', async () => {
    const mockFile = new File(['img'], 'qr.png', { type: 'image/png' })
    const storageMock = {
      upload: vi.fn().mockResolvedValue({ error: null }),
      getPublicUrl: vi.fn().mockReturnValue({
        data: { publicUrl: 'https://cdn.example.com/qr-codes/gcash-qr-1' },
      }),
    }
    supabase.storage.from.mockReturnValue(storageMock)

    const url = await uploadQRCode(1, mockFile, 'admin-id')

    expect(supabase.storage.from).toHaveBeenCalledWith('qr-codes')
    expect(storageMock.upload).toHaveBeenCalledWith(
      'gcash-qr-1',
      mockFile,
      { upsert: true, contentType: 'image/png' }
    )
    expect(upsertSetting).toHaveBeenCalledWith(
      'gcash_qr_1',
      expect.objectContaining({ url: expect.stringContaining('gcash-qr-1') }),
      'admin-id'
    )
    expect(url).toContain('gcash-qr-1')
  })

  it('throws when storage upload fails', async () => {
    supabase.storage.from.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: new Error('storage error') }),
    })
    await expect(uploadQRCode(1, new File([''], 'q.png', { type: 'image/png' }), 'admin-id'))
      .rejects.toThrow('storage error')
  })
})

describe('removeQRCode', () => {
  it('removes file from storage and nullifies the setting', async () => {
    const storageMock = {
      remove: vi.fn().mockResolvedValue({ error: null }),
    }
    supabase.storage.from.mockReturnValue(storageMock)

    await removeQRCode(2, 'admin-id')

    expect(storageMock.remove).toHaveBeenCalledWith(['gcash-qr-2'])
    expect(upsertSetting).toHaveBeenCalledWith('gcash_qr_2', { url: null }, 'admin-id')
  })

  it('nullifies setting even if storage remove fails', async () => {
    const storageMock = {
      remove: vi.fn().mockResolvedValue({ error: new Error('remove failed') }),
    }
    supabase.storage.from.mockReturnValue(storageMock)

    await removeQRCode(1, 'admin-id')

    expect(storageMock.remove).toHaveBeenCalledWith(['gcash-qr-1'])
    expect(upsertSetting).toHaveBeenCalledWith('gcash_qr_1', { url: null }, 'admin-id')
  })
})

describe('getQRCodeUrls', () => {
  it('returns urls for both slots', async () => {
    getSetting
      .mockResolvedValueOnce({ url: 'https://cdn.example.com/gcash-qr-1' })
      .mockResolvedValueOnce({ url: 'https://cdn.example.com/gcash-qr-2' })

    const result = await getQRCodeUrls()

    expect(getSetting).toHaveBeenCalledWith('gcash_qr_1')
    expect(getSetting).toHaveBeenCalledWith('gcash_qr_2')
    expect(result).toEqual({
      qr1: 'https://cdn.example.com/gcash-qr-1',
      qr2: 'https://cdn.example.com/gcash-qr-2',
    })
  })

  it('returns null for slots with no setting', async () => {
    getSetting.mockResolvedValue(null)
    const result = await getQRCodeUrls()
    expect(result).toEqual({ qr1: null, qr2: null })
  })
})
