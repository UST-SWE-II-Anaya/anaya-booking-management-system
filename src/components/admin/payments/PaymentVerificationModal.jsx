// src/components/admin/payments/PaymentVerificationModal.jsx
import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, ExternalLink, ArrowLeft } from 'lucide-react'
import clsx from 'clsx'
import Modal from '../../common/Modal'
import Badge from '../../common/Badge'
import { verifyAndAssignPayment, denyPayment } from '../../../services/paymentService'
import { getAssignableStaff } from '../../../services/staffService'
import useAuthStore from '../../../store/authStore'

const PREF_LABELS = {
  any: 'Any Professional',
  any_female: 'Any Female Professional',
  any_male: 'Any Male Professional',
}

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   booking: object | null,
 *   onUpdated: () => void,
 *   readOnly?: boolean
 * }} props
 */
const PaymentVerificationModal = ({ open, onClose, booking, onUpdated, readOnly = false }) => {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [step, setStep] = useState('review')
  const [staffList, setStaffList] = useState([])
  const [loadingStaff, setLoadingStaff] = useState(false)
  const [selectedStaffId, setSelectedStaffId] = useState(null)

  const payment = booking?.payments?.[0]

  useEffect(() => {
    if (!open) {
      setStep('review')
      setSelectedStaffId(null)
      setError(null)
      setStaffList([])
    }
  }, [open])

  useEffect(() => {
    if (step !== 'assign' || !booking) return
    setLoadingStaff(true)
    getAssignableStaff(booking.professional_preference)
      .then(setStaffList)
      .catch((err) => setError(err.message))
      .finally(() => setLoadingStaff(false))
  }, [step, booking?.professional_preference])

  if (!booking) return null

  const handleProceedToAssign = () => {
    setError(null)
    setStep('assign')
  }

  const handleConfirmAssignment = async () => {
    if (!payment || !selectedStaffId) return
    setLoading(true)
    setError(null)
    try {
      await verifyAndAssignPayment(payment.id, booking.id, selectedStaffId, user.id)
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
      title={step === 'review' ? 'Payment Verification' : 'Assign Staff Member'}
      size="lg"
    >
      {step === 'review' ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                Booking Ref
              </p>
              <p className="font-medium text-[#2C2C2C]">{booking.reference_id}</p>
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
              <Badge variant={booking.downpayment_status} label={booking.downpayment_status} />
            </div>
          </div>

          {payment ? (
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-[#2C2C2C]">GCash Receipt</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-400">Reference No.</p>
                  <p className="font-mono text-[#4A4A4A]">{payment.reference_number}</p>
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

          {readOnly && payment && (
            <p className="text-sm text-gray-500 italic text-center py-2">
              Payment verification is handled by an admin.
            </p>
          )}

          {!readOnly && payment && ['pending', 'paid'].includes(booking.downpayment_status) && (
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
                onClick={handleProceedToAssign}
                disabled={loading || !payment}
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
      ) : (
        <div className="space-y-5">
          <button
            onClick={() => { setStep('review'); setSelectedStaffId(null); setError(null) }}
            className="flex items-center gap-1.5 text-sm text-gray-500
              hover:text-[#2C2C2C] transition-colors"
          >
            <ArrowLeft size={14} />
            Back to payment review
          </button>

          <div className="bg-blue-50 rounded-xl px-4 py-3 text-sm">
            <span className="text-gray-500">Customer preference: </span>
            <span className="font-medium text-[#2C2C2C]">
              {PREF_LABELS[booking.professional_preference] ?? 'Any Professional'}
            </span>
          </div>

          {loadingStaff ? (
            <p className="text-sm text-gray-400 text-center py-6">Loading staff…</p>
          ) : staffList.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              No available staff members match this preference.
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {staffList.map((s) => {
                const isSelected = selectedStaffId === s.id
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStaffId(s.id)}
                    className={clsx(
                      'w-full flex items-center gap-3 p-3 rounded-xl border',
                      'text-left transition-colors',
                      isSelected
                        ? 'bg-[#8A956D]/10 border-[#8A956D]'
                        : 'bg-white border-gray-200 hover:border-[#8A956D]'
                    )}
                  >
                    {s.avatar_url ? (
                      <img
                        src={s.avatar_url}
                        alt={`${s.first_name} ${s.last_name}`}
                        className="w-10 h-10 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center
                        justify-center text-sm font-bold text-gray-500 shrink-0">
                        {s.first_name?.[0]}{s.last_name?.[0]}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[#2C2C2C] text-sm">
                        {s.first_name} {s.last_name}
                      </p>
                      {s.staff_details?.job_title && (
                        <p className="text-xs text-gray-400 truncate">
                          {s.staff_details.job_title}
                        </p>
                      )}
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-[#8A956D] flex items-center
                        justify-center text-white shrink-0">
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="pt-2">
            <button
              onClick={handleConfirmAssignment}
              disabled={!selectedStaffId || loading}
              className="w-full flex items-center justify-center gap-2 py-2.5
                bg-[#8A956D] hover:bg-[#7a8560] text-white rounded-lg text-sm font-medium
                transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle size={15} />
              {loading ? 'Confirming…' : 'Confirm Assignment'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default PaymentVerificationModal
