import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import PaymentVerificationModal from './PaymentVerificationModal'

vi.mock('../../../services/paymentService', () => ({
  verifyPayment: vi.fn(),
  denyPayment: vi.fn(),
}))

vi.mock('../../../store/authStore', () => ({
  default: () => ({ user: { id: 'admin-123' } })
}))

import { verifyPayment, denyPayment } from '../../../services/paymentService'

const mockBooking = {
  id: 'book-1',
  reference_id: 'REF-BOOK-1',
  customer: { first_name: 'John', last_name: 'Doe' },
  downpayment_amount: 500,
  downpayment_status: 'pending',
  payments: [
    {
      id: 'pay-1',
      reference_number: 'GCASH-123',
      account_name: 'Jane Doe',
      amount: 500,
      receipt_url: 'http://example.com/receipt.jpg'
    }
  ]
}

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  booking: mockBooking,
  onUpdated: vi.fn(),
}

beforeEach(() => vi.clearAllMocks())

describe('PaymentVerificationModal', () => {
  it('renders booking and payment details correctly', () => {
    render(<PaymentVerificationModal {...defaultProps} />)
    expect(screen.getByText('REF-BOOK-1')).toBeInTheDocument()
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getAllByText('₱500.00').length).toBeGreaterThan(0)
    expect(screen.getByText('GCASH-123')).toBeInTheDocument()
  })

  it('shows Verify and Deny buttons when readOnly is false', () => {
    render(<PaymentVerificationModal {...defaultProps} readOnly={false} />)
    expect(screen.getByRole('button', { name: /Verify & Approve/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Deny/i })).toBeInTheDocument()
  })

  it('hides Verify and Deny buttons and shows informational note when readOnly is true', () => {
    render(<PaymentVerificationModal {...defaultProps} readOnly={true} />)
    expect(screen.queryByRole('button', { name: /Verify & Approve/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Deny/i })).not.toBeInTheDocument()
    expect(screen.getByText('Payment verification is handled by an admin.')).toBeInTheDocument()
  })

  it('calls verifyPayment when Verify is clicked', async () => {
    verifyPayment.mockResolvedValue({})
    render(<PaymentVerificationModal {...defaultProps} />)
    
    fireEvent.click(screen.getByRole('button', { name: /Verify & Approve/i }))
    
    await waitFor(() => {
      expect(verifyPayment).toHaveBeenCalledWith('pay-1', 'book-1', 'admin-123')
      expect(defaultProps.onUpdated).toHaveBeenCalled()
      expect(defaultProps.onClose).toHaveBeenCalled()
    })
  })

  it('calls denyPayment when Deny is clicked', async () => {
    denyPayment.mockResolvedValue({})
    render(<PaymentVerificationModal {...defaultProps} />)
    
    fireEvent.click(screen.getByRole('button', { name: /Deny/i }))
    
    await waitFor(() => {
      expect(denyPayment).toHaveBeenCalledWith('pay-1', 'book-1')
      expect(defaultProps.onUpdated).toHaveBeenCalled()
      expect(defaultProps.onClose).toHaveBeenCalled()
    })
  })
})
