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

export const getLeaveRequests = async ({ status } = {}) => {
  let query = supabase
    .from('leave_requests')
    .select(`
      id, leave_type, start_date, end_date, reason, status, reviewed_at,
      staff:profiles!leave_requests_staff_id_fkey(first_name, last_name),
      reviewer:profiles!leave_requests_reviewed_by_fkey(first_name, last_name)
    `)
    .order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw error
  return data
}

export const reviewLeaveRequest = async (id, status, reviewedBy) => {
  const { data, error } = await supabase
    .from('leave_requests')
    .update({ status, reviewed_by: reviewedBy, reviewed_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
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
