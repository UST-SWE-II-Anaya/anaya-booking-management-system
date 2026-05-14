// src/services/staffService.js
import { supabase } from './supabaseClient'

export const getStaff = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id, reference_id, first_name, last_name, email, phone_number, avatar_url, created_at, role, account_status,
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
      id, reference_id, first_name, last_name, email, phone_number, avatar_url, created_at, role, date_of_birth, gender, account_status,
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

export const deactivateStaff = async (id, reason) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      account_status: 'suspended',
      deactivation_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export const activateStaff = async (id) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      account_status: 'active',
      deactivation_reason: null,
      updated_at: new Date().toISOString(),
    })
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
  return await getStaffList()
}

export const inviteUser = async ({ firstName, lastName, email, phone, role }) => {
  const { data, error } = await supabase.functions.invoke('invite-user', {
    body: {
      first_name: firstName,
      last_name: lastName,
      email,
      phone_number: phone ?? '',
      role,
      redirect_to: `${window.location.origin}/accept-invite`,
    },
  })
  if (error) {
    if (error.context instanceof Response) {
      const body = await error.context.json().catch(() => ({}))
      throw new Error(body.error ?? error.message)
    }
    throw error
  }
  return data
}

export const banStaff = async (id, reason = 'Banned by admin') => {
  const { data, error } = await supabase.functions.invoke('ban-user', {
    body: { userId: id, reason, role: 'staff' },
  })
  if (error) {
    if (error.context instanceof Response) {
      const body = await error.context.json().catch(() => ({}))
      throw new Error(body.error ?? error.message)
    }
    throw error
  }
  return data
}
