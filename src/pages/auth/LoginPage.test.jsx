// src/pages/auth/LoginPage.test.jsx
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

import { signIn } from '../../services/authService'
import LoginPage from './LoginPage'

const renderLogin = () =>
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  )

beforeEach(() => vi.clearAllMocks())

describe('LoginPage', () => {
  it('renders email and password inputs', () => {
    renderLogin()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('shows error when non-admin logs in', async () => {
    signIn.mockResolvedValue({
      user: { id: 'x' },
      session: {},
    })
    renderLogin()
    await userEvent.type(screen.getByLabelText(/email/i), 'staff@anaya.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/admin'))
  })

  it('shows error message on failed login', async () => {
    signIn.mockRejectedValue(new Error('Invalid login credentials'))
    renderLogin()
    await userEvent.type(screen.getByLabelText(/email/i), 'bad@anaya.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'wrongpass')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() =>
      expect(screen.getByText(/invalid login credentials/i)).toBeInTheDocument()
    )
  })
})
