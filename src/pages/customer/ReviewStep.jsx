import { useNavigate, Link } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import useBookingStore from '../../store/bookingStore'
import useAuthStore from '../../store/authStore'
import { createBooking } from '../../services/customerBookingService'
import { formatDuration } from '../../utils/bookingUtils'

const to12h = (time24) => {
  const [h, m] = time24.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

const ReviewStep = () => {
  const navigate = useNavigate()
  const {
    cart,
    staffPreference,
    selectedStaffId,
    selectedDate,
    selectedTime,
    bookingNotes,
    setBookingNotes,
    clearBooking,
  } = useBookingStore()

  if (!selectedDate || !selectedTime) {
    navigate('/booking/datetime', { replace: true })
    return null
  }

  const subtotal = cart.reduce((sum, s) => sum + Number(s.price), 0)
  const totalDuration = cart.reduce((sum, s) => sum + s.duration_minutes, 0)
  const downPayment = subtotal * 0.1
  const balance = subtotal - downPayment

  const [startH, startM] = selectedTime.split(':').map(Number)
  const endTotal = startH * 60 + startM + totalDuration
  const endHH = String(Math.floor(endTotal / 60)).padStart(2, '0')
  const endMM = String(endTotal % 60).padStart(2, '0')
  const endTime = `${endHH}:${endMM}`

  // Format display date
  const d = new Date(selectedDate + 'T00:00:00')
  const displayDate = d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const buildPayload = () => ({
    staff_id: selectedStaffId,
    professional_preference: staffPreference,
    appointment_date: selectedDate,
    start_time: selectedTime,
    total_duration_minutes: totalDuration,
    subtotal,
    downpayment_amount: downPayment,
    remaining_balance: balance,
    booking_notes: bookingNotes,
    services: cart.map((s) => ({
      id: s.id,
      price: s.price,
      duration_minutes: s.duration_minutes,
    })),
  })

  const handleReserve = async (goToPayment = false) => {
    try {
      const booking = await createBooking(buildPayload())
      if (goToPayment) {
        navigate(`/booking/payment/${booking.id}`)
      } else {
        clearBooking()
        navigate('/dashboard')
      }
    } catch (err) {
      if (err.message === 'SLOT_UNAVAILABLE') {
        toast.error('This time slot was just taken — please choose another.')
        navigate('/booking/datetime')
      } else {
        toast.error('Something went wrong. Please try again.')
      }
    }
  }

  return (
    <div className="min-h-screen bg-anaya-bg">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <Link
          to="/booking/datetime"
          className="text-sm text-gray-500 hover:underline mb-4 inline-block"
        >
          ← Go Back to Previous Page
        </Link>
        <div className="flex gap-8 items-start">
          {/* Left content */}
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-anaya-text mb-6">
              Review and Confirm
            </h1>

            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
              <h2 className="font-semibold text-anaya-text mb-2">
                Cancellation Policy
              </h2>
              <p className="text-sm text-gray-600">
                You are free to cancel this booking request up to 12 hours of
                the initial appointment reservation time, as long as you
                haven't completed the down payment step. Please finalize your
                payment to secure your slot.
              </p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
              <h2 className="font-semibold text-anaya-text mb-3">
                Important info
              </h2>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>
                  <span className="font-medium text-anaya-text">
                    Securing Your Slot:{' '}
                  </span>
                  To finalize your appointment, a non-refundable down payment
                  is required.
                </li>
                <li>
                  <span className="font-medium text-anaya-text">
                    Final Pricing:{' '}
                  </span>
                  We apply all eligible discounts in person during your visit.
                </li>
                <li>
                  <span className="font-medium text-anaya-text">
                    Time Limit:{' '}
                  </span>
                  We will tentatively reserve this time for you! Please
                  complete your payment within the next{' '}
                  <strong>12 hours</strong> to keep this appointment from
                  expiring once reserved.
                </li>
              </ul>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
              <h2 className="font-semibold text-anaya-text mb-2">
                Booking Notes
              </h2>
              <textarea
                value={bookingNotes}
                onChange={(e) => setBookingNotes(e.target.value)}
                className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-anaya-accent"
                rows={4}
                placeholder="Include comments or requests about your booking"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleReserve(false)}
                className="flex-1 border border-anaya-accent text-anaya-accent py-3 rounded-lg font-medium hover:bg-anaya-accent/5 transition-colors"
              >
                Reserve Appointment
              </button>
              <button
                onClick={() => handleReserve(true)}
                className="flex-1 bg-anaya-accent hover:bg-anaya-accent-hover text-white py-3 rounded-lg font-medium transition-colors"
              >
                Reserve Appointment and Proceed to Payment
              </button>
            </div>
          </div>

          {/* Right summary sidebar */}
          <div className="w-72 shrink-0 bg-white border border-gray-200 rounded-xl p-5 h-fit sticky top-6 shadow-sm">
            <h2 className="font-semibold text-lg mb-4 text-anaya-text">
              Your Booking
            </h2>

            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <span>📅</span>
              <span>{displayDate}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
              <span>🕐</span>
              <span>
                {to12h(selectedTime)} – {to12h(endTime)} (
                {formatDuration(totalDuration)})
              </span>
            </div>

            <ul className="space-y-2 mb-4">
              {cart.map((s) => (
                <li
                  key={s.id}
                  className="flex justify-between text-sm text-anaya-text"
                >
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-gray-400">
                      {formatDuration(s.duration_minutes)} with any professional
                    </p>
                  </div>
                  <span className="font-medium shrink-0 ml-2">
                    ₱{Number(s.price).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>

            <div className="border-t border-gray-100 pt-3 space-y-2 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal:</span>
                <span>₱{subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-semibold text-anaya-text">
                <span>Total:</span>
                <span>₱{subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Down Payment (10%):</span>
                <span>₱{downPayment.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Pay at venue:</span>
                <span>₱{balance.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ReviewStep
