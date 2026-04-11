import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import clsx from 'clsx'
import useBookingStore from '../../store/bookingStore'
import { getStaffList } from '../../services/staffService'
import BookingSidebar from '../../components/customer/BookingSidebar'

const GENERIC_OPTIONS = [
  {
    id: 'any',
    preference: 'any',
    label: 'Any professional',
    subtitle: 'for maximum availability',
  },
  {
    id: 'any_female',
    preference: 'any_female',
    label: 'Any female professional',
    subtitle: 'any female professional available',
  },
  {
    id: 'any_male',
    preference: 'any_male',
    label: 'Any male professional',
    subtitle: 'any male professional available',
  },
]

const StaffStep = () => {
  const navigate = useNavigate()
  const {
    cart,
    staffPreference,
    setStaffPreference,
    setSelectedStaff,
  } = useBookingStore()
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (cart.length === 0) {
      navigate('/booking/services', { replace: true })
      return
    }
    getStaffList()
      .then(setStaff)
      .finally(() => setLoading(false))
  }, [])

  const handleGenericSelect = (pref) => {
    setStaffPreference(pref)
    navigate('/booking/datetime')
  }

  const handleSpecificSelect = (staffId) => {
    setStaffPreference('specific')
    setSelectedStaff(staffId)
    navigate('/booking/datetime')
  }

  return (
    <div className="min-h-screen bg-anaya-bg">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <Link
          to="/booking/services"
          className="text-sm text-gray-500 hover:underline mb-4 inline-block"
        >
          ← Go Back to Previous Page
        </Link>
        <div className="flex gap-8 items-start">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-anaya-text mb-6">
              Select a Professional
            </h1>

            <div className="space-y-3 mb-6">
              {GENERIC_OPTIONS.map((opt) => {
                const isSelected = staffPreference === opt.preference
                return (
                  <button
                    key={opt.id}
                    onClick={() => handleGenericSelect(opt.preference)}
                    className={clsx(
                      'w-full flex items-center gap-4 p-4 rounded-xl border',
                      'text-left transition-colors',
                      isSelected
                        ? 'bg-anaya-accent/10 border-anaya-accent'
                        : 'bg-white border-gray-200 hover:border-anaya-accent'
                    )}
                  >
                    <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-2xl shrink-0">
                      {opt.id === 'any' ? '👥' : '👤'}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-anaya-text">{opt.label}</p>
                      <p className="text-sm text-gray-400">{opt.subtitle}</p>
                    </div>
                    {isSelected ? (
                      <div className="w-8 h-8 rounded-full bg-anaya-accent flex items-center justify-center text-white text-sm shrink-0">
                        ✓
                      </div>
                    ) : (
                      <span className="text-sm border border-anaya-accent text-anaya-accent px-3 py-1 rounded-full shrink-0">
                        Select
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {!loading && staff.length > 0 && (
              <div className="space-y-3">
                {staff.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleSpecificSelect(s.id)}
                    className={clsx(
                      'w-full flex items-center gap-4 p-4 rounded-xl border',
                      'bg-white border-gray-200 hover:border-anaya-accent',
                      'text-left transition-colors'
                    )}
                  >
                    {s.avatar_url ? (
                      <img
                        src={s.avatar_url}
                        alt={s.first_name}
                        className="w-12 h-12 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-base font-bold text-gray-500 shrink-0">
                        {s.first_name?.[0]}{s.last_name?.[0]}
                      </div>
                    )}
                    <span className="flex-1 font-medium text-anaya-text">
                      {s.first_name} {s.last_name}
                    </span>
                    <span className="text-sm border border-anaya-accent text-anaya-accent px-3 py-1 rounded-full shrink-0">
                      Select
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <BookingSidebar
            onContinue={() => navigate('/booking/datetime')}
            continueDisabled={!staffPreference}
          />
        </div>
      </div>
    </div>
  )
}

export default StaffStep
