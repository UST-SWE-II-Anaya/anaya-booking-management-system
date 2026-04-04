import { useState, useEffect } from 'react'
import { ClipboardList } from 'lucide-react'
import { createLeaveRequest, getMyLeaveRequests } from '../../services/staffLeaveService'
import useAuthStore from '../../store/authStore'
import Badge from '../../components/common/Badge'
import Spinner from '../../components/common/Spinner'
import clsx from 'clsx'

const LEAVE_TYPES = [
  { value: 'vacation', label: 'Vacation Leave' },
  { value: 'sick', label: 'Sick Leave' },
  { value: 'emergency', label: 'Emergency Leave' },
  { value: 'other', label: 'Others' },
]

const LEAVE_STATUS_LABELS = {
  pending: 'Pending',
  approved: 'Approved',
  denied: 'Denied',
}

const StaffLeaveRequestPage = () => {
  const { user } = useAuthStore()
  const staffId = user?.id

  const [leaveType, setLeaveType] = useState('vacation')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)
  const [success, setSuccess] = useState(false)

  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)

  const loadHistory = () => {
    if (!staffId) return
    setHistoryLoading(true)
    getMyLeaveRequests(staffId)
      .then(setHistory)
      .catch((err) => console.error('History load error:', err))
      .finally(() => setHistoryLoading(false))
  }

  useEffect(() => { loadHistory() }, [staffId])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError(null)
    setSuccess(false)
    setSubmitting(true)
    try {
      await createLeaveRequest(staffId, {
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim() || null,
      })
      setStartDate('')
      setEndDate('')
      setReason('')
      setSuccess(true)
      loadHistory()
      setTimeout(() => setSuccess(false), 4000)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass = `w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm
    focus:outline-none focus:ring-2 focus:ring-[#8A956D]/40 focus:border-[#8A956D]`

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-semibold text-[#2C2C2C]">Leave Request</h1>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5"
      >
        {/* Leave type */}
        <div>
          <p className="text-sm font-medium text-[#4A4A4A] mb-3">Leave Type</p>
          <div className="flex flex-wrap gap-2">
            {LEAVE_TYPES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setLeaveType(value)}
                className={clsx(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  leaveType === value
                    ? 'bg-[#8A956D] text-white'
                    : 'border border-gray-200 text-[#4A4A4A] hover:bg-gray-50'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#4A4A4A] mb-1">
              Start Date
            </label>
            <input
              type="date"
              className={inputClass}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#4A4A4A] mb-1">
              End Date
            </label>
            <input
              type="date"
              className={inputClass}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate || new Date().toISOString().split('T')[0]}
              required
            />
          </div>
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium text-[#4A4A4A] mb-1">
            Reason <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            className={inputClass}
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Briefly describe the reason for your leave…"
          />
        </div>

        {formError && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {formError}
          </p>
        )}
        {success && (
          <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
            Leave request submitted. Awaiting admin approval.
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 bg-[#8A956D] hover:bg-[#7a8560] text-white
            text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
        >
          {submitting ? 'Submitting…' : 'Submit Leave Request'}
        </button>
      </form>

      {/* History */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-[#2C2C2C] flex items-center gap-2">
            <ClipboardList size={16} className="text-[#8A956D]" />
            My Leave History
          </h2>
        </div>

        {historyLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : history.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            No leave requests submitted yet.
          </p>
        ) : (
          <div className="divide-y divide-gray-50">
            {history.map((req) => {
              const typeLabel =
                LEAVE_TYPES.find((t) => t.value === req.leave_type)?.label ??
                req.leave_type
              const start = new Date(req.start_date).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric',
              })
              const end = new Date(req.end_date).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              })
              return (
                <div key={req.id} className="px-6 py-4 flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[#4A4A4A]">
                        {typeLabel}
                      </p>
                      <Badge
                        variant={req.status}
                        label={LEAVE_STATUS_LABELS[req.status]}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {start} – {end}
                    </p>
                    {req.reason && (
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                        {req.reason}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 flex-shrink-0">
                    {new Date(req.created_at).toLocaleDateString()}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default StaffLeaveRequestPage
