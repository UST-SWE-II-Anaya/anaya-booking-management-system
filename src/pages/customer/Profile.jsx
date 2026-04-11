import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil } from 'lucide-react'
import { toast } from 'react-hot-toast'
import useAuthStore from '../../store/authStore'
import { getMyProfile, uploadAvatar, updateMyProfile } from '../../services/customerProfileService'

const FIELDS = [
  ['First Name', 'first_name'],
  ['Last Name', 'last_name'],
  ['Phone Number', 'phone_number'],
  ['Date of Birth', 'date_of_birth'],
  ['Gender', 'gender'],
]

const Profile = () => {
  const { user } = useAuthStore()
  const [profile, setProfile] = useState(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    getMyProfile(user.id).then(setProfile)
  }, [])

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadAvatar(file, user.id)
      await updateMyProfile(user.id, { avatar_url: url })
      setProfile((p) => ({ ...p, avatar_url: url }))
      toast.success('Profile photo updated.')
    } catch {
      toast.error('Failed to update photo.')
    } finally {
      setUploading(false)
    }
  }

  if (!profile) return (
    <div className="min-h-screen bg-anaya-bg flex items-center justify-center">
      <p className="text-gray-500">Loading...</p>
    </div>
  )

  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'User'

  return (
    <div className="min-h-screen bg-anaya-bg">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold text-anaya-text mb-8">Profile</h1>

        <div className="bg-white border border-gray-200 rounded-2xl p-8">
          {/* Avatar */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative">
              <img
                src={profile.avatar_url ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=90987D&color=fff&size=128`}
                alt="Avatar"
                className="w-28 h-28 rounded-full object-cover border-4 border-white shadow-md"
              />
              <label className="absolute bottom-0 right-0 bg-white border border-gray-200 rounded-full p-1.5 cursor-pointer shadow-sm hover:bg-gray-50 transition-colors">
                <Pencil size={14} className="text-gray-600" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                  disabled={uploading}
                />
              </label>
            </div>
            {uploading && <p className="text-xs text-gray-400 mt-2">Uploading...</p>}
            <h2 className="text-xl font-semibold text-anaya-text mt-3">{fullName}</h2>
          </div>

          {/* Fields */}
          <div className="space-y-4 mb-8">
            {FIELDS.map(([label, key]) => (
              <div key={key}>
                <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                <p className="text-sm font-medium text-anaya-text">{profile[key] ?? '—'}</p>
              </div>
            ))}
          </div>

          <Link
            to="/profile/edit"
            className="block w-full bg-anaya-accent hover:bg-anaya-accent-hover text-white py-3 rounded-xl font-medium text-center transition-colors"
          >
            Edit
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Profile
