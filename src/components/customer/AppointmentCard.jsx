import clsx from 'clsx'
import { formatDuration } from '../../utils/bookingUtils'

const STATUS_LABEL = {
  pending: 'Pending',
  paid: 'Checking',
  verified: 'Paid',
  denied: 'Denied',
}

const STATUS_COLORS = {
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  paid: 'bg-blue-50 text-blue-700 border-blue-200',
  verified: 'bg-green-50 text-green-700 border-green-200',
  denied: 'bg-red-50 text-red-700 border-red-200',
}

const to12h = (time24) => {
  if (!time24) return ''
  const [h, m] = time24.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

const AppointmentCard = ({ booking, onViewDetail, onPay, onCancel }) => {
  const services = booking.booking_services ?? []
  const isPending = booking.downpayment_status === 'pending'
  const deadline = booking.payment_deadline
    ? new Date(booking.payment_deadline)
    : null
  const hoursLeft = deadline
    ? Math.max(0, Math.ceil((deadline - Date.now()) / 3_600_000))
    : 0
  const showCountdown = isPending && deadline && deadline > Date.now()

  const displayDate = booking.appointment_date
    ? new Date(booking.appointment_date + 'T00:00:00').toLocaleDateString(
        'en-US',
        { weekday: 'long', month: 'long', day: 'numeric' }
      )
    : ''

  const startTime = booking.start_time
    ? to12h(booking.start_time.slice(0, 5))
    : ''

  return (
    <div
      className="bg-white border border-gray-200 rounded-xl p-5 cursor-pointer hover:border-anaya-accent/50 transition-colors"
      onClick={() => onViewDetail(booking)}
    >
      {/* Top row */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm mb-3">
        <div>
          <span className="text-xs text-gray-400">Appointment ID</span>
          <p className="font-semibold text-anaya-text">
            #{booking.reference_id}
          </p>
        </div>
        <div>
          <span className="text-xs text-gray-400">Date</span>
          <p className="font-medium text-anaya-text">{displayDate}</p>
        </div>
        <div>
          <span className="text-xs text-gray-400">Time</span>
          <p className="font-medium text-anaya-text">{startTime}</p>
        </div>
        <div>
          <span className="text-xs text-gray-400">Duration</span>
          <p className="font-medium text-anaya-text">
            {formatDuration(booking.total_duration_minutes ?? 0)}
          </p>
        </div>
        <div className="flex-1">
          <span className="text-xs text-gray-400">Service/s</span>
          <div className="font-medium text-anaya-text">
            {services.map((bs) => (
              <p key={bs.id} className="text-sm">
                [{bs.services?.service_categories?.name}] {bs.services?.name}
              </p>
            ))}
          </div>
        </div>
        <div>
          <span className="text-xs text-gray-400">Balance</span>
          <p className="font-semibold text-anaya-text">
            ₱{Number(booking.remaining_balance).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Status row */}
      <div className="flex flex-wrap gap-3 items-center mb-3">
        <div>
          <span className="text-xs text-gray-400 block mb-1">
            Appointment Status
          </span>
          <span className="text-xs font-medium text-anaya-green capitalize">
            {booking.booking_status}
          </span>
        </div>
        <div>
          <span className="text-xs text-gray-400 block mb-1">
            Down Payment Status
          </span>
          <span
            className={clsx(
              'text-xs font-medium border rounded-full px-2 py-0.5',
              STATUS_COLORS[booking.downpayment_status] ??
                'bg-gray-50 text-gray-600 border-gray-200'
            )}
          >
            {STATUS_LABEL[booking.downpayment_status] ??
              booking.downpayment_status}
          </span>
        </div>
        <div>
          <span className="text-xs text-gray-400 block mb-1">
            Down Payment Total
          </span>
          <span className="text-xs font-medium text-anaya-text">
            ₱{Number(booking.downpayment_amount).toFixed(2)}
          </span>
        </div>
        {showCountdown && (
          <span className="text-xs text-orange-500 ml-auto">
            Time left to pay: {hoursLeft} hour{hoursLeft !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Action buttons */}
      {booking.booking_status === 'upcoming' && (
        <div
          className="flex gap-2 pt-1"
          onClick={(e) => e.stopPropagation()}
        >
          {isPending && (
            <button
              onClick={() => onPay(booking)}
              className="bg-anaya-accent hover:bg-anaya-accent-hover text-white text-xs px-4 py-2 rounded-full font-medium transition-colors"
            >
              Pay Down Payment
            </button>
          )}
          <button
            onClick={() => onCancel(booking)}
            className="bg-anaya-accent hover:bg-anaya-accent-hover text-white text-xs px-4 py-2 rounded-full font-medium transition-colors"
          >
            Cancel Reservation
          </button>
        </div>
      )}
    </div>
  )
}

export default AppointmentCard
