import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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

const AvatarPlaceholder = ({ name }) => (
  <div className="w-24 h-24 rounded-full bg-anaya-accent/20 flex items-center justify-center text-2xl font-bold text-anaya-accent">
    {name?.[0]?.toUpperCase() ?? '?'}
  </div>
)

const Profile = () => {
  const { user } = useAuthStore()
  const [profile, setProfile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [fetchError, setFetchError] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    getMyProfile(user.id)
      .then(setProfile)
      .catch(() => setFetchError(true))
  }, [user?.id])

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

  if (fetchError) return (
    <div className="min-h-screen bg-anaya-bg flex items-center justify-center">
      <p className="text-gray-500 text-center mt-10">Could not load profile. Please refresh.</p>
    </div>
  )

  if (!profile) return (
    <div className="min-h-screen bg-anaya-bg flex items-center justify-center">
      <p className="text-gray-500">Loading...</p>
    </div>
  )

  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'User'

  return (
    <div className="min-h-screen bg-anaya-bg">
      <div className="max-w-lg mx-auto px-6 py-10">
        <div className="flex justify-start mb-6">
          <Link to="/dashboard" className="text-sm text-gray-500 hover:underline flex items-center">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Go back to My Appointments
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-anaya-text mb-6">Profile</h1>

        <div className="bg-white border border-gray-200 rounded-2xl p-8 flex flex-col items-center">
          {/* Avatar with pencil overlay */}
          <div className="relative mb-2">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Avatar"
                className="w-24 h-24 rounded-full object-cover"
              />
            ) : (
              <AvatarPlaceholder name={profile.first_name} />
            )}
            <label className="absolute bottom-0 right-0 bg-white border border-gray-200 rounded-full p-1 cursor-pointer shadow-sm hover:bg-gray-50 transition-colors">
              <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a4 4 0 01-1.414.828l-3 1 1-3a4 4 0 01.828-1.414z" />
              </svg>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
                disabled={uploading}
              />
            </label>
          </div>

          {uploading && <p className="text-xs text-gray-400 mb-1">Uploading...</p>}

          <h2 className="text-lg font-semibold text-anaya-text mb-6">{fullName}</h2>

          {/* Fields */}
          <div className="w-full space-y-4 mb-8">
            {FIELDS.map(([label, key]) => (
              <div key={key}>
                <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                <p className="text-sm text-anaya-text">{profile[key] ?? '—'}</p>
              </div>
            ))}
          </div>

          <Link
            to="/profile/edit"
            className="bg-anaya-accent hover:bg-anaya-accent-hover text-white px-10 py-2.5 rounded-full font-medium text-center transition-colors"
          >
            Edit
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Profile
