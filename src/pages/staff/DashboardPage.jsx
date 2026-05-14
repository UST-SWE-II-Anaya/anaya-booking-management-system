import { useNavigate } from 'react-router-dom'
import { CalendarDays, Clock, TrendingUp, ChevronRight } from 'lucide-react'
import { getMyDashboardStats } from '../../services/staffAppointmentService'
import useAuthStore from '../../store/authStore'
import StatCard from '../../components/common/StatCard'
import Spinner from '../../components/common/Spinner'
import Badge from '../../components/common/Badge'

const formatTime = (time) => {
  if (!time) return '—'
  const [h, m] = time.split(':')
  const hour = parseInt(h, 10)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

const formatDuration = (minutes) => {
  if (!minutes) return '0m'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

const StaffDashboardPage = () => {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user?.id) return
    getMyDashboardStats(user.id)
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [user?.id])

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

      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Total Upcoming"
          value={stats.upcomingCount}
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          label="Appointments Today"
          value={stats.todayCount}
          icon={CalendarDays}
          color="blue"
        />
        <StatCard
          label="Service Duration Today"
          value={formatDuration(stats.todayDurationMinutes)}
          icon={Clock}
          color="rust"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-[#2C2C2C] flex items-center gap-2">
            <Clock size={16} className="text-[#8A956D]" />
            Today&apos;s Schedule
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
              <button
                key={appt.id}
                onClick={() => navigate(`/staff/appointments/${appt.id}`)}
                className="w-full px-6 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="w-20 text-center flex-shrink-0">
                  <p className="text-sm font-semibold text-[#2C2C2C]">
                    {formatTime(appt.start_time)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatDuration(appt.total_duration_minutes)}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#4A4A4A]">
                    {appt.customer
                      ? `${appt.customer.first_name} ${appt.customer.last_name}`
                      : 'Unknown Customer'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {appt.booking_services
                      ?.map((bs) => bs.services?.name)
                      .filter(Boolean)
                      .join(', ') || 'No services'}
                  </p>
                </div>
                <Badge
                  variant={appt.downpayment_status}
                  label={appt.downpayment_status}
                />
                <ChevronRight size={16} className="text-gray-300" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default StaffDashboardPage
