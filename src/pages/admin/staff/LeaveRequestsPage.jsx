// src/pages/admin/staff/LeaveRequestsPage.jsx
import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, XCircle, ClipboardList } from 'lucide-react'
import { getLeaveRequests, reviewLeaveRequest } from '../../../services/staffService'
import Badge from '../../../components/common/Badge'
import Spinner from '../../../components/common/Spinner'
import EmptyState from '../../../components/common/EmptyState'
import useAuthStore from '../../../store/authStore'

const STATUS_FILTERS = ['pending', 'approved', 'denied']

const LEAVE_TYPE_LABELS = {
  vacation: 'Vacation',
  sick: 'Sick',
  emergency: 'Emergency',
  other: 'Other',
}

const LeaveRequestsPage = () => {
  const { user } = useAuthStore()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('pending')
  const [actionLoading, setActionLoading] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    getLeaveRequests({ status: statusFilter })
      .then(setRequests)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const handleReview = async (id, newStatus) => {
    setActionLoading(id)
    try {
      await reviewLeaveRequest(id, newStatus, user.id)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const formatDateRange = (start, end) => {
    const s = new Date(start).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric',
    })
    const e = new Date(end).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    })
    return `${s} – ${e}`
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-[#2C2C2C]">Leave Requests</h1>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex gap-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium
                transition-colors capitalize ${
                  statusFilter === s
                    ? 'bg-[#8A956D] text-white'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
            >
              {s}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : error ? (
          <p className="text-red-600 text-sm text-center py-8">{error}</p>
        ) : requests.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No leave requests"
            message={`No ${statusFilter} leave requests.`}
          />
        ) : (
          <div className="divide-y divide-gray-50">
            {requests.map((req) => (
              <div key={req.id} className="px-6 py-4 flex items-start gap-4">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-[#4A4A4A] text-sm">
                      {req.staff?.first_name} {req.staff?.last_name}
                    </p>
                    <Badge
                      variant={req.status}
                      label={LEAVE_TYPE_LABELS[req.leave_type] ?? req.leave_type}
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    {formatDateRange(req.start_date, req.end_date)}
                  </p>
                  {req.reason && (
                    <p className="text-xs text-gray-400 mt-1">{req.reason}</p>
                  )}
                  {req.status !== 'pending' && req.reviewer && (
                    <p className="text-xs text-gray-300 mt-1">
                      {req.status === 'approved' ? 'Approved' : 'Denied'} by{' '}
                      {req.reviewer.first_name} {req.reviewer.last_name}
                      {req.reviewed_at &&
                        ` · ${new Date(req.reviewed_at).toLocaleDateString()}`}
                    </p>
                  )}
                </div>

                {req.status === 'pending' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleReview(req.id, 'denied')}
                      disabled={actionLoading === req.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 border
                        border-red-200 text-red-600 text-xs rounded-lg
                        hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      <XCircle size={12} /> Deny
                    </button>
                    <button
                      onClick={() => handleReview(req.id, 'approved')}
                      disabled={actionLoading === req.id}
                      className="flex items-center gap-1.5 px-3 py-1.5
                        bg-[#8A956D] text-white text-xs rounded-lg
                        hover:bg-[#7a8560] transition-colors disabled:opacity-50"
                    >
                      <CheckCircle size={12} /> Approve
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default LeaveRequestsPage
