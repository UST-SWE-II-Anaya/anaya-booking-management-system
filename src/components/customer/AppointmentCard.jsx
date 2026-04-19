import clsx from 'clsx'
import { formatDuration } from '../../utils/bookingUtils'

const DOWNPAYMENT_LABEL = {
  pending: 'Pending',
  paid: 'Checking',
  verified: 'Paid',
  denied: 'Denied',
}

const BOOKING_STATUS_COLOR = {
  upcoming: 'text-anaya-green',
  finished: 'text-gray-500',
  cancelled: 'text-red-500',
  no_show: 'text-red-400',
}

const DOWNPAYMENT_COLOR = {
  pending: 'text-yellow-600',
  paid: 'text-blue-600',
  verified: 'text-green-600',
  denied: 'text-red-600',
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
  const isUpcoming = booking.booking_status === 'upcoming'
  const deadline = booking.payment_deadline ? new Date(booking.payment_deadline) : null
  const hoursLeft = deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 3_600_000)) : 0
  const showCountdown = isPending && deadline && deadline > Date.now()
  const isExpired = isPending && deadline !== null && deadline <= Date.now()

  const displayDate = booking.appointment_date
    ? new Date(booking.appointment_date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
    : ''

  const startTime = booking.start_time ? to12h(booking.start_time.slice(0, 5)) : ''

  return (
    <div
      className="bg-white border border-gray-200 rounded-xl p-5 cursor-pointer hover:border-gray-300 transition-colors"
      onClick={() => onViewDetail(booking)}
    >
      {/* Top info row */}
      <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm mb-3">
        <div>
          <span className="text-xs text-gray-400">Appointment ID</span>
          <p className="font-semibold text-anaya-text">#{booking.reference_id}</p>
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
        <div className="flex-1 min-w-0">
          <span className="text-xs text-gray-400">Service/s</span>
          <div className="font-medium text-anaya-text">
            {services.map((bs) => (
              <p key={bs.id} className="text-sm truncate">
                [{bs.services?.service_categories?.name}] {bs.services?.name}
              </p>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div>
            <span className="text-xs text-gray-400 block text-right">Balance</span>
            <p className="font-semibold text-anaya-text text-right">
              ₱{Number(booking.remaining_balance).toLocaleString()}
            </p>
          </div>
          {/* Action buttons aligned top-right */}
          {isUpcoming && (
            <div
              className="flex flex-col gap-1.5 items-end"
              onClick={(e) => e.stopPropagation()}
            >
              {isPending && !isExpired && (
                <button
                  onClick={() => onPay(booking)}
                  className="bg-anaya-accent hover:bg-anaya-accent-hover text-white text-xs px-4 py-1.5 rounded-full font-medium transition-colors whitespace-nowrap"
                >
                  Pay Down Payment
                </button>
              )}
              {!isExpired && (
                <button
                  onClick={() => onCancel(booking)}
                  className="bg-anaya-accent hover:bg-anaya-accent-hover text-white text-xs px-4 py-1.5 rounded-full font-medium transition-colors whitespace-nowrap"
                >
                  Cancel Reservation
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Services breakdown (for multi-service bookings) */}
      {services.length > 1 && (
        <div className="mb-3 pl-0">
          {services.map((bs) => (
            <div key={bs.id} className="flex justify-between text-sm text-gray-500 mb-0.5">
              <span>[{bs.services?.service_categories?.name}] {bs.services?.name}</span>
              <span className="shrink-0 ml-4">
                ₱{Number(bs.price_at_booking).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Status row */}
      <div className="flex flex-wrap gap-x-8 gap-y-1 items-center">
        <div>
          <span className="text-xs text-gray-400 block">Appointment Status</span>
          <span className={clsx('text-xs font-medium capitalize', BOOKING_STATUS_COLOR[booking.booking_status] ?? 'text-gray-500')}>
            {booking.booking_status === 'no_show' ? 'No Show' : (
              booking.booking_status.charAt(0).toUpperCase() + booking.booking_status.slice(1)
            )}
          </span>
        </div>
        <div>
          <span className="text-xs text-gray-400 block">Down Payment Status</span>
          <span className={clsx('text-xs font-medium', DOWNPAYMENT_COLOR[booking.downpayment_status] ?? 'text-gray-500')}>
            {DOWNPAYMENT_LABEL[booking.downpayment_status] ?? booking.downpayment_status}
          </span>
        </div>
        <div>
          <span className="text-xs text-gray-400 block">Down Payment Total</span>
          <span className="text-xs font-medium text-anaya-text">
            ₱{Number(booking.downpayment_amount).toFixed(2)}
          </span>
        </div>
        {isExpired ? (
          <span className="text-xs text-red-500 ml-auto">
            Payment deadline passed — booking will be cancelled automatically
          </span>
        ) : showCountdown ? (
          <span className="text-xs text-orange-500 ml-auto">
            Time left to pay: {hoursLeft} hour{hoursLeft !== 1 ? 's' : ''}
          </span>
        ) : null}
      </div>
    </div>
  )
}

export default AppointmentCard
