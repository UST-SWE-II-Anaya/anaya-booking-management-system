import { useState, useRef, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import useBookingStore from '../../store/bookingStore'
import { createBooking } from '../../services/customerBookingService'
import { formatDuration, to12h } from '../../utils/bookingUtils'
import useSiteSettings from '../../hooks/useSiteSettings'

const ReviewStep = () => {
  const navigate = useNavigate()
  const {
    cart,
    staffPreference,
    selectedStaffId,
    selectedStaffName,
    selectedDate,
    selectedTime,
    bookingNotes,
    setBookingNotes,
    clearBooking,
    bookingSessionKey,
    setBookingSessionKey,
    previousSessionKey,
  } = useBookingStore()
  const [submitting, setSubmitting] = useState(false)
  // Tracks a successful submit so the date-guard below doesn't fire
  // and override the post-booking navigation when clearBooking() wipes the dates.
  const submittedRef = useRef(false)
  const { settings } = useSiteSettings()

  // Generate a session-scoped idempotency key the first time the user lands
  // on this page. Persisted in sessionStorage so a back-navigation from the
  // payment page reuses the same key and the RPC returns the existing booking
  // instead of creating a duplicate.
  useEffect(() => {
    if (!bookingSessionKey) {
      setBookingSessionKey(crypto.randomUUID())
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!submittedRef.current && (!selectedDate || !selectedTime)) {
    navigate('/booking/datetime', { replace: true })
    return null
  }

  const subtotal = cart.reduce((sum, s) => sum + Number(s.price), 0)
  const totalDuration = cart.reduce((sum, s) => sum + s.duration_minutes, 0)
  const downpaymentPct = (settings?.downpayment_rate?.percentage ?? 10) / 100
  const downPayment = subtotal * downpaymentPct
  const downpaymentLabel = `${settings?.downpayment_rate?.percentage ?? 10}% of Total`
  const balance = subtotal - downPayment

  const [startH, startM] = selectedTime.split(':').map(Number)
  const endTotal = startH * 60 + startM + totalDuration
  const endHH = String(Math.floor(endTotal / 60)).padStart(2, '0')
  const endMM = String(endTotal % 60).padStart(2, '0')
  const endTime = `${endHH}:${endMM}`

  const displayDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString(
    'en-US',
    { weekday: 'long', month: 'long', day: 'numeric' }
  )

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
    idempotency_key: bookingSessionKey,
    replaces_idempotency_key: previousSessionKey,
    services: cart.map((s) => ({
      id: s.id,
      price: s.price,
      duration_minutes: s.duration_minutes,
    })),
  })

  const handleReserve = async (goToPayment = false) => {
    setSubmitting(true)
    try {
      const booking = await createBooking(buildPayload())
      submittedRef.current = true
      if (goToPayment) {
        // Do NOT call clearBooking() here — the user may navigate back from
        // the payment page and the store state must remain intact so that
        // (a) the review page renders correctly and (b) a repeated "Reserve"
        // click returns the same booking via the idempotency key.
        // clearBooking() is called by SuccessPage.handleBackHome() after payment.
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
    } finally {
      setSubmitting(false)
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
          {/* Left: policies + notes */}
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-anaya-text mb-6">
              Terms and Conditions
            </h1>

            <div className="mb-5">
              <h2 className="font-semibold text-anaya-text mb-2">
                Cancellation Policy
              </h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                You are free to cancel this booking request up to{' '}
                <strong>{settings?.cancellation_window?.hours ?? 12} hours</strong>{' '}
                of the initial appointment reservation time, as long as you
                haven't completed the down payment step. Please finalize your
                payment to secure your slot.
              </p>
            </div>

            <div className="mb-5">
              <h2 className="font-semibold text-anaya-text mb-2">
                Important info
              </h2>
              <ul className="space-y-2 text-sm text-gray-600 leading-relaxed">
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
                  <strong>{settings?.cancellation_window?.hours ?? 12} hours</strong>{' '}
                  to keep this appointment from expiring once reserved.
                </li>
              </ul>
            </div>

            <div className="mb-6">
              <h2 className="font-semibold text-anaya-text mb-2">
                Booking Notes
              </h2>
              <textarea
                value={bookingNotes}
                onChange={(e) => setBookingNotes(e.target.value)}
                className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-anaya-accent bg-white"
                rows={4}
                placeholder="Include comments or requests about your booking"
              />
            </div>
          </div>

          {/* Right: booking summary + actions */}
          <div className="w-72 shrink-0 bg-white border border-gray-200 rounded-xl p-5 h-fit sticky top-6 shadow-sm">
            <h2 className="font-semibold text-lg mb-3 text-anaya-text">
              Your Booking
            </h2>

            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>{displayDate}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>
                {to12h(selectedTime)} – {to12h(endTime)}{' '}
                ({formatDuration(totalDuration)})
              </span>
            </div>

            <ul className="space-y-2 mb-4">
              {cart.map((s) => (
                <li key={s.id} className="flex justify-between text-sm text-anaya-text">
                  <div className="flex-1 pr-2">
                    <p className="font-medium leading-snug">{s.name}</p>
                    <p className="text-xs text-gray-400">
                      {formatDuration(s.duration_minutes)} with{' '}
                      {staffPreference === 'specific'
                        ? (selectedStaffName ?? 'specific professional')
                        : staffPreference === 'any_female'
                        ? 'any female professional'
                        : staffPreference === 'any_male'
                        ? 'any male professional'
                        : 'any professional'}
                    </p>
                  </div>
                  <span className="font-medium shrink-0">
                    ₱{Number(s.price).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>

            <div className="border-t border-gray-100 pt-3 space-y-2 text-sm mb-5">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal:</span>
                <span>₱{subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-semibold text-anaya-text">
                <span>Total:</span>
                <span>₱{subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>
                  Down Payment
                  <br />
                  <span className="text-xs">({downpaymentLabel}):</span>
                </span>
                <span>₱{downPayment.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Pay at venue:</span>
                <span>₱{balance.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => handleReserve(false)}
                disabled={submitting}
                className="w-full border border-anaya-accent text-anaya-accent py-2.5 rounded-lg text-sm font-medium hover:bg-anaya-accent/5 transition-colors disabled:opacity-50"
              >
                Reserve Appointment
              </button>
              <button
                onClick={() => handleReserve(true)}
                disabled={submitting}
                className="w-full bg-anaya-accent hover:bg-anaya-accent-hover text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                Reserve Appointment and
                <br />
                Proceed to Payment
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ReviewStep
