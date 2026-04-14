// src/pages/admin/bookings/BookingDetailPage.jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import {
  getBookingById,
  updateBookingStatus,
  settleBalance,
  cancelBooking,
} from '../../../services/bookingService'
import Badge from '../../../components/common/Badge'
import Spinner from '../../../components/common/Spinner'
import ConfirmDialog from '../../../components/common/ConfirmDialog'
import PaymentVerificationModal from '../../../components/admin/payments/PaymentVerificationModal'
import useAuthStore from '../../../store/authStore'

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

const BookingDetailPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [booking, setBooking] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [verifyOpen, setVerifyOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const load = () => {
    setLoading(true)
    getBookingById(id)
      .then(setBooking)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])

  const handleConfirm = async () => {
    if (!confirm) return
    setActionLoading(true)
    try {
      if (confirm.action === 'settle') await settleBalance(id)
      else if (confirm.action === 'cancel') await cancelBooking(id, user.id)
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
    <p className="text-red-600 bg-red-50 rounded-lg p-4 text-sm">{error}</p>
  )
  if (!booking) return null

  const payment = booking.payments?.[0]

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/admin/bookings')}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-semibold text-[#2C2C2C]">
          Booking {booking.reference_id}
        </h1>
        <Badge variant={booking.booking_status} label={booking.booking_status} />
      </div>

      {/* Overview */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-[#2C2C2C] mb-4">Overview</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
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
            <p className="text-xs text-gray-400">{booking.customer?.email}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
              Staff
            </p>
            <p className="text-[#4A4A4A]">
              {booking.staff
                ? `${booking.staff.first_name} ${booking.staff.last_name}`
                : 'Unassigned'}
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
          {!booking.balance_settled && booking.booking_status === 'upcoming' && (
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
      {booking.booking_status === 'upcoming' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-[#2C2C2C] mb-4">Actions</h2>
          <div className="flex flex-wrap gap-3">
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
                  label: 'Cancel Booking',
                  message: 'Cancel this booking? This cannot be undone.',
                  danger: true,
                })
              }
              className="px-4 py-2 border border-red-200 text-red-600 text-sm
                rounded-lg font-medium hover:bg-red-50 transition-colors"
            >
              Cancel Booking
            </button>
          </div>
        </div>
      )}

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

export default BookingDetailPage
