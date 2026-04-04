// src/services/bookingService.js
import { supabase } from './supabaseClient'

const BOOKING_SELECT = `
  id, reference_id, appointment_date, start_time,
  total_duration_minutes, subtotal, downpayment_amount,
  remaining_balance, booking_status, downpayment_status,
  payment_deadline, balance_settled, booking_notes,
  cancelled_at, created_at,
  customer:profiles!bookings_customer_id_fkey(
    id, first_name, last_name, email, phone_number, avatar_url
  ),
  staff:profiles!bookings_staff_id_fkey(
    id, first_name, last_name
  ),
  booking_services(
    id, price_at_booking, duration_at_booking,
    services(id, name, duration_minutes, price)
  )
`

export const getBookings = async ({
  status,
  search,
  page = 0,
  pageSize = 20,
} = {}) => {
  let query = supabase
    .from('bookings')
    .select(BOOKING_SELECT, { count: 'exact' })
    .order('appointment_date', { ascending: false })
    .order('start_time', { ascending: true })
    .range(page * pageSize, page * pageSize + pageSize - 1)

  if (status) query = query.eq('booking_status', status)
  if (search) {
    query = query.ilike('reference_id', `%${search}%`)
  }

  const { data, error, count } = await query
  if (error) throw error
  return { data, count }
}

export const getBookingById = async (id) => {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      ${BOOKING_SELECT},
      payments(
        id, reference_number, account_name, receipt_url,
        amount, status, verified_at,
        verifier:profiles!payments_verified_by_fkey(first_name, last_name)
      )
    `)
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export const updateBookingStatus = async (id, bookingStatus) => {
  const { data, error } = await supabase
    .from('bookings')
    .update({ booking_status: bookingStatus, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export const settleBalance = async (id) => {
  const { data, error } = await supabase
    .from('bookings')
    .update({
      balance_settled: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export const cancelBooking = async (id, cancelledBy) => {
  const { data, error } = await supabase
    .from('bookings')
    .update({
      booking_status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by: cancelledBy,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}
