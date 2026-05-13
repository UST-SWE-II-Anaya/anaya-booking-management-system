import { useNavigate } from 'react-router-dom'
import { formatDuration, to12h, professionalLabel } from '../../utils/bookingUtils'

const AppointmentDetailModal = ({ booking, onClose }) => {
  const navigate = useNavigate()
  if (!booking) return null

  const services = booking.booking_services ?? []
  const totalMins = booking.total_duration_minutes ?? 0
  const startStr = booking.start_time ? booking.start_time.slice(0, 5) : '00:00'
  const [sH, sM] = startStr.split(':').map(Number)
  const endTotal = sH * 60 + sM + totalMins
  const endStr = `${String(Math.floor(endTotal / 60)).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`

  const displayDate = booking.appointment_date
    ? new Date(booking.appointment_date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
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
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-colors"
        >
          ×
        </button>

        {/* Header */}
        <h2 className="font-bold text-lg text-anaya-text mb-3">
          Appointment Details
        </h2>

        <div className="flex items-start gap-4 pb-4 border-b border-gray-100">
          <div>
            <p className="text-sm text-gray-500">ID: #{booking.reference_id}</p>
          </div>
          <div className="ml-auto text-right">
            <div className="flex items-center gap-1.5 text-sm text-anaya-text justify-end mb-0.5">
              <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span className="font-medium">{displayDate}</span>
            </div>
            <p className="text-sm text-gray-500">
              {to12h(startStr)} – {to12h(endStr)} ({formatDuration(totalMins)})
            </p>
          </div>
        </div>

        {/* Services */}
        <div className="pt-4 mb-4">
          <h3 className="font-semibold text-anaya-text mb-3">Services</h3>
          {services.map((bs) => (
            <div key={bs.id} className="flex justify-between items-start text-sm mb-2">
              <div>
                <p className="font-medium text-anaya-text">
                  [{bs.services?.service_categories?.name}] {bs.services?.name}
                </p>
                <p className="text-xs text-gray-400">
                  {formatDuration(bs.duration_at_booking)}
                </p>
              </div>
              <span className="font-medium text-anaya-text shrink-0 ml-4">
                ₱{Number(bs.price_at_booking).toLocaleString()}
              </span>
            </div>
          ))}
          <p className="text-sm text-gray-500 mt-1">
            Professional: {professionalLabel(booking.professional_preference)}
          </p>
        </div>

        {/* Booking Notes */}
        <div className="border-t border-gray-100 pt-4 mb-4">
          <h3 className="font-semibold text-anaya-text mb-2">Booking Notes</h3>
          <div className="border border-gray-200 rounded-lg p-3 text-sm text-gray-600 min-h-[64px] bg-gray-50">
            {booking.booking_notes || (
              <span className="text-gray-400 italic">No notes added.</span>
            )}
          </div>
        </div>

        {/* Totals */}
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
            <span>Down Payment</span>
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
