// src/pages/admin/customers/CustomerDetailPage.jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import {
  getCustomerById,
  getCustomerBookings,
  updateAccountStatus,
  banCustomer,
} from '../../../services/customerService'
import Badge from '../../../components/common/Badge'
import Spinner from '../../../components/common/Spinner'
import ConfirmDialog from '../../../components/common/ConfirmDialog'
import DeactivateAccountModal from '../../../components/admin/accounts/DeactivateAccountModal'

const CustomerDetailPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState(null)
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [deactivateModal, setDeactivateModal] = useState({ open: false, action: 'suspend' })

  const load = () => {
    setLoading(true)
    Promise.all([getCustomerById(id), getCustomerBookings(id)])
      .then(([c, b]) => { setCustomer(c); setBookings(b) })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [id])

  const handleReactivate = async () => {
    if (!confirm) return
    try {
      await updateAccountStatus(id, 'active')
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setConfirm(null)
    }
  }

  const STATUS_MAP = { suspend: 'suspended', ban: 'banned' }

  const handleDeactivate = async (reason) => {
    try {
      if (deactivateModal.action === 'ban') {
        await banCustomer(id, reason)
      } else {
        await updateAccountStatus(id, STATUS_MAP[deactivateModal.action], reason)
      }
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setDeactivateModal({ open: false, action: 'suspend' })
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>
  if (error) return <p className="text-red-600 p-4 text-sm">{error}</p>
  if (!customer) return null

  const noShowCount = bookings.filter((b) => b.booking_status === 'no_show').length

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/admin/customers')} aria-label="Back">
          <ArrowLeft size={18} className="text-gray-400 hover:text-gray-600" />
        </button>
        <h1 className="text-xl font-semibold text-[#2C2C2C]">
          {customer.first_name} {customer.last_name}
        </h1>
        <Badge
          variant={customer.account_status}
          label={
            customer.account_status === 'active' ? 'Active'
            : customer.account_status === 'banned' ? 'Banned'
            : 'Inactive'
          }
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-[#2C2C2C] mb-4">Profile</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-400 mb-1">Email</p>
            <p className="text-[#4A4A4A]">{customer.email}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Phone</p>
            <p className="text-[#4A4A4A]">{customer.phone_number || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Gender</p>
            <p className="text-[#4A4A4A] capitalize">{customer.gender || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Date of Birth</p>
            <p className="text-[#4A4A4A]">
              {customer.date_of_birth
                ? new Date(customer.date_of_birth).toLocaleDateString()
                : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">No-Show Count</p>
            <p className={`font-medium ${noShowCount > 2 ? 'text-red-600' : 'text-[#4A4A4A]'}`}>
              {noShowCount}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Member Since</p>
            <p className="text-[#4A4A4A]">
              {new Date(customer.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-5 pt-4 border-t border-gray-100">
          {customer.account_status === 'active' ? (
            <button
              onClick={() => setDeactivateModal({ open: true, action: 'suspend' })}
              className="px-4 py-2 text-sm border border-yellow-200 text-yellow-700
                rounded-lg hover:bg-yellow-50 transition-colors cursor-pointer"
            >
              Suspend
            </button>
          ) : (
            <button
              onClick={() => setConfirm(true)}
              className="px-4 py-2 text-sm bg-[#8A956D] text-white rounded-lg
                hover:bg-[#7a8560] transition-colors cursor-pointer"
            >
              Reactivate
            </button>
          )}
          {customer.account_status !== 'banned' && (
            <button
              onClick={() => setDeactivateModal({ open: true, action: 'ban' })}
              className="px-4 py-2 text-sm border border-red-200 text-red-600
                rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
            >
              Ban
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-[#2C2C2C]">
            Booking History ({bookings.length})
          </h2>
        </div>
        {bookings.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No bookings yet.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {bookings.map((b) => (
              <div key={b.id} className="px-6 py-4 flex items-center gap-4 text-sm">
                <div className="flex-1">
                  <p className="font-medium text-[#4A4A4A]">
                    {new Date(b.appointment_date).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {b.booking_services
                      ?.map((bs) => bs.services?.name)
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                </div>
                <Badge variant={b.booking_status} label={b.booking_status} />
                <span className="text-gray-500 text-xs font-mono">{b.reference_id}</span>
                <button
                  onClick={() => navigate(`/admin/bookings/${b.id}`)}
                  className="text-xs text-[#8A956D] hover:underline"
                >
                  View
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={handleReactivate}
        title="Reactivate Account"
        message="Restore this customer's access."
        confirmLabel="Reactivate"
      />

      <DeactivateAccountModal
        open={deactivateModal.open}
        onClose={() => setDeactivateModal({ open: false, action: 'suspend' })}
        onConfirm={handleDeactivate}
        userName={customer ? `${customer.first_name} ${customer.last_name}` : ''}
        userRole="customer"
        action={deactivateModal.action}
      />
    </div>
  )
}

export default CustomerDetailPage
