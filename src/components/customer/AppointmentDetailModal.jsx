import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { formatDuration } from '../../utils/bookingUtils'

const to12h = (time24) => {
  if (!time24) return ''
  const [h, m] = time24.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

const AppointmentDetailModal = ({ booking, onClose }) => {
  const navigate = useNavigate()
  if (!booking) return null

  const services = booking.booking_services ?? []
  const totalMins = booking.total_duration_minutes ?? 0
  const startStr = booking.start_time
    ? booking.start_time.slice(0, 5)
    : '00:00'
  const [sH, sM] = startStr.split(':').map(Number)
  const endTotal = sH * 60 + sM + totalMins
  const endStr = `${String(Math.floor(endTotal / 60)).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`

  const displayDate = booking.appointment_date
    ? new Date(booking.appointment_date + 'T00:00:00').toLocaleDateString(
        'en-US',
        { weekday: 'long', month: 'long', day: 'numeric' }
      )
    : ''

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full p-6 relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X size={20} />
        </button>

        <h2 className="font-bold text-xl text-anaya-text mb-1">
          Appointment Details
        </h2>
        <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
          <span>ID: #{booking.reference_id}</span>
          <span>📅 {displayDate}</span>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          🕐 {to12h(startStr)} – {to12h(endStr)} ({formatDuration(totalMins)})
        </p>

        <div className="border-t border-gray-100 pt-4 mb-4">
          <h3 className="font-semibold text-anaya-text mb-3">Services</h3>
          {services.map((bs) => (
            <div
              key={bs.id}
              className="flex justify-between items-start text-sm mb-2"
            >
              <div>
                <p className="font-medium text-anaya-text">
                  [{bs.services?.service_categories?.name}]{' '}
                  {bs.services?.name}
                </p>
                <p className="text-xs text-gray-400">
                  {bs.duration_at_booking} min
                </p>
              </div>
              <span className="font-medium text-anaya-text shrink-0 ml-3">
                ₱{Number(bs.price_at_booking).toLocaleString()}
              </span>
            </div>
          ))}
          <p className="text-sm text-gray-500 mt-2">
            Professional:{' '}
            {booking.professional_preference === 'any'
              ? 'Any Available'
              : booking.professional_preference}
          </p>
        </div>

        {booking.booking_notes && (
          <div className="border-t border-gray-100 pt-4 mb-4">
            <h3 className="font-semibold text-anaya-text mb-2">
              Booking Notes
            </h3>
            <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
              {booking.booking_notes}
            </p>
          </div>
        )}

        <div className="border-t border-gray-100 pt-4 space-y-2 text-sm mb-5">
          <div className="flex justify-between text-gray-500">
            <span>Subtotal</span>
            <span>₱{Number(booking.subtotal).toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-bold text-anaya-text">
            <span>Total</span>
            <span>₱{Number(booking.subtotal).toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Down Payment (10%)</span>
            <span>₱{Number(booking.downpayment_amount).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Balance (Pay at venue)</span>
            <span>₱{Number(booking.remaining_balance).toFixed(2)}</span>
          </div>
        </div>

        {booking.downpayment_status === 'pending' && (
          <button
            onClick={() => navigate(`/booking/payment/${booking.id}`)}
            className="w-full bg-anaya-accent hover:bg-anaya-accent-hover text-white py-3 rounded-xl font-medium transition-colors"
          >
            Pay Down Payment
          </button>
        )}
      </div>
    </div>
  )
}

export default AppointmentDetailModal
