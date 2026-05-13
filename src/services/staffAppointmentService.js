import { supabase } from './supabaseClient'

const today = () => new Date().toISOString().split('T')[0]

const APPOINTMENT_SELECT = `
  id, reference_id, appointment_date, start_time,
  total_duration_minutes, subtotal, downpayment_amount,
  remaining_balance, booking_status, downpayment_status,
  payment_deadline, balance_settled, created_at,
  staff_id, professional_preference,
  customer:profiles!bookings_customer_id_fkey(
    id, first_name, last_name, email, phone_number, avatar_url
  ),
  booking_services(
    id, price_at_booking, duration_at_booking,
    services(id, name, category_id,
      service_categories(id, name))
  )
`

/**
 * @param {string} staffId
 * @param {{
 *   status?: string,
 *   categoryId?: string,
 *   search?: string,
 *   sortField?: 'id' | 'date',
 *   sortDir?: 'asc' | 'desc',
 *   page?: number,
 *   pageSize?: number
 * }} options
 */
export const getMyAppointments = async (staffId, {
  status = 'upcoming',
  categoryId,
  search,
  sortField = 'date',
  sortDir = 'desc',
  page = 0,
  pageSize = 20,
} = {}) => {
  let query = supabase
    .from('bookings')
    .select(APPOINTMENT_SELECT, { count: 'exact' })
    .or(`staff_id.eq.${staffId},staff_id.is.null`)
    .range(page * pageSize, page * pageSize + pageSize - 1)

  if (status) query = query.eq('booking_status', status)
  if (search) query = query.ilike('reference_id', `%${search}%`)

  if (sortField === 'date') {
    query = query.order('appointment_date', { ascending: sortDir === 'asc' })
    query = query.order('start_time', { ascending: true })
  } else {
    query = query.order('created_at', { ascending: sortDir === 'asc' })
  }

  const { data, error, count } = await query
  if (error) throw error

  // Filter by category client-side (join path is too deep for server filter)
  const filtered = categoryId
    ? (data ?? []).filter((b) =>
        b.booking_services?.some(
          (bs) => bs.services?.service_categories?.id === categoryId
        )
      )
    : (data ?? [])

  return { data: filtered, count: count ?? 0 }
}

export const getMyDashboardStats = async (staffId) => {
  const todayStr = today()

  const [upcomingRes, todaysRes] = await Promise.all([
    supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .or(`staff_id.eq.${staffId},staff_id.is.null`)
      .eq('booking_status', 'upcoming'),
    supabase
      .from('bookings')
      .select(APPOINTMENT_SELECT)
      .or(`staff_id.eq.${staffId},staff_id.is.null`)
      .eq('appointment_date', todayStr)
      .eq('booking_status', 'upcoming')
      .order('start_time'),
  ])

  if (upcomingRes.error) throw upcomingRes.error
  if (todaysRes.error) throw todaysRes.error

  const todaysAppointments = todaysRes.data ?? []
  const todayDurationMinutes = todaysAppointments.reduce(
    (sum, appt) => sum + (appt.total_duration_minutes ?? 0),
    0
  )

  return {
    upcomingCount: upcomingRes.count ?? 0,
    todayCount: todaysAppointments.length,
    todayDurationMinutes,
    todaysAppointments,
  }
}

export const getMyAppointmentById = async (id, staffId) => {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      ${APPOINTMENT_SELECT},
      payments(
        id, reference_number, account_name, receipt_url,
        amount, status, verified_at
      )
    `)
    .eq('id', id)
    .or(`staff_id.eq.${staffId},staff_id.is.null`)
    .single()
  if (error) throw error
  return data
}

export const getMyAppointmentDates = async (staffId, year, month) => {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = new Date(year, month, 0).toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('bookings')
    .select('appointment_date')
    .or(`staff_id.eq.${staffId},staff_id.is.null`)
    .eq('booking_status', 'upcoming')
    .gte('appointment_date', startDate)
    .lte('appointment_date', endDate)
  if (error) throw error
  return new Set((data ?? []).map((b) => b.appointment_date))
}

export const claimAppointment = async (bookingId, staffId) => {
  const { data, error } = await supabase
    .from('bookings')
    .update({ staff_id: staffId })
    .eq('id', bookingId)
    .is('staff_id', null)
    .select()
    .single()
  if (error) throw error
  return data
}
