// src/pages/admin/staff/StaffPage.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users } from 'lucide-react'
import { getStaff, deactivateStaff } from '../../../services/staffService'
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

  const handleDeactivate = async () => {
    if (!confirm) return
    try {
      await deactivateStaff(confirm.id)
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
                {['Name', 'Email', 'Phone', 'Joined', 'Actions'].map((h) => (
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
                  <td className="px-5 py-3.5 text-gray-400 text-xs">
                    {new Date(s.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex gap-3 text-xs">
                      <button
                        onClick={() => navigate(`/admin/staff/${s.id}`)}
                        className="text-[#8A956D] hover:underline"
                      >
                        View
                      </button>
                      <button
                        onClick={() => setConfirm({
                          id: s.id,
                          message: `Deactivate ${s.first_name} ${s.last_name}?`,
                        })}
                        className="text-red-500 hover:underline"
                      >
                        Deactivate
                      </button>
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
        onConfirm={handleDeactivate}
        title="Deactivate Staff"
        message={confirm?.message ?? ''}
        confirmLabel="Deactivate"
        danger
      />
    </div>
  )
}

export default StaffPage
