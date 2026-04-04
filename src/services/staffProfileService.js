import { supabase } from './supabaseClient'

export const getMyFullProfile = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id, first_name, last_name, email, phone_number, avatar_url,
      staff_details(job_title, contact_number, social_media_links)
    `)
    .eq('id', userId)
    .single()
  if (error) throw error
  return data
}

export const updateMyProfile = async (userId, updates) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}

export const updateMyStaffDetails = async (userId, updates) => {
  const { data, error } = await supabase
    .from('staff_details')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}

export const updateMyPassword = async (newPassword) => {
  if (!newPassword || newPassword.length < 8) {
    throw new Error('Password must be at least 8 characters')
  }
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}
