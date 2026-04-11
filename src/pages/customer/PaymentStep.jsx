import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { supabase } from '../../services/supabaseClient'
import { getMyBookingById } from '../../services/customerBookingService'
import { formatDuration } from '../../utils/bookingUtils'

const to12h = (time24) => {
  if (!time24) return ''
  const [h, m] = time24.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

const PaymentStep = () => {
  const { bookingId } = useParams()
  const navigate = useNavigate()
  const [booking, setBooking] = useState(null)
  const [refNumber, setRefNumber] = useState('')
  const [accountName, setAccountName] = useState('')
  const [receipt, setReceipt] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [dragOver, setDragOver] = useState(false)

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
    setSubmitting(true)
    try {
      const path = `${bookingId}/${Date.now()}_${receipt.name}`
      const { error: uploadErr } = await supabase.storage
        .from('payment-receipts')
        .upload(path, receipt)
      if (uploadErr) throw uploadErr

      const { data: urlData } = supabase.storage
        .from('payment-receipts')
        .getPublicUrl(path)

      const { error: insertErr } = await supabase.from('payments').insert({
        booking_id: bookingId,
        reference_number: refNumber,
        account_name: accountName,
        receipt_url: urlData.publicUrl,
        amount: booking.downpayment_amount,
        status: 'paid',
      })
      if (insertErr) throw insertErr

      const { error: updateErr } = await supabase
        .from('bookings')
        .update({ downpayment_status: 'paid' })
        .eq('id', bookingId)
      if (updateErr) throw updateErr

      navigate(`/booking/success/${bookingId}`)
    } catch (err) {
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

  const startTime = booking.start_time
    ? to12h(booking.start_time.slice(0, 5))
    : ''
  const totalMins = booking.total_duration_minutes ?? 0
  const [startH, startM] = (booking.start_time ?? '00:00')
    .split(':')
    .map(Number)
  const endTotal = startH * 60 + startM + totalMins
  const endHH = String(Math.floor(endTotal / 60)).padStart(2, '0')
  const endMM = String(endTotal % 60).padStart(2, '0')
  const endTime = to12h(`${endHH}:${endMM}`)

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
            <div className="flex gap-4 mb-8">
              {[1, 2].map((n) => (
                <div
                  key={n}
                  className="flex-1 border-2 border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center bg-white min-h-[160px]"
                >
                  <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center mb-2">
                    <span className="text-3xl">📱</span>
                  </div>
                  <p className="text-sm font-semibold text-anaya-text">
                    GCASH #{n}
                  </p>
                </div>
              ))}
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
                    placeholder="e.g. 1234567890123"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-anaya-accent"
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
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-anaya-accent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-anaya-text mb-1">
                  Upload proof of payment*
                </label>
                <div
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOver(true)
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragOver(false)
                    handleFile(e.dataTransfer.files[0])
                  }}
                  onClick={() =>
                    document.getElementById('receipt-input').click()
                  }
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                    dragOver
                      ? 'border-anaya-accent bg-anaya-accent/5'
                      : 'border-gray-300 bg-white hover:border-anaya-accent'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-3xl text-gray-400">☁</span>
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
            <h2 className="font-semibold text-lg mb-4 text-anaya-text">
              Your Booking
            </h2>

            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <span>📅</span>
              <span>{displayDate}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
              <span>🕐</span>
              <span>
                {startTime} – {endTime} ({formatDuration(totalMins)})
              </span>
            </div>

            <ul className="space-y-2 mb-4">
              {services.map((bs) => (
                <li
                  key={bs.id}
                  className="flex justify-between text-sm text-anaya-text"
                >
                  <div>
                    <p className="font-medium">
                      [{bs.services?.service_categories?.name}]{' '}
                      {bs.services?.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDuration(bs.duration_at_booking)} with any
                      professional
                    </p>
                  </div>
                  <span className="font-medium shrink-0 ml-2">
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
                <span>Down Payment (10%):</span>
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
