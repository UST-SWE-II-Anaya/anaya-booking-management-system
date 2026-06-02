import { useState, useEffect, useCallback } from 'react'
import { List, CalendarDays } from 'lucide-react'
import clsx from 'clsx'
import {
  getMyAppointments,
  getMyAppointmentById,
  getMyAppointmentDates,
} from '../../services/staffAppointmentService'
import useAuthStore from '../../store/authStore'
import Badge from '../../components/common/Badge'
import Spinner from '../../components/common/Spinner'
import EmptyState from '../../components/common/EmptyState'
import SearchInput from '../../components/common/SearchInput'
import MonthCalendar from '../../components/staff/MonthCalendar'
import PaymentVerificationModal from '../../components/admin/payments/PaymentVerificationModal'

const STATUS_OPTIONS = ['upcoming', 'finished', 'cancelled', 'no_show']

const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })

const formatTime = (time) => {
  if (!time) return '—'
  const [h, m] = time.split(':')
  const hour = parseInt(h, 10)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

const formatDuration = (minutes) => {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

const formatDeadlineCountdown = (deadlineStr) => {
  if (!deadlineStr) return null
  const diff = new Date(deadlineStr) - new Date()
  if (diff <= 0) return 'Expired'
  const hours = Math.floor(diff / 1000 / 60 / 60)
  const mins = Math.floor((diff / 1000 / 60) % 60)
  return hours > 0 ? `${hours}h ${mins}m left` : `${mins}m left`
}

const AppointmentCard = ({ appt, onVerifyClick }) => {
  const countdown = formatDeadlineCountdown(appt.payment_deadline)

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-[#2C2C2C]">
            {appt.customer
              ? `${appt.customer.first_name} ${appt.customer.last_name}`
              : 'Unknown'}
          </p>
          <p className="text-xs font-mono text-gray-400 mt-0.5">
            {appt.reference_id}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={appt.booking_status} label={appt.booking_status} />
          <Badge variant={appt.downpayment_status} label={appt.downpayment_status} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Date &amp; Time</p>
          <p className="text-[#4A4A4A]">{formatDate(appt.appointment_date)}</p>
          <p className="text-xs text-gray-500">{formatTime(appt.start_time)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Duration &amp; Services</p>
          <p className="text-[#4A4A4A]">
            {formatDuration(appt.total_duration_minutes)}
          </p>
          <p className="text-xs text-gray-500 line-clamp-1">
            {appt.booking_services
              ?.map((bs) => bs.services?.name)
              .filter(Boolean)
              .join(', ')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Downpayment / Total</p>
          <p className="text-[#4A4A4A]">
            ₱{Number(appt.downpayment_amount).toFixed(2)}
            {' '}/{' '}
            ₱{Number(appt.subtotal).toFixed(2)}
          </p>
        </div>
        {countdown && (
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Time Left to Pay</p>
            <p className={clsx(
              'text-sm font-medium',
              countdown === 'Expired' ? 'text-red-500' : 'text-orange-500'
            )}>
              {countdown}
            </p>
          </div>
        )}
      </div>

      {['paid', 'pending'].includes(appt.downpayment_status) && (
        <button
          onClick={() => onVerifyClick(appt.id)}
          className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm
            font-medium rounded-lg transition-colors border border-gray-200"
        >
          View Payment
        </button>
      )}
    </div>
  )
}

const StaffAppointmentsPage = () => {
  const { user } = useAuthStore()
  const [view, setView] = useState('list')
  const [appointments, setAppointments] = useState([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [status, setStatus] = useState('upcoming')
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(0)
  const pageSize = 10

  const now = new Date()
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1)
  const [selectedDate, setSelectedDate] = useState(null)
  const [apptDates, setApptDates] = useState(new Set())

  const [verifyBooking, setVerifyBooking] = useState(null)
  const [loadingVerify, setLoadingVerify] = useState(false)

  const staffId = user?.id

  const load = useCallback(() => {
    if (!staffId) return
    setLoading(true)
    getMyAppointments(staffId, { status, search, sortField, sortDir, page, pageSize })
      .then(({ data, count: c }) => { setAppointments(data); setCount(c) })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [staffId, status, search, sortField, sortDir, page])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!staffId || view !== 'calendar') return
    getMyAppointmentDates(staffId, calYear, calMonth)
      .then(setApptDates)
      .catch((err) => console.error('Calendar dates error:', err))
  }, [staffId, view, calYear, calMonth])

  const handleVerifyClick = async (id) => {
    setLoadingVerify(true)
    try {
      const booking = await getMyAppointmentById(id, staffId)
      setVerifyBooking(booking)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingVerify(false)
    }
  }



  const handleDateSelect = (dateStr) => {
    setSelectedDate((prev) => (prev === dateStr ? null : dateStr))
  }

  const totalPages = Math.ceil(count / pageSize)

  const displayedAppointments = selectedDate
    ? appointments.filter((a) => a.appointment_date === selectedDate)
    : appointments

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[#2C2C2C]">Appointments</h1>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setView('list')}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium',
              'transition-colors',
              view === 'list'
                ? 'bg-white text-[#2C2C2C] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            <List size={13} /> List
          </button>
          <button
            onClick={() => setView('calendar')}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium',
              'transition-colors',
              view === 'calendar'
                ? 'bg-white text-[#2C2C2C] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            <CalendarDays size={13} /> Calendar
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5
        py-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => { setStatus(s); setPage(0) }}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize',
                status === s
                  ? 'bg-[#8A956D] text-white'
                  : 'text-gray-500 hover:bg-gray-100'
              )}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>

        <select
          value={`${sortField}-${sortDir}`}
          onChange={(e) => {
            const [f, d] = e.target.value.split('-')
            setSortField(f)
            setSortDir(d)
            setPage(0)
          }}
          className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg
            focus:outline-none focus:ring-2 focus:ring-[#8A956D]/40
            text-gray-600"
        >
          <option value="date-desc">Newest First</option>
          <option value="date-asc">Oldest First</option>
          <option value="id-desc">ID Descending</option>
          <option value="id-asc">ID Ascending</option>
        </select>

        <div className="ml-auto">
          <SearchInput
            value={search}
            onChange={(v) => { setSearch(v); setPage(0) }}
            placeholder="Customer name or Ref ID…"
          />
        </div>
      </div>

      {view === 'calendar' ? (
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">
          <MonthCalendar
            year={calYear}
            month={calMonth}
            appointmentDates={apptDates}
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
            onMonthChange={(y, m) => { setCalYear(y); setCalMonth(m) }}
          />
          <div className="space-y-3">
            {selectedDate ? (
              <>
                <p className="text-sm text-gray-500">
                  Appointments on{' '}
                  <span className="font-medium text-[#4A4A4A]">
                    {new Date(selectedDate).toLocaleDateString('en-US', {
                      weekday: 'long', month: 'long', day: 'numeric',
                    })}
                  </span>
                </p>
                {loading ? (
                  <div className="flex justify-center py-8"><Spinner /></div>
                ) : displayedAppointments.length === 0 ? (
                  <EmptyState
                    title="No appointments this day"
                    message="Select another date or change your status filter."
                  />
                ) : (
                  displayedAppointments.map((appt) => (
                    <AppointmentCard
                      key={appt.id}
                      appt={appt}
                      onVerifyClick={handleVerifyClick}
                    />
                  ))
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16
                text-center text-sm text-gray-400">
                <CalendarDays size={28} className="mb-3 text-gray-300" />
                Select a date to see appointments.
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {loading ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : error ? (
            <p className="text-red-600 text-sm bg-red-50 rounded-lg p-4">{error}</p>
          ) : appointments.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No appointments found"
              message="Try adjusting your filters."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {appointments.map((appt) => (
                <AppointmentCard
                  key={appt.id}
                  appt={appt}
                  onVerifyClick={handleVerifyClick}
                />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>
                {page * pageSize + 1}–{Math.min((page + 1) * pageSize, count)} of {count}
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

      {loadingVerify && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <Spinner />
        </div>
      )}

      <PaymentVerificationModal
        open={!!verifyBooking}
        booking={verifyBooking}
        onClose={() => setVerifyBooking(null)}
        onUpdated={load}
        readOnly
      />
    </div>
  )
}

export default StaffAppointmentsPage
