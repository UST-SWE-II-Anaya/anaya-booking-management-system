// src/pages/customer/StaffStep.jsx
import { useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import clsx from 'clsx'
import useBookingStore from '../../store/bookingStore'
import BookingSidebar from '../../components/customer/BookingSidebar'

const GENERIC_OPTIONS = [
  {
    id: 'any',
    preference: 'any',
    label: 'Any professional',
    subtitle: 'for maximum availability',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-7 h-7 text-blue-400">
        <circle cx="25" cy="12" r="5" fill="currentColor" opacity="0.45" />
        <path
          d="M15 34c0-5.5 4-9 10-9h6c6 0 9 3.5 9 9"
          stroke="currentColor" strokeWidth="2" fill="none" opacity="0.45"
        />
        <circle cx="16" cy="14" r="6" fill="currentColor" opacity="0.9" />
        <path
          d="M4 34c0-6 4.5-10 12-10s12 4 12 10"
          stroke="currentColor" strokeWidth="2" fill="none" opacity="0.9"
        />
      </svg>
    ),
  },
  {
    id: 'any_female',
    preference: 'any_female',
    label: 'Any female professional',
    subtitle: 'any female professional available',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-7 h-7 text-blue-400">
        <circle cx="20" cy="13" r="7" fill="currentColor" opacity="0.85" />
        <path
          d="M8 36c0-7 5.4-12 12-12s12 5 12 12"
          stroke="currentColor" strokeWidth="2" fill="none" opacity="0.85"
        />
      </svg>
    ),
  },
  {
    id: 'any_male',
    preference: 'any_male',
    label: 'Any male professional',
    subtitle: 'any male professional available',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-7 h-7 text-blue-400">
        <circle cx="20" cy="13" r="7" fill="currentColor" opacity="0.85" />
        <path
          d="M8 36c0-7 5.4-12 12-12s12 5 12 12"
          stroke="currentColor" strokeWidth="2" fill="none" opacity="0.85"
        />
      </svg>
    ),
  },
]

const StaffStep = () => {
  const navigate = useNavigate()
  const { cart, staffPreference, setStaffPreference } = useBookingStore()

  useEffect(() => {
    if (cart.length === 0) {
      navigate('/booking/services', { replace: true })
    }
  }, [cart.length, navigate])

  const handleSelect = (pref) => {
    setStaffPreference(pref)
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
            <div className="space-y-3">
              {GENERIC_OPTIONS.map((opt) => {
                const isSelected = staffPreference === opt.preference
                return (
                  <button
                    key={opt.id}
                    onClick={() => handleSelect(opt.preference)}
                    className={clsx(
                      'w-full flex items-center gap-4 p-4 rounded-xl border',
                      'text-left transition-colors',
                      isSelected
                        ? 'bg-anaya-accent/10 border-anaya-accent'
                        : 'bg-white border-gray-200 hover:border-anaya-accent'
                    )}
                  >
                    <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center
                      justify-center shrink-0">
                      {opt.icon}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-anaya-text">{opt.label}</p>
                      <p className="text-sm text-gray-400">{opt.subtitle}</p>
                    </div>
                    {isSelected ? (
                      <div className="w-8 h-8 rounded-full bg-anaya-accent flex items-center
                        justify-center text-white shrink-0">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                    ) : (
                      <span className="text-sm border border-anaya-accent text-anaya-accent
                        px-3 py-1 rounded-full shrink-0">
                        Select
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
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
