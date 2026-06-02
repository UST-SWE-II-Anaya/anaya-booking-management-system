// src/services/inquiryService.js
import { supabase } from './supabaseClient'
import { logAction } from './auditService'

export const getInquiries = async ({ status } = {}) => {
  let query = supabase
    .from('inquiries')
    .select('id, reference_id, first_name, last_name, email, message, status, created_at')
    .order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw error
  return data
}

export const createInquiry = async (inquiryData) => {
  const { error } = await supabase
    .from('inquiries')
    .insert([inquiryData])
  if (error) throw error
  return true
}

export const markRead = async (id) => {
  const { data: prev } = await supabase
    .from('inquiries')
    .select('status, reference_id')
    .eq('id', id)
    .single()

  const { data, error } = await supabase
    .from('inquiries')
    .update({ status: 'read' })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error

  logAction({
    actionType: 'inquiry.marked_read',
    entityType: 'inquiry',
    entityId: id,
    entityReference: data.reference_id,
    description: `Marked inquiry #${data.reference_id} as read`,
    oldData: prev ? { status: prev.status } : null,
    newData: { status: data.status },
  })

  return data
}

export const archiveInquiry = async (id) => {
  const { data: prev } = await supabase
    .from('inquiries')
    .select('status, reference_id')
    .eq('id', id)
    .single()

  const { data, error } = await supabase
    .from('inquiries')
    .update({ status: 'archived' })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error

  logAction({
    actionType: 'inquiry.archived',
    entityType: 'inquiry',
    entityId: id,
    entityReference: data.reference_id,
    description: `Archived inquiry #${data.reference_id}`,
    oldData: prev ? { status: prev.status } : null,
    newData: { status: data.status },
  })

  return data
}
