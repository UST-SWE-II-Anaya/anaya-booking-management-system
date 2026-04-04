import { supabase } from './supabaseClient'

/**
 * @param {string} staffId
 * @param {{
 *   leave_type: 'vacation' | 'sick' | 'emergency' | 'other',
 *   start_date: string,  // 'YYYY-MM-DD'
 *   end_date: string,    // 'YYYY-MM-DD'
 *   reason?: string
 * }} payload
 */
export const createLeaveRequest = async (staffId, payload) => {
  if (new Date(payload.end_date) < new Date(payload.start_date)) {
    throw new Error('End date must be on or after start date')
  }

  const { data, error } = await supabase
    .from('leave_requests')
    .insert({ staff_id: staffId, ...payload })
    .select()
    .single()
  if (error) throw error
  return data
}

export const getMyLeaveRequests = async (staffId) => {
  const { data, error } = await supabase
    .from('leave_requests')
    .select(
      'id, reference_id, leave_type, start_date, end_date, reason, status, created_at, reviewed_at'
    )
    .eq('staff_id', staffId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}
