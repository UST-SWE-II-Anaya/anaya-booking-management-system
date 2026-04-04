// src/components/admin/payments/PaymentVerificationModal.jsx
import { useState } from 'react'
import { CheckCircle, XCircle, ExternalLink } from 'lucide-react'
import Modal from '../../common/Modal'
import Badge from '../../common/Badge'
import { verifyPayment, denyPayment } from '../../../services/paymentService'
import useAuthStore from '../../../store/authStore'

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   booking: object | null,
 *   onUpdated: () => void
 * }} props
 */
const PaymentVerificationModal = ({ open, onClose, booking, onUpdated }) => {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  if (!booking) return null
  const payment = booking.payments?.[0]

  const handleVerify = async () => {
    if (!payment) return
    setLoading(true)
    setError(null)
    try {
      await verifyPayment(payment.id, booking.id, user.id)
      onUpdated()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeny = async () => {
    if (!payment) return
    setLoading(true)
    setError(null)
    try {
      await denyPayment(payment.id, booking.id)
      onUpdated()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Payment Verification"
      size="lg"
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
              Booking Ref
            </p>
            <p className="font-medium text-[#2C2C2C]">
              {booking.reference_id}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
              Customer
            </p>
            <p className="font-medium text-[#2C2C2C]">
              {booking.customer
                ? `${booking.customer.first_name} ${booking.customer.last_name}`
                : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
              Downpayment
            </p>
            <p className="font-medium text-[#2C2C2C]">
              ₱{Number(booking.downpayment_amount).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
              Status
            </p>
            <Badge
              variant={booking.downpayment_status}
              label={booking.downpayment_status}
            />
          </div>
        </div>

        {payment ? (
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium text-[#2C2C2C]">GCash Receipt</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-400">Reference No.</p>
                <p className="font-mono text-[#4A4A4A]">
                  {payment.reference_number}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Account Name</p>
                <p className="text-[#4A4A4A]">{payment.account_name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Amount Paid</p>
                <p className="font-medium text-[#4A4A4A]">
                  ₱{Number(payment.amount).toFixed(2)}
                </p>
              </div>
            </div>
            {payment.receipt_url && (
              <a
                href={payment.receipt_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-[#CE845D]
                  hover:underline"
              >
                <ExternalLink size={13} />
                View Receipt Screenshot
              </a>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">
            No payment submitted yet.
          </p>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {payment && booking.downpayment_status === 'pending' && (
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleDeny}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5
                border border-red-200 text-red-600 rounded-lg text-sm font-medium
                hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              <XCircle size={15} />
              Deny
            </button>
            <button
              onClick={handleVerify}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5
                bg-[#8A956D] hover:bg-[#7a8560] text-white rounded-lg text-sm
                font-medium transition-colors disabled:opacity-50"
            >
              <CheckCircle size={15} />
              Verify & Approve
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default PaymentVerificationModal
