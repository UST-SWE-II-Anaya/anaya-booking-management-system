// src/pages/admin/staff/StaffDetailPage.jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import {
  getStaffById,
  getStaffLeaveRequests,
  deactivateStaff,
  activateStaff,
} from '../../../services/staffService'
import Badge from '../../../components/common/Badge'
import Spinner from '../../../components/common/Spinner'
import ConfirmDialog from '../../../components/common/ConfirmDialog'

const StaffDetailPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [staff, setStaff] = useState(null)
  const [leaves, setLeaves] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [confirm, setConfirm] = useState(null)

  const load = () => {
    setLoading(true)
    Promise.all([getStaffById(id), getStaffLeaveRequests(id)])
      .then(([s, l]) => { setStaff(s); setLeaves(l) })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])

  const handleStatusChange = async () => {
    if (!confirm) return
    try {
      if (confirm.newStatus === 'active') {
        await activateStaff(id)
      } else {
        await deactivateStaff(id)
      }
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setConfirm(null)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>
  if (error) return <p className="text-red-600 p-4 text-sm">{error}</p>
  if (!staff) return null

  const isActive = staff.account_status === 'active'

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    })

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/admin/staff')} aria-label="Back">
          <ArrowLeft size={18} className="text-gray-400 hover:text-gray-600 cursor-pointer" />
        </button>
        <h1 className="text-xl font-semibold text-[#2C2C2C]">
          {staff.first_name} {staff.last_name}
        </h1>
        <Badge variant={isActive ? 'active' : 'suspended'} label={isActive ? 'Active' : 'Inactive'} />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-[#2C2C2C] mb-4">Profile</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-400 mb-1">Email</p>
            <p className="text-[#4A4A4A]">{staff.email}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Phone</p>
            <p className="text-[#4A4A4A]">{staff.phone_number || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Gender</p>
            <p className="text-[#4A4A4A] capitalize">{staff.gender || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Date of Birth</p>
            <p className="text-[#4A4A4A]">
              {staff.date_of_birth
                ? new Date(staff.date_of_birth).toLocaleDateString()
                : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Employee Reference</p>
            <p className="text-[#4A4A4A] font-mono">{staff.reference_id || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Member Since</p>
            <p className="text-[#4A4A4A]">
              {new Date(staff.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-5 pt-4 border-t border-gray-100">
          {isActive ? (
            <button
              onClick={() => setConfirm({
                newStatus: 'inactive',
                label: 'Deactivate Staff',
                message: 'This staff member will no longer be active or able to login.',
                danger: true,
              })}
              className="px-4 py-2 text-sm border border-red-200 text-red-600
                rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
            >
              Deactivate
            </button>
          ) : (
            <button
              onClick={() => setConfirm({
                newStatus: 'active',
                label: 'Reactivate Staff',
                message: 'Restore this staff member\'s access to the system.',
              })}
              className="px-4 py-2 text-sm bg-[#8A956D] text-white rounded-lg
                hover:bg-[#7a8560] transition-colors cursor-pointer"
            >
              Reactivate
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-[#2C2C2C]">
            Leave Requests ({leaves.length})
          </h2>
        </div>
        {leaves.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No leave requests yet.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {leaves.map((l) => (
              <div key={l.id} className="px-6 py-4 flex items-center justify-between gap-4 text-sm">
                <div className="flex-1">
                  <p className="font-medium text-[#4A4A4A] capitalize text-sm">
                    {l.leave_type.replace('_', ' ')}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatDate(l.start_date)} - {formatDate(l.end_date)}
                  </p>
                </div>
                <div className="flex-1 hidden md:block">
                  <p className="text-xs text-gray-500 whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]">
                    {l.reason}
                  </p>
                </div>
                <div>
                  <Badge variant={l.status} label={l.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={handleStatusChange}
        title={confirm?.label ?? ''}
        message={confirm?.message ?? ''}
        confirmLabel={confirm?.label}
        danger={confirm?.danger}
      />
    </div>
  )
}

export default StaffDetailPage
