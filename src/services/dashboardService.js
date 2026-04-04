// src/services/dashboardService.js
import { supabase } from './supabaseClient'

const today = () => new Date().toISOString().split('T')[0]

export const getDashboardStats = async () => {
  const [
    bookingsRes,
    upcomingRes,
    pendingPaymentsRes,
    pendingLeaveRes,
    unreadInquiriesRes,
    todaysRes,
  ] = await Promise.all([
    supabase.from('bookings').select('*', { count: 'exact', head: true }),
    supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('booking_status', 'upcoming'),
    supabase
      .from('payments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('leave_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('inquiries')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'unread'),
    supabase
      .from('bookings')
      .select(`
        id, reference_id, start_time, total_duration_minutes,
        booking_status, downpayment_status,
        customer:profiles!bookings_customer_id_fkey(first_name, last_name),
        staff:profiles!bookings_staff_id_fkey(first_name, last_name),
        booking_services(service_id, services(name))
      `)
      .eq('appointment_date', today())
      .eq('booking_status', 'upcoming')
      .order('start_time'),
  ])

  // Propagate first error found
  const errors = [
    bookingsRes, upcomingRes, pendingPaymentsRes,
    pendingLeaveRes, unreadInquiriesRes, todaysRes,
  ].map((r) => r.error).filter(Boolean)
  if (errors.length) throw errors[0]

  return {
    totalBookings: bookingsRes.count ?? 0,
    upcomingBookings: upcomingRes.count ?? 0,
    pendingPayments: pendingPaymentsRes.count ?? 0,
    pendingLeaveRequests: pendingLeaveRes.count ?? 0,
    unreadInquiries: unreadInquiriesRes.count ?? 0,
    todaysAppointments: todaysRes.data ?? [],
  }
}
