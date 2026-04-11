import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar } from 'lucide-react'
import useAuthStore from '../../store/authStore'
import { getMyPastBookings } from '../../services/customerBookingService'
import AppointmentCard from '../../components/customer/AppointmentCard'

const AppointmentsHistory = () => {
  const { user } = useAuthStore()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    getMyPastBookings(user.id).then((data) => {
      setBookings(data ?? [])
      setLoading(false)
    })
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-anaya-bg flex items-center justify-center">
      <p className="text-gray-500">Loading...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-anaya-bg">
      <div className="max-w-4xl mx-auto px-6 py-10">
        {bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Calendar size={64} className="text-gray-300 mb-5" />
            <h1 className="text-2xl font-bold text-anaya-text mb-2">No past appointments.</h1>
            <p className="text-gray-400 text-sm mb-8">
              It looks like you haven't booked any services yet. Ready to treat yourself?
            </p>
            <div className="flex flex-col gap-3 w-64">
              <Link
                to="/booking/services"
                className="bg-anaya-accent hover:bg-anaya-accent-hover text-white py-3 rounded-xl font-medium text-center transition-colors"
              >
                Book an appointment
              </Link>
              <Link
                to="/dashboard"
                className="border border-gray-300 text-anaya-text py-3 rounded-xl font-medium text-center hover:border-anaya-accent transition-colors"
              >
                Back
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4 mb-6">
              <Link to="/dashboard" className="text-sm text-anaya-accent hover:underline">
                ← Go Back
              </Link>
              <h1 className="text-3xl font-bold text-anaya-text">Past Appointments</h1>
            </div>
            <div className="space-y-4">
              {bookings.map((b) => (
                <AppointmentCard
                  key={b.id}
                  booking={b}
                  onViewDetail={() => {}}
                  onPay={() => {}}
                  onCancel={() => {}}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default AppointmentsHistory
