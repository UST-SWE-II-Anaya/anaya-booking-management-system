// src/services/authService.js
import { supabase } from './supabaseClient'

export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw error
  return data
}

/**
 * Registers a new customer account.
 * Metadata is stored in auth.users.raw_user_meta_data and consumed by
 * the handle_new_user DB trigger to populate public.profiles automatically.
 * @param {string} email
 * @param {string} password
 * @param {{ first_name: string, last_name: string, phone_number?: string, date_of_birth?: string }} metadata
 */
export const signUp = async (email, password, metadata = {}) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: metadata.first_name ?? '',
        last_name: metadata.last_name ?? '',
        phone_number: metadata.phone_number ?? '',
        date_of_birth: metadata.date_of_birth ?? '',
        role: 'customer',
      },
    },
  })
  if (error) throw error
  return data
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export const getSession = async () => {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

export const getProfile = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data
}

export const updateProfile = async (userId, updates) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}
