// src/services/bookingService.js
import { supabase } from './supabaseClient'
import { logAction } from './auditService'

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
  const { data: prev } = await supabase
    .from('bookings')
    .select('booking_status, reference_id')
    .eq('id', id)
    .single()

  const { data, error } = await supabase
    .from('bookings')
    .update({ booking_status: bookingStatus, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error

  logAction({
    actionType: 'booking.status_updated',
    entityType: 'booking',
    entityId: id,
    entityReference: data.reference_id,
    description: `Updated booking #${data.reference_id} status to ${bookingStatus}`,
    oldData: prev ? { status: prev.booking_status } : null,
    newData: { status: data.booking_status },
  })

  return data
}

export const settleBalance = async (id) => {
  const { data: prev } = await supabase
    .from('bookings')
    .select('balance_settled, reference_id')
    .eq('id', id)
    .single()

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

  logAction({
    actionType: 'booking.balance_settled',
    entityType: 'booking',
    entityId: id,
    entityReference: data.reference_id,
    description: `Settled balance for booking #${data.reference_id}`,
    oldData: prev ? { balance_settled: prev.balance_settled } : null,
    newData: { balance_settled: data.balance_settled },
  })

  return data
}

export const cancelBooking = async (id, cancelledBy) => {
  const { data: prev } = await supabase
    .from('bookings')
    .select('booking_status, reference_id')
    .eq('id', id)
    .single()

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

  logAction({
    actionType: 'booking.cancelled',
    entityType: 'booking',
    entityId: id,
    entityReference: data.reference_id,
    description: `Cancelled booking #${data.reference_id}`,
    oldData: prev ? { status: prev.booking_status } : null,
    newData: { status: data.booking_status },
  })

  return data
}

export const exportBookings = async ({
  status,
  search,
  dateFrom,
  dateTo,
} = {}) => {
  let query = supabase
    .from('bookings')
    .select(BOOKING_SELECT)
    .order('appointment_date', { ascending: false })
    .order('start_time', { ascending: true })

  if (status) query = query.eq('booking_status', status)
  if (search) query = query.ilike('reference_id', `%${search}%`)
  if (dateFrom) query = query.gte('appointment_date', dateFrom)
  if (dateTo) query = query.lte('appointment_date', dateTo)

  const { data, error } = await query
  if (error) throw error
  return data
}
