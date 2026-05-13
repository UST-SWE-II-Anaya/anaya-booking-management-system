import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import useBookingStore from '../../store/bookingStore'
import { getMyBookingById } from '../../services/customerBookingService'
import { formatDuration, to12h } from '../../utils/bookingUtils'

const SuccessPage = () => {
  const { bookingId } = useParams()
  const navigate = useNavigate()
  const clearBooking = useBookingStore((s) => s.clearBooking)
  const [booking, setBooking] = useState(null)

  useEffect(() => {
    getMyBookingById(bookingId).then(setBooking)
  }, [bookingId])

  const handleBackHome = () => {
    clearBooking()
    navigate('/dashboard')
  }

  if (!booking) return (
    <div className="min-h-screen flex items-center justify-center bg-anaya-bg">
      <p className="text-gray-500">Loading...</p>
    </div>
  )

  const services = booking.booking_services ?? []
  const totalMins = booking.total_duration_minutes ?? 0
  const startTimeStr = (booking.start_time ?? '00:00').slice(0, 5)
  const [startH, startM] = startTimeStr.split(':').map(Number)
  const endTotal = startH * 60 + startM + totalMins
  const endTime = to12h(
    `${String(Math.floor(endTotal / 60)).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`
  )

  const displayDate = booking.appointment_date
    ? new Date(booking.appointment_date + 'T00:00:00').toLocaleDateString(
        'en-US',
        { weekday: 'long', month: 'long', day: 'numeric' }
      )
    : ''

  const timeRange = `${to12h(startTimeStr)} - ${endTime} (${formatDuration(totalMins)})`

  return (
    <div className="min-h-screen flex items-center justify-center bg-anaya-bg p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
        {/* Green checkmark */}
        <div className="w-14 h-14 rounded-full bg-green-600 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-anaya-text mb-2">
          Booking Confirmed!
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          Your payment was successful and your appointment is confirmed.
        </p>

        <div className="bg-gray-50 rounded-xl p-4 text-left mb-6">
          <h2 className="font-semibold text-anaya-text mb-3">Booking Summary</h2>

          <div className="flex items-start gap-2 text-sm text-gray-600 mb-1">
            <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <div className="flex justify-between flex-1">
              <span>Date:</span>
              <span className="font-medium text-anaya-text text-right">{displayDate}</span>
            </div>
          </div>

          <div className="flex items-start gap-2 text-sm text-gray-600 mb-3">
            <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <div className="flex justify-between flex-1">
              <span>Time:</span>
              <span className="font-medium text-anaya-text text-right">{timeRange}</span>
            </div>
          </div>

          <p className="text-sm font-medium text-anaya-text mb-2">Service/s:</p>
          {services.map((bs) => (
            <div key={bs.id} className="flex justify-between items-start text-sm mb-1.5">
              <div className="flex-1 pr-2">
                <p className="font-medium text-anaya-text">{bs.services?.name}</p>
                <p className="text-xs text-gray-400">
                  {formatDuration(bs.duration_at_booking)} with any professional
                </p>
              </div>
              <span className="font-medium text-anaya-text shrink-0">
                ₱{Number(bs.price_at_booking).toLocaleString()}
              </span>
            </div>
          ))}

          <div className="border-t border-gray-200 mt-3 pt-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Total:</span>
              <span>₱{Number(booking.subtotal).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Down Payment Paid:</span>
              <span>₱{Number(booking.downpayment_amount).toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-anaya-text">
              <span>Remaining Balance:</span>
              <span>₱{Number(booking.remaining_balance).toFixed(2)}</span>
            </div>
            <p className="text-xs text-gray-400 text-right">To be paid at the venue</p>
          </div>
        </div>

        <button
          onClick={handleBackHome}
          className="w-full bg-anaya-accent hover:bg-anaya-accent-hover text-white py-3 rounded-xl font-medium transition-colors"
        >
          Back to Home
        </button>
      </div>
    </div>
  )
}

export default SuccessPage
