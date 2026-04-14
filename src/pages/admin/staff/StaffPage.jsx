// src/pages/admin/staff/StaffPage.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Eye, Trash2, UserCheck } from 'lucide-react'
import { getStaff, deactivateStaff, activateStaff } from '../../../services/staffService'
import Badge from '../../../components/common/Badge'
import Spinner from '../../../components/common/Spinner'
import EmptyState from '../../../components/common/EmptyState'
import ConfirmDialog from '../../../components/common/ConfirmDialog'

const StaffPage = () => {
  const navigate = useNavigate()
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [confirm, setConfirm] = useState(null)

  const load = () => {
    setLoading(true)
    getStaff()
      .then(setStaff)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleStatusChange = async () => {
    if (!confirm) return
    try {
      if (confirm.action === 'Reactivate') {
        await activateStaff(confirm.id)
      } else {
        await deactivateStaff(confirm.id)
      }
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setConfirm(null)
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-[#2C2C2C]">Staff</h1>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : error ? (
          <p className="text-red-600 text-sm text-center py-8">{error}</p>
        ) : staff.length === 0 ? (
          <EmptyState icon={Users} title="No staff members found" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                {['Name', 'Email', 'Phone', 'Status', 'Joined', 'Actions'].map((h) => (
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
              {staff.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-[#4A4A4A]">
                    {s.first_name} {s.last_name}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{s.email}</td>
                  <td className="px-5 py-3.5 text-gray-500">
                    {s.phone_number || '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    {s.staff_details?.[0]?.is_active !== false ? (
                      <Badge variant="active" label="Active" />
                    ) : (
                      <Badge variant="suspended" label="Inactive" />
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-gray-400 text-xs text-nowrap">
                    {new Date(s.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex gap-2 text-xs">
                      <button
                        onClick={() => navigate(`/admin/staff/${s.id}`)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 border border-[#8A956D] 
                          rounded-lg text-[#8A956D] hover:bg-[#8A956D] hover:text-white 
                          transition-all text-xs font-medium group"
                      >
                        <Eye size={14} className="group-hover:text-white" />
                        View
                      </button>
                      {s.staff_details?.[0]?.is_active !== false ? (
                        <button
                          onClick={() => setConfirm({
                            id: s.id,
                            action: 'Deactivate',
                            message: `Deactivate ${s.first_name} ${s.last_name}?`,
                          })}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 border border-red-500 
                            rounded-lg text-red-500 hover:bg-red-500 hover:text-white 
                            transition-all text-xs font-medium group"
                        >
                          <Trash2 size={14} className="group-hover:text-white" />
                          Deactivate
                        </button>
                      ) : (
                        <button
                          onClick={() => setConfirm({
                            id: s.id,
                            action: 'Reactivate',
                            message: `Reactivate ${s.first_name} ${s.last_name}?`,
                          })}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 border border-green-600 
                            rounded-lg text-green-600 hover:bg-green-600 hover:text-white 
                            transition-all text-xs font-medium group"
                        >
                          <UserCheck size={14} className="group-hover:text-white" />
                          Reactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={handleStatusChange}
        title={`${confirm?.action} Staff`}
        message={confirm?.message ?? ''}
        confirmLabel={confirm?.action}
        danger={confirm?.action !== 'Reactivate'}
      />
    </div>
  )
}

export default StaffPage
