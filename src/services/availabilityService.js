import { supabase } from './supabaseClient'

export const getAvailableSlots = async (staffId, date, preference) => {
  const { data, error } = await supabase.rpc('get_available_slots', {
    p_staff_id: staffId,
    p_date: date,
    p_preference: preference,
  })
  if (error) throw error
  return data
}
