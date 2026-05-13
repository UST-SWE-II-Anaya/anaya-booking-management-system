import { useState } from 'react'
import clsx from 'clsx'
import Modal from '../../common/Modal'
import Spinner from '../../common/Spinner'
import { inviteUser } from '../../../services/staffService'

const CreateAccountModal = ({ open, onClose, onSuccess }) => {
  const [role, setRole] = useState('staff')
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const isValid = form.firstName.trim() && form.lastName.trim() && form.email.trim()

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleRoleChange = (newRole) => {
    setRole(newRole)
    setError(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await inviteUser({ ...form, role })
      onSuccess()
      onClose()
      setForm({ firstName: '', lastName: '', email: '', phone: '' })
      setRole('staff')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create Account" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex bg-gray-100 rounded-lg p-1">
          {['staff', 'admin'].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => handleRoleChange(r)}
              className={clsx(
                'flex-1 py-1.5 text-sm font-medium rounded-md capitalize transition-all',
                role === r
                  ? 'bg-white text-[#2C2C2C] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {r === 'staff' ? 'Staff' : 'Admin'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <input
            name="firstName"
            placeholder="First name"
            value={form.firstName}
            onChange={handleChange}
            required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
              focus:outline-none focus:ring-1 focus:ring-[#8A956D]"
          />
          <input
            name="lastName"
            placeholder="Last name"
            value={form.lastName}
            onChange={handleChange}
            required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
              focus:outline-none focus:ring-1 focus:ring-[#8A956D]"
          />
        </div>

        <input
          name="email"
          type="email"
          placeholder="Email address"
          value={form.email}
          onChange={handleChange}
          required
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
            focus:outline-none focus:ring-1 focus:ring-[#8A956D]"
        />

        <input
          name="phone"
          type="tel"
          placeholder="Phone number (optional)"
          value={form.phone}
          onChange={handleChange}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
            focus:outline-none focus:ring-1 focus:ring-[#8A956D]"
        />

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={!isValid || loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#8A956D]
            hover:bg-[#7a8560] text-white rounded-lg text-sm font-medium
            transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading && <Spinner />}
          Send Invite
        </button>
      </form>
    </Modal>
  )
}

export default CreateAccountModal
