import { supabase } from './supabaseClient'

export const getMyProfile = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, phone_number, date_of_birth, gender, avatar_url')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data
}

export const updateMyProfile = async (userId, payload) => {
  const { error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', userId)
  if (error) throw error
}

export const uploadAvatar = async (file, userId) => {
  const ext = file.name.split('.').pop()
  const path = `${userId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file)
  if (error) {
    console.error('Avatar upload error:', error)
    throw error
  }
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}
