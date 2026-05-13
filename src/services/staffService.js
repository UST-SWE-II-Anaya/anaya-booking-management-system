// src/services/staffService.js
import { supabase } from './supabaseClient'

export const getStaff = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id, reference_id, first_name, last_name, email, phone_number, avatar_url, created_at, role,
      staff_details(is_active)
    `)
    .in('role', ['staff', 'admin'])
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export const getStaffById = async (id) => {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id, reference_id, first_name, last_name, email, phone_number, avatar_url, created_at, role, date_of_birth, gender,
      staff_details(is_active)
    `)
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export const getStaffLeaveRequests = async (staffId) => {
  const { data, error } = await supabase
    .from('leave_requests')
    .select(`
      id, leave_type, start_date, end_date, reason, status, reviewed_at,
      reviewer:profiles!leave_requests_reviewed_by_fkey(first_name, last_name)
    `)
    .eq('staff_id', staffId)
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

export const activateStaff = async (id) => {
  const { data, error } = await supabase
    .from('staff_details')
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export const getStaffList = async () => {
  const { data, error } = await supabase.rpc('get_staff_list')
  if (error) throw error
  return data
}

export const getActiveStaffList = async () => {
  const data = await getStaffList()
  return (data ?? []).filter((s) => s.is_active !== false)
}
