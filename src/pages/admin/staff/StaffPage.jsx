import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Eye, PauseCircle, UserCheck, UserPlus, UserX } from 'lucide-react'
import clsx from 'clsx'
import { getStaff, deactivateStaff, activateStaff, banStaff } from '../../../services/staffService'
import Badge from '../../../components/common/Badge'
import Spinner from '../../../components/common/Spinner'
import EmptyState from '../../../components/common/EmptyState'
import ConfirmDialog from '../../../components/common/ConfirmDialog'
import DeactivateAccountModal from '../../../components/admin/accounts/DeactivateAccountModal'
import CreateAccountModal from '../../../components/admin/staff/CreateAccountModal'

const FILTERS = ['all', 'staff', 'admin']

const StaffPage = () => {
  const navigate = useNavigate()
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [deactivateModal, setDeactivateModal] = useState(null)
  const [banConfirm, setBanConfirm] = useState(null)
  const [filter, setFilter] = useState('all')
  const [showCreate, setShowCreate] = useState(false)

  const load = () => {
    setLoading(true)
    getStaff()
      .then(setStaff)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleReactivate = async () => {
    if (!confirm) return
    try {
      await activateStaff(confirm.id)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setConfirm(null)
    }
  }

  const handleBan = async () => {
    if (!banConfirm) return
    try {
      await banStaff(banConfirm.id)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBanConfirm(null)
    }
  }

  const handleDeactivate = async (reason) => {
    if (!deactivateModal) return
    try {
      await deactivateStaff(deactivateModal.id, reason)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setDeactivateModal(null)
    }
  }

  const filtered = staff.filter((s) => filter === 'all' || s.role === filter)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[#2C2C2C]">Team</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-3.5 py-2 bg-[#8A956D] hover:bg-[#7a8560]
            text-white rounded-lg text-sm font-medium transition-colors"
        >
          <UserPlus size={15} />
          Create Account
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="flex gap-1">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors',
                  filter === f
                    ? 'bg-[#8A956D] text-white'
                    : 'text-gray-500 hover:bg-gray-100'
                )}
              >
                {f === 'all' ? 'All' : f}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : error ? (
          <p className="text-red-600 text-sm text-center py-8">{error}</p>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Users} title="No team members found" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                {['Name', 'Email', 'Phone', 'Role', 'Status', 'Joined', 'Actions'].map((h) => (
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
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-[#4A4A4A]">
                    {s.first_name} {s.last_name}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{s.email}</td>
                  <td className="px-5 py-3.5 text-gray-500">
                    {s.phone_number || '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge
                      variant={s.role === 'admin' ? 'paid' : 'active'}
                      label={s.role === 'admin' ? 'Admin' : 'Staff'}
                    />
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge
                      variant={s.account_status === 'active' ? 'active' : 'suspended'}
                      label={s.account_status === 'active' ? 'Active' : 'Inactive'}
                    />
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
                      {s.account_status === 'active' ? (
                        <button
                          onClick={() => setDeactivateModal({
                            id: s.id,
                            name: `${s.first_name} ${s.last_name}`,
                            role: s.role,
                          })}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 border border-yellow-600
                            rounded-lg text-yellow-600 hover:bg-yellow-600 hover:text-white
                            transition-all text-xs font-medium group"
                        >
                          <PauseCircle size={14} className="group-hover:text-white" />
                          Suspend
                        </button>
                      ) : (
                        <button
                          onClick={() => setConfirm({
                            id: s.id,
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
                      {s.role === 'staff' && s.account_status !== 'banned' && (
                        <button
                          onClick={() => setBanConfirm({
                            id: s.id,
                            name: `${s.first_name} ${s.last_name}`,
                          })}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 border border-red-500
                            rounded-lg text-red-500 hover:bg-red-500 hover:text-white
                            transition-all text-xs font-medium group"
                        >
                          <UserX size={14} className="group-hover:text-white" />
                          Ban
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
        onConfirm={handleReactivate}
        title="Reactivate Staff"
        message={confirm?.message ?? ''}
        confirmLabel="Reactivate"
        danger={false}
      />

      <DeactivateAccountModal
        open={!!deactivateModal}
        onClose={() => setDeactivateModal(null)}
        onConfirm={handleDeactivate}
        userName={deactivateModal?.name ?? ''}
        userRole={deactivateModal?.role ?? 'staff'}
        action="suspend"
      />

      <ConfirmDialog
        open={!!banConfirm}
        onClose={() => setBanConfirm(null)}
        onConfirm={handleBan}
        title="Ban Staff"
        message={`Are you sure you want to ban ${banConfirm?.name}?`}
        description="This action is permanent and cannot be undone. The staff member will lose access to the platform immediately."
        confirmLabel="Ban"
        danger
      />

      <CreateAccountModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={load}
      />
    </div>
  )
}

export default StaffPage
