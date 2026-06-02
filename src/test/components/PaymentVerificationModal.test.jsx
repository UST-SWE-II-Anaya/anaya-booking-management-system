// src/test/components/PaymentVerificationModal.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PaymentVerificationModal from '../../components/admin/payments/PaymentVerificationModal'

vi.mock('../../components/common/Modal', () => ({
  default: ({ open, title, children }) =>
    open ? <div data-testid="modal"><h2>{title}</h2>{children}</div> : null,
}))

vi.mock('../../components/common/Badge', () => ({
  default: ({ label }) => <span data-testid="badge">{label}</span>,
}))

vi.mock('../../services/paymentService', () => ({
  verifyAndAssignPayment: vi.fn().mockResolvedValue({}),
  denyPayment: vi.fn().mockResolvedValue({}),
}))

vi.mock('../../services/staffService', () => ({
  getAssignableStaff: vi.fn().mockResolvedValue([
    { id: 'staff-1', first_name: 'Ana', last_name: 'Cruz', avatar_url: null,
      staff_details: { job_title: 'Therapist' } },
    { id: 'staff-2', first_name: 'Ben', last_name: 'Lee', avatar_url: null,
      staff_details: { job_title: 'Stylist' } },
  ]),
}))

vi.mock('../../store/authStore', () => ({
  default: () => ({ user: { id: 'admin-1' } }),
}))

const mockBooking = {
  id: 'booking-1',
  reference_id: 'BK-0001',
  customer: { first_name: 'Jane', last_name: 'Doe' },
  downpayment_amount: 500,
  downpayment_status: 'paid',
  professional_preference: 'any',
  payments: [{
    id: 'pay-1',
    reference_number: 'GC-12345678901',
    account_name: 'Jane Doe',
    amount: 500,
    receipt_url: null,
  }],
}

describe('PaymentVerificationModal', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    booking: mockBooking,
    onUpdated: vi.fn(),
  }

  beforeEach(() => vi.clearAllMocks())

  it('renders booking reference and customer name in step 1', () => {
    render(<PaymentVerificationModal {...defaultProps} />)
    expect(screen.getByText('BK-0001')).toBeInTheDocument()
    expect(screen.getAllByText('Jane Doe')[0]).toBeInTheDocument()
  })

  it('transitions to "Assign Staff Member" step when Verify & Approve is clicked', async () => {
    render(<PaymentVerificationModal {...defaultProps} />)
    fireEvent.click(screen.getByText('Verify & Approve'))
    expect(await screen.findByText('Assign Staff Member')).toBeInTheDocument()
  })

  it('shows customer preference label and staff list in step 2', async () => {
    render(<PaymentVerificationModal {...defaultProps} />)
    fireEvent.click(screen.getByText('Verify & Approve'))
    expect(await screen.findByText('Any Professional')).toBeInTheDocument()
    expect(await screen.findByText('Ana Cruz')).toBeInTheDocument()
    expect(await screen.findByText('Ben Lee')).toBeInTheDocument()
  })

  it('keeps Confirm Assignment button disabled until a staff member is selected', async () => {
    render(<PaymentVerificationModal {...defaultProps} />)
    fireEvent.click(screen.getByText('Verify & Approve'))
    const btn = await screen.findByText('Confirm Assignment')
    expect(btn.closest('button')).toBeDisabled()
  })

  it('enables Confirm Assignment after selecting a staff member', async () => {
    render(<PaymentVerificationModal {...defaultProps} />)
    fireEvent.click(screen.getByText('Verify & Approve'))
    fireEvent.click(await screen.findByText('Ana Cruz'))
    expect(screen.getByText('Confirm Assignment').closest('button')).not.toBeDisabled()
  })

  it('returns to step 1 and shows Payment Verification title when Back is clicked', async () => {
    render(<PaymentVerificationModal {...defaultProps} />)
    fireEvent.click(screen.getByText('Verify & Approve'))
    await screen.findByText('Assign Staff Member')
    fireEvent.click(screen.getByText('Back to payment review'))
    expect(screen.getByText('Payment Verification')).toBeInTheDocument()
  })
})
