import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { supabase } from '../../services/supabaseClient'
import { getMyBookingById } from '../../services/customerBookingService'
import { formatDuration } from '../../utils/bookingUtils'
import useAuthStore from '../../store/authStore'
import useSiteSettings from '../../hooks/useSiteSettings'

const to12h = (time24) => {
  if (!time24) return ''
  const [h, m] = time24.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

// GCash QR placeholder — replace src with actual QR image paths when available
const GCashCard = ({ number }) => (
  <div className="flex-1 flex flex-col items-center">
    <div className="w-full rounded-xl overflow-hidden border-2 border-blue-200 bg-blue-600 flex flex-col items-center py-4 px-3">
      <div className="flex items-center gap-1.5 mb-3">
        <div className="bg-white rounded-full w-6 h-6 flex items-center justify-center">
          <span className="text-blue-600 font-black text-xs">G</span>
        </div>
        <span className="text-white font-bold text-sm tracking-wide">GCash</span>
      </div>
      <p className="text-blue-200 text-xs mb-2 font-medium tracking-wider">SCAN TO PAY HERE</p>
      {/* Replace with: <img src={`/gcash-qr-${number}.png`} ... /> when QR images are available */}
      <div className="w-28 h-28 bg-white rounded-lg flex items-center justify-center">
        <div className="grid grid-cols-5 gap-0.5 p-2 w-full h-full">
          {Array.from({ length: 25 }).map((_, i) => (
            <div
              key={i}
              className="bg-gray-800 rounded-sm"
              style={{ opacity: Math.random() > 0.4 ? 1 : 0 }}
            />
          ))}
        </div>
      </div>
    </div>
    <p className="text-sm font-semibold text-anaya-text mt-2">GCASH #{number}</p>
  </div>
)

const PaymentStep = () => {
  const { bookingId } = useParams()
  const navigate = useNavigate()
  const { user: currentUser } = useAuthStore()
  const [booking, setBooking] = useState(null)
  const [refNumber, setRefNumber] = useState('')
  const [accountName, setAccountName] = useState('')
  const [receipt, setReceipt] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const { settings } = useSiteSettings()
  const downpaymentPctLabel = `${settings?.downpayment_rate?.percentage ?? 10}% of Total`

  useEffect(() => {
    getMyBookingById(bookingId).then(setBooking)
  }, [bookingId])

  const handleFile = (file) => {
    if (!file) return
    if (!['image/jpeg', 'image/jpg'].includes(file.type)) {
      toast.error('Only JPG/JPEG files are allowed.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File must be under 5MB.')
      return
    }
    setReceipt(file)
  }

  const handleConfirm = async () => {
    if (!refNumber.match(/^\d{13}$/)) {
      toast.error('Reference number must be exactly 13 digits.')
      return
    }
    if (!accountName.trim()) {
      toast.error('Account name is required.')
      return
    }
    if (!receipt) {
      toast.error('Receipt image is required.')
      return
    }

    if (!currentUser?.id) {
      toast.error('User session not found. Please log in again.')
      return
    }

    setSubmitting(true)
    try {
      // 1. Upload Receipt
      const path = `${currentUser.id}/${Date.now()}_${receipt.name}`
      const { error: uploadErr } = await supabase.storage
        .from('payment-receipts')
        .upload(path, receipt)
      
      if (uploadErr) {
        console.error('Upload Error:', uploadErr)
        throw new Error(`Upload failed: ${uploadErr.message}`)
      }

      const { data: urlData } = supabase.storage
        .from('payment-receipts')
        .getPublicUrl(path)

      // 2. Insert Payment Record
      const { error: insertErr } = await supabase.from('payments').insert({
        booking_id: bookingId,
        reference_number: refNumber,
        account_name: accountName,
        receipt_url: urlData.publicUrl,
        amount: booking.downpayment_amount,
        status: 'paid',
      })
      
      if (insertErr) {
        console.error('Insert Error:', insertErr)
        throw new Error(`Record creation failed: ${insertErr.message}`)
      }

      // 3. Update Booking Status
      const { error: updateErr } = await supabase
        .from('bookings')
        .update({ downpayment_status: 'paid' })
        .eq('id', bookingId)
      
      if (updateErr) {
        console.error('Update Error:', updateErr)
        throw new Error(`Booking update failed: ${updateErr.message}`)
      }

      navigate(`/booking/success/${bookingId}`)
    } catch {
      toast.error('Payment submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!booking) return (
    <div className="min-h-screen bg-anaya-bg flex items-center justify-center">
      <p className="text-gray-500">Loading...</p>
    </div>
  )

  const services = booking.booking_services ?? []
  const subtotal = booking.subtotal ?? 0
  const downPayment = booking.downpayment_amount ?? 0
  const balance = booking.remaining_balance ?? 0
  const totalMins = booking.total_duration_minutes ?? 0
  const startTimeStr = (booking.start_time ?? '00:00').slice(0, 5)
  const [startH, startM] = startTimeStr.split(':').map(Number)
  const endTotal = startH * 60 + startM + totalMins
  const endTime = to12h(
    `${String(Math.floor(endTotal / 60)).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`
  )

  const displayDate = booking.appointment_date
    ? new Date(booking.appointment_date + 'T00:00:00').toLocaleDateString(
        'en-US',
        { weekday: 'long', month: 'long', day: 'numeric' }
      )
    : ''

  return (
    <div className="min-h-screen bg-anaya-bg">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <Link
          to="/dashboard"
          className="text-sm text-gray-500 hover:underline mb-4 inline-block"
        >
          ← Go Back to My Appointment
        </Link>
        <div className="flex gap-8 items-start">
          {/* Left panel */}
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-anaya-text mb-1">
              Payment
            </h1>
            <p className="text-gray-500 mb-6">
              Settle your payment to confirm your booking.
            </p>

            {/* GCash QR codes */}
            <div className="flex gap-6 mb-8 max-w-sm">
              <GCashCard number={1} />
              <GCashCard number={2} />
            </div>

            <h2 className="font-semibold text-anaya-text mb-4">
              Enter payment details
            </h2>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-anaya-text mb-1">
                    Reference Number (13 digits)*
                  </label>
                  <input
                    type="text"
                    value={refNumber}
                    onChange={(e) =>
                      setRefNumber(e.target.value.replace(/\D/g, '').slice(0, 13))
                    }
                    placeholder="e.g. 1234567890ABC"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-anaya-accent bg-white"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-anaya-text mb-1">
                    Account Name*
                  </label>
                  <input
                    type="text"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-anaya-accent bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-anaya-text mb-1">
                  Upload proof of payment*
                </label>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragOver(false)
                    handleFile(e.dataTransfer.files[0])
                  }}
                  onClick={() => document.getElementById('receipt-input').click()}
                  className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                    dragOver
                      ? 'border-anaya-accent bg-anaya-accent/5'
                      : 'border-gray-300 bg-white hover:border-anaya-accent'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
                    </svg>
                    <p className="text-sm text-anaya-text font-medium">
                      {receipt ? receipt.name : 'Upload a file or drag and drop'}
                    </p>
                    <p className="text-xs text-gray-400">JPG, JPEG up to 5MB</p>
                  </div>
                  <input
                    id="receipt-input"
                    type="file"
                    accept=".jpg,.jpeg"
                    className="hidden"
                    onChange={(e) => handleFile(e.target.files[0])}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right sidebar */}
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
                {to12h(startTimeStr)} – {endTime} ({formatDuration(totalMins)})
              </span>
            </div>

            <ul className="space-y-2 mb-4">
              {services.map((bs) => (
                <li key={bs.id} className="flex justify-between text-sm text-anaya-text">
                  <div className="flex-1 pr-2">
                    <p className="font-medium leading-snug">{bs.services?.name}</p>
                    <p className="text-xs text-gray-400">
                      {formatDuration(bs.duration_at_booking)} with any professional
                    </p>
                  </div>
                  <span className="font-medium shrink-0">
                    ₱{Number(bs.price_at_booking).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>

            <div className="border-t border-gray-100 pt-3 space-y-2 text-sm mb-5">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal:</span>
                <span>₱{Number(subtotal).toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-semibold text-anaya-text">
                <span>Total:</span>
                <span>₱{Number(subtotal).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>
                  Down Payment
                  <br />
                  <span className="text-xs">({downpaymentPctLabel}):</span>
                </span>
                <span>₱{Number(downPayment).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Pay at venue:</span>
                <span>₱{Number(balance).toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={handleConfirm}
              disabled={submitting}
              className="w-full bg-anaya-accent hover:bg-anaya-accent-hover text-white py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PaymentStep
