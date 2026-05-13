import { describe, it, expect } from 'vitest'
import { buildCsv } from './bookingsCsv'

const makeBooking = (overrides = {}) => ({
  reference_id: 'AN-TEST',
  appointment_date: '2026-05-14',
  start_time: '09:00:00',
  booking_status: 'upcoming',
  downpayment_status: 'pending',
  subtotal: '500.00',
  downpayment_amount: '250.00',
  remaining_balance: '250.00',
  booking_notes: null,
  created_at: '2026-05-01T10:00:00Z',
  customer: {
    first_name: 'Jane',
    last_name: 'Doe',
    email: 'jane@example.com',
    phone_number: '09171234567',
  },
  staff: { first_name: 'Fiona', last_name: 'Facial' },
  booking_services: [
    { services: { name: 'Facial Treatment' } },
    { services: { name: 'Eyebrow Shaping' } },
  ],
  ...overrides,
})

describe('buildCsv', () => {
  it('includes header row as first line', () => {
    const csv = buildCsv([makeBooking()])
    const firstLine = csv.split('\n')[0]
    expect(firstLine).toBe(
      'Ref ID,Customer Name,Email,Phone,Appointment Date,Start Time,Services,Subtotal,Downpayment Amount,Remaining Balance,Booking Status,Payment Status,Staff,Notes,Created At'
    )
  })

  it('maps booking fields to correct columns', () => {
    const csv = buildCsv([makeBooking()])
    const dataLine = csv.split('\n')[1]
    expect(dataLine).toContain('AN-TEST')
    expect(dataLine).toContain('Jane Doe')
    expect(dataLine).toContain('jane@example.com')
    expect(dataLine).toContain('09171234567')
    expect(dataLine).toContain('2026-05-14')
    expect(dataLine).toContain('09:00:00')
    expect(dataLine).toContain('Fiona Facial')
    expect(dataLine).toContain('upcoming')
    expect(dataLine).toContain('pending')
  })

  it('joins multiple services with semicolon', () => {
    const csv = buildCsv([makeBooking()])
    expect(csv).toContain('Facial Treatment; Eyebrow Shaping')
  })

  it('uses "Unassigned" when staff is null', () => {
    const csv = buildCsv([makeBooking({ staff: null })])
    expect(csv).toContain('Unassigned')
  })

  it('handles empty booking_services gracefully', () => {
    const csv = buildCsv([makeBooking({ booking_services: [] })])
    const lines = csv.split('\n')
    expect(lines).toHaveLength(2)
  })

  it('wraps values containing commas in double quotes', () => {
    const csv = buildCsv([makeBooking({ booking_notes: 'bring ID, please' })])
    expect(csv).toContain('"bring ID, please"')
  })

  it('escapes double quotes inside values', () => {
    const csv = buildCsv([makeBooking({ booking_notes: 'she said "hello"' })])
    expect(csv).toContain('"she said ""hello"""')
  })

  it('produces one data row per booking', () => {
    const csv = buildCsv([makeBooking(), makeBooking()])
    expect(csv.split('\n')).toHaveLength(3) // header + 2 rows
  })
})
