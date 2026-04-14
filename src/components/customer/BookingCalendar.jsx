import { useState } from 'react'
import clsx from 'clsx'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const BookingCalendar = ({ onDateSelect, selectedDate }) => {
  const today = new Date()
  const [viewDate, setViewDate] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  )

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const toISO = (d) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  const isPast = (d) => {
    const cell = new Date(year, month, d)
    const todayMidnight = new Date(
      today.getFullYear(), today.getMonth(), today.getDate()
    )
    return cell < todayMidnight
  }

  const isToday = (d) =>
    d === today.getDate() &&
    month === today.getMonth() &&
    year === today.getFullYear()

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => setViewDate(new Date(year, month - 1, 1))}
          className="p-1 hover:bg-gray-100 rounded text-gray-500"
        >
          ‹
        </button>
        <span className="font-semibold text-anaya-text">
          {MONTHS[month]} {year}
        </span>
        <button
          onClick={() => setViewDate(new Date(year, month + 1, 1))}
          className="p-1 hover:bg-gray-100 rounded text-gray-500"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400 mb-2">
        {DAYS.map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {cells.map((d, i) => (
          <div key={i}>
            {d ? (
              <button
                disabled={isPast(d)}
                onClick={() => onDateSelect(toISO(d))}
                className={clsx(
                  'w-8 h-8 rounded-full text-sm mx-auto flex items-center justify-center transition-colors',
                  isPast(d) && 'text-gray-300 cursor-not-allowed',
                  !isPast(d) && selectedDate === toISO(d) &&
                    'bg-anaya-accent text-white font-semibold',
                  !isPast(d) && selectedDate !== toISO(d) && isToday(d) &&
                    'border border-anaya-accent text-anaya-accent',
                  !isPast(d) && selectedDate !== toISO(d) && !isToday(d) &&
                    'hover:bg-gray-100 text-anaya-text'
                )}
              >
                {d}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

export default BookingCalendar
