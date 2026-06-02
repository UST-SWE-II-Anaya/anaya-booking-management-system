import { render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import StaffAppointmentsPage from './AppointmentsPage'

vi.mock('../../store/authStore', () => ({
  default: () => ({ user: { id: 'staff-123' } })
}))

vi.mock('../../services/staffAppointmentService', () => ({
  getMyAppointments: vi.fn(),
  getMyAppointmentById: vi.fn(),
  getMyAppointmentDates: vi.fn(),
  claimAppointment: vi.fn(),
}))

vi.mock('../../components/staff/MonthCalendar', () => ({
  default: () => <div data-testid="month-calendar" />
}))

vi.mock('../../components/admin/payments/PaymentVerificationModal', () => ({
  default: ({ open, readOnly }) => open ? <div data-testid="payment-modal" data-readonly={readOnly} /> : null
}))

import { getMyAppointments } from '../../services/staffAppointmentService'

describe('StaffAppointmentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows Awaiting admin payment review instead of Take this session when payment is pending', async () => {
    getMyAppointments.mockResolvedValue({
      data: [{
        id: 'appt-1',
        reference_id: 'REF-1',
        booking_status: 'upcoming',
        downpayment_status: 'pending',
        staff_id: null,
        appointment_date: '2026-06-02',
        start_time: '10:00:00',
        total_duration_minutes: 60,
        subtotal: 1000,
        downpayment_amount: 500,
      }],
      count: 1
    })

    render(<StaffAppointmentsPage />)

    await waitFor(() => {
      expect(screen.getByText('REF-1')).toBeInTheDocument()
      expect(screen.getByText('Awaiting admin payment review')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Take this session' })).not.toBeInTheDocument()
    })
  })

  it('shows View Payment button for paid downpayments instead of Review Payment', async () => {
    getMyAppointments.mockResolvedValue({
      data: [{
        id: 'appt-2',
        reference_id: 'REF-2',
        booking_status: 'upcoming',
        downpayment_status: 'paid',
        staff_id: 'staff-123',
        appointment_date: '2026-06-02',
        start_time: '11:00:00',
        total_duration_minutes: 60,
        subtotal: 1000,
        downpayment_amount: 500,
      }],
      count: 1
    })

    render(<StaffAppointmentsPage />)

    await waitFor(() => {
      expect(screen.getByText('REF-2')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'View Payment' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Review Payment' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Approve Appointment' })).not.toBeInTheDocument()
    })
  })

  it('shows Take this session when unassigned and no pending payment', async () => {
    getMyAppointments.mockResolvedValue({
      data: [{
        id: 'appt-3',
        reference_id: 'REF-3',
        booking_status: 'upcoming',
        downpayment_status: 'unpaid',
        staff_id: null,
        appointment_date: '2026-06-02',
        start_time: '12:00:00',
        total_duration_minutes: 60,
        subtotal: 1000,
        downpayment_amount: 500,
      }],
      count: 1
    })

    render(<StaffAppointmentsPage />)

    await waitFor(() => {
      expect(screen.getByText('REF-3')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Take this session' })).toBeInTheDocument()
      expect(screen.queryByText('Awaiting admin payment review')).not.toBeInTheDocument()
    })
  })
})
