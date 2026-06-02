// src/services/paymentService.js
import { supabase } from './supabaseClient'
import { logAction } from './auditService'

export const verifyPayment = async (paymentId, bookingId, verifierId) => {
  const now = new Date().toISOString()

  const { data: prev } = await supabase
    .from('payments')
    .select('status, reference_number')
    .eq('id', paymentId)
    .single()

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

  logAction({
    actionType: 'payment.verified',
    entityType: 'payment',
    entityId: paymentId,
    entityReference: prev?.reference_number,
    description: `Verified payment ${prev?.reference_number}`,
    oldData: prev ? { status: prev.status } : null,
    newData: { status: 'verified' },
  })

  return data
}

export const denyPayment = async (paymentId, bookingId) => {
  const now = new Date().toISOString()

  const { data: prev } = await supabase
    .from('payments')
    .select('status, reference_number')
    .eq('id', paymentId)
    .single()

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

  logAction({
    actionType: 'payment.denied',
    entityType: 'payment',
    entityId: paymentId,
    entityReference: prev?.reference_number,
    description: `Denied payment ${prev?.reference_number}`,
    oldData: prev ? { status: prev.status } : null,
    newData: { status: 'denied' },
  })

  return data
}

export const verifyAndAssignPayment = async (paymentId, bookingId, staffId, verifierId) => {
  const now = new Date().toISOString()

  const { data: prev } = await supabase
    .from('payments')
    .select('status, reference_number')
    .eq('id', paymentId)
    .single()

  const { error: payErr } = await supabase
    .from('payments')
    .update({ status: 'verified', verified_by: verifierId, verified_at: now })
    .eq('id', paymentId)
  if (payErr) throw payErr

  const { data, error: bookErr } = await supabase
    .from('bookings')
    .update({ downpayment_status: 'verified', staff_id: staffId, updated_at: now })
    .eq('id', bookingId)
    .select()
    .single()
  if (bookErr) throw bookErr

  logAction({
    actionType: 'payment.verified_and_assigned',
    entityType: 'payment',
    entityId: paymentId,
    entityReference: prev?.reference_number,
    description: `Verified payment ${prev?.reference_number} and assigned staff`,
    oldData: prev ? { status: prev.status } : null,
    newData: { status: 'verified', staff_id: staffId },
  })

  return data
}
