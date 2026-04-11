// src/services/servicesCmsService.js
import { supabase } from './supabaseClient'

// Categories

export const getCategories = async () => {
  const { data, error } = await supabase
    .from('service_categories')
    .select('id, reference_id, name, description, image_url, display_order, created_at')
    .order('display_order')
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
  return data
}

export const updateCategory = async (id, payload) => {
  const { data, error } = await supabase
    .from('service_categories')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export const deleteCategory = async (id) => {
  const { error } = await supabase
    .from('service_categories')
    .delete()
    .eq('id', id)
  if (error) throw error
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
  return data
}

export const updateService = async (id, payload) => {
  const { data, error } = await supabase
    .from('services')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export const deleteService = async (id) => {
  const { error } = await supabase
    .from('services')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export const getAllActiveServices = async () => {
  const { data, error } = await supabase
    .from('services')
    .select('id, name, duration_minutes, price, service_categories(name, display_order)')
    .eq('is_active', true)
    .order('display_order', { referencedTable: 'service_categories' })
    .order('name')
  if (error) throw error
  return data.map((s) => ({
    id: s.id,
    name: s.name,
    category_name: s.service_categories.name,
    category_display_order: s.service_categories.display_order,
    duration_minutes: s.duration_minutes,
    price: s.price,
  }))
}
