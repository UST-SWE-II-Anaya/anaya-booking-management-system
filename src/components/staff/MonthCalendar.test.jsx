import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MonthCalendar from './MonthCalendar'

describe('MonthCalendar', () => {
  const appointmentDates = new Set(['2026-04-03', '2026-04-10', '2026-04-15'])

  it('renders day-of-week headers', () => {
    render(
      <MonthCalendar
        year={2026}
        month={4}
        appointmentDates={appointmentDates}
        selectedDate={null}
        onDateSelect={vi.fn()}
        onMonthChange={vi.fn()}
      />
    )
    expect(screen.getByText('Sun')).toBeInTheDocument()
    expect(screen.getByText('Sat')).toBeInTheDocument()
  })

  it('marks appointment dates with a dot', () => {
    render(
      <MonthCalendar
        year={2026}
        month={4}
        appointmentDates={appointmentDates}
        selectedDate={null}
        onDateSelect={vi.fn()}
        onMonthChange={vi.fn()}
      />
    )
    const apptDays = document.querySelectorAll('[data-has-appointment="true"]')
    expect(apptDays.length).toBe(3)
  })

  it('calls onDateSelect with YYYY-MM-DD when a day is clicked', () => {
    const onDateSelect = vi.fn()
    render(
      <MonthCalendar
        year={2026}
        month={4}
        appointmentDates={appointmentDates}
        selectedDate={null}
        onDateSelect={onDateSelect}
        onMonthChange={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('3'))
    expect(onDateSelect).toHaveBeenCalledWith('2026-04-03')
  })
})
