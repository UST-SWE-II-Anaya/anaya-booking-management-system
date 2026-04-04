// src/services/staffService.js
import { supabase } from './supabaseClient'

export const getStaff = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, reference_id, first_name, last_name, email, phone_number, avatar_url, created_at')
    .eq('role', 'staff')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export const deactivateStaff = async (id) => {
  const { data, error } = await supabase
    .from('staff_details')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}
