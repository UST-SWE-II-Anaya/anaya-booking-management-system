import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import {
  getMyAppointmentById,
  claimAppointment,
} from '../../services/staffAppointmentService'
import {
  updateBookingStatus,
  settleBalance,
  cancelBooking,
} from '../../services/bookingService'
import Badge from '../../components/common/Badge'
import Spinner from '../../components/common/Spinner'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import PaymentVerificationModal from '../../components/admin/payments/PaymentVerificationModal'
import useAuthStore from '../../store/authStore'

const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

const formatTime = (time) => {
  if (!time) return '—'
  const [h, m] = time.split(':')
  const hour = parseInt(h, 10)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

const StaffAppointmentDetailPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [booking, setBooking] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [verifyOpen, setVerifyOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const staffId = user?.id

  const load = () => {
    if (!id || !staffId) return
    setLoading(true)
    getMyAppointmentById(id, staffId)
      .then(setBooking)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id, staffId])

  const handleConfirm = async () => {
    if (!confirm) return
    setActionLoading(true)
    try {
      if (confirm.action === 'settle') await settleBalance(id)
      else if (confirm.action === 'cancel') await cancelBooking(id, user.id)
      else if (confirm.action === 'claim') await claimAppointment(id, staffId)
      else await updateBookingStatus(id, confirm.action)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(false)
      setConfirm(null)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>
  if (error) return (
    <div className="max-w-3xl">
      <p className="text-red-600 bg-red-50 rounded-lg p-4 text-sm">{error}</p>
      <button
        onClick={() => navigate('/staff/appointments')}
        className="mt-4 flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={16} /> Back to Appointments
      </button>
    </div>
  )
  if (!booking) return null

  const payment = booking.payments?.[0]
  const isUnassigned = !booking.staff_id

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-semibold text-[#2C2C2C]">
          Appointment {booking.reference_id}
        </h1>
        <Badge variant={booking.booking_status} label={booking.booking_status} />
        {isUnassigned && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full
            bg-orange-100 text-orange-600 uppercase tracking-wide">
            Unassigned
          </span>
        )}
      </div>

      {/* Overview */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-[#2C2C2C] mb-4">Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
              Date
            </p>
            <p className="text-[#4A4A4A]">{formatDate(booking.appointment_date)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
              Time
            </p>
            <p className="text-[#4A4A4A]">
              {formatTime(booking.start_time)}
              {' '}({booking.total_duration_minutes} min)
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
              Customer
            </p>
            <p className="text-[#4A4A4A] font-medium">
              {booking.customer
                ? `${booking.customer.first_name} ${booking.customer.last_name}`
                : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
              Professional Preference
            </p>
            <p className="text-[#4A4A4A] capitalize">
              {booking.professional_preference?.replace('_', ' ')}
            </p>
          </div>
        </div>
      </div>

      {/* Services */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-[#2C2C2C] mb-4">Services</h2>
        <div className="space-y-2">
          {booking.booking_services?.map((bs) => (
            <div key={bs.id} className="flex justify-between text-sm">
              <span className="text-[#4A4A4A]">{bs.services?.name}</span>
              <span className="text-gray-500">
                ₱{Number(bs.price_at_booking).toFixed(2)}
                {' '}· {bs.duration_at_booking} min
              </span>
            </div>
          ))}
          <div className="border-t border-gray-100 pt-2 flex justify-between
            text-sm font-semibold">
            <span>Total</span>
            <span>₱{Number(booking.subtotal).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Payment */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-[#2C2C2C] mb-4">Payment</h2>
        <div className="grid grid-cols-3 gap-4 text-sm mb-4">
          <div>
            <p className="text-xs text-gray-400 mb-1">Downpayment</p>
            <p className="font-medium">₱{Number(booking.downpayment_amount).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Remaining</p>
            <p className="font-medium">₱{Number(booking.remaining_balance).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Balance Settled</p>
            <p className="font-medium">{booking.balance_settled ? 'Yes' : 'No'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant={booking.downpayment_status}
            label={`Downpayment: ${booking.downpayment_status}`}
          />
          {['pending', 'paid', 'verified'].includes(booking.downpayment_status) && payment && (
            <button
              onClick={() => setVerifyOpen(true)}
              className="text-sm text-[#CE845D] hover:underline"
            >
              {booking.downpayment_status === 'verified' ? 'View GCash Receipt' : 'Review GCash Receipt'}
            </button>
          )}
          {!isUnassigned && !booking.balance_settled && booking.booking_status === 'upcoming' && (
            <button
              onClick={() =>
                setConfirm({
                  action: 'settle',
                  label: 'Mark Balance Settled',
                  message:
                    'Confirm that the customer has paid the remaining balance in person.',
                })
              }
              className="text-sm text-[#8A956D] hover:underline"
            >
              Mark Balance Settled
            </button>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-[#2C2C2C] mb-4">Actions</h2>
        <div className="flex flex-wrap gap-3">
          {isUnassigned && booking.booking_status === 'upcoming' && (
            <button
              onClick={() =>
                setConfirm({
                  action: 'claim',
                  label: 'Take this session',
                  message: 'Are you sure you want to take this appointment?',
                })
              }
              className="px-4 py-2 bg-[#8A956D] hover:bg-[#7a8560] text-white
                text-sm rounded-lg font-medium transition-colors"
            >
              Take this session
            </button>
          )}

          {!isUnassigned && booking.booking_status === 'upcoming' && (
            <>
              <button
                onClick={() =>
                  setConfirm({
                    action: 'finished',
                    label: 'Mark as Finished',
                    message: 'Mark this appointment as finished?',
                  })
                }
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white
                  text-sm rounded-lg font-medium transition-colors"
              >
                Mark Finished
              </button>
              <button
                onClick={() =>
                  setConfirm({
                    action: 'no_show',
                    label: 'Mark as No Show',
                    message: 'Mark this customer as a no-show?',
                  })
                }
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white
                  text-sm rounded-lg font-medium transition-colors"
              >
                Mark No Show
              </button>
              <button
                onClick={() =>
                  setConfirm({
                    action: 'cancel',
                    label: 'Cancel Appointment',
                    message: 'Cancel this appointment? This cannot be undone.',
                    danger: true,
                  })
                }
                className="px-4 py-2 border border-red-200 text-red-600 text-sm
                  rounded-lg font-medium hover:bg-red-50 transition-colors"
              >
                Cancel Appointment
              </button>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={handleConfirm}
        title={confirm?.label ?? ''}
        message={confirm?.message ?? ''}
        confirmLabel={actionLoading ? 'Processing…' : confirm?.label}
        danger={confirm?.danger}
      />

      <PaymentVerificationModal
        open={verifyOpen}
        booking={booking}
        onClose={() => setVerifyOpen(false)}
        onUpdated={load}
      />
    </div>
  )
}

export default StaffAppointmentDetailPage
