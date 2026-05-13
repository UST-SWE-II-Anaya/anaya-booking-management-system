// src/components/admin/accounts/DeactivateAccountModal.test.jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DeactivateAccountModal from './DeactivateAccountModal'

const baseProps = {
  open: true,
  onClose: vi.fn(),
  onConfirm: vi.fn(),
  userName: 'Jane Doe',
  userRole: 'customer',
  action: 'suspend',
}

describe('DeactivateAccountModal', () => {
  it('renders user name and role in subtitle', () => {
    render(<DeactivateAccountModal {...baseProps} />)
    expect(screen.getByText(/Jane Doe/)).toBeInTheDocument()
    expect(screen.getByText(/customer/i)).toBeInTheDocument()
  })

  it('confirm button is disabled when reason is empty', () => {
    render(<DeactivateAccountModal {...baseProps} />)
    expect(screen.getByRole('button', { name: /confirm suspension/i })).toBeDisabled()
  })

  it('confirm button enables after typing a reason', () => {
    render(<DeactivateAccountModal {...baseProps} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'No-shows' } })
    expect(screen.getByRole('button', { name: /confirm suspension/i })).not.toBeDisabled()
  })

  it('calls onConfirm with trimmed reason', () => {
    const onConfirm = vi.fn()
    render(<DeactivateAccountModal {...baseProps} onConfirm={onConfirm} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  No-shows  ' } })
    fireEvent.click(screen.getByRole('button', { name: /confirm suspension/i }))
    expect(onConfirm).toHaveBeenCalledWith('No-shows')
  })

  it('clears reason and calls onClose when cancel is clicked', () => {
    const onClose = vi.fn()
    render(<DeactivateAccountModal {...baseProps} onClose={onClose} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'some reason' } })
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('renders nothing when open is false', () => {
    render(<DeactivateAccountModal {...baseProps} open={false} />)
    expect(screen.queryByText(/Jane Doe/)).not.toBeInTheDocument()
  })
})
