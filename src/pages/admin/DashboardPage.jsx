// src/pages/admin/DashboardPage.jsx
import { useEffect, useState } from 'react'
import {
  CalendarDays, Clock, CreditCard, ClipboardList, Mail, TrendingUp,
} from 'lucide-react'
import { getDashboardStats } from '../../services/dashboardService'
import StatCard from '../../components/common/StatCard'
import Spinner from '../../components/common/Spinner'
import Badge from '../../components/common/Badge'

const formatTime = (time) => {
  if (!time) return '—'
  const [h, m] = time.split(':')
  const hour = parseInt(h, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const display = hour % 12 || 12
  return `${display}:${m} ${ampm}`
}

const DashboardPage = () => {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-red-600 bg-red-50 rounded-lg p-4 text-sm">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#2C2C2C]">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          })}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard
          label="Total Bookings"
          value={stats.totalBookings}
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          label="Upcoming"
          value={stats.upcomingBookings}
          icon={CalendarDays}
          color="blue"
        />
        <StatCard
          label="Pending Payments"
          value={stats.pendingPayments}
          icon={CreditCard}
          color="rust"
        />
        <StatCard
          label="Leave Requests"
          value={stats.pendingLeaveRequests}
          icon={ClipboardList}
          color="orange"
        />
        <StatCard
          label="Unread Inquiries"
          value={stats.unreadInquiries}
          icon={Mail}
          color="rust"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-[#2C2C2C] flex items-center gap-2">
            <Clock size={16} className="text-[#8A956D]" />
            Today&apos;s Appointments
            <span className="ml-auto text-sm font-normal text-gray-400">
              {stats.todaysAppointments.length} appointment
              {stats.todaysAppointments.length !== 1 ? 's' : ''}
            </span>
          </h2>
        </div>

        {stats.todaysAppointments.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-10">
            No appointments scheduled for today.
          </p>
        ) : (
          <div className="divide-y divide-gray-50">
            {stats.todaysAppointments.map((appt) => (
              <div
                key={appt.id}
                className="px-6 py-4 flex items-center gap-4"
              >
                <div className="w-16 text-center">
                  <p className="text-sm font-semibold text-[#2C2C2C]">
                    {formatTime(appt.start_time)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {appt.total_duration_minutes}m
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#4A4A4A]">
                    {appt.customer
                      ? `${appt.customer.first_name} ${appt.customer.last_name}`
                      : 'Unknown Customer'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {appt.booking_services
                      ?.map((bs) => bs.services?.name)
                      .filter(Boolean)
                      .join(', ') || 'No services'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={appt.booking_status}
                    label={appt.booking_status}
                  />
                  {appt.staff && (
                    <span className="text-xs text-gray-400">
                      {appt.staff.first_name} {appt.staff.last_name}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default DashboardPage
