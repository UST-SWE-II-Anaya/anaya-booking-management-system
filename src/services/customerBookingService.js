import { supabase } from './supabaseClient'

const BOOKING_SELECT = `
  id, reference_id, appointment_date, start_time, total_duration_minutes,
  subtotal, downpayment_amount, remaining_balance, booking_status,
  downpayment_status, payment_deadline, booking_notes, professional_preference,
  booking_services(
    id, price_at_booking, duration_at_booking,
    services(id, name, service_categories(name))
  )
`

export const createBooking = async (payload) => {
  const { data, error } = await supabase.rpc('create_booking', { payload })
  if (error) throw new Error(error.message)
  return data
}

export const getMyBookings = async (userId) => {
  const { data, error } = await supabase
    .from('bookings')
    .select(BOOKING_SELECT)
    .eq('customer_id', userId)
    .in('booking_status', ['upcoming'])
    .order('appointment_date', { ascending: true })
  if (error) throw error
  return data
}

export const getMyPastBookings = async (userId) => {
  const { data, error } = await supabase
    .from('bookings')
    .select(BOOKING_SELECT)
    .eq('customer_id', userId)
    .in('booking_status', ['finished', 'cancelled', 'no_show'])
    .order('appointment_date', { ascending: false })
  if (error) throw error
  return data
}

export const getMyBookingById = async (id) => {
  const { data, error } = await supabase
    .from('bookings')
    .select(
      BOOKING_SELECT +
        ', payments(id, reference_number, account_name, receipt_url, amount, status)'
    )
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export const cancelMyBooking = async (id, userId) => {
  const { error } = await supabase
    .from('bookings')
    .update({
      booking_status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by: userId,
    })
    .eq('id', id)
    .eq('customer_id', userId)
  if (error) throw error
}
