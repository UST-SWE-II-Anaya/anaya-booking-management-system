import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import clsx from 'clsx'
import useBookingStore from '../../store/bookingStore'
import { getAvailableSlots } from '../../services/availabilityService'
import { generateTimeSlots } from '../../utils/bookingUtils'
import BookingSidebar from '../../components/customer/BookingSidebar'
import BookingCalendar from '../../components/customer/BookingCalendar'

const to12h = (time24) => {
  const [h, m] = time24.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

const DateTimeStep = () => {
  const navigate = useNavigate()
  const { staffPreference, selectedStaffId, setDateTime } = useBookingStore()
  const [selectedDate, setSelectedDate] = useState(null)
  const [slots, setSlots] = useState([])
  const [selectedTime, setSelectedTime] = useState(null)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [displayDate, setDisplayDate] = useState('')

  if (!staffPreference) {
    navigate('/booking/staff', { replace: true })
    return null
  }

  const handleDateSelect = async (date) => {
    setSelectedDate(date)
    setSelectedTime(null)
    setLoadingSlots(true)

    const d = new Date(date + 'T00:00:00')
    setDisplayDate(
      d.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    )

    const staffId = staffPreference === 'specific' ? selectedStaffId : null
    try {
      const blocked = await getAvailableSlots(staffId, date, staffPreference)
      setSlots(generateTimeSlots(blocked || []))
    } finally {
      setLoadingSlots(false)
    }
  }

  const handleContinue = () => {
    setDateTime(selectedDate, selectedTime)
    navigate('/booking/review')
  }

  return (
    <div className="min-h-screen bg-anaya-bg">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <Link
          to="/booking/staff"
          className="text-sm text-gray-500 hover:underline mb-4 inline-block"
        >
          ← Go Back to Previous Page
        </Link>
        <div className="flex gap-8 items-start">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-anaya-text mb-6">
              Select a Time and Date
            </h1>

            <BookingCalendar
              onDateSelect={handleDateSelect}
              selectedDate={selectedDate}
            />

            {selectedDate && (
              <div className="mt-6">
                <h2 className="font-semibold text-anaya-text mb-3">
                  Available Times for {displayDate}
                </h2>
                {loadingSlots ? (
                  <p className="text-sm text-gray-400">
                    Loading available times...
                  </p>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {slots.map((slot) => (
                      <button
                        key={slot.time}
                        disabled={slot.blocked}
                        onClick={() => setSelectedTime(slot.time)}
                        className={clsx(
                          'py-2 px-3 rounded-lg text-sm border transition-colors',
                          slot.blocked &&
                            'opacity-40 cursor-not-allowed bg-gray-100 border-gray-200 text-gray-400',
                          !slot.blocked &&
                            selectedTime === slot.time &&
                            'bg-anaya-accent text-white border-anaya-accent font-medium',
                          !slot.blocked &&
                            selectedTime !== slot.time &&
                            'bg-white border-gray-200 hover:border-anaya-accent text-anaya-text'
                        )}
                      >
                        {to12h(slot.time)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <BookingSidebar
            onContinue={handleContinue}
            continueDisabled={!selectedDate || !selectedTime}
          />
        </div>
      </div>
    </div>
  )
}

export default DateTimeStep
