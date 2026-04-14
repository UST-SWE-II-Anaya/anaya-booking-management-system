import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import { getMyPastBookings } from '../../services/customerBookingService'
import AppointmentCard from '../../components/customer/AppointmentCard'
import Navbar from '../../components/Navbar'
import Footer from '../../components/Footer'

const CalendarIcon = () => (
  <svg className="w-16 h-16 text-gray-300 mb-5" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <rect x="7" y="14" width="3" height="3" rx="0.5" fill="currentColor" stroke="none" />
  </svg>
)

const AppointmentsHistory = () => {
  const { user } = useAuthStore()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    getMyPastBookings(user.id)
      .then((data) => setBookings(data ?? []))
      .finally(() => setLoading(false))
  }, [user?.id])

  if (loading) return (
    <div className="min-h-screen bg-anaya-bg flex items-center justify-center">
      <p className="text-gray-500">Loading...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-anaya-bg flex flex-col">
      <Navbar />

      <main className="flex-1 w-full max-w-4xl mx-auto px-6 py-10">
        {bookings.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <CalendarIcon />
            <h1 className="text-2xl font-bold text-anaya-text mb-2">
              No past appointments.
            </h1>
            <p className="text-gray-400 text-sm mb-8">
              It looks like you haven't booked any services yet.
              <br />
              Ready to treat yourself?
            </p>
            <div className="flex flex-col gap-3 w-60">
              <Link
                to="/booking/services"
                className="bg-anaya-accent hover:bg-anaya-accent-hover text-white py-3 rounded-full font-medium text-center transition-colors"
              >
                Book an appointment
              </Link>
              <Link
                to="/dashboard"
                className="border border-gray-300 text-anaya-text py-3 rounded-full font-medium text-center hover:border-anaya-accent transition-colors"
              >
                Back
              </Link>
            </div>
          </div>
        ) : (
          /* Past appointments list */
          <>
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-3xl font-bold text-anaya-text">
                Past Appointments
              </h1>
              <Link
                to="/dashboard"
                className="text-sm text-anaya-accent hover:underline"
              >
                Go Back to Active
              </Link>
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
      </main>

      <Footer />
    </div>
  )
}

export default AppointmentsHistory
