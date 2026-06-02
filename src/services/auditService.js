import { supabase } from './supabaseClient'
import useAuthStore from '../store/authStore'

export async function logAction({
  actionType,
  entityType,
  entityId,
  entityReference,
  description,
  metadata,
  oldData,
  newData,
}) {
  const { profile } = useAuthStore.getState()
  if (!profile?.id) return

  const actor = {
    id: profile.id,
    name: `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim(),
    role: profile.role,
  }

  const { error } = await supabase.from('audit_logs').insert({
    actor_id: actor.id,
    actor_name: actor.name,
    actor_role: actor.role,
    action_type: actionType,
    entity_type: entityType,
    entity_id: entityId,
    entity_reference: entityReference,
    description,
    metadata,
    old_data: oldData,
    new_data: newData,
  })
  if (error) console.error('Audit log failed:', error)
}

export async function getAuditLogs({
  page = 1,
  pageSize = 20,
  actorId,
  actionType,
  entityType,
  startDate,
  endDate,
  search,
}) {
  let query = supabase
    .from('audit_logs')
    .select('*', { count: 'exact' })

  if (actorId) query = query.eq('actor_id', actorId)
  if (actionType) query = query.eq('action_type', actionType)
  if (entityType) query = query.eq('entity_type', entityType)
  if (startDate) query = query.gte('created_at', startDate.toISOString())
  if (endDate) query = query.lte('created_at', endDate.toISOString())
  if (search) {
    query = query.or(
      `description.ilike.%${search}%,entity_reference.ilike.%${search}%`
    )
  }

  query = query
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  const { data, count, error } = await query
  return { data: data || [], count: count || 0, error }
}

export async function getEntityAuditLogs({
  entityType,
  entityId,
  limit = 50,
  offset = 0,
}) {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  return { data: data || [], error }
}

export async function getMyAuditLogs({
  page = 1,
  pageSize = 20,
  actionType,
  startDate,
  endDate,
}) {
  let query = supabase
    .from('audit_logs')
    .select('*', { count: 'exact' })

  if (actionType) query = query.eq('action_type', actionType)
  if (startDate) query = query.gte('created_at', startDate.toISOString())
  if (endDate) query = query.lte('created_at', endDate.toISOString())

  query = query
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  const { data, count, error } = await query
  return { data: data || [], count: count || 0, error }
}
