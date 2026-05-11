// src/services/qrPaymentService.js
import { supabase } from './supabaseClient'
import { upsertSetting, getSetting } from './settingsService'

const BUCKET = 'qr-codes'

export const uploadQRCode = async (slot, file, adminId) => {
  const path = `gcash-qr-${slot}`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw error
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  const url = `${data.publicUrl}?t=${Date.now()}`
  await upsertSetting(`gcash_qr_${slot}`, { url }, adminId)
  return url
}

export const removeQRCode = async (slot, adminId) => {
  const path = `gcash-qr-${slot}`
  await supabase.storage.from(BUCKET).remove([path]) // Best effort removal
  await upsertSetting(`gcash_qr_${slot}`, { url: null }, adminId)
}

export const getQRCodeUrls = async () => {
  const [qr1, qr2] = await Promise.all([
    getSetting('gcash_qr_1'),
    getSetting('gcash_qr_2'),
  ])
  return {
    qr1: qr1?.url ?? null,
    qr2: qr2?.url ?? null,
  }
}
