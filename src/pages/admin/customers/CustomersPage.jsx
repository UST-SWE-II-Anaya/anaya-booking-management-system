// src/pages/admin/customers/CustomersPage.jsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Eye, PauseCircle, UserX, UserCheck } from 'lucide-react'
import {
  getCustomers,
  updateAccountStatus,
  banCustomer,
} from '../../../services/customerService'
import Badge from '../../../components/common/Badge'
import SearchInput from '../../../components/common/SearchInput'
import Spinner from '../../../components/common/Spinner'
import EmptyState from '../../../components/common/EmptyState'
import ConfirmDialog from '../../../components/common/ConfirmDialog'
import DeactivateAccountModal from '../../../components/admin/accounts/DeactivateAccountModal'

const STATUS_FILTERS = ['all', 'active', 'suspended', 'banned']

const CustomersPage = () => {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [confirm, setConfirm] = useState(null)
  const [suspendModal, setSuspendModal] = useState(null)
  const pageSize = 20

  const load = useCallback(() => {
    setLoading(true)
    getCustomers({
      status: statusFilter === 'all' ? undefined : statusFilter,
      search,
      page,
      pageSize,
    })
      .then(({ data, count: c }) => { setCustomers(data); setCount(c) })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [statusFilter, search, page])

  useEffect(() => { load() }, [load])

  const handleStatusChange = async () => {
    if (!confirm) return
    try {
      await banCustomer(confirm.id)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setConfirm(null)
    }
  }

  const handleSuspend = async (reason) => {
    if (!suspendModal) return
    try {
      await updateAccountStatus(suspendModal.id, 'suspended', reason)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSuspendModal(null)
    }
  }

  const totalPages = Math.ceil(count / pageSize)

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-[#2C2C2C]">Customers</h1>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap
          items-center gap-3">
          <div className="flex gap-1">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(0) }}
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
          <div className="ml-auto">
            <SearchInput
              value={search}
              onChange={(v) => { setSearch(v); setPage(0) }}
              placeholder="Search by email…"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : error ? (
          <p className="text-red-600 text-sm text-center py-8">{error}</p>
        ) : customers.length === 0 ? (
          <EmptyState icon={Users} title="No customers found" />
        ) : (
          <>
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
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-[#4A4A4A]">
                      {c.first_name} {c.last_name}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">{c.email}</td>
                    <td className="px-5 py-3.5 text-gray-500">
                      {c.phone_number || '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={c.account_status} label={c.account_status} />
                    </td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => navigate(`/admin/customers/${c.id}`)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 border border-[#8A956D] 
                            rounded-lg text-[#8A956D] hover:bg-[#8A956D] hover:text-white 
                            transition-all text-xs font-medium group"
                        >
                          <Eye size={14} className="group-hover:text-white" />
                          View
                        </button>
                        {c.account_status === 'active' && (
                          <button
                            onClick={() => setSuspendModal({
                              id: c.id,
                              name: `${c.first_name} ${c.last_name}`,
                            })}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 border border-yellow-600
                              rounded-lg text-yellow-600 hover:bg-yellow-600 hover:text-white
                              transition-all text-xs font-medium group"
                          >
                            <PauseCircle size={14} className="group-hover:text-white" />
                            Suspend
                          </button>
                        )}
                        {c.account_status === 'suspended' && (
                          <button
                            onClick={() => setConfirm({
                              id: c.id,
                              action: 'Reactivate',
                              newStatus: 'active',
                              message: `Reactivate ${c.first_name} ${c.last_name}?`,
                            })}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 border border-green-600
                              rounded-lg text-green-600 hover:bg-green-600 hover:text-white
                              transition-all text-xs font-medium group"
                          >
                            <UserCheck size={14} className="group-hover:text-white" />
                            Reactivate
                          </button>
                        )}
                        {c.account_status !== 'banned' && (
                          <button
                            onClick={() => setConfirm({
                              id: c.id,
                              action: 'Ban',
                              message: `Are you sure you want to ban ${c.first_name} ${c.last_name}?`,
                              description: 'This will permanently ban the account. The user will lose access to the platform and all their data will be retained but inaccessible. This action cannot be undone.',
                              danger: true,
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

            {totalPages > 1 && (
              <div className="px-5 py-4 border-t border-gray-100 flex items-center
                justify-between text-sm text-gray-500">
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
      </div>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={handleStatusChange}
        title={confirm?.action ?? ''}
        message={confirm?.message ?? ''}
        description={confirm?.description}
        confirmLabel={confirm?.action}
        danger={confirm?.danger}
      />

      <DeactivateAccountModal
        open={!!suspendModal}
        onClose={() => setSuspendModal(null)}
        onConfirm={handleSuspend}
        userName={suspendModal?.name ?? ''}
        userRole="customer"
        action="suspend"
      />
    </div>
  )
}

export default CustomersPage
