// src/services/servicesCmsService.js
import { supabase } from './supabaseClient'
import { logAction } from './auditService'

// Categories

export const getCategories = async () => {
  const { data, error } = await supabase
    .from('service_categories')
    .select('id, reference_id, name, description, image_url, display_order, created_at')
    .order('display_order')
  if (error) throw error
  return data
}

export const getPopularServices = async () => {
  const { data, error } = await supabase
    .from('services')
    .select('id, name, image_url, category_id, service_categories(id, name)')
    .eq('is_popular', true)
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return data
}

export const createCategory = async (payload) => {
  const { data, error } = await supabase
    .from('service_categories')
    .insert(payload)
    .select()
    .single()
  if (error) throw error

  logAction({
    actionType: 'category.created',
    entityType: 'category',
    entityId: data.id,
    entityReference: data.reference_id,
    description: `Created category ${data.name}`,
    newData: payload,
  })

  return data
}

export const updateCategory = async (id, payload) => {
  const { data: prev } = await supabase
    .from('service_categories')
    .select('*')
    .eq('id', id)
    .single()

  const { data, error } = await supabase
    .from('service_categories')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error

  logAction({
    actionType: 'category.updated',
    entityType: 'category',
    entityId: id,
    entityReference: data.reference_id,
    description: `Updated category ${data.name}`,
    oldData: prev,
    newData: data,
  })

  return data
}

export const deleteCategory = async (id) => {
  const { data: prev } = await supabase
    .from('service_categories')
    .select('reference_id, name')
    .eq('id', id)
    .single()

  const { error } = await supabase
    .from('service_categories')
    .delete()
    .eq('id', id)
  if (error) throw error

  logAction({
    actionType: 'category.deleted',
    entityType: 'category',
    entityId: id,
    entityReference: prev?.reference_id,
    description: `Deleted category ${prev?.name}`,
  })
}

// Services

export const getServicesByCategory = async (categoryId) => {
  const { data, error } = await supabase
    .from('services')
    .select(`
      id, reference_id, name, description, duration_minutes,
      price, image_url, is_popular, is_active, created_at
    `)
    .eq('category_id', categoryId)
    .order('name')
  if (error) throw error
  return data
}

export const createService = async (payload) => {
  const { data, error } = await supabase
    .from('services')
    .insert(payload)
    .select()
    .single()
  if (error) throw error

  logAction({
    actionType: 'service.created',
    entityType: 'service',
    entityId: data.id,
    entityReference: data.reference_id,
    description: `Created service ${data.name}`,
    newData: payload,
  })

  return data
}

export const updateService = async (id, payload) => {
  const { data: prev } = await supabase
    .from('services')
    .select('*')
    .eq('id', id)
    .single()

  const { data, error } = await supabase
    .from('services')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error

  logAction({
    actionType: 'service.updated',
    entityType: 'service',
    entityId: id,
    entityReference: data.reference_id,
    description: `Updated service ${data.name}`,
    oldData: prev,
    newData: data,
  })

  return data
}

export const deleteService = async (id) => {
  const { data: prev } = await supabase
    .from('services')
    .select('reference_id, name')
    .eq('id', id)
    .single()

  const { error } = await supabase
    .from('services')
    .delete()
    .eq('id', id)
  if (error) throw error

  logAction({
    actionType: 'service.deleted',
    entityType: 'service',
    entityId: id,
    entityReference: prev?.reference_id,
    description: `Deleted service ${prev?.name}`,
  })
}

export const getAllActiveServices = async () => {
  const { data, error } = await supabase
    .from('services')
    .select('id, name, description, duration_minutes, price, service_categories(name, display_order)')
    .eq('is_active', true)
    .order('display_order', { referencedTable: 'service_categories' })
    .order('name')
  if (error) throw error
  return data.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    category_name: s.service_categories.name,
    category_display_order: s.service_categories.display_order,
    duration_minutes: s.duration_minutes,
    price: s.price,
  }))
}
