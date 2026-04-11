import { describe, it, expect } from 'vitest'
import { generateTimeSlots, formatDuration } from './bookingUtils'

describe('generateTimeSlots', () => {
  it('generates 22 slots from 09:00 to 19:30', () => {
    const slots = generateTimeSlots([])
    expect(slots).toHaveLength(22)
    expect(slots[0].time).toBe('09:00')
    expect(slots[21].time).toBe('19:30')
    expect(slots.every((s) => !s.blocked)).toBe(true)
  })

  it('blocks slots that fall within a blocked interval', () => {
    const slots = generateTimeSlots([{ start_time: '10:00', duration_minutes: 60 }])
    expect(slots.find((s) => s.time === '10:00').blocked).toBe(true)
    expect(slots.find((s) => s.time === '10:30').blocked).toBe(true)
    expect(slots.find((s) => s.time === '11:00').blocked).toBe(false)
  })

  it('does not block a slot that ends exactly when an interval starts', () => {
    const slots = generateTimeSlots([{ start_time: '11:00', duration_minutes: 60 }])
    expect(slots.find((s) => s.time === '10:30').blocked).toBe(false)
  })

  it('handles multiple blocked intervals', () => {
    const slots = generateTimeSlots([
      { start_time: '09:00', duration_minutes: 30 },
      { start_time: '14:00', duration_minutes: 60 },
    ])
    expect(slots.find((s) => s.time === '09:00').blocked).toBe(true)
    expect(slots.find((s) => s.time === '09:30').blocked).toBe(false)
    expect(slots.find((s) => s.time === '14:00').blocked).toBe(true)
    expect(slots.find((s) => s.time === '14:30').blocked).toBe(true)
    expect(slots.find((s) => s.time === '15:00').blocked).toBe(false)
  })
})

describe('formatDuration', () => {
  it('formats minutes only', () => {
    expect(formatDuration(45)).toBe('45 mins')
  })
  it('formats exact hours (singular)', () => {
    expect(formatDuration(60)).toBe('1 hr')
  })
  it('formats exact hours (plural)', () => {
    expect(formatDuration(120)).toBe('2 hrs')
  })
  it('formats hours and minutes', () => {
    expect(formatDuration(90)).toBe('1 hr 30 mins')
  })
  it('formats multiple hours and minutes', () => {
    expect(formatDuration(150)).toBe('2 hrs 30 mins')
  })
})
