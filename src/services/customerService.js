// src/services/customerService.js
import { supabase } from './supabaseClient'

export const getCustomers = async ({ search, status, page = 0, pageSize = 20 } = {}) => {
  let query = supabase
    .from('profiles')
    .select(
      'id, reference_id, first_name, last_name, email, phone_number, avatar_url, account_status, created_at',
      { count: 'exact' }
    )
    .eq('role', 'customer')
    .order('created_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1)

  if (status) query = query.eq('account_status', status)
  if (search) query = query.ilike('email', `%${search}%`)

  const { data, error, count } = await query
  if (error) throw error
  return { data, count }
}

export const getCustomerById = async (id) => {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id, reference_id, first_name, last_name, email, phone_number,
      date_of_birth, avatar_url, gender, account_status, created_at
    `)
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export const getCustomerBookings = async (customerId) => {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id, reference_id, appointment_date, start_time,
      booking_status, downpayment_status, subtotal, balance_settled,
      booking_services(services(name))
    `)
    .eq('customer_id', customerId)
    .order('appointment_date', { ascending: false })
  if (error) throw error
  return data
}

export const updateAccountStatus = async (id, accountStatus, reason = null) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      account_status: accountStatus,
      deactivation_reason: accountStatus === 'active' ? null : reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export const updateCustomer = async (id, updates) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}
