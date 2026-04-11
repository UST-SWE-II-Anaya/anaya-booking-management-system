import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import useAuthStore from '../../store/authStore'
import { getMyProfile, updateMyProfile } from '../../services/customerProfileService'

const ProfileEdit = () => {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone_number: '',
    date_of_birth: '',
    gender: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    getMyProfile(user.id).then((p) => {
      setForm({
        first_name: p.first_name ?? '',
        last_name: p.last_name ?? '',
        phone_number: p.phone_number ?? '',
        date_of_birth: p.date_of_birth ?? '',
        gender: p.gender ?? '',
      })
    })
  }, [user?.id])

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateMyProfile(user.id, form)
      toast.success('Profile updated.')
      navigate('/profile')
    } catch {
      toast.error('Failed to update profile.')
    } finally {
      setSaving(false)
    }
  }

  const onChange = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  return (
    <div className="min-h-screen bg-anaya-bg">
      <div className="max-w-lg mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold text-anaya-text mb-6">
          Edit User Detail
        </h1>

        <div className="bg-white border border-gray-200 rounded-2xl p-8">
          <div className="space-y-4">
            {/* First + Last Name */}
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-anaya-text mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  value={form.first_name}
                  onChange={onChange('first_name')}
                  placeholder="Jane"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-anaya-accent bg-white"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-anaya-text mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  value={form.last_name}
                  onChange={onChange('last_name')}
                  placeholder="Doe"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-anaya-accent bg-white"
                />
              </div>
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-sm font-medium text-anaya-text mb-1">
                Phone Number
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 border border-r-0 border-gray-200 rounded-l-lg bg-gray-50 text-sm text-gray-500 select-none">
                  +63
                </span>
                <input
                  type="tel"
                  value={form.phone_number}
                  onChange={onChange('phone_number')}
                  placeholder="123 456 7890"
                  className="flex-1 border border-gray-200 rounded-r-lg px-3 py-2.5 text-sm focus:outline-none focus:border-anaya-accent bg-white"
                />
              </div>
            </div>

            {/* Date of Birth */}
            <div>
              <label className="block text-sm font-medium text-anaya-text mb-1">
                Date of Birth
              </label>
              <input
                type="date"
                value={form.date_of_birth}
                onChange={onChange('date_of_birth')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-anaya-accent bg-white"
              />
            </div>

            {/* Gender */}
            <div>
              <label className="block text-sm font-medium text-anaya-text mb-1">
                Gender
              </label>
              <select
                value={form.gender}
                onChange={onChange('gender')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-anaya-accent bg-white"
              >
                <option value="">Select...</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-8">
            <button
              onClick={() => navigate('/profile')}
              className="flex-1 border border-gray-300 text-anaya-text py-2.5 rounded-full font-medium hover:border-anaya-accent transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-anaya-accent hover:bg-anaya-accent-hover text-white py-2.5 rounded-full font-medium transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProfileEdit
