import { useState, useEffect } from 'react'
import { Save, Eye, EyeOff, UserCircle } from 'lucide-react'
import {
  getMyFullProfile,
  updateMyProfile,
  updateMyStaffDetails,
  updateMyPassword,
} from '../../services/staffProfileService'
import useAuthStore from '../../store/authStore'
import Spinner from '../../components/common/Spinner'

const Section = ({ title, children }) => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
    <h2 className="font-semibold text-[#2C2C2C] mb-5">{title}</h2>
    {children}
  </div>
)

const inputClass = `w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm
  focus:outline-none focus:ring-2 focus:ring-[#8A956D]/40 focus:border-[#8A956D]`

const SaveButton = ({ loading, label = 'Save' }) => (
  <button
    type="submit"
    disabled={loading}
    className="flex items-center gap-2 px-4 py-2 bg-[#8A956D] hover:bg-[#7a8560]
      text-white text-sm rounded-lg transition-colors disabled:opacity-50"
  >
    <Save size={14} />
    {loading ? 'Saving…' : label}
  </button>
)

const StaffProfileSettingsPage = () => {
  const { user, setProfile } = useAuthStore()
  const userId = user?.id

  const [fullProfile, setFullProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const [personal, setPersonal] = useState({
    first_name: '', last_name: '', avatar_url: '',
  })
  const [personalSaving, setPersonalSaving] = useState(false)
  const [personalMsg, setPersonalMsg] = useState(null)

  const [contact, setContact] = useState({
    contact_number: '',
    email: '',
    instagram: '',
    facebook: '',
    tiktok: '',
  })
  const [contactSaving, setContactSaving] = useState(false)
  const [contactMsg, setContactMsg] = useState(null)

  const [pwForm, setPwForm] = useState({ next: '', confirm: '' })
  const [showPw, setShowPw] = useState({ next: false, confirm: false })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState(null)

  useEffect(() => {
    if (!userId) return
    getMyFullProfile(userId)
      .then((p) => {
        setFullProfile(p)
        setPersonal({
          first_name: p.first_name ?? '',
          last_name: p.last_name ?? '',
          avatar_url: p.avatar_url ?? '',
        })
        const social = p.staff_details?.social_media_links ?? {}
        setContact({
          contact_number: p.staff_details?.contact_number ?? '',
          email: p.email ?? '',
          instagram: social.instagram ?? '',
          facebook: social.facebook ?? '',
          tiktok: social.tiktok ?? '',
        })
      })
      .catch((err) => console.error('Profile load error:', err))
      .finally(() => setLoading(false))
  }, [userId])

  const handlePersonalSave = async (e) => {
    e.preventDefault()
    setPersonalSaving(true)
    setPersonalMsg(null)
    try {
      const updated = await updateMyProfile(userId, {
        first_name: personal.first_name,
        last_name: personal.last_name,
        avatar_url: personal.avatar_url || null,
      })
      setProfile(updated)
      setPersonalMsg({ type: 'success', text: 'Profile updated.' })
    } catch (err) {
      setPersonalMsg({ type: 'error', text: err.message })
    } finally {
      setPersonalSaving(false)
    }
  }

  const handleContactSave = async (e) => {
    e.preventDefault()
    setContactSaving(true)
    setContactMsg(null)
    try {
      await updateMyStaffDetails(userId, {
        contact_number: contact.contact_number || null,
        social_media_links: {
          instagram: contact.instagram || null,
          facebook: contact.facebook || null,
          tiktok: contact.tiktok || null,
        },
      })
      if (contact.email !== fullProfile?.email) {
        await updateMyProfile(userId, { email: contact.email })
      }
      setContactMsg({ type: 'success', text: 'Contact info updated.' })
    } catch (err) {
      setContactMsg({ type: 'error', text: err.message })
    } finally {
      setContactSaving(false)
    }
  }

  const handlePasswordSave = async (e) => {
    e.preventDefault()
    setPwMsg(null)
    if (pwForm.next !== pwForm.confirm) {
      setPwMsg({ type: 'error', text: 'New passwords do not match.' })
      return
    }
    setPwSaving(true)
    try {
      await updateMyPassword(pwForm.next)
      setPwForm({ next: '', confirm: '' })
      setPwMsg({ type: 'success', text: 'Password updated successfully.' })
    } catch (err) {
      setPwMsg({ type: 'error', text: err.message })
    } finally {
      setPwSaving(false)
    }
  }

  const msgClass = (type) =>
    type === 'success'
      ? 'text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2'
      : 'text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2'

  const togglePw = (field) =>
    setShowPw((s) => ({ ...s, [field]: !s[field] }))

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-semibold text-[#2C2C2C]">Profile Settings</h1>

      {/* Personal info */}
      <Section title="Personal Information">
        <form onSubmit={handlePersonalSave} className="space-y-4">
          <div className="flex items-center gap-4 mb-2">
            {personal.avatar_url ? (
              <img
                src={personal.avatar_url}
                alt="Avatar"
                className="w-16 h-16 rounded-full object-cover border border-gray-200"
                onError={(e) => { e.target.style.display = 'none' }}
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center
                justify-center">
                <UserCircle size={32} className="text-gray-400" />
              </div>
            )}
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">
                Profile Picture URL
              </label>
              <input
                className={inputClass}
                value={personal.avatar_url}
                onChange={(e) =>
                  setPersonal((p) => ({ ...p, avatar_url: e.target.value }))
                }
                placeholder="https://…"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">First Name</label>
              <input
                className={inputClass}
                value={personal.first_name}
                onChange={(e) =>
                  setPersonal((p) => ({ ...p, first_name: e.target.value }))
                }
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Last Name</label>
              <input
                className={inputClass}
                value={personal.last_name}
                onChange={(e) =>
                  setPersonal((p) => ({ ...p, last_name: e.target.value }))
                }
                required
              />
            </div>
          </div>

          {personalMsg && (
            <p className={msgClass(personalMsg.type)}>{personalMsg.text}</p>
          )}
          <div className="flex justify-end">
            <SaveButton loading={personalSaving} />
          </div>
        </form>
      </Section>

      {/* Change Password */}
      <Section title="Change Password">
        <form onSubmit={handlePasswordSave} className="space-y-4">
          {[
            { field: 'next', label: 'New Password' },
            { field: 'confirm', label: 'Confirm New Password' },
          ].map(({ field, label }) => (
            <div key={field}>
              <label className="block text-xs text-gray-500 mb-1">{label}</label>
              <div className="relative">
                <input
                  type={showPw[field] ? 'text' : 'password'}
                  className={inputClass + ' pr-10'}
                  value={pwForm[field]}
                  onChange={(e) =>
                    setPwForm((f) => ({ ...f, [field]: e.target.value }))
                  }
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => togglePw(field)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400
                    hover:text-gray-600"
                  aria-label={showPw[field] ? 'Hide' : 'Show'}
                >
                  {showPw[field] ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          ))}

          {pwMsg && <p className={msgClass(pwMsg.type)}>{pwMsg.text}</p>}
          <div className="flex justify-end">
            <SaveButton loading={pwSaving} label="Update Password" />
          </div>
        </form>
      </Section>

      {/* Contact & Social */}
      <Section title="Contact &amp; Social">
        <form onSubmit={handleContactSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Contact Number
              </label>
              <input
                className={inputClass}
                value={contact.contact_number}
                onChange={(e) =>
                  setContact((c) => ({ ...c, contact_number: e.target.value }))
                }
                placeholder="+63 912 345 6789"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Email</label>
              <input
                type="email"
                className={inputClass}
                value={contact.email}
                onChange={(e) =>
                  setContact((c) => ({ ...c, email: e.target.value }))
                }
                required
              />
            </div>
          </div>

          <div className="pt-2">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">
              Social Media Links
            </p>
            <div className="space-y-3">
              {[
                { field: 'instagram', placeholder: 'https://instagram.com/handle' },
                { field: 'facebook', placeholder: 'https://facebook.com/profile' },
                { field: 'tiktok', placeholder: 'https://tiktok.com/@handle' },
              ].map(({ field, placeholder }) => (
                <div key={field}>
                  <label className="block text-xs text-gray-500 mb-1 capitalize">
                    {field}
                  </label>
                  <input
                    className={inputClass}
                    value={contact[field]}
                    onChange={(e) =>
                      setContact((c) => ({ ...c, [field]: e.target.value }))
                    }
                    placeholder={placeholder}
                  />
                </div>
              ))}
            </div>
          </div>

          {contactMsg && <p className={msgClass(contactMsg.type)}>{contactMsg.text}</p>}
          <div className="flex justify-end">
            <SaveButton loading={contactSaving} />
          </div>
        </form>
      </Section>
    </div>
  )
}

export default StaffProfileSettingsPage
