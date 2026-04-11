import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CheckCircle } from 'lucide-react'
import useBookingStore from '../../store/bookingStore'
import { getMyBookingById } from '../../services/customerBookingService'
import { formatDuration } from '../../utils/bookingUtils'

const to12h = (time24) => {
  if (!time24) return ''
  const [h, m] = time24.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

const SuccessPage = () => {
  const { bookingId } = useParams()
  const navigate = useNavigate()
  const clearBooking = useBookingStore((s) => s.clearBooking)
  const [booking, setBooking] = useState(null)

  useEffect(() => {
    getMyBookingById(bookingId).then(setBooking)
  }, [bookingId])

  const handleBackToDashboard = () => {
    clearBooking()
    navigate('/dashboard')
  }

  if (!booking) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-500">Loading...</p>
    </div>
  )

  const services = booking.booking_services ?? []
  const totalMins = booking.total_duration_minutes ?? 0
  const startTimeStr = booking.start_time ? booking.start_time.slice(0, 5) : '00:00'
  const [startH, startM] = startTimeStr.split(':').map(Number)
  const endTotal = startH * 60 + startM + totalMins
  const endHH = String(Math.floor(endTotal / 60)).padStart(2, '0')
  const endMM = String(endTotal % 60).padStart(2, '0')

  const displayDate = booking.appointment_date
    ? new Date(booking.appointment_date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
    : ''

  const timeRange = `${to12h(startTimeStr)} - ${to12h(`${endHH}:${endMM}`)} (${formatDuration(totalMins)})`

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
        <CheckCircle className="mx-auto mb-4 text-green-500" size={56} />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Booking Confirmed!</h1>
        <p className="text-sm text-gray-500 mb-6">
          Your payment was successful and your appointment is confirmed.
        </p>

        <div className="bg-gray-50 rounded-xl p-4 text-left mb-6">
          <h2 className="font-semibold text-gray-900 mb-3">Booking Summary</h2>
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
            <span>📅</span>
            <span>Date: {displayDate}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
            <span>🕐</span>
            <span>Time: {timeRange}</span>
          </div>

          <p className="text-sm font-medium text-gray-700 mb-2">Service/s:</p>
          {services.map((bs) => (
            <div key={bs.id} className="flex justify-between items-start text-sm mb-1">
              <div>
                <p className="font-medium text-gray-800">{bs.services?.name}</p>
                <p className="text-xs text-gray-400">
                  {formatDuration(bs.duration_at_booking)} with any professional
                </p>
              </div>
              <span className="font-medium text-gray-800 shrink-0 ml-2">
                ₱{Number(bs.price_at_booking).toLocaleString()}
              </span>
            </div>
          ))}

          <div className="border-t border-gray-200 mt-3 pt-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Total:</span>
              <span>₱{Number(booking.subtotal).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Down Payment Paid:</span>
              <span>₱{Number(booking.downpayment_amount).toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-900">
              <span>Remaining Balance:</span>
              <span>₱{Number(booking.remaining_balance).toFixed(2)}</span>
            </div>
            <p className="text-xs text-gray-400 text-right">To be paid at the venue</p>
          </div>
        </div>

        <button
          onClick={handleBackToDashboard}
          className="w-full bg-anaya-accent hover:bg-anaya-accent-hover text-white py-3 rounded-xl font-medium transition-colors"
        >
          Back to Home
        </button>
      </div>
    </div>
  )
}

export default SuccessPage
