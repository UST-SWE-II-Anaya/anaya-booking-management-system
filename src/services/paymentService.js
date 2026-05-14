// src/services/paymentService.js
import { supabase } from './supabaseClient'

export const verifyPayment = async (paymentId, bookingId, verifierId) => {
  const now = new Date().toISOString()

  const { error: payErr } = await supabase
    .from('payments')
    .update({ status: 'verified', verified_by: verifierId, verified_at: now })
    .eq('id', paymentId)
  if (payErr) throw payErr

  const { data, error: bookErr } = await supabase
    .from('bookings')
    .update({ downpayment_status: 'verified', updated_at: now })
    .eq('id', bookingId)
    .select()
    .single()
  if (bookErr) throw bookErr
  return data
}

export const denyPayment = async (paymentId, bookingId) => {
  const now = new Date().toISOString()

  const { error: payErr } = await supabase
    .from('payments')
    .update({ status: 'denied' })
    .eq('id', paymentId)
  if (payErr) throw payErr

  const { data, error: bookErr } = await supabase
    .from('bookings')
    .update({ downpayment_status: 'denied', booking_status: 'cancelled', updated_at: now })
    .eq('id', bookingId)
    .select()
    .single()
  if (bookErr) throw bookErr
  return data
}
