// src/test/components/StaffStep.test.jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import StaffStep from '../../pages/customer/StaffStep'

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ to, children, className }) => <a href={to} className={className}>{children}</a>,
}))

vi.mock('../../store/bookingStore', () => ({
  default: () => ({
    cart: [{ id: 'svc-1', name: 'Massage' }],
    staffPreference: 'any',
    setStaffPreference: vi.fn(),
  }),
}))

vi.mock('../../components/customer/BookingSidebar', () => ({
  default: ({ onContinue, continueDisabled }) => (
    <button onClick={onContinue} disabled={continueDisabled}>Continue</button>
  ),
}))

describe('StaffStep', () => {
  it('renders exactly the 3 generic preference options', () => {
    render(<StaffStep />)
    expect(screen.getByText('Any professional')).toBeInTheDocument()
    expect(screen.getByText('Any female professional')).toBeInTheDocument()
    expect(screen.getByText('Any male professional')).toBeInTheDocument()
  })

  it('does not render a loading state or any staff-specific content', () => {
    render(<StaffStep />)
    expect(screen.queryByText(/Loading professionals/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/No specific professionals/i)).not.toBeInTheDocument()
  })
})
