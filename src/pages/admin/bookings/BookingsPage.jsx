// src/pages/admin/bookings/BookingsPage.jsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getBookings } from '../../../services/bookingService'
import Badge from '../../../components/common/Badge'
import SearchInput from '../../../components/common/SearchInput'
import Spinner from '../../../components/common/Spinner'
import EmptyState from '../../../components/common/EmptyState'
import PaymentVerificationModal from '../../../components/admin/payments/PaymentVerificationModal'
import { CalendarDays } from 'lucide-react'

const STATUS_FILTERS = ['all', 'upcoming', 'finished', 'cancelled', 'no_show']

const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

const formatTime = (time) => {
  if (!time) return '—'
  const [h, m] = time.split(':')
  const hour = parseInt(h, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  return `${hour % 12 || 12}:${m} ${ampm}`
}

const BookingsPage = () => {
  const navigate = useNavigate()
  const [bookings, setBookings] = useState([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [verifyModal, setVerifyModal] = useState(null)
  const pageSize = 20

  const load = useCallback(() => {
    setLoading(true)
    getBookings({
      status: status === 'all' ? undefined : status,
      search,
      page,
      pageSize,
    })
      .then(({ data, count: c }) => { setBookings(data); setCount(c) })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [status, search, page])

  useEffect(() => { load() }, [load])

  const totalPages = Math.ceil(count / pageSize)

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-[#2C2C2C]">Bookings</h1>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap
          items-center gap-3">
          <div className="flex gap-1">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => { setStatus(s); setPage(0) }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium
                  transition-colors capitalize ${
                    status === s
                      ? 'bg-[#8A956D] text-white'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
              >
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>
          <div className="ml-auto">
            <SearchInput
              value={search}
              onChange={(v) => { setSearch(v); setPage(0) }}
              placeholder="Search by reference ID…"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : error ? (
          <p className="text-red-600 text-sm text-center py-8">{error}</p>
        ) : bookings.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No bookings found"
            message="Try adjusting your filters."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left">
                    {['Ref ID', 'Customer', 'Date & Time', 'Status',
                      'Payment', 'Staff', 'Actions'].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-3 text-xs font-medium text-gray-400
                          uppercase tracking-wide"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {bookings.map((b) => (
                    <tr
                      key={b.id}
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-5 py-3.5 font-mono text-xs text-gray-500">
                        {b.reference_id}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-[#4A4A4A]">
                        {b.customer
                          ? `${b.customer.first_name} ${b.customer.last_name}`
                          : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">
                        <p>{formatDate(b.appointment_date)}</p>
                        <p className="text-xs text-gray-400">
                          {formatTime(b.start_time)}
                        </p>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={b.booking_status} label={b.booking_status} />
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge
                          variant={b.downpayment_status}
                          label={b.downpayment_status}
                        />
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs">
                        {b.staff
                          ? `${b.staff.first_name} ${b.staff.last_name}`
                          : 'Unassigned'}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex gap-2">
                          <button
                            onClick={() => navigate(`/admin/bookings/${b.id}`)}
                            className="text-xs text-[#8A956D] hover:underline"
                          >
                            View
                          </button>
                          {b.downpayment_status === 'pending' && (
                            <button
                              onClick={() => setVerifyModal(b)}
                              className="text-xs text-[#CE845D] hover:underline"
                            >
                              Verify
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="px-5 py-4 border-t border-gray-100 flex items-center
                justify-between text-sm text-gray-500">
                <span>
                  Showing {page * pageSize + 1}–
                  {Math.min((page + 1) * pageSize, count)} of {count}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => p - 1)}
                    disabled={page === 0}
                    className="px-3 py-1 border border-gray-200 rounded-lg
                      disabled:opacity-40 hover:bg-gray-50"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= totalPages - 1}
                    className="px-3 py-1 border border-gray-200 rounded-lg
                      disabled:opacity-40 hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <PaymentVerificationModal
        open={!!verifyModal}
        booking={verifyModal}
        onClose={() => setVerifyModal(null)}
        onUpdated={load}
      />
    </div>
  )
}

export default BookingsPage
