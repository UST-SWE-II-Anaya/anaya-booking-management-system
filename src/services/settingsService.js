// src/services/settingsService.js
import { supabase } from './supabaseClient'

/**
 * Keys used in site_settings:
 *   operating_hours        → { start: "09:00", end: "19:30" }
 *   downpayment_rate       → { percentage: 10 }
 *   cancellation_window    → { hours: 12 }
 *   payment_deadline_hours → { hours: 12 }
 *   slot_duration          → { minutes: 30 }
 *   contact_info           → { phone, email, address }
 */

export const getSetting = async (key) => {
  const { data, error } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle()
  if (error) throw error
  return data?.value ?? null
}

export const getAllSettings = async () => {
  const { data, error } = await supabase
    .from('site_settings')
    .select('key, value')
  if (error) throw error
  return Object.fromEntries((data ?? []).map((r) => [r.key, r.value]))
}

export const upsertSetting = async (key, value, updatedBy) => {
  const { data, error } = await supabase
    .from('site_settings')
    .upsert(
      {
        key,
        value,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    )
    .select()
    .single()
  if (error) throw error
  return data
}
