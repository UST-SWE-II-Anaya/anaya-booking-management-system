import { ChevronLeft, ChevronRight } from 'lucide-react'
import clsx from 'clsx'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const pad = (n) => String(n).padStart(2, '0')

/**
 * @param {{
 *   year: number,
 *   month: number,          // 1-based
 *   appointmentDates: Set,  // Set of 'YYYY-MM-DD' strings
 *   selectedDate: string | null,
 *   onDateSelect: (date: string) => void,
 *   onMonthChange: (year: number, month: number) => void
 * }} props
 */
const MonthCalendar = ({
  year,
  month,
  appointmentDates,
  selectedDate,
  onDateSelect,
  onMonthChange,
}) => {
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const todayStr = new Date().toISOString().split('T')[0]

  const cells = []
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const prevMonth = () => {
    if (month === 1) onMonthChange(year - 1, 12)
    else onMonthChange(year, month - 1)
  }

  const nextMonth = () => {
    if (month === 12) onMonthChange(year + 1, 1)
    else onMonthChange(year, month + 1)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500
            transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="text-sm font-semibold text-[#2C2C2C]">
          {MONTH_NAMES[month - 1]} {year}
        </p>
        <button
          onClick={nextMonth}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500
            transition-colors"
          aria-label="Next month"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 mb-2">
        {DAY_LABELS.map((d) => (
          <div
            key={d}
            className="text-center text-xs font-medium text-gray-400 py-1"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} />
          const dateStr = `${year}-${pad(month)}-${pad(day)}`
          const hasAppt = appointmentDates.has(dateStr)
          const isToday = dateStr === todayStr
          const isSelected = dateStr === selectedDate

          return (
            <button
              key={dateStr}
              onClick={() => onDateSelect(dateStr)}
              data-has-appointment={hasAppt ? 'true' : 'false'}
              className={clsx(
                'relative flex flex-col items-center justify-center h-9 rounded-lg',
                'text-sm transition-colors',
                isSelected
                  ? 'bg-[#8A956D] text-white font-semibold'
                  : isToday
                  ? 'bg-[#8A956D]/10 text-[#8A956D] font-semibold'
                  : 'hover:bg-gray-100 text-[#4A4A4A]'
              )}
            >
              {day}
              {hasAppt && (
                <span
                  className={clsx(
                    'absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full',
                    isSelected ? 'bg-white' : 'bg-[#CE845D]'
                  )}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default MonthCalendar
