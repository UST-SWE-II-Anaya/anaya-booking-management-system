import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import CreateAccountModal from './CreateAccountModal'

vi.mock('../../../services/staffService', () => ({
  inviteUser: vi.fn(),
}))

import { inviteUser } from '../../../services/staffService'

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  onSuccess: vi.fn(),
}

beforeEach(() => vi.clearAllMocks())

describe('CreateAccountModal', () => {
  it('renders form fields with Staff selected by default', () => {
    render(<CreateAccountModal {...defaultProps} />)
    expect(screen.getByPlaceholderText('First name')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Last name')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Email address')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Phone number (optional)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Staff' })).toHaveClass('bg-white')
  })

  it('switches to Admin when Admin toggle is clicked', () => {
    render(<CreateAccountModal {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Admin' }))
    expect(screen.getByRole('button', { name: 'Admin' })).toHaveClass('bg-white')
    expect(screen.getByRole('button', { name: 'Staff' })).not.toHaveClass('bg-white')
  })

  it('disables Send Invite when required fields are empty', () => {
    render(<CreateAccountModal {...defaultProps} />)
    expect(screen.getByRole('button', { name: 'Send Invite' })).toBeDisabled()
  })

  it('calls inviteUser with correct payload and triggers onSuccess then onClose', async () => {
    inviteUser.mockResolvedValue({ success: true })
    render(<CreateAccountModal {...defaultProps} />)

    fireEvent.change(screen.getByPlaceholderText('First name'), { target: { value: 'Maria' } })
    fireEvent.change(screen.getByPlaceholderText('Last name'), { target: { value: 'Cruz' } })
    fireEvent.change(screen.getByPlaceholderText('Email address'), { target: { value: 'maria@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send Invite' }))

    await waitFor(() => {
      expect(inviteUser).toHaveBeenCalledWith({
        firstName: 'Maria',
        lastName: 'Cruz',
        email: 'maria@example.com',
        phone: '',
        role: 'staff',
      })
      expect(defaultProps.onSuccess).toHaveBeenCalled()
      expect(defaultProps.onClose).toHaveBeenCalled()
    })
  })

  it('shows inline error when inviteUser fails', async () => {
    inviteUser.mockRejectedValue(new Error('An account with this email already exists'))
    render(<CreateAccountModal {...defaultProps} />)

    fireEvent.change(screen.getByPlaceholderText('First name'), { target: { value: 'Ana' } })
    fireEvent.change(screen.getByPlaceholderText('Last name'), { target: { value: 'Reyes' } })
    fireEvent.change(screen.getByPlaceholderText('Email address'), { target: { value: 'ana@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send Invite' }))

    await waitFor(() => {
      expect(screen.getByText('An account with this email already exists')).toBeInTheDocument()
    })
    expect(defaultProps.onClose).not.toHaveBeenCalled()
  })
})
