// src/pages/auth/LoginPage.test.jsx  (replace the existing file)
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../../services/authService', () => ({
  signIn: vi.fn(),
  getProfile: vi.fn(),
}))

import { signIn, getProfile } from '../../services/authService'
import LoginPage from './LoginPage'

const renderLogin = ({ portal } = {}) =>
  render(
    <MemoryRouter initialEntries={[portal ? `/login?portal=${portal}` : '/login']}>
      <LoginPage />
    </MemoryRouter>
  )

beforeEach(() => vi.clearAllMocks())

describe('LoginPage', () => {
  it('redirects admin role to /admin', async () => {
    signIn.mockResolvedValue({ user: { id: 'u1' } })
    getProfile.mockResolvedValue({ role: 'admin', account_status: 'active' })
    renderLogin({ portal: 'staff' })
    await userEvent.type(screen.getByLabelText(/email/i), 'admin@anaya.com')
    await userEvent.type(screen.getByLabelText(/password/i, { selector: 'input' }), 'pass')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/admin')
    )
  })

  it('redirects staff role to /staff', async () => {
    signIn.mockResolvedValue({ user: { id: 'u2' } })
    getProfile.mockResolvedValue({ role: 'staff', account_status: 'active' })
    renderLogin({ portal: 'staff' })
    await userEvent.type(screen.getByLabelText(/email/i), 'staff@anaya.com')
    await userEvent.type(screen.getByLabelText(/password/i, { selector: 'input' }), 'pass')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/staff')
    )
  })

  it('redirects to /account-inactive when account is suspended', async () => {
    signIn.mockResolvedValue({ user: { id: 'u3' } })
    getProfile.mockResolvedValue({ role: 'customer', account_status: 'suspended' })
    renderLogin()
    await userEvent.type(screen.getByLabelText(/email/i), 'suspended@anaya.com')
    await userEvent.type(screen.getByLabelText(/password/i, { selector: 'input' }), 'pass')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/account-inactive')
    )
  })

  it('shows error on failed login', async () => {
    signIn.mockRejectedValue(new Error('Invalid login credentials'))
    renderLogin()
    await userEvent.type(screen.getByLabelText(/email/i), 'bad@anaya.com')
    await userEvent.type(screen.getByLabelText(/password/i, { selector: 'input' }), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() =>
      expect(screen.getByText(/invalid login credentials/i)).toBeInTheDocument()
    )
  })
})
